import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
// Fix: Corrected a typo in the type import from 'ValidateAndValidatePayload' to 'ValidateAndArchivePayload'.
import type { Conversation, Message, Attachment, Mode, Label, WeekRouteInfo, WeekPlan, BlockDetails, Student, Notebook, PlanningActionPayload, GroupDefinition, Evaluation, AdaAnalysis, ToolkitShortcut, ValidateAndArchivePayload, ToolkitCategory, BlockStatus, LessonState } from '../types';
import TurndownService from 'turndown';
import { GoogleGenAI } from '@google/genai';
import CryptoJS from 'crypto-js';

// Components
import Sidebar from './Sidebar';
import ChatView from './ChatView';
import PlanningView from './PlanningView';
import StudentRosterView from './StudentRosterView';
import NotebookLMView from './NotebookLMView';
import InAulaView from './InAulaView';
import StudentProfileView from './StudentProfileView';
import ClassroomTrendView from './ClassroomTrendView';
import FoundingDocumentsView from './FoundingDocumentsView';
import StrategicDashboardView from './StrategicDashboardView';
import ToolkitView from './ToolkitView';
import LobbyView from './LobbyView';
import GroupsArchiveView from './GroupsArchiveView';
import Toast from './Toast';
// Modals
import ContextModal from './MasterContextModal';
import ImageGenerationModal from './ImageGenerationModal';
import LabelManagementModal from './LabelManagementModal';
import AssignLabelsModal from './AssignLabelsModal';
import AddNotebookModal from './AddNotebookModal';
import ManageNotesModal from './ManageNotesModal';
import ConfirmationModal from './ConfirmationModal';
import PasswordPromptModal from './PasswordPromptModal';
import ImportEvaluationModal from './ImportEvaluationModal';
import BlockDayDefaultsModal from './BlockDayDefaultsModal';
// Hooks
import { useConversations } from '../hooks/useConversations';
import { useLabels } from '../hooks/useLabels';
import { useStudents } from '../hooks/useStudents';
import { useNotebooks } from '../hooks/useNotebooks';
import { useToolkitShortcuts } from '../hooks/useToolkitShortcuts';
import { useToolkitCategories } from '../hooks/useToolkitCategories';
import { useConstitutionCache } from '../contexts/ConstitutionCacheContext';
import { useMasterContext } from '../hooks/useMasterContext';
import { usePlanning } from '../hooks/usePlanning';
// Services
import * as db from '../services/db';
import * as GeminiService from '../services/gemini';
// Utils & Constants
import { parseRouteContext, parseCrewContextToNames, generateExportContent, fileToAttachment, generateCourseBookHtml } from '../utils';
import { 
    AUTO_LABELS,
    DEFAULT_SYSTEM_INSTRUCTION,
    DEFAULT_TEACHER_PROFILE,
    GEMINI_API_ERROR_MESSAGE, MODES,
    ADA_QUICK_CHAT_ID,
} from '../constants';
import LessonNotesModal from './LessonNotesModal';
import GroupWorkSummary from './GroupWorkSummary';

interface MainAppProps {
  masterContext: ReturnType<typeof useMasterContext>;
  onOpenApiSettings: () => void;
}

const MainApp: React.FC<MainAppProps> = ({ masterContext, onOpenApiSettings }) => {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'info') => setToast({ message, type }), []);
  
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const latestRequestRef = useRef<symbol | null>(null);

  const {
    conversations, activeConversationId, setConversations, 
    handleNewConversation: newConversationHook,
    handleSelectConversation: selectConversationHook,
    handleRenameConversation, handleDeleteConversation,
    handleReorderConversations, updateMessageInConversation, addMessageToConversation,
    updateConversation, updateConversationTitle, updateConversationLabels, conversationsRef,
  } = useConversations(showToast);
  
  const { labels, addLabel, updateLabel, deleteLabel, getOrCreateLabelsByName } = useLabels(showToast);
  const { students, syncStudentsWithContext, addEvaluationToStudent, recordAttendanceForBlock, updateStudentNotes, updateStudentSummary } = useStudents(masterContext.crewContext);
  const { notebooks, addNotebook, updateNotebook, removeNotebook, accessNotebook } = useNotebooks(showToast);
  const { shortcuts, addShortcut, updateShortcut, deleteShortcut, bulkUpdateShortcuts } = useToolkitShortcuts(showToast);
  const { categories, addCategory, updateCategory, deleteCategory, bulkUpdateCategories } = useToolkitCategories(showToast);

  const { processPlanningMessage, handleReEditBlock: reEditBlockHandler } = usePlanning(updateConversation, showToast, recordAttendanceForBlock, addEvaluationToStudent);

  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'lobby' | 'chat' | 'roster' | 'notebooklm' | 'lezione_in_corso' | 'archivio_lezioni' | 'student_profile' | 'classroom_trend' | 'founding_documents' | 'toolkit' | 'strategic_dashboard' | 'groups_archive'>('lobby');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [initialPlanningTab, setInitialPlanningTab] = useState<'laboratorio' | 'contenutoMaster' | null>(null);
  const [analysisLoadingBlockId, setAnalysisLoadingBlockId] = useState<string | null>(null);


  // --- Modal States ---
  const [modalState, setModalState] = useState({
    instructions: false,
    teacherProfile: false,
    image: false, labelManagement: false, addNotebook: false,
    exportPassword: false, importPassword: false, importConfirm: false,
    blockDayDefaults: false,
  });
  const [assignLabelsConversation, setAssignLabelsConversation] = useState<Conversation | null>(null);
  const [notebookToEdit, setNotebookToEdit] = useState<Partial<Notebook> | null>(null);
  const [notebookForNotes, setNotebookForNotes] = useState<Notebook | null>(null);
  const [notebookSuggestion, setNotebookSuggestion] = useState<{title: string} | null>(null);
  const [lessonNotesModalInfo, setLessonNotesModalInfo] = useState<{ convoId: string; blockIndex: number; initialNotes: string; } | null>(null);
  const [studentForEvaluationImport, setStudentForEvaluationImport] = useState<Student | null>(null);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [dataToRestore, setDataToRestore] = useState<db.BackupData | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [confirmationProps, setConfirmationProps] = useState<any | null>(null);

  const { modules } = useConstitutionCache();


  useEffect(() => {
    syncStudentsWithContext();
  }, [masterContext.crewContext, syncStudentsWithContext]);

  useEffect(() => {
    // Controlla se la "nota adesiva" dal ripristino esiste
    if (sessionStorage.getItem('backupRestored') === 'true') {
      
      // Se esiste, come prima cosa, buttala via per non vederla più
      sessionStorage.removeItem('backupRestored');
      
      // Ora, e solo ora, mostra il messaggio di successo all'utente
      showToast('Backup ripristinato con successo!', 'success');
    }
  }, []); // L'array vuoto [] assicura che questo codice venga eseguito solo una volta
  
  // Effect for Automatic Lifecycle Label Management
  useEffect(() => {
    // This effect ensures that each week-plan conversation has the correct "status" label
    // (e.g., "In Progettazione", "Completata") based on its `weekPlan.status`.
    // The logic is designed to be resilient against duplicate or legacy auto-labels by:
    // 1. Ensuring all canonical auto-labels exist in the database.
    // 2. For each conversation, removing ALL possible auto-labels.
    // 3. Adding back only the SINGLE, correct, canonical auto-label that matches the current week status.
    // This prevents label duplication and keeps the state consistent.
    const autoLabelNames = Object.values(AUTO_LABELS).map(l => l.name);

    // 1. Check if all required auto labels exist in the state.
    const allLabelsExist = autoLabelNames.every(name =>
        labels.some(l => l.name.toLowerCase() === name.toLowerCase())
    );

    // 2. If labels are missing, create them and stop. The effect will re-run once the `labels` state updates.
    if (!allLabelsExist) {
        getOrCreateLabelsByName(autoLabelNames);
        return;
    }
    
    // Find ALL labels that match auto-label names, including potential duplicates from race conditions.
    const allAutoLabelsInState = labels.filter(l => 
        autoLabelNames.some(name => name.toLowerCase() === l.name.toLowerCase())
    );
    const allAutoLabelIdsInState = allAutoLabelsInState.map(l => l.id);

    // Find the CANONICAL auto-labels (the first one of each name) to be used for adding.
    const canonicalAutoLabels = autoLabelNames.map(name => 
        labels.find(l => l.name.toLowerCase() === l.name.toLowerCase())
    ).filter((l): l is Label => !!l);
    
    // Defensive check: if canonical labels aren't found yet, wait for next render.
    if (canonicalAutoLabels.length !== autoLabelNames.length) return;

    let needsUpdate = false;
    const updatedConvos = conversations.map(c => {
        if (!c.weekPlan) return c; // Only for week plans

        const status = c.weekPlan.status;
        let targetLabelName: string | null = null;
        switch (status) {
            case 'in progettazione': targetLabelName = AUTO_LABELS.PLANNING.name; break;
            case 'progettazione completata':
            case 'in corso': // A week in progress is considered planned
                 targetLabelName = AUTO_LABELS.PLANNED.name; break;
            case 'completata': targetLabelName = AUTO_LABELS.COMPLETED.name; break;
        }

        const currentLabelIds = c.labelIds ?? [];
        const canonicalTargetLabel = targetLabelName ? canonicalAutoLabels.find(l => l.name === targetLabelName) : null;
        
        // This is the core of the fix: filter out ALL auto labels, leaving only manual ones.
        const manualIds = currentLabelIds.filter(id => !allAutoLabelIdsInState.includes(id));
        
        // This is the list of labels the conversation *should* have.
        const correctIds = canonicalTargetLabel ? [...manualIds, canonicalTargetLabel.id] : manualIds;

        // Compare the current set of labels with the correct one to see if an update is needed.
        // This prevents unnecessary re-renders and handles cleanup.
        const currentIdsSet = new Set(currentLabelIds);
        const correctIdsSet = new Set(correctIds);

        if (currentIdsSet.size !== correctIdsSet.size || !correctIds.every(id => currentIdsSet.has(id))) {
            needsUpdate = true;
            return { ...c, labelIds: Array.from(correctIdsSet) };
        }
        
        return c;
    });
    
    if (needsUpdate) {
        setConversations(updatedConvos);
    }
  }, [conversations, labels, getOrCreateLabelsByName, setConversations]);


  const activeConversation = useMemo(() => conversations.find(c => c.id === activeConversationId) ?? null, [conversations, activeConversationId]);
  const availableWeeks = useMemo(() => parseRouteContext(masterContext.routeContext), [masterContext.routeContext]);

  const handleDistillContext = useCallback(async (textToDistill: string): Promise<string> => {
    try {
        const distilledText = await GeminiService.distillText(textToDistill);
        showToast('Contesto distillato con successo!', 'success');
        return distilledText;
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Errore sconosciuto';
        console.error("Failed to distill context:", error);
        showToast(errorMessage, 'error');
        throw error;
    }
  }, [showToast]);

  const getOrCreateConversationForWeek = useCallback((weekInfo: WeekRouteInfo): Conversation => {
    const existingConversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekInfo.weekNumber);
    if (existingConversation) return existingConversation;

    const studentNames = parseCrewContextToNames(masterContext.crewContext);
    const weekStudents = studentNames.map(name => {
      const existingStudent = students.find(s => s.name === name);
      return { id: existingStudent?.id || `student-stub-${Date.now()}-${Math.random()}`, name: name };
    });

    const weekPlan: WeekPlan = {
      ...weekInfo, theme: 'Tema da definire', status: 'in progettazione',
      students: weekStudents, activeBlockIndex: 0,
      blocks: Array.from({ length: weekInfo.totalBlocks }, (_, i) => ({
        id: `block-${i}-${Date.now()}`, 
        day: 'Giorno da definire', 
        status: 'da definire', 
        messages: [],
      })),
    };

    const newConversation: Conversation = {
      id: `conv-week-${weekInfo.weekNumber}-${Date.now()}`, title: `Settimana ${weekInfo.weekNumber}`,
      messages: [], weekPlan,
    };
    
    setConversations([newConversation, ...conversationsRef.current]);
    return newConversation;
  }, [masterContext.crewContext, students, setConversations, conversationsRef]);

  const handleSetWeekTheme = useCallback((weekInfo: WeekRouteInfo, theme: string) => {
      let conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekInfo.weekNumber);
      if (!conversation) {
        conversation = getOrCreateConversationForWeek(weekInfo);
      }
      
      if (conversation.weekPlan?.theme === theme) return;
      
      updateConversation(conversation.id, c => ({
          ...c,
          weekPlan: { ...c.weekPlan!, theme: theme || 'Tema da definire' }
      }));
  }, [getOrCreateConversationForWeek, updateConversation, conversationsRef]);
  
  const handleUpdateWeekTheme = useCallback((weekNumber: number, theme: string) => {
    const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
    if (weekInfo) {
        handleSetWeekTheme(weekInfo, theme);
    } else {
        console.warn(`Attempted to update theme for non-existent week number: ${weekNumber}`);
    }
  }, [availableWeeks, handleSetWeekTheme]);

  const handleUpdateBlockObjective = useCallback((weekNumber: number, blockIndex: number, objective: string) => {
      let conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
      
      if (!conversation) {
          const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
          if (!weekInfo) {
              console.warn(`Attempted to update objective for non-existent week number: ${weekNumber}`);
              return;
          }
          conversation = getOrCreateConversationForWeek(weekInfo);
      }
      
      if (conversation.weekPlan) {
          const newBlocks = [...conversation.weekPlan.blocks];
          if (newBlocks[blockIndex]) {
              newBlocks[blockIndex] = { ...newBlocks[blockIndex], objective: objective };
              updateConversation(conversation.id, c => ({
                  ...c,
                  weekPlan: { ...c.weekPlan!, blocks: newBlocks }
              }));
          } else {
              console.warn(`Attempted to update objective for non-existent block index: ${blockIndex} in week ${weekNumber}`);
          }
      }
  }, [conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek]);

  const handleGenerateStrategicSuggestions = useCallback(async (prompt: string, module: string, pillar: string | null): Promise<{ theme: string; objectives: string[]; reasoning: string; }> => {
      setIsLoading(true);
      try {
          const moduleDetails = modules.find(m => m.name === module);
          const moduleContext = moduleDetails ? `${moduleDetails.name}\nRuolo: ${moduleDetails.role}\nSignificato: ${moduleDetails.significance}` : module;
          let pillarContext: string | null = null;
          if (moduleDetails && pillar) {
              const allPillars = [...moduleDetails.sintonizzazione.map(p => p.name), ...moduleDetails.operativi.map(p => p.name), ...moduleDetails.attivitaChiave];
              if (allPillars.includes(pillar)) {
                  pillarContext = pillar;
              }
          }

          const result = await GeminiService.generateStrategicSuggestions(prompt, moduleContext, pillarContext);
          showToast('Suggerimenti strategici generati!', 'success');
          return result;
      } catch (error) {
          console.error("Failed to generate strategic suggestions:", error);
          showToast(error instanceof Error ? error.message : "Errore durante la generazione dei suggerimenti.", 'error');
          throw error;
      } finally {
          setIsLoading(false);
      }
  }, [modules, showToast]);

  const handleUpdateStrategicData = useCallback((weekNumber: number, theme: string, objectives: string[]) => {
      let conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
      
      if (!conversation) {
          const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
          if (!weekInfo) {
              console.warn(`Attempted to update strategic data for non-existent week number: ${weekNumber}`);
              return;
          }
          conversation = getOrCreateConversationForWeek(weekInfo);
      }

      if (conversation.weekPlan) {
          const newBlocks = [...conversation.weekPlan.blocks];
          objectives.forEach((obj, index) => {
              if (newBlocks[index] && obj) {
                  newBlocks[index] = { ...newBlocks[index], objective: obj };
              }
          });

          updateConversation(conversation.id, c => ({
              ...c,
              weekPlan: { 
                  ...c.weekPlan!,
                  theme: theme || 'Tema da definire',
                  blocks: newBlocks,
              }
          }));
      }
  }, [conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek]);

  const handleGenerateBlockDetails = useCallback(async (weekNumber: number, blockIndex: number) => {
    const conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
    if (!conversation?.weekPlan) return;
    const block = conversation.weekPlan.blocks[blockIndex];
    const theme = conversation.weekPlan.theme;

    if (!block.objective) {
      showToast("Definisci prima l'obiettivo del blocco.", 'error');
      return;
    }
    
    try {
      const details = await GeminiService.generateBlockDetails(block.objective, theme);
      updateConversation(conversation.id, c => {
        const newBlocks = [...c.weekPlan!.blocks];
        newBlocks[blockIndex] = { ...newBlocks[blockIndex], ...details };
        return { ...c, weekPlan: { ...c.weekPlan!, blocks: newBlocks } };
      });
      showToast('Dettagli del blocco generati con AI!', 'success');
    } catch (error) {
      console.error("Failed to generate block details:", error);
      showToast(error instanceof Error ? error.message : 'Errore nella generazione dei dettagli.', 'error');
    }
  }, [conversationsRef, showToast, updateConversation]);

  const handleUpdateWeekDetails = useCallback((weekNumber: number, details: Partial<Pick<WeekPlan, 'notes'>>) => {
    const conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
    if (conversation?.weekPlan) {
      updateConversation(conversation.id, c => ({
        ...c, weekPlan: { ...c.weekPlan!, ...details }
      }));
    }
  }, [conversationsRef, updateConversation]);

  const handleUpdateBlockDetails = useCallback((weekNumber: number, blockIndex: number, details: Partial<Pick<BlockDetails, 'lessonTitle' | 'lessonSyllabus' | 'lessonMaterials' | 'isLocked'>>) => {
      let conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
      
      if (!conversation) {
          const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
          if (!weekInfo) {
              console.warn(`Attempted to update details for non-existent week number: ${weekNumber}`);
              return;
          }
          conversation = getOrCreateConversationForWeek(weekInfo);
      }
      
      if (conversation.weekPlan) {
          updateConversation(conversation.id, c => {
            const newBlocks = [...c.weekPlan!.blocks];
            if (newBlocks[blockIndex]) {
                newBlocks[blockIndex] = { ...newBlocks[blockIndex], ...details };
            }
            return { ...c, weekPlan: { ...c.weekPlan!, blocks: newBlocks } };
          });
      }
  }, [conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek]);
  

  const handleUpdateBlockModuleAndPillar = useCallback((weekNumber: number, blockIndex: number, module: string, pillar: string, lessonTitle: string) => {
    let conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);

    if (!conversation) {
        const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
        if (!weekInfo) {
            console.warn(`Attempted to update for non-existent week number: ${weekNumber}`);
            return;
        }
        conversation = getOrCreateConversationForWeek(weekInfo);
    }
    
    if (conversation.weekPlan) {
        updateConversation(conversation.id, c => {
            const newBlocks = [...c.weekPlan.blocks];
            if (newBlocks[blockIndex]) {
                newBlocks[blockIndex] = { ...newBlocks[blockIndex], module, pillar, lessonTitle };
            }
            return { ...c, weekPlan: { ...c.weekPlan!, blocks: newBlocks } };
        });
    }
  }, [conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek]);

  const handleUpdateBlockStatus = useCallback((weekNumber: number, blockIndex: number, status: BlockStatus, reason?: string) => {
    const existingConvo = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);

    const updateBlockInConversation = (c: Conversation) => {
        if (!c.weekPlan) return c;
        const newBlocks = [...c.weekPlan.blocks];
        if (newBlocks[blockIndex]) {
            const updatedBlock = { ...newBlocks[blockIndex], status, reason: reason || undefined };
            if (status === 'normale') {
                delete updatedBlock.reason;
            }
            newBlocks[blockIndex] = updatedBlock;
        }
        return { ...c, weekPlan: { ...c.weekPlan!, blocks: newBlocks } };
    };

    if (existingConvo) {
        updateConversation(existingConvo.id, updateBlockInConversation);
    } else {
        const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
        if (!weekInfo) {
            console.error(`Cannot create and update status for non-existent week: ${weekNumber}`);
            return;
        }

        const newConversation = getOrCreateConversationForWeek(weekInfo);
        
        // Use a functional update to ensure we're updating the just-created conversation
        updateConversation(newConversation.id, updateBlockInConversation);
    }
  }, [availableWeeks, updateConversation, conversationsRef, getOrCreateConversationForWeek]);

  const handleUpdateBlockInConversation = useCallback((convoId: string, blockIndex: number, updatedBlockData: Partial<BlockDetails>) => {
    updateConversation(convoId, convo => {
        if (!convo.weekPlan) return convo;
        const newBlocks = [...convo.weekPlan.blocks];
        if (newBlocks[blockIndex]) {
            newBlocks[blockIndex] = { ...newBlocks[blockIndex], ...updatedBlockData };
        }
        return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
  }, [updateConversation]);


  const handleModeChange = useCallback((newModeId: Mode['id']) => {
    const newMode = MODES.find(m => m.id === newModeId);
    if (!newMode || newMode.id === masterContext.currentModeId) return;
    masterContext.handleSaveMode(newModeId);
    if (activeConversationId) {
      addMessageToConversation(activeConversationId, {
        id: `msg-mode-${Date.now()}`, role: 'assistant', content: newMode.introMessage,
      });
    }
    showToast(`Modalità cambiata in: ${newMode.label}`, 'info');
  }, [activeConversationId, masterContext.currentModeId, masterContext.handleSaveMode, showToast, addMessageToConversation]);

  // Versione senza messaggio di intro: usata nel Laboratorio di pianificazione,
  // dove i messaggi vivono per-blocco e un messaggio di sistema sarebbe fuori posto.
  const handlePlanningModeChange = useCallback((newModeId: Mode['id']) => {
    const newMode = MODES.find(m => m.id === newModeId);
    if (!newMode || newMode.id === masterContext.currentModeId) return;
    masterContext.handleSaveMode(newModeId);
    showToast(`Modalità: ${newMode.label}`, 'info');
  }, [masterContext.currentModeId, masterContext.handleSaveMode, showToast]);
  
  const handleSelectConversation = useCallback((id: string) => {
    selectConversationHook(id);
    setView('chat');
  }, [selectConversationHook]);

  // Conversa con Ada — chat singola fissa, non cancellabile
  const handleOpenConversaConAda = useCallback(() => {
    const existing = conversationsRef.current.find(c => c.id === ADA_QUICK_CHAT_ID);
    if (!existing) {
      const quickChat: Conversation = {
        id: ADA_QUICK_CHAT_ID,
        title: 'Conversa con Ada',
        messages: [],
        labelIds: [],
      };
      // Aggiunge in testa senza cancellare le altre conversazioni
      setConversations([quickChat, ...conversationsRef.current]);
    }
    handleSelectConversation(ADA_QUICK_CHAT_ID);
  }, [conversationsRef, setConversations, handleSelectConversation]);

  const handleStartPlanningForWeek = useCallback((weekInfo: WeekRouteInfo) => {
      const conversation = getOrCreateConversationForWeek(weekInfo);
      handleSelectConversation(conversation.id);
  }, [getOrCreateConversationForWeek, handleSelectConversation]);
  
  const handleEvaluationMessage = useCallback((conversation: Conversation, userInput: string) => {
    if (!conversation.studentId) return;

    if (conversation.evaluationState === 'AWAITING_VALUE') {
        const tempEvaluation = { date: new Date().toISOString(), value: userInput, notes: '' };
        updateConversation(conversation.id, { evaluationState: 'AWAITING_NOTES', tempEvaluation });
        addMessageToConversation(conversation.id, { id: `msg-ada-${Date.now()}`, role: 'assistant', content: 'Ottimo. Vuoi aggiungere delle note a questa valutazione?' });
    } else if (conversation.evaluationState === 'AWAITING_NOTES' && conversation.tempEvaluation) {
        const evaluation: Evaluation = {
            ...conversation.tempEvaluation,
            date: conversation.tempEvaluation.date!,
            value: conversation.tempEvaluation.value!,
            notes: userInput.trim(),
        };
        addEvaluationToStudent(conversation.studentId, evaluation);

        updateConversation(conversation.id, c => {
            const newConvo = { ...c };
            delete newConvo.evaluationState;
            delete newConvo.tempEvaluation;
            return newConvo;
        });

        addMessageToConversation(conversation.id, { id: `msg-ada-${Date.now()}`, role: 'assistant', content: 'Valutazione registrata con successo nella scheda della studentessa.' });
        showToast('Valutazione salvata!', 'success');
    }
  }, [addEvaluationToStudent, updateConversation, addMessageToConversation, showToast]);

  const handleSendMessage = useCallback(async (content: string, file?: File) => {
    if (!activeConversationId) {
        showToast("Seleziona una conversazione prima di inviare un messaggio.", "info");
        return;
    }
    const activeConvo = conversationsRef.current.find(c => c.id === activeConversationId);
    if (!activeConvo || activeConvo.weekPlan) return;
    
    setIsLoading(true);
    const currentRequestId = Symbol("gemini-request");
    latestRequestRef.current = currentRequestId;
    
    const attachmentForMessage = file ? await fileToAttachment(file) : undefined;
    const userMessage: Message = { id: `msg-user-${Date.now()}`, role: 'user', content, attachment: attachmentForMessage };
    const assistantPlaceholder: Message = { id: `msg-assistant-${Date.now()}`, role: 'assistant', content: '...' };

    updateConversation(activeConvo.id, convo => ({ ...convo, messages: [...convo.messages, userMessage, assistantPlaceholder] }));

    if (activeConvo.messages.length <= 1) {
        const titlePrompt = content || (file ? `Analizza il file: ${file.name}` : 'Nuova chat');
        GeminiService.generateTitle(titlePrompt)
            .then(newTitle => {
                if (latestRequestRef.current === currentRequestId) updateConversationTitle(activeConvo.id, newTitle);
            })
            .catch(err => {
                console.error("Failed to generate title:", err);
                // Non-critical, so we don't show a toast, just log it.
            });
    }

    if (content.trim().toLowerCase() === '/valuta' && activeConvo.studentId) {
        updateConversation(activeConvo.id, { evaluationState: 'AWAITING_VALUE' });
        updateMessageInConversation(activeConvo.id, assistantPlaceholder.id, { content: "Inserisci la valutazione (es. 'Ottimo', 'In recupero', '7/10')." });
        setIsLoading(false);
        return;
    }
     if (activeConvo.evaluationState) {
        handleEvaluationMessage(activeConvo, content);
        updateConversation(activeConvo.id, c => ({ ...c, messages: c.messages.filter(m => m.id !== assistantPlaceholder.id) }));
        setIsLoading(false);
        return;
    }

    try {
      const responseStream = await GeminiService.streamChatResponse(
        activeConvo.messages, content, attachmentForMessage, masterContext, masterContext.currentModeId, useGoogleSearch, conversations, availableWeeks, undefined, students
      );

      let accumulatedResponse = "", finalSources: any[] = [];
      for await (const chunk of responseStream) {
          if (latestRequestRef.current !== currentRequestId) return; 
          accumulatedResponse += (chunk.text ?? '');
          if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
              finalSources = chunk.candidates[0].groundingMetadata.groundingChunks.filter(c => c.web && c.web.uri).map(c => ({ uri: c.web!.uri, title: c.web!.title || c.web!.uri }));
          }
          updateMessageInConversation(activeConvo.id, assistantPlaceholder.id, { content: accumulatedResponse, sources: finalSources });
      }
    } catch(e) {
      if (latestRequestRef.current === currentRequestId) {
        console.error("Error calling Gemini API:", e);
        let errorString = GEMINI_API_ERROR_MESSAGE;
        if (e instanceof Error) {
            errorString = e.message;
        } else if (e && typeof e === 'object' && 'message' in e) {
            errorString = String(e.message);
        } else {
            try { errorString = JSON.stringify(e); } catch {}
        }
        
        const finalErrorMessage = `**Errore API:**\n\n\`\`\`\n${errorString}\n\`\`\``;
        updateMessageInConversation(activeConvo.id, assistantPlaceholder.id, { content: finalErrorMessage });
        showToast(errorString, 'error');
      }
    } finally {
       if (latestRequestRef.current === currentRequestId) setIsLoading(false);
    }
  }, [activeConversationId, showToast, masterContext, useGoogleSearch, students, updateConversation, updateConversationTitle, updateMessageInConversation, handleEvaluationMessage, conversationsRef, conversations, availableWeeks]);

  const handleGenerateImage = useCallback(async (prompt: string, aspectRatio: string, numberOfImages: number, adaStyle: boolean) => {
    if (!activeConversationId) { showToast("Seleziona una conversazione.", "info"); return; }
    const currentRequestId = Symbol("gemini-image-request");
    latestRequestRef.current = currentRequestId;
    setIsLoading(true);
    setModalState(s => ({ ...s, image: false }));

    addMessageToConversation(activeConversationId, { id: `msg-${Date.now()}`, role: 'user', content: `Genera immagine: "${prompt}"` });
    const assistantPlaceholderId = `msg-${Date.now() + 1}`;
    addMessageToConversation(activeConversationId, { id: assistantPlaceholderId, role: 'assistant', content: 'Sto creando la tua immagine...' });

    try {
        const imageBase64Urls = await GeminiService.generateImages(prompt, aspectRatio, numberOfImages, adaStyle);
        if (latestRequestRef.current !== currentRequestId) return;
        updateMessageInConversation(activeConversationId, assistantPlaceholderId, {
            content: `Ecco le immagini create per: "${prompt}"`, generatedImages: imageBase64Urls,
        });
        showToast("Immagini generate!", "success");
    } catch (error) {
        if (latestRequestRef.current === currentRequestId) {
            const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto durante la generazione dell'immagine.";
            console.error("Error generating image:", error);
            showToast(errorMessage, "error");
            updateMessageInConversation(activeConversationId, assistantPlaceholderId, { content: `Impossibile generare l'immagine: ${errorMessage}` });
        }
    } finally {
        if (latestRequestRef.current === currentRequestId) setIsLoading(false);
    }
  }, [activeConversationId, showToast, addMessageToConversation, updateMessageInConversation]);
  
  const handleSendPlanningMessage = useCallback(async (content: string, file?: File, actionPayload?: PlanningActionPayload) => {
    if (!activeConversation) return;

    // If the user types the command, convert it to an action payload.
    if (content.trim().toLowerCase() === '/valida contenuto' && !actionPayload) {
        const block = activeConversation.weekPlan?.blocks[activeConversation.weekPlan.activeBlockIndex];
        const lastAssistantMessage = (block?.messages || [])
            .filter(m => m.role === 'assistant' && m.content && m.content !== '...' && m.actions)
            .pop();
        
        if (!lastAssistantMessage) {
            showToast("Non c'è una risposta dell'assistente da validare.", "error");
            return; // Don't proceed
        }

        // Create the action payload to trigger the validation logic
        actionPayload = {
            action: 'validate_and_archive',
            messageId: lastAssistantMessage.id,
        };
    }

    const currentRequestId = Symbol("gemini-planning-request");
    latestRequestRef.current = currentRequestId;
    setIsLoading(true);

    try {
      await processPlanningMessage({
        content,
        file,
        actionPayload,
        activeConversation,
        masterContext,
        currentModeId: masterContext.currentModeId,
        students,
        useGoogleSearch,
        conversations,
        availableWeeks,
      });
    } catch(e) {
      if (latestRequestRef.current === currentRequestId) {
        console.error("Error in planning flow:", e);
        const errorMessage = e instanceof Error ? e.message : "Si è verificato un errore durante la pianificazione.";
        showToast(errorMessage, 'error');
      }
    } finally {
       if (latestRequestRef.current === currentRequestId) setIsLoading(false);
    }
  }, [activeConversation, masterContext, students, processPlanningMessage, showToast, useGoogleSearch, conversations, availableWeeks]);

  const handleUpdateWeekPlan = useCallback((updater: (plan: WeekPlan) => WeekPlan) => {
    if (activeConversationId) {
        updateConversation(activeConversationId, (conversation) => {
            if (!conversation.weekPlan) return conversation;
            return { ...conversation, weekPlan: updater(conversation.weekPlan) };
        });
    }
  }, [activeConversationId, updateConversation]);

  const handleOpenAddNotebookModal = useCallback((data?: Partial<Notebook>) => {
    setNotebookToEdit(data || null);
    setModalState(s => ({...s, addNotebook: true}));
  }, []);

  const handleExportContent = useCallback(async (plan: WeekPlan, block: BlockDetails, blockIndex: number, format: string) => {
      if (format === 'document') {
          const htmlBody = (block.contentBlocks || [])
              .map(cb => cb.content)
              .join('<hr style="border: 0; height: 1px; background-image: linear-gradient(to right, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)); margin: 2em 0;" />');

          const fullHtml = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${plan.theme} - Blocco ${blockIndex + 1}</title>
  <style>
    body { font-family: 'Lora', serif; line-height: 1.7; color: #1f2937; max-width: 21cm; margin: 2rem auto; padding: 2.54cm; }
    h1, h2, h3 { font-family: sans-serif; }
    h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.17em; }
    blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; font-style: italic; color: #4b5563; }
    a { color: #2563eb; }
  </style>
</head>
<body>
<h1>Settimana ${plan.weekNumber}: ${plan.theme}</h1>
<h2>Blocco ${blockIndex + 1} - ${block.day}: ${block.objective || ''}</h2>
<hr>
${htmlBody}
</body>
</html>`;
          
          const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = `documento_blocco_${blockIndex + 1}.html`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          showToast("Documento HTML esportato!", "success");
          return;
      }

      if (!block.contentBlocks || block.contentBlocks.length === 0) {
          showToast("Nessun contenuto da esportare per questo blocco.", "error");
          return;
      }
      setIsLoading(true);
      showToast(`Sto generando l'esportazione come ${format}...`, "info");
      try {
          const { prompt, filename } = generateExportContent(plan, block, blockIndex, format);
          const exportedText = await GeminiService.distillText(prompt);
          
          const blob = new Blob([exportedText], { type: format === 'notebooklm' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          showToast("Esportazione completata!", "success");

          if (format === 'notebooklm') {
              setNotebookSuggestion({ title: `Settimana ${plan.weekNumber} - ${plan.theme}` });
          }

      } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto durante l'esportazione.";
          console.error("Export failed:", error);
          showToast(errorMessage, "error");
      } finally {
          setIsLoading(false);
      }
  }, [showToast]);

  const handleDeleteLabel = useCallback((labelId: string) => {
    deleteLabel(labelId);
    const updatedConvos = conversationsRef.current.map(c => ({ ...c, labelIds: c.labelIds?.filter(id => id !== labelId) }));
    setConversations(updatedConvos);
    showToast('Etichetta eliminata e rimossa da tutte le conversazioni.', 'success');
  }, [deleteLabel, setConversations, showToast, conversationsRef]);

  const handleReEditBlock = useCallback((convoId: string, blockIndex: number) => {
     reEditBlockHandler(convoId, blockIndex);
     setView('chat'); // Ensure the view switches to the planning/chat view
     handleSelectConversation(convoId); // Ensure the correct conversation is active
  }, [reEditBlockHandler, handleSelectConversation]);
  
  const handleStartReview = useCallback((conversationId: string) => {
      handleSelectConversation(conversationId);
      handleSendPlanningMessage("Avvia consuntivo", undefined, { action: 'start_review' });
      showToast("Flusso di consuntivo avviato.", "info");
  }, [handleSelectConversation, handleSendPlanningMessage, showToast]);

  const handleSelectStudent = useCallback((student: Student) => {
    setSelectedStudent(student);
    setView('student_profile');
  }, []);

  const openLezioneinCorso = useCallback(() => setView('lezione_in_corso'), []);
  const openArchivioLezioni = useCallback(() => setView('archivio_lezioni'), []);

  // hasActiveLessons — per il dot verde nella sidebar
  const hasActiveLessons = useMemo(
    () => conversations.some(c => c.weekPlan?.blocks.some(b => b.lessonState === 'in_corso')),
    [conversations]
  );

  // Avvia Lezione: imposta lessonState = 'in_corso' su un blocco (uno solo per volta).
  // Prima azzera gli altri blocchi in_corso, poi setta quello target.
  const handleAvviaLezione = useCallback((convoId: string, blockIndex: number) => {
    // Azzera eventuali lezioni in_corso sulle altre conversazioni
    conversationsRef.current.forEach(c => {
      if (!c.weekPlan) return;
      const hasActive = c.weekPlan.blocks.some(b => b.lessonState === 'in_corso');
      if (hasActive && c.id !== convoId) {
        updateConversation(c.id, conv => {
          if (!conv.weekPlan) return conv;
          return {
            ...conv,
            weekPlan: {
              ...conv.weekPlan,
              blocks: conv.weekPlan.blocks.map(b =>
                b.lessonState === 'in_corso' ? { ...b, lessonState: 'progettata' as LessonState } : b
              ),
            },
          };
        });
      }
    });
    // Imposta il blocco target come in_corso
    updateConversation(convoId, c => {
      if (!c.weekPlan) return c;
      return {
        ...c,
        weekPlan: {
          ...c.weekPlan,
          blocks: c.weekPlan.blocks.map((b, i) =>
            i === blockIndex ? { ...b, lessonState: 'in_corso' as LessonState } : b
          ),
        },
      };
    });
    setView('lezione_in_corso');
  }, [conversationsRef, updateConversation]);

  // Chiudi Lezione: imposta lessonState = 'archiviata' e vai all'archivio
  const handleChiudiLezione = useCallback((convoId: string, blockIndex: number) => {
    updateConversation(convoId, c => {
      if (!c.weekPlan) return c;
      return {
        ...c,
        weekPlan: {
          ...c.weekPlan,
          blocks: c.weekPlan.blocks.map((b, i) =>
            i === blockIndex ? { ...b, lessonState: 'archiviata' as LessonState } : b
          ),
        },
      };
    });
    setView('archivio_lezioni');
  }, [updateConversation]);
  
  const handleFormatBlocks = useCallback((selectedIds: Set<string>) => {
      const turndownService = new TurndownService();

      const allBlocks = conversationsRef.current
          .filter(c => c.weekPlan)
          .flatMap(convo => 
              convo.weekPlan!.blocks.map((block, index) => ({
                  ...block,
                  uniqueId: `${convo.id}-${index}`,
                  weekPlan: convo.weekPlan!,
                  convoId: convo.id,
                  blockIndex: index,
              }))
          );

      const selectedBlocks = allBlocks.filter(b => selectedIds.has(b.uniqueId));
      if (selectedBlocks.length === 0) {
          showToast("Nessun blocco valido selezionato.", "error");
          return;
      }

      selectedBlocks.sort((a, b) => {
          if (a.weekPlan.weekNumber !== b.weekPlan.weekNumber) {
              return a.weekPlan.weekNumber - b.weekPlan.weekNumber;
          }
          return a.blockIndex - b.blockIndex;
      });

      const titleParts = selectedBlocks.map(b => `Blocco ${b.blockIndex + 1}`).join(', ');
      const weekInfo = `Settimana ${selectedBlocks[0].weekPlan.weekNumber}`;
      const newTitle = `Lavorazione: ${titleParts} / ${weekInfo}`;

      let aggregatedContent = `### **SESSIONE DI LAVORAZIONE MULTI-BLOCCO**\n\nSono stati selezionati i seguenti Contenuti Master:\n\n---\n\n`;
      selectedBlocks.forEach((block, index) => {
          const masterContentHtml = block.contentBlocks?.map(cb => cb.content).join('\n<hr>\n') || '_Nessun contenuto_';
          const masterContentMd = turndownService.turndown(masterContentHtml);

          aggregatedContent += `### **CONTENUTO ${index + 1}**\n`;
          aggregatedContent += `*   **Settimana:** ${block.weekPlan.weekNumber} - ${block.weekPlan.theme}\n`;
          aggregatedContent += `*   **Blocco:** ${block.blockIndex + 1} - ${block.objective || 'N/D'}\n`;
          aggregatedContent += `*   **Modulo:** ${block.module || 'N/D'}\n\n`;
          aggregatedContent += `${masterContentMd}\n\n---\n\n`;
      });
      aggregatedContent += `### **ISTRUZIONI PER LA MANIPOLAZIONE**\n\nAda, basandoti sui contenuti aggregati qui sopra, aiutami a: `;
      
      const newConversation: Conversation = {
          id: `conv-creative-${Date.now()}`,
          title: newTitle,
          messages: [{ id: `msg-user-${Date.now()}`, role: 'user', content: aggregatedContent }],
      };

      setConversations([newConversation, ...conversationsRef.current]);
      handleSelectConversation(newConversation.id);
      setView('chat');
      showToast("Atelier Creativo pronto! Inizia a dare istruzioni.", "success");

  }, [conversationsRef, showToast, setConversations, handleSelectConversation]);

  const handleNewConversationClick = useCallback(() => {
      newConversationHook();
      setView('chat');
  }, [newConversationHook]);

    // --- In Aula Handlers ---
  const resetInitialPlanningTab = useCallback(() => setInitialPlanningTab(null), []);

  const handleNavigateToBlock = useCallback((convoId: string, blockIndex: number) => {
      handleSelectConversation(convoId);
      updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      return {
          ...convo,
          weekPlan: { ...convo.weekPlan, activeBlockIndex: blockIndex }
      };
      });
      setInitialPlanningTab('contenutoMaster');
      setView('chat');
  }, [handleSelectConversation, updateConversation]);

  const handleRecordAttendanceForBlock = useCallback((convoId: string, blockIndex: number, presentStudentIds: string[]) => {
      const convo = conversationsRef.current.find(c => c.id === convoId);
      if (!convo || !convo.weekPlan) return;
      const block = convo.weekPlan.blocks[blockIndex];
      const allWeekStudentIds = convo.weekPlan.students.map(s => s.id);
      
      updateConversation(convoId, convo => {
          const newBlocks = [...convo.weekPlan!.blocks];
          newBlocks[blockIndex] = { ...newBlocks[blockIndex], presentStudentIds };
          return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
      });

      recordAttendanceForBlock(block, blockIndex, convo.weekPlan.weekNumber, allWeekStudentIds, presentStudentIds);
      showToast('Presenze registrate con successo!', 'success');
  }, [conversationsRef, updateConversation, recordAttendanceForBlock, showToast]);

  const handleUpdateGroupsForBlock = useCallback((convoId: string, blockIndex: number, groups: GroupDefinition[]) => {
      updateConversation(convoId, convo => {
          if (!convo.weekPlan) return convo;
          const newBlocks = [...convo.weekPlan!.blocks];
          const currentAllocations = newBlocks[blockIndex].allocations;
          newBlocks[blockIndex] = {
              ...newBlocks[blockIndex],
              allocations: {
                  ...currentAllocations,
                  type: 'group',
                  data: {
                      ...(currentAllocations?.data),
                      groups: groups,
                  }
              }
          };
          return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
      });
  }, [updateConversation]);
  
  const handleUpdateGroupNotesForBlock = useCallback((convoId: string, blockIndex: number, groupIndex: number, notes: string) => {
      updateConversation(convoId, convo => {
          if (!convo.weekPlan) return convo;
          const newBlocks = [...convo.weekPlan!.blocks];
          const block = newBlocks[blockIndex];
          if (block.allocations?.data.groups) {
              const newGroups = [...block.allocations.data.groups];
              newGroups[groupIndex] = { ...newGroups[groupIndex], notes };
               newBlocks[blockIndex] = {
                  ...block,
                  allocations: {
                      ...block.allocations,
                      data: { ...block.allocations.data, groups: newGroups }
                  }
              };
          }
          return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
      });
  }, [updateConversation]);

  const handleSaveGroupsForBlock = useCallback((convoId: string, blockIndex: number, groups: GroupDefinition[]) => {
      updateConversation(convoId, convo => {
          const newBlocks = [...convo.weekPlan!.blocks];
          newBlocks[blockIndex] = {
              ...newBlocks[blockIndex],
              allocations: { type: 'group', data: { groups } }
          };
          return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
      });
      showToast('Gruppi di lavoro salvati!', 'success');
  }, [updateConversation, showToast]);

  const handleAddArtifactForBlock = useCallback((convoId: string, blockIndex: number, artifactText: string) => {
      updateConversation(convoId, convo => {
          const newBlocks = [...convo.weekPlan!.blocks];
          const currentArtifacts = newBlocks[blockIndex].artifacts || [];
          newBlocks[blockIndex] = {
              ...newBlocks[blockIndex],
              artifacts: [...currentArtifacts, artifactText]
          };
          return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
      });
  }, [updateConversation]);
  
  const handleDeleteArtifactForBlock = useCallback((convoId: string, blockIndex: number, artifactIndex: number) => {
      updateConversation(convoId, convo => {
          const newBlocks = [...convo.weekPlan!.blocks];
          const currentArtifacts = newBlocks[blockIndex].artifacts || [];
          const newArtifacts = currentArtifacts.filter((_, index) => index !== artifactIndex);
          newBlocks[blockIndex] = {
              ...newBlocks[blockIndex],
              artifacts: newArtifacts
          };
          return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
      });
  }, [updateConversation]);

    const handleSaveLessonNotes = useCallback((convoId: string, blockIndex: number, notes: string) => {
        updateConversation(convoId, convo => {
            if (!convo.weekPlan) return convo;
            const newBlocks = [...convo.weekPlan.blocks];
            newBlocks[blockIndex] = { ...newBlocks[blockIndex], lessonNotes: notes };
            return { ...convo, weekPlan: { ...convo.weekPlan, blocks: newBlocks } };
        });
        showToast('Note sulla lezione salvate.', 'success');
    }, [updateConversation, showToast]);

    const handleDeleteLessonNotes = useCallback((convoId: string, blockIndex: number) => {
        updateConversation(convoId, convo => {
            if (!convo.weekPlan) return convo;
            const newBlocks = [...convo.weekPlan.blocks];
            const { lessonNotes, adaAnalysis, ...rest } = newBlocks[blockIndex];
            newBlocks[blockIndex] = rest;
            return { ...convo, weekPlan: { ...convo.weekPlan, blocks: newBlocks } };
        });
        showToast('Note sulla lezione cancellate.', 'success');
    }, [updateConversation, showToast]);

    const handleGenerateAnalysis = useCallback(async (convoId: string, blockIndex: number) => {
        const convo = conversationsRef.current.find(c => c.id === convoId);
        if (!convo?.weekPlan) return;
        const block = convo.weekPlan.blocks[blockIndex];
        if (!block.lessonNotes) {
            showToast("Nessuna nota su cui generare l'analisi.", 'error');
            return;
        }

        const blockUniqueId = `${convoId}-${blockIndex}`;
        setAnalysisLoadingBlockId(blockUniqueId);
        try {
            const studentNames = students.map(s => s.name);
            const analysis = await GeminiService.generateLessonAnalysis(block.lessonNotes, studentNames);

            updateConversation(convoId, c => {
                if (!c.weekPlan) return c;
                const newBlocks = [...c.weekPlan.blocks];
                newBlocks[blockIndex] = { ...newBlocks[blockIndex], adaAnalysis: analysis };
                return { ...c, weekPlan: { ...c.weekPlan, blocks: newBlocks } };
            });
            showToast("Analisi di Ada generata!", "success");

        } catch (error) {
            console.error("Analysis generation failed:", error);
            showToast(error instanceof Error ? error.message : "Errore durante l'analisi.", 'error');
        } finally {
            setAnalysisLoadingBlockId(null);
        }
    }, [conversationsRef, students, showToast, updateConversation]);

  const handleAddLinkForBlock = useCallback((convoId: string, blockIndex: number, title: string, url: string) => {
      updateConversation(convoId, convo => {
          if (!convo.weekPlan) return convo;
          const newBlocks = [...convo.weekPlan!.blocks];
          const currentLinks = newBlocks[blockIndex].usefulLinks || [];
          const newLink = { id: `link-${Date.now()}`, title, url };
          newBlocks[blockIndex] = {
              ...newBlocks[blockIndex],
              usefulLinks: [...currentLinks, newLink]
          };
          return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
      });
  }, [updateConversation]);
  
  const handleDeleteLinkForBlock = useCallback((convoId: string, blockIndex: number, linkId: string) => {
      updateConversation(convoId, convo => {
          if (!convo.weekPlan) return convo;
          const newBlocks = [...convo.weekPlan!.blocks];
          const currentLinks = newBlocks[blockIndex].usefulLinks || [];
          const newLinks = currentLinks.filter(link => link.id !== linkId);
          newBlocks[blockIndex] = {
              ...newBlocks[blockIndex],
              usefulLinks: newLinks
          };
          return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
      });
  }, [updateConversation]);
  
  const handleUpdateBlockCloudLink = useCallback((convoId: string, blockIndex: number, url: string) => {
      updateConversation(convoId, convo => {
          if (!convo.weekPlan) return convo;
          const newBlocks = [...convo.weekPlan!.blocks];
          newBlocks[blockIndex] = {
              ...newBlocks[blockIndex],
              materialsCloudLink: url || undefined // Store undefined if url is empty
          };
          return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
      });
      showToast(url ? 'Cartella materiali collegata!' : 'Collegamento rimosso.', 'success');
  }, [updateConversation, showToast]);

  const handleUpdateBlockLinkedNotebooks = useCallback((convoId: string, blockIndex: number, notebookIds: string[]) => {
      updateConversation(convoId, convo => {
          if (!convo.weekPlan) return convo;
          const newBlocks = [...convo.weekPlan!.blocks];
          newBlocks[blockIndex] = {
              ...newBlocks[blockIndex],
              linkedNotebookIds: notebookIds
          };
          return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
      });
  }, [updateConversation]);

  const handleExportData = useCallback(async (password: string) => {
    setIsLoading(true);
    setModalState(s => ({ ...s, exportPassword: false }));
    showToast('Creazione del backup in corso...', 'info');
    try {
        const backupData = {
            version: 2,
            timestamp: new Date().toISOString(),
            data: {
                conversations: await db.getAllConversations(),
                labels: await db.getAllLabels(),
                students: await db.getAllStudents(),
                notebooks: await db.getAllNotebooks(),
                toolkit_shortcuts: await db.getAllShortcuts(),
                toolkit_categories: await db.getAllCategories(),
                settings: await db.getAllSettings(),
            }
        };

        const jsonString = JSON.stringify(backupData);
        const encryptedData = CryptoJS.AES.encrypt(jsonString, password).toString();

        const blob = new Blob([encryptedData], { type: 'application/octet-stream' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `backup_ada_laboratorio.ada_encrypted`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        showToast('Backup esportato con successo!', 'success');
    } catch (error) {
        console.error("Export failed:", error);
        showToast("Errore durante la creazione del backup.", 'error');
    } finally {
        setIsLoading(false);
    }
  }, [showToast]);

  const handleFileSelectedForImport = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
          setFileToImport(file);
          setModalState(s => ({...s, importPassword: true}));
      }
      event.target.value = ''; // Reset input
  };
  
  const handleAttemptImport = (password: string) => {
    if (!fileToImport) return;
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
        const fileContent = e.target?.result as string;
        try {
            const bytes = CryptoJS.AES.decrypt(fileContent, password);
            const decryptedJson = bytes.toString(CryptoJS.enc.Utf8);
            
            if (!decryptedJson) {
                throw new Error("Password errata o file corrotto.");
            }

            const backup = JSON.parse(decryptedJson);

            if (!backup.version || !backup.data) {
                 throw new Error("File di backup non valido.");
            }

            setDataToRestore(backup.data);
            setModalState(s => ({...s, importPassword: false, importConfirm: true}));

        } catch (error) {
            console.error("Import failed:", error);
            showToast(error instanceof Error ? error.message : "Password errata o file non valido.", 'error');
        } finally {
            setIsLoading(false);
        }
    };
    reader.readAsText(fileToImport);
  };
  
  const handleConfirmRestore = async () => {
    if (!dataToRestore) return;
    setIsLoading(true);
    setModalState(s => ({...s, importConfirm: false}));
  
    try {
      await db.restoreFromBackup(dataToRestore);
  
      sessionStorage.setItem('backupRestored', 'true');
  
      window.location.reload();
  
    } catch (error) {
      console.error("Restore failed:", error);
      showToast("Errore critico durante il ripristino dei dati.", 'error');
      setIsLoading(false);
    }
  };

    const handleOpenImportModal = useCallback((student: Student) => {
        setStudentForEvaluationImport(student);
    }, []);

    const handleConfirmImportEvaluation = useCallback(async (text: string) => {
        if (!studentForEvaluationImport) return;
        
        setIsLoading(true);
        try {
            const analyzedData = await GeminiService.analyzeEvaluationText(text, studentForEvaluationImport.name);
            
            const newEvaluation: Evaluation = {
                date: new Date().toISOString(),
                value: analyzedData.value || 'Non specificato',
                notes: analyzedData.notes || 'Nessuna nota.',
                weekNumber: analyzedData.weekNumber,
                module: analyzedData.module,
                pillar: analyzedData.pillar,
            };

            addEvaluationToStudent(studentForEvaluationImport.id, newEvaluation);
            showToast('Valutazione importata e analizzata con successo!', 'success');
        } catch (error) {
            console.error("Failed to import evaluation:", error);
            showToast(error instanceof Error ? error.message : "Errore durante l'importazione.", 'error');
        } finally {
            setIsLoading(false);
            setStudentForEvaluationImport(null);
        }
    }, [studentForEvaluationImport, addEvaluationToStudent, showToast]);

    const handleExportCourseBook = useCallback(() => {
        showToast('Generazione del libro del corso in corso...', 'info');
        try {
            const htmlContent = generateCourseBookHtml(
                masterContext.systemInstruction,
                {
                    constitution: masterContext.constitution,
                    route: masterContext.routeContext,
                    crew: masterContext.crewContext,
                    rules: masterContext.rulesContext,
                },
                conversationsRef.current,
                students
            );

            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `libro_del_corso_ada.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
            showToast('Libro del corso esportato con successo!', 'success');
        } catch (error) {
            console.error("Course book export failed:", error);
            showToast("Errore durante l'esportazione del libro del corso.", 'error');
        }
    }, [masterContext, conversationsRef, students, showToast]);


  // --- Stabilized callbacks for props ---
  const openInstructionsModal = useCallback(() => setModalState(s => ({ ...s, instructions: true })), []);
  const openTeacherProfileModal = useCallback(() => setModalState(s => ({ ...s, teacherProfile: true })), []);
  const openImageModal = useCallback(() => setModalState(s => ({ ...s, image: true })), []);
  
  const openLabelManagerModal = useCallback(() => setModalState(s => ({ ...s, labelManagement: true })), []);
  const openStudentRoster = useCallback(() => setView('roster'), []);
  const openNotebookLM = useCallback(() => setView('notebooklm'), []);
  const openClassroomTrend = useCallback(() => setView('classroom_trend'), []);
  const openGroupsArchive = useCallback(() => setView('groups_archive'), []);
  const openFoundingDocuments = useCallback(() => setView('founding_documents'), []);
  const openToolkit = useCallback(() => setView('toolkit'), []);
  const openStrategicDashboard = useCallback(() => setView('strategic_dashboard'), []);
  const openBlockDayDefaultsModal = useCallback(() => setModalState(s => ({ ...s, blockDayDefaults: true })), []);
  // --- End of stabilized callbacks ---

  const currentView = useMemo(() => {
    if (view === 'strategic_dashboard') return 'strategic_dashboard';
    if (view === 'founding_documents') return 'founding_documents';
    if (view === 'toolkit') return 'toolkit';
    if (view === 'lezione_in_corso') return 'lezione_in_corso';
    if (view === 'archivio_lezioni') return 'archivio_lezioni';
    if (view === 'classroom_trend') return 'classroom_trend';
    if (view === 'groups_archive') return 'groups_archive';
    if (view === 'student_profile' && selectedStudent) return 'student_profile';
    if (view === 'roster') return 'roster';
    if (view === 'notebooklm') return 'notebooklm';
    if (activeConversationId) {
      if (activeConversation?.weekPlan) return 'planning';
      return 'chat';
    }
    return 'lobby';
  }, [view, activeConversationId, activeConversation, selectedStudent]);

  return (
    <>
      <div className="flex h-full w-full bg-gray-900 text-gray-100 font-sans">
        <input type="file" ref={importFileRef} onChange={handleFileSelectedForImport} accept=".ada_encrypted" className="hidden" />
        <Sidebar
          activeView={currentView as any}
          onOpenConversaConAda={handleOpenConversaConAda}
          onOpenStrategicDashboard={openStrategicDashboard}
          onOpenToolkit={openToolkit}
          onOpenImageGenerator={openImageModal}
          onOpenLezioneinCorso={openLezioneinCorso}
          onOpenArchivioLezioni={openArchivioLezioni}
          onOpenNotebookLM={openNotebookLM}
          hasActiveLessons={hasActiveLessons}
          onOpenClassroomTrend={openClassroomTrend}
          onOpenGroupsArchive={openGroupsArchive}
          onOpenStudentRoster={openStudentRoster}
          onOpenFoundingDocuments={openFoundingDocuments}
          onOpenTeacherProfile={openTeacherProfileModal}
          onOpenBlockDayDefaults={openBlockDayDefaultsModal}
          onOpenInstructions={openInstructionsModal}
          onOpenLabelManager={openLabelManagerModal}
          onExportData={() => setModalState(s => ({...s, exportPassword: true}))}
          onImportData={() => importFileRef.current?.click()}
          onExportCourseBook={handleExportCourseBook}
          onOpenApiSettings={onOpenApiSettings}
          onSaveInstructions={masterContext.handleSaveInstructions}
          disciplina={masterContext.disciplina}
          onSaveDisciplina={masterContext.handleSaveDisciplina}
          onShowToast={showToast}
        />
        {
          {
            'lobby': <LobbyView teacherProfile={masterContext.teacherProfile} />,
            'founding_documents': <FoundingDocumentsView masterContext={masterContext} onClose={() => setView('lobby')} />,
// FIX: Corrected prop name from `onUpdateBlockStatus` to `handleUpdateBlockStatus`
            'strategic_dashboard': <StrategicDashboardView conversations={conversations} weeks={availableWeeks} modules={modules} constitutionText={masterContext.constitution} onClose={() => setView('lobby')} onUpdateWeekTheme={handleUpdateWeekTheme} onUpdateBlockObjective={handleUpdateBlockObjective} onGenerateStrategicSuggestions={handleGenerateStrategicSuggestions} onSaveStrategicData={handleUpdateStrategicData} onGenerateBlockDetails={handleGenerateBlockDetails} onUpdateWeekDetails={handleUpdateWeekDetails} onUpdateBlockDetails={handleUpdateBlockDetails} onStartPlanning={handleStartPlanningForWeek} onUpdateBlockModuleAndPillar={handleUpdateBlockModuleAndPillar} onUpdateBlockStatus={handleUpdateBlockStatus} showToast={showToast} />,
            'toolkit': <ToolkitView shortcuts={shortcuts} categories={categories} onClose={() => setView('lobby')} onAddShortcut={addShortcut} onUpdateShortcut={updateShortcut} onDeleteShortcut={deleteShortcut} onAddCategory={addCategory} onUpdateCategory={updateCategory} onDeleteCategory={deleteCategory} onBulkUpdateShortcuts={bulkUpdateShortcuts} onBulkUpdateCategories={bulkUpdateCategories} showToast={showToast} />,
            'lezione_in_corso': <InAulaView viewMode="in_corso" conversations={conversations} onClose={() => setView('lobby')} students={students} onNavigateToBlock={handleNavigateToBlock} onFormatMultipleBlocks={handleFormatBlocks} onRecordAttendance={handleRecordAttendanceForBlock} onSaveGroups={handleSaveGroupsForBlock} onAddArtifact={handleAddArtifactForBlock} onDeleteArtifact={handleDeleteArtifactForBlock} onOpenLessonNotesModal={setLessonNotesModalInfo} onDeleteLessonNotes={handleDeleteLessonNotes} onGenerateAnalysis={handleGenerateAnalysis} analysisLoadingBlockId={analysisLoadingBlockId} onUpdateGroups={handleUpdateGroupsForBlock} onUpdateGroupNotes={handleUpdateGroupNotesForBlock} showToast={showToast} masterContext={masterContext} onUpdateBlockStatus={handleUpdateBlockStatus} onAddLink={handleAddLinkForBlock} onDeleteLink={handleDeleteLinkForBlock} onUpdateCloudLink={handleUpdateBlockCloudLink} notebooks={notebooks} onAddNotebook={addNotebook} onUpdateLinkedNotebooks={handleUpdateBlockLinkedNotebooks} onAvviaLezione={handleAvviaLezione} onChiudiLezione={handleChiudiLezione} />,
            'archivio_lezioni': <InAulaView viewMode="archivio" conversations={conversations} onClose={() => setView('lobby')} students={students} onNavigateToBlock={handleNavigateToBlock} onFormatMultipleBlocks={handleFormatBlocks} onRecordAttendance={handleRecordAttendanceForBlock} onSaveGroups={handleSaveGroupsForBlock} onAddArtifact={handleAddArtifactForBlock} onDeleteArtifact={handleDeleteArtifactForBlock} onOpenLessonNotesModal={setLessonNotesModalInfo} onDeleteLessonNotes={handleDeleteLessonNotes} onGenerateAnalysis={handleGenerateAnalysis} analysisLoadingBlockId={analysisLoadingBlockId} onUpdateGroups={handleUpdateGroupsForBlock} onUpdateGroupNotes={handleUpdateGroupNotesForBlock} showToast={showToast} masterContext={masterContext} onUpdateBlockStatus={handleUpdateBlockStatus} onAddLink={handleAddLinkForBlock} onDeleteLink={handleDeleteLinkForBlock} onUpdateCloudLink={handleUpdateBlockCloudLink} notebooks={notebooks} onAddNotebook={addNotebook} onUpdateLinkedNotebooks={handleUpdateBlockLinkedNotebooks} onAvviaLezione={handleAvviaLezione} onChiudiLezione={handleChiudiLezione} />,
            'classroom_trend': <ClassroomTrendView conversations={conversations} students={students} onClose={() => setView('lobby')} />,
            'groups_archive': <GroupsArchiveView conversations={conversations} students={students} onClose={() => setView('lobby')} masterContext={masterContext} onUpdateBlock={handleUpdateBlockInConversation} />,
            'student_profile': <StudentProfileView student={selectedStudent!} onClose={() => setView('roster')} onUpdateNotes={updateStudentNotes} onUpdateSummary={updateStudentSummary} onOpenImportModal={handleOpenImportModal} />,
            'roster': <StudentRosterView students={students} onSelectStudent={handleSelectStudent} onClose={() => setView('lobby')} />,
            'notebooklm': <NotebookLMView notebooks={notebooks} onClose={() => setView('lobby')} onAddNotebook={() => handleOpenAddNotebookModal()} onEditNotebook={handleOpenAddNotebookModal} onRemoveNotebook={removeNotebook} onAccessNotebook={accessNotebook} onManageNotes={setNotebookForNotes} />,
            'planning': <PlanningView key={activeConversation?.id} conversation={activeConversation!} onUpdateWeekPlan={handleUpdateWeekPlan} isLoading={isLoading} onSendMessage={handleSendPlanningMessage} onReEditBlock={handleReEditBlock} onClose={() => setView('strategic_dashboard')} students={students} masterContext={masterContext} initialTab={initialPlanningTab} onInitialTabConsumed={resetInitialPlanningTab} useGoogleSearch={useGoogleSearch} onGoogleSearchChange={setUseGoogleSearch} onShowConfirmation={setConfirmationProps} currentModeId={masterContext.currentModeId} onModeChange={handlePlanningModeChange} weekConversations={conversations.filter(c => !!c.weekPlan)} onSelectWeekConversation={handleSelectConversation} />,
            'chat': <ChatView conversation={activeConversation} students={students} onSendMessage={handleSendMessage} isLoading={isLoading} useGoogleSearch={useGoogleSearch} onGoogleSearchChange={setUseGoogleSearch} onShowToast={showToast} onOpenImageGenerator={openImageModal} currentModeId={masterContext.currentModeId} onModeChange={handleModeChange} />
          }[currentView]
        }
      </div>
      
      <ContextModal isOpen={modalState.instructions} onClose={() => setModalState(s=>({...s, instructions: false}))} onSave={masterContext.handleSaveInstructions} onDistill={handleDistillContext} currentContext={masterContext.systemInstruction} defaultContext={DEFAULT_SYSTEM_INSTRUCTION} title="Personalità di Ada" description="Definisci qui la personalità, il ruolo e lo stile di Ada." placeholder="Es: Sei un esperto di programmazione Python..." />
      
      <ContextModal 
        isOpen={modalState.teacherProfile} 
        onClose={() => setModalState(s=>({...s, teacherProfile: false}))} 
        onSave={masterContext.handleSaveTeacherProfile} 
        onDistill={handleDistillContext} 
        currentContext={masterContext.teacherProfile} 
        defaultContext={DEFAULT_TEACHER_PROFILE} 
        title="Profilo Docente" 
        description="Definisci qui chi sei. Ada userà queste informazioni per personalizzare l'esperienza e l'interazione." 
        placeholder="Nome: Mario Rossi&#10;Materia: Design e Comunicazione&#10;Ruolo: Docente di Laboratorio" 
      />

      <ImageGenerationModal isOpen={modalState.image} onClose={() => setModalState(s=>({...s, image: false}))} onGenerate={handleGenerateImage} isLoading={isLoading} />
      
      <LabelManagementModal isOpen={modalState.labelManagement} onClose={() => setModalState(s=>({...s, labelManagement: false}))} labels={labels} onAddLabel={addLabel} onUpdateLabel={updateLabel} onDeleteLabel={handleDeleteLabel} conversations={conversations} />
      {assignLabelsConversation && <AssignLabelsModal isOpen={!!assignLabelsConversation} onClose={() => setAssignLabelsConversation(null)} conversation={assignLabelsConversation} allLabels={labels} onSave={updateConversationLabels} />}
      
      <AddNotebookModal isOpen={modalState.addNotebook} onClose={() => setModalState(s=>({...s, addNotebook: false}))} onSave={addNotebook} onUpdate={updateNotebook} notebookToEdit={notebookToEdit} />
      <ManageNotesModal isOpen={!!notebookForNotes} onClose={() => setNotebookForNotes(null)} onSave={(id, notes) => updateNotebook(id, { notes })} notebook={notebookForNotes} />
      
      {lessonNotesModalInfo && (
          <LessonNotesModal
              isOpen={!!lessonNotesModalInfo}
              onClose={() => setLessonNotesModalInfo(null)}
              onSave={(notes) => handleSaveLessonNotes(lessonNotesModalInfo.convoId, lessonNotesModalInfo.blockIndex, notes)}
              blockTitle={`Blocco ${lessonNotesModalInfo.blockIndex + 1}`}
              initialNotes={lessonNotesModalInfo.initialNotes}
          />
      )}
      
      <PasswordPromptModal
        isOpen={modalState.exportPassword}
        onClose={() => setModalState(s => ({...s, exportPassword: false}))}
        onSubmit={handleExportData}
        title="Cripta e Esporta Backup"
        buttonText="Crea Backup"
        isLoading={isLoading}
      >
          Inserisci la tua password di accesso per criptare il backup. Solo tu potrai decriptarlo con la stessa password.
      </PasswordPromptModal>
      
      <PasswordPromptModal
        isOpen={modalState.importPassword}
        onClose={() => setModalState(s => ({...s, importPassword: false}))}
        onSubmit={handleAttemptImport}
        title="Importa da Backup"
        buttonText="Decripta e Carica"
        isLoading={isLoading}
      >
          Inserisci la password utilizzata per creare questo backup.
      </PasswordPromptModal>

      <ConfirmationModal
        isOpen={modalState.importConfirm}
        onClose={() => setModalState(s => ({...s, importConfirm: false}))}
        onConfirm={handleConfirmRestore}
        title="Conferma Ripristino Dati"
        confirmText="Sì, sovrascrivi tutto"
      >
        Stai per sostituire tutti i dati attuali con quelli del backup. L'operazione non è reversibile. Vuoi continuare?
      </ConfirmationModal>

      <BlockDayDefaultsModal
          isOpen={modalState.blockDayDefaults}
          onClose={() => setModalState(s => ({ ...s, blockDayDefaults: false }))}
          defaults={masterContext.blockDayDefaults}
          onSave={masterContext.handleSaveBlockDayDefaults}
      />
        
      {studentForEvaluationImport && (
          <ImportEvaluationModal
              isOpen={!!studentForEvaluationImport}
              onClose={() => setStudentForEvaluationImport(null)}
              onConfirm={handleConfirmImportEvaluation}
              isLoading={isLoading}
              studentName={studentForEvaluationImport.name}
          />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {confirmationProps && (
          <ConfirmationModal
              isOpen={!!confirmationProps}
              onClose={() => setConfirmationProps(null)}
              {...confirmationProps}
          />
      )}

      {notebookSuggestion && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-md shadow-lg text-white text-sm font-medium flex items-center transition-all duration-300 ease-in-out bg-gray-700 border border-gray-600 animate-fade-in-down">
            <div>
                <p className="font-semibold">Contenuto preparato per NotebookLM!</p>
                <p className="text-xs text-gray-300">Vuoi salvare il notebook in cui lavorerai?</p>
            </div>
            <button onClick={() => { setNotebookSuggestion(null); handleOpenAddNotebookModal({ title: notebookSuggestion.title }); }} className="ml-4 px-3 py-1 bg-blue-600 rounded-md text-xs hover:bg-blue-700">Sì, aggiungi</button>
             <button onClick={() => setNotebookSuggestion(null)} className="ml-2 text-xl font-semibold leading-none">&times;</button>
        </div>
      )}
    </>
  );
};

export default MainApp;
