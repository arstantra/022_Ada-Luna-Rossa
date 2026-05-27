import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Conversation, Message, Attachment, Mode, WeekRouteInfo, WeekPlan, BlockDetails, Student, Notebook, PlanningActionPayload, GroupDefinition, Evaluation, AdaAnalysis, ToolkitShortcut, ValidateAndArchivePayload, ToolkitCategory, BlockStatus, LessonState, GroundingSource, LessonType, DetachedLesson, CourseModule, Activity } from '../types';
import type { ActiveView } from './Sidebar';
import type { ConfirmationModalProps } from './ConfirmationModal';
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
import AdaPersonalityView from './AdaPersonalityView';
import RouteView from './RouteView';
import StrategicDashboardView from './StrategicDashboardView';
import ToolkitView from './ToolkitView';
import LobbyView from './LobbyView';
import GroupsArchiveView from './GroupsArchiveView';
import GanttView from './GanttView';
import Toast from './Toast';
// Modals
import ImageGenerationModal from './ImageGenerationModal';
import AddNotebookModal from './AddNotebookModal';
import ManageNotesModal from './ManageNotesModal';
import ConfirmationModal from './ConfirmationModal';
import PasswordPromptModal from './PasswordPromptModal';
import ImportEvaluationModal from './ImportEvaluationModal';
import SaltaLezioneModal from './SaltaLezioneModal';
import type { SaltaChoice } from './SaltaLezioneModal';
// Hooks
import { useConversations } from '../hooks/useConversations';
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
import { routeCalendarToWeekInfos, parseCrewContextToNames, generateExportContent, fileToAttachment, generateCourseBookHtml } from '../utils';
import { 
    GEMINI_API_ERROR_MESSAGE, MODES,
    ADA_QUICK_CHAT_ID,
} from '../constants';
import LessonNotesModal from './LessonNotesModal';
import { createBlockPlanningHandlers } from './handlers/blockHandlers';
import { createBlockStatusHandlers } from './handlers/blockHandlers_status';
import { createConversationHandlers } from './handlers/conversationHandlers';
import { createMessagingHandlers } from './handlers/messagingHandlers';
import { createLessonHandlers } from './handlers/lessonHandlers';
import { createBlockNoteHandlers } from './handlers/blockNoteHandlers';
import { createContentHandlers } from './handlers/contentHandlers';
import { createDataHandlers } from './handlers/dataHandlers';
import { createUiHandlers } from './handlers/uiHandlers';

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
    updateConversation, updateConversationTitle, conversationsRef,
  } = useConversations(showToast);
  
const { students, syncStudentsWithContext, addEvaluationToStudent, recordAttendanceForBlock, updateStudentNotes, updateStudentSummary, addStructuredStudent, updateStructuredStudent, deleteStructuredStudent } = useStudents(masterContext.crewContext);
  const { notebooks, addNotebook, updateNotebook, removeNotebook, accessNotebook } = useNotebooks(showToast);
  const { shortcuts, addShortcut, updateShortcut, deleteShortcut, bulkUpdateShortcuts } = useToolkitShortcuts(showToast);
  const { categories, addCategory, updateCategory, deleteCategory, bulkUpdateCategories } = useToolkitCategories(showToast);

  const { processPlanningMessage, handleReEditBlock: reEditBlockHandler } = usePlanning(updateConversation, showToast);

  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'lobby' | 'chat' | 'roster' | 'notebooklm' | 'lezione' | 'student_profile' | 'classroom_trend' | 'founding_documents' | 'toolkit' | 'strategic_dashboard' | 'groups_archive' | 'gantt' | 'la_rotta' | 'ada_personality'>('lobby');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [initialPlanningTab, setInitialPlanningTab] = useState<'laboratorio' | 'contenutoMaster' | null>(null);
  const [analysisLoadingBlockId, setAnalysisLoadingBlockId] = useState<string | null>(null);


  // --- Modal States ---
  const [modalState, setModalState] = useState({
    image: false, addNotebook: false,
    exportPassword: false, importPassword: false, importConfirm: false,
  });
const [notebookToEdit, setNotebookToEdit] = useState<Partial<Notebook> | null>(null);
  const [notebookForNotes, setNotebookForNotes] = useState<Notebook | null>(null);
  const [notebookSuggestion, setNotebookSuggestion] = useState<{title: string} | null>(null);
  const [lessonNotesModalInfo, setLessonNotesModalInfo] = useState<{ convoId: string; blockIndex: number; initialNotes: string; } | null>(null);
  const [studentForEvaluationImport, setStudentForEvaluationImport] = useState<Student | null>(null);
  const [fileToImport, setFileToImport] = useState<File | null>(null);
  const [dataToRestore, setDataToRestore] = useState<db.BackupData | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [confirmationProps, setConfirmationProps] = useState<Omit<ConfirmationModalProps, 'isOpen' | 'onClose'> | null>(null);
  const [pendingSaltaInfo, setPendingSaltaInfo] = useState<{ weekNumber: number; blockIndex: number; block: BlockDetails } | null>(null);
  const [pendingFirstMessage, setPendingFirstMessage] = useState<string | null>(null);

  const { modules, contentUnits } = useConstitutionCache();


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

  // Migrazione one-shot: blocchi con status 'formazione scuola-lavoro' → status 'normale' + isFslPeriod: true
  // (v2: tipologia 'fsl' → rimossa dal LessonType, FSL è ora flag isFslPeriod)
  const fslMigrationDoneRef = useRef(false);
  useEffect(() => {
    if (fslMigrationDoneRef.current || conversations.length === 0) return;
    fslMigrationDoneRef.current = true;
    conversations.forEach(conv => {
      if (!conv.weekPlan) return;
      const hasFsl = conv.weekPlan.blocks.some(
        b => (b.status as string) === 'formazione scuola-lavoro' || (b.tipologia as string) === 'fsl'
      );
      if (!hasFsl) return;
      updateConversation(conv.id, c => ({
        ...c,
        weekPlan: c.weekPlan ? {
          ...c.weekPlan,
          blocks: c.weekPlan.blocks.map(b => {
            const wasOldStatus = (b.status as string) === 'formazione scuola-lavoro';
            const wasOldTipologia = (b.tipologia as string) === 'fsl';
            if (!wasOldStatus && !wasOldTipologia) return b;
            const updated = { ...b };
            if (wasOldStatus) updated.status = 'normale' as BlockStatus;
            if (wasOldTipologia) {
              updated.isFslPeriod = true;
              updated.tipologia = undefined;
            }
            return updated;
          })
        } : undefined
      }));
    });
  }, [conversations, updateConversation]);
  


  const activeConversation = useMemo(() => conversations.find(c => c.id === activeConversationId) ?? null, [conversations, activeConversationId]);
  // Le settimane visibili in Progettazione del Corso derivano direttamente
  // dal calendario strutturato di La Rotta (routeCalendar). Se non ci sono
  // settimane configurate, il dashboard mostra uno stato vuoto.
  const availableWeeks = useMemo(
    () => routeCalendarToWeekInfos(masterContext.routeCalendar),
    [masterContext.routeCalendar]
  );

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

  // --- pendingSaltaInfo ref (evita stale closure in handleSaltaChoice) ---
  const pendingSaltaInfoRef = useRef<{ weekNumber: number; blockIndex: number; block: BlockDetails } | null>(null);
  useEffect(() => { pendingSaltaInfoRef.current = pendingSaltaInfo; }, [pendingSaltaInfo]);

  // Helper per transizioni di view (risolve incompatibilita' union type vs. string)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setViewFn = useCallback((v: string) => setView(v as any), []);

  // --- Handler factories ---
  const {
    handleSetWeekTheme, handleUpdateWeekTheme, handleUpdateBlockObjective,
    handleGenerateStrategicSuggestions, handleUpdateStrategicData,
    handleGenerateBlockDetails, handleUpdateWeekDetails, handleUpdateBlockDetails,
  } = useMemo(() => createBlockPlanningHandlers({
    conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek,
    modules, showToast, setIsLoading,
  }), [conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek, modules, showToast, setIsLoading]);

  const {
    handleUpdateBlockModule, handleUpdateBlockStatus, handleUpdateBlockTipologia,
    handleToggleFslPeriod, handleSaltaChoice,
  } = useMemo(() => createBlockStatusHandlers({
    conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek,
    showToast, setPendingSaltaInfo, pendingSaltaInfoRef,
  }), [conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek, showToast, setPendingSaltaInfo]);

  const handleSelectConversation = useCallback((id: string) => {
    selectConversationHook(id);
    setViewFn('chat');
  }, [selectConversationHook, setViewFn]);

  const {
    handleModeChange, handlePlanningModeChange, handleOpenConversaConAda,
    handleStartPlanningForWeek, handleNewConversationClick,
    handleSaveConversationModules, handleEvaluationMessage,
  } = useMemo(() => createConversationHandlers({
    conversations, conversationsRef, updateConversation, addMessageToConversation,
    activeConversationId, selectConversationHook, setConversations, newConversationHook,
    getOrCreateConversationForWeek, handleSelectConversation,
    masterContextCurrentModeId: masterContext.currentModeId,
    handleSaveMode: masterContext.handleSaveMode,
    showToast, setView: setViewFn, addEvaluationToStudent,
  }), [
    conversations, conversationsRef, updateConversation, addMessageToConversation,
    activeConversationId, selectConversationHook, setConversations, newConversationHook,
    getOrCreateConversationForWeek, handleSelectConversation,
    masterContext.currentModeId, masterContext.handleSaveMode, showToast, addEvaluationToStudent,
  ]);

  const handleOpenChatFromLobby = useCallback((message: string) => {
    setPendingFirstMessage(message);
    handleOpenConversaConAda();
  }, [handleOpenConversaConAda]);

  const {
    handleSendMessage, handleGenerateImage, handleSendPlanningMessage,
  } = useMemo(() => createMessagingHandlers({
    activeConversationId, activeConversation, conversationsRef, conversations,
    availableWeeks, students, masterContext, useGoogleSearch, latestRequestRef,
    updateConversation, addMessageToConversation, updateMessageInConversation,
    updateConversationTitle, handleEvaluationMessage, processPlanningMessage,
    showToast, setIsLoading, setModalState,
  }), [
    activeConversationId, activeConversation, conversationsRef, conversations,
    availableWeeks, students, masterContext, useGoogleSearch,
    updateConversation, addMessageToConversation, updateMessageInConversation,
    updateConversationTitle, handleEvaluationMessage, processPlanningMessage, showToast,
  ]);

  const {
    handleUpdateBlockInConversation, handleReEditBlock, handleAddActivity,
    handleMarkActivityDelivered, handleAvviaLezione, handleChiudiLezione,
    handleRecordAttendanceForBlock, handleUpdateGroupsForBlock,
    handleUpdateGroupNotesForBlock, handleSaveGroupsForBlock,
    handleAddArtifactForBlock, handleDeleteArtifactForBlock,
  } = useMemo(() => createLessonHandlers({
    conversationsRef, conversations, updateConversation, handleSelectConversation,
    reEditBlockHandler, recordAttendanceForBlock, showToast, setView: setViewFn,
    activeConversationId,
  }), [conversationsRef, conversations, updateConversation, handleSelectConversation, reEditBlockHandler, recordAttendanceForBlock, showToast, activeConversationId]);

  const {
    handleSaveLessonNotes, handleDeleteLessonNotes, handleGenerateAnalysis,
    handleAddLinkForBlock, handleDeleteLinkForBlock,
    handleUpdateBlockCloudLink, handleUpdateBlockLinkedNotebooks,
    handleAddLessonMaterial, handleRemoveLessonMaterial,
    handleAutoSaveLessonNotes, handleUpdateLiveAttendance,
    handleAddLessonEvaluation, handleRemoveLessonEvaluation,
    handleGenerateLessonNoteAnalysis, handleSaveClassroomUrl,
  } = useMemo(() => createBlockNoteHandlers({
    conversationsRef, updateConversation, students, showToast, setAnalysisLoadingBlockId,
  }), [conversationsRef, updateConversation, students, showToast, setAnalysisLoadingBlockId]);

  const {
    handleUpdateWeekPlan, handleExportContent, handleFormatBlocks,
  } = useMemo(() => createContentHandlers({
    conversationsRef, activeConversationId, updateConversation, setConversations,
    handleSelectConversation, setNotebookSuggestion, showToast, setIsLoading, setView: setViewFn,
  }), [conversationsRef, activeConversationId, updateConversation, setConversations, handleSelectConversation, setNotebookSuggestion, showToast, setIsLoading]);

  const {
    handleExportData, handleFileSelectedForImport, handleAttemptImport,
    handleConfirmRestore, handleOpenImportModal,
    handleConfirmImportEvaluation, handleExportCourseBook,
  } = useMemo(() => createDataHandlers({
    conversationsRef, students, masterContext, addEvaluationToStudent,
    fileToImport, dataToRestore, studentForEvaluationImport,
    showToast, setIsLoading, setModalState, setDataToRestore,
    setFileToImport, setStudentForEvaluationImport,
  }), [
    conversationsRef, students, masterContext, addEvaluationToStudent,
    fileToImport, dataToRestore, studentForEvaluationImport, showToast,
  ]);

  const {
    handleSelectStudent, handleNavigateToBlock, handleOpenAddNotebookModal,
  } = useMemo(() => createUiHandlers({
    updateConversation, handleSelectConversation, setSelectedStudent,
    setInitialPlanningTab, setNotebookToEdit, setModalState, setView: setViewFn,
  }), [updateConversation, handleSelectConversation, setSelectedStudent, setInitialPlanningTab, setNotebookToEdit, setModalState]);

  const openLezione = useCallback(() => setView('lezione'), []);

  // hasActiveLessons — per il dot verde nella sidebar
  const hasActiveLessons = useMemo(
    () => conversations.some(c => c.weekPlan?.blocks.some(b => b.lessonState === 'in_corso')),
    [conversations]
  );

  const resetInitialPlanningTab = useCallback(() => setInitialPlanningTab(null), []);

  // --- Stabilized callbacks for props ---
  const openImageModal = useCallback(() => setModalState(s => ({ ...s, image: true })), []);
  const openStudentRoster = useCallback(() => setView('roster'), []);
  const openNotebookLM = useCallback(() => setView('notebooklm'), []);
  const openClassroomTrend = useCallback(() => setView('classroom_trend'), []);
  const openGroupsArchive = useCallback(() => setView('groups_archive'), []);
  const openFoundingDocuments = useCallback(() => setView('founding_documents'), []);
  const openToolkit = useCallback(() => setView('toolkit'), []);
  const openStrategicDashboard = useCallback(() => setView('strategic_dashboard'), []);
  const openGantt = useCallback(() => setView('gantt'), []);
  const openAdaPersonality = useCallback(() => setView('ada_personality'), []);
  const openLaRotta = useCallback(() => setView('la_rotta'), []);
  // --- End of stabilized callbacks ---

  const currentView = useMemo((): ActiveView => {
    if (view === 'strategic_dashboard') return 'strategic_dashboard';
    if (view === 'gantt') return 'gantt';
    if (view === 'founding_documents') return 'founding_documents';
    if (view === 'ada_personality') return 'ada_personality';
    if (view === 'la_rotta') return 'la_rotta';
    if (view === 'toolkit') return 'toolkit';
    if (view === 'lezione') return 'lezione';
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
          activeView={currentView}
          onOpenConversaConAda={handleOpenConversaConAda}
          onOpenStrategicDashboard={openStrategicDashboard}
          onOpenGantt={openGantt}
          onOpenToolkit={openToolkit}
          onOpenImageGenerator={openImageModal}
          onOpenLezione={openLezione}
          onOpenNotebookLM={openNotebookLM}
          hasActiveLessons={hasActiveLessons}
          onOpenClassroomTrend={openClassroomTrend}
          onOpenGroupsArchive={openGroupsArchive}
          onOpenStudentRoster={openStudentRoster}
          onOpenFoundingDocuments={openFoundingDocuments}
          onOpenLaRotta={openLaRotta}
          onOpenAdaPersonality={openAdaPersonality}
          onExportData={() => setModalState(s => ({...s, exportPassword: true}))}
          onImportData={() => importFileRef.current?.click()}
          onExportCourseBook={handleExportCourseBook}
          onOpenApiSettings={onOpenApiSettings}
          onShowToast={showToast}
        />
        {
          {
            'lobby': <LobbyView teacherProfile={masterContext.teacherProfile} onStartChat={handleOpenChatFromLobby} />,
            'gantt': <GanttView conversations={conversations} onClose={() => setView('lobby')} onNavigateToWeek={(w) => { setView('strategic_dashboard'); }} onMarkActivityDelivered={handleMarkActivityDelivered} />,
            'founding_documents': <FoundingDocumentsView masterContext={masterContext} onClose={() => setView('lobby')} students={students} onAddStudent={addStructuredStudent} onUpdateStudent={updateStructuredStudent} onDeleteStudent={deleteStructuredStudent} />,
            'ada_personality': <AdaPersonalityView masterContext={masterContext} onClose={() => setView('lobby')} />,
            'la_rotta': <RouteView masterContext={masterContext} onClose={() => setView('lobby')} />,
// FIX: Corrected prop name from `onUpdateBlockStatus` to `handleUpdateBlockStatus`
            'strategic_dashboard': <StrategicDashboardView conversations={conversations} weeks={availableWeeks} modules={modules} contentUnits={contentUnits} constitutionText={masterContext.constitution} teacherProfile={masterContext.teacherProfile} onClose={() => setView('lobby')} onUpdateWeekTheme={handleUpdateWeekTheme} onUpdateBlockObjective={handleUpdateBlockObjective} onGenerateStrategicSuggestions={handleGenerateStrategicSuggestions} onSaveStrategicData={handleUpdateStrategicData} onGenerateBlockDetails={handleGenerateBlockDetails} onUpdateWeekDetails={handleUpdateWeekDetails} onUpdateBlockDetails={handleUpdateBlockDetails} onStartPlanning={handleStartPlanningForWeek} onUpdateBlockModule={handleUpdateBlockModule} onUpdateBlockStatus={handleUpdateBlockStatus} onUpdateBlockTipologia={handleUpdateBlockTipologia} onToggleFslPeriod={handleToggleFslPeriod} showToast={showToast} />,
            'toolkit': <ToolkitView shortcuts={shortcuts} categories={categories} onClose={() => setView('lobby')} onAddShortcut={addShortcut} onUpdateShortcut={updateShortcut} onDeleteShortcut={deleteShortcut} onAddCategory={addCategory} onUpdateCategory={updateCategory} onDeleteCategory={deleteCategory} onBulkUpdateShortcuts={bulkUpdateShortcuts} onBulkUpdateCategories={bulkUpdateCategories} showToast={showToast} />,
            'lezione': <InAulaView conversations={conversations} onClose={() => setView('lobby')} students={students} onNavigateToBlock={handleNavigateToBlock} onFormatMultipleBlocks={handleFormatBlocks} onRecordAttendance={handleRecordAttendanceForBlock} onSaveGroups={handleSaveGroupsForBlock} onAddArtifact={handleAddArtifactForBlock} onDeleteArtifact={handleDeleteArtifactForBlock} onOpenLessonNotesModal={setLessonNotesModalInfo} onDeleteLessonNotes={handleDeleteLessonNotes} onGenerateAnalysis={handleGenerateAnalysis} analysisLoadingBlockId={analysisLoadingBlockId} onUpdateGroups={handleUpdateGroupsForBlock} onUpdateGroupNotes={handleUpdateGroupNotesForBlock} showToast={showToast} masterContext={masterContext} onUpdateBlockStatus={handleUpdateBlockStatus} onAddLink={handleAddLinkForBlock} onDeleteLink={handleDeleteLinkForBlock} onUpdateCloudLink={handleUpdateBlockCloudLink} notebooks={notebooks} onAddNotebook={addNotebook} onUpdateLinkedNotebooks={handleUpdateBlockLinkedNotebooks} onAvviaLezione={handleAvviaLezione} onChiudiLezione={handleChiudiLezione} onAddMaterial={handleAddLessonMaterial} onRemoveMaterial={handleRemoveLessonMaterial} onSetAttendance={handleUpdateLiveAttendance} onAddEvaluation={handleAddLessonEvaluation} onRemoveEvaluation={handleRemoveLessonEvaluation} onAutoSaveNotes={handleAutoSaveLessonNotes} onGenerateLessonNoteAnalysis={handleGenerateLessonNoteAnalysis} onSaveClassroomUrl={handleSaveClassroomUrl} />,
            'classroom_trend': <ClassroomTrendView conversations={conversations} students={students} onClose={() => setView('lobby')} />,
            'groups_archive': <GroupsArchiveView conversations={conversations} students={students} onClose={() => setView('lobby')} masterContext={masterContext} onUpdateBlock={handleUpdateBlockInConversation} />,
            'student_profile': <StudentProfileView student={selectedStudent!} onClose={() => setView('roster')} onUpdateNotes={updateStudentNotes} onUpdateSummary={updateStudentSummary} onOpenImportModal={handleOpenImportModal} conversations={conversations} />,
            'roster': <StudentRosterView students={students} onSelectStudent={handleSelectStudent} onClose={() => setView('lobby')} />,
            'notebooklm': <NotebookLMView notebooks={notebooks} onClose={() => setView('lobby')} onAddNotebook={() => handleOpenAddNotebookModal()} onEditNotebook={handleOpenAddNotebookModal} onRemoveNotebook={removeNotebook} onAccessNotebook={accessNotebook} onManageNotes={setNotebookForNotes} />,
            'planning': <PlanningView key={activeConversation?.id} conversation={activeConversation!} onUpdateWeekPlan={handleUpdateWeekPlan} isLoading={isLoading} onSendMessage={handleSendPlanningMessage} onReEditBlock={handleReEditBlock} onClose={() => setView('strategic_dashboard')} masterContext={masterContext} initialTab={initialPlanningTab} onInitialTabConsumed={resetInitialPlanningTab} useGoogleSearch={useGoogleSearch} onGoogleSearchChange={setUseGoogleSearch} onShowConfirmation={setConfirmationProps} currentModeId={masterContext.currentModeId} onModeChange={handlePlanningModeChange} onSaveModules={handleSaveConversationModules} onAddActivity={handleAddActivity} />,
            'chat': <ChatView conversation={activeConversation} students={students} onSendMessage={handleSendMessage} isLoading={isLoading} useGoogleSearch={useGoogleSearch} onGoogleSearchChange={setUseGoogleSearch} onShowToast={showToast} onOpenImageGenerator={openImageModal} currentModeId={masterContext.currentModeId} onModeChange={handleModeChange} pendingFirstMessage={pendingFirstMessage} onConsumeFirstMessage={() => setPendingFirstMessage(null)} />
          }[currentView]
        }
      </div>
      
      

      <ImageGenerationModal isOpen={modalState.image} onClose={() => setModalState(s=>({...s, image: false}))} onGenerate={handleGenerateImage} isLoading={isLoading} />
      
      
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

      <SaltaLezioneModal
          isOpen={!!pendingSaltaInfo}
          onClose={() => setPendingSaltaInfo(null)}
          blockSummary={pendingSaltaInfo?.block.lessonTitle || pendingSaltaInfo?.block.objective || ''}
          onChoice={handleSaltaChoice}
      />

      {notebookSuggestion && (
        <div className="fixed bottom-5 right-5 z-50 px-4 py-3 rounded-md shadow-lg text-white text-sm font-medium flex items-center transition-all duration-300 ease-in-out bg-gray-700 border border-gray-600 animate-fade-in-down">
            <div>
                <p className="font-semibold">Contenuto preparato per NotebookLM!</p>
                <p className="text-xs text-gray-300">Vuoi salvare il notebook in cui lavorerai?</p>
            </div>
            <button onClick={() => { setNotebookSuggestion(null); handleOpenAddNotebookModal({ title: notebookSuggestion.title }); }} className="ml-4 px-3 py-1 bg-blue-600 rounded-md text-xs hover:bg-blue-700">Sì, aggiungi</button>
            <button onClick={() => setNotebookSuggestion(null)} className="ml-2 px-3 py-1 bg-gray-600 rounded-md text-xs hover:bg-gray-500">No, grazie</button>
        </div>
      )}

    </>
  );
};

export default MainApp;
