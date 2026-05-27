import React from 'react';
import type { Conversation, Student, LessonMaterial, LessonEvaluation, LessonNoteAnalysis } from '../../types';
import * as GeminiService from '../../services/gemini';

export interface BlockNoteHandlerDeps {
  conversationsRef: React.MutableRefObject<Conversation[]>;
  updateConversation: (id: string, updater: Partial<Conversation> | ((c: Conversation) => Conversation)) => void;
  students: Student[];
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  setAnalysisLoadingBlockId: React.Dispatch<React.SetStateAction<string | null>>;
}

export function createBlockNoteHandlers(deps: BlockNoteHandlerDeps) {
  const { conversationsRef, updateConversation, students, showToast, setAnalysisLoadingBlockId } = deps;

  const handleSaveLessonNotes = (convoId: string, blockIndex: number, notes: string) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan.blocks];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], lessonNotes: notes };
      return { ...convo, weekPlan: { ...convo.weekPlan, blocks: newBlocks } };
    });
    showToast('Note sulla lezione salvate.', 'success');
  };

  const handleDeleteLessonNotes = (convoId: string, blockIndex: number) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan.blocks];
      const { lessonNotes: _ln, adaAnalysis: _aa, ...rest } = newBlocks[blockIndex];
      newBlocks[blockIndex] = rest;
      return { ...convo, weekPlan: { ...convo.weekPlan, blocks: newBlocks } };
    });
    showToast('Note sulla lezione cancellate.', 'success');
  };

  const handleGenerateAnalysis = async (convoId: string, blockIndex: number) => {
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
      showToast('Analisi di Ada generata!', 'success');
    } catch (error) {
      console.error('Analysis generation failed:', error);
      showToast(error instanceof Error ? error.message : "Errore durante l'analisi.", 'error');
    } finally {
      setAnalysisLoadingBlockId(null);
    }
  };

  const handleAddLinkForBlock = (convoId: string, blockIndex: number, title: string, url: string) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan!.blocks];
      const currentLinks = newBlocks[blockIndex].usefulLinks || [];
      const newLink = { id: `link-${Date.now()}`, title, url };
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        usefulLinks: [...currentLinks, newLink],
      };
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
  };

  const handleDeleteLinkForBlock = (convoId: string, blockIndex: number, linkId: string) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan!.blocks];
      const currentLinks = newBlocks[blockIndex].usefulLinks || [];
      const newLinks = currentLinks.filter(link => link.id !== linkId);
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], usefulLinks: newLinks };
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
  };

  const handleUpdateBlockCloudLink = (convoId: string, blockIndex: number, url: string) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan!.blocks];
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        materialsCloudLink: url || undefined,
      };
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
    showToast(url ? 'Cartella materiali collegata!' : 'Collegamento rimosso.', 'success');
  };

  const handleSaveClassroomUrl = (convoId: string, blockIndex: number, url: string) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan!.blocks];
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        classroomUrl: url || undefined,
      };
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
  };

  const handleUpdateBlockLinkedNotebooks = (convoId: string, blockIndex: number, notebookIds: string[]) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan!.blocks];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], linkedNotebookIds: notebookIds };
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
  };

  const handleAddLessonMaterial = (convoId: string, blockIndex: number, material: Omit<LessonMaterial, 'id' | 'addedAt'>) => {
    const newMaterial: LessonMaterial = {
      ...material,
      id: crypto.randomUUID(),
      addedAt: new Date().toISOString(),
    };
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan.blocks];
      const current = newBlocks[blockIndex].lessonMaterials ?? [];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], lessonMaterials: [...current, newMaterial] };
      return { ...convo, weekPlan: { ...convo.weekPlan, blocks: newBlocks } };
    });
  };

  const handleRemoveLessonMaterial = (convoId: string, blockIndex: number, materialId: string) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan.blocks];
      const current = newBlocks[blockIndex].lessonMaterials ?? [];
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        lessonMaterials: current.filter(m => m.id !== materialId),
      };
      return { ...convo, weekPlan: { ...convo.weekPlan, blocks: newBlocks } };
    });
  };

  // Silent autosave — no toast, for debounced textarea in in-corso tab
  const handleAutoSaveLessonNotes = (convoId: string, blockIndex: number, notes: string) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan.blocks];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], lessonNotes: notes };
      return { ...convo, weekPlan: { ...convo.weekPlan, blocks: newBlocks } };
    });
  };

  const handleUpdateLiveAttendance = (convoId: string, blockIndex: number, presentIds: string[], lateIds: string[]) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan.blocks];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], presentStudentIds: presentIds, lateStudentIds: lateIds };
      return { ...convo, weekPlan: { ...convo.weekPlan, blocks: newBlocks } };
    });
  };

  const handleAddLessonEvaluation = (convoId: string, blockIndex: number, evaluation: Omit<LessonEvaluation, 'id' | 'date'>) => {
    const newEval: LessonEvaluation = {
      ...evaluation,
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
    };
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan.blocks];
      const current = newBlocks[blockIndex].lessonEvaluations ?? [];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], lessonEvaluations: [...current, newEval] };
      return { ...convo, weekPlan: { ...convo.weekPlan, blocks: newBlocks } };
    });
    showToast('Valutazione aggiunta.', 'success');
  };

  const handleRemoveLessonEvaluation = (convoId: string, blockIndex: number, evaluationId: string) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan.blocks];
      const current = newBlocks[blockIndex].lessonEvaluations ?? [];
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        lessonEvaluations: current.filter(e => e.id !== evaluationId),
      };
      return { ...convo, weekPlan: { ...convo.weekPlan, blocks: newBlocks } };
    });
  };

  const handleGenerateLessonNoteAnalysis = async (convoId: string, blockIndex: number): Promise<void> => {
    const convo = conversationsRef.current.find(c => c.id === convoId);
    if (!convo?.weekPlan) return;
    const block = convo.weekPlan.blocks[blockIndex];
    if (!block.lessonNotes?.trim()) {
      showToast('Scrivi prima alcune note sulla lezione.', 'error');
      return;
    }

    const blockUniqueId = `${convoId}-${blockIndex}`;
    setAnalysisLoadingBlockId(blockUniqueId);
    try {
      const studentList = students.map(s => ({ id: s.id, name: s.name }));
      const partial = await GeminiService.generateLessonNoteAnalysis(block.lessonNotes, studentList);
      const analysis: LessonNoteAnalysis = {
        ...partial,
        rawNotes: block.lessonNotes,
        analyzedAt: new Date().toISOString(),
      };
      updateConversation(convoId, c => {
        if (!c.weekPlan) return c;
        const newBlocks = [...c.weekPlan.blocks];
        newBlocks[blockIndex] = { ...newBlocks[blockIndex], lessonNoteAnalysis: analysis };
        return { ...c, weekPlan: { ...c.weekPlan, blocks: newBlocks } };
      });
      showToast('Analisi note completata!', 'success');
    } catch (error) {
      console.error('Note analysis failed:', error);
      showToast(error instanceof Error ? error.message : "Errore durante l'analisi.", 'error');
    } finally {
      setAnalysisLoadingBlockId(null);
    }
  };

  return {
    handleSaveLessonNotes,
    handleDeleteLessonNotes,
    handleGenerateAnalysis,
    handleAddLinkForBlock,
    handleDeleteLinkForBlock,
    handleUpdateBlockCloudLink,
    handleUpdateBlockLinkedNotebooks,
    handleAddLessonMaterial,
    handleRemoveLessonMaterial,
    handleAutoSaveLessonNotes,
    handleUpdateLiveAttendance,
    handleAddLessonEvaluation,
    handleRemoveLessonEvaluation,
    handleGenerateLessonNoteAnalysis,
    handleSaveClassroomUrl,
  };
}
