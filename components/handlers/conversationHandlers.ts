import React from 'react';
import type { Conversation, Message, Mode, WeekRouteInfo, Evaluation } from '../../types';
import { MODES, ADA_QUICK_CHAT_ID } from '../../constants';

export interface ConversationHandlerDeps {
  conversations: Conversation[];
  conversationsRef: React.MutableRefObject<Conversation[]>;
  updateConversation: (id: string, updater: Partial<Conversation> | ((c: Conversation) => Conversation)) => void;
  addMessageToConversation: (id: string, message: Message) => void;
  activeConversationId: string | null;
  selectConversationHook: (id: string) => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  newConversationHook: () => void;
  getOrCreateConversationForWeek: (weekInfo: WeekRouteInfo) => Conversation;
  handleSelectConversation: (id: string) => void;
  masterContextCurrentModeId: string | undefined;
  handleSaveMode: (modeId: string) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  setView: (v: string) => void;
  addEvaluationToStudent: (studentId: string, evaluation: Evaluation) => void;
}

export function createConversationHandlers(deps: ConversationHandlerDeps) {
  const {
    conversationsRef, updateConversation, addMessageToConversation,
    activeConversationId, selectConversationHook, setConversations, newConversationHook,
    getOrCreateConversationForWeek, handleSelectConversation,
    masterContextCurrentModeId, handleSaveMode, showToast, setView, addEvaluationToStudent,
  } = deps;

  const handleModeChange = (newModeId: Mode['id']) => {
    const newMode = MODES.find(m => m.id === newModeId);
    if (!newMode || newMode.id === masterContextCurrentModeId) return;
    handleSaveMode(newModeId);
    if (activeConversationId) {
      addMessageToConversation(activeConversationId, {
        id: `msg-mode-${Date.now()}`, role: 'assistant', content: newMode.introMessage,
      });
    }
    showToast(`Modalità cambiata in: ${newMode.label}`, 'info');
  };

  const handlePlanningModeChange = (newModeId: Mode['id']) => {
    const newMode = MODES.find(m => m.id === newModeId);
    if (!newMode || newMode.id === masterContextCurrentModeId) return;
    handleSaveMode(newModeId);
    showToast(`Modalità: ${newMode.label}`, 'info');
  };

  const handleOpenConversaConAda = () => {
    const existing = conversationsRef.current.find(c => c.id === ADA_QUICK_CHAT_ID);
    if (!existing) {
      const quickChat: Conversation = {
        id: ADA_QUICK_CHAT_ID,
        title: 'Conversa con Ada',
        messages: [],
      };
      setConversations([quickChat, ...conversationsRef.current]);
    }
    handleSelectConversation(ADA_QUICK_CHAT_ID);
  };

  const handleStartPlanningForWeek = (weekInfo: WeekRouteInfo) => {
    const conversation = getOrCreateConversationForWeek(weekInfo);
    handleSelectConversation(conversation.id);
  };

  const handleNewConversationClick = () => {
    newConversationHook();
    setView('chat');
  };

  const handleEvaluationMessage = (conversation: Conversation, userInput: string) => {
    if (!conversation.studentId) return;

    if (conversation.evaluationState === 'AWAITING_VALUE') {
      const tempEvaluation = { date: new Date().toISOString(), value: userInput, notes: '' };
      updateConversation(conversation.id, { evaluationState: 'AWAITING_NOTES', tempEvaluation });
      addMessageToConversation(conversation.id, {
        id: `msg-ada-${Date.now()}`, role: 'assistant',
        content: 'Ottimo. Vuoi aggiungere delle note a questa valutazione?',
      });
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
      addMessageToConversation(conversation.id, {
        id: `msg-ada-${Date.now()}`, role: 'assistant',
        content: 'Valutazione registrata con successo nella scheda della studentessa.',
      });
      showToast('Valutazione salvata!', 'success');
    }
  };

  return {
    handleModeChange,
    handlePlanningModeChange,
    handleOpenConversaConAda,
    handleStartPlanningForWeek,
    handleNewConversationClick,
    handleEvaluationMessage,
  };
}
