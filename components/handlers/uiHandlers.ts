import React from 'react';
import type { Conversation, Student, Notebook } from '../../types';

export interface UiHandlerDeps {
  updateConversation: (id: string, updater: Partial<Conversation> | ((c: Conversation) => Conversation)) => void;
  handleSelectConversation: (id: string) => void;
  setSelectedStudent: React.Dispatch<React.SetStateAction<Student | null>>;
  setInitialPlanningTab: React.Dispatch<React.SetStateAction<'laboratorio' | 'contenutoMaster' | null>>;
  setNotebookToEdit: React.Dispatch<React.SetStateAction<Partial<Notebook> | null>>;
  setModalState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setView: (v: string) => void;
}

export function createUiHandlers(deps: UiHandlerDeps) {
  const { updateConversation, handleSelectConversation, setSelectedStudent, setInitialPlanningTab, setNotebookToEdit, setModalState, setView } = deps;

  const handleSelectStudent = (student: Student) => {
    setSelectedStudent(student);
    setView('student_profile');
  };

  const handleNavigateToBlock = (convoId: string, blockIndex: number) => {
    handleSelectConversation(convoId);
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      return {
        ...convo,
        weekPlan: { ...convo.weekPlan, activeBlockIndex: blockIndex },
      };
    });
    setInitialPlanningTab('contenutoMaster');
    setView('chat');
  };

  const handleOpenAddNotebookModal = (data?: Partial<Notebook>) => {
    setNotebookToEdit(data || null);
    setModalState(s => ({ ...s, addNotebook: true }));
  };

  return {
    handleSelectStudent,
    handleNavigateToBlock,
    handleOpenAddNotebookModal,
  };
}
