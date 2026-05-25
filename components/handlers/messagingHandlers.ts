import React from 'react';
import type { Conversation, Message, WeekRouteInfo, Student, PlanningActionPayload, GroundingSource } from '../../types';
import type { useMasterContext } from '../../hooks/useMasterContext';
import * as GeminiService from '../../services/gemini';
import { GEMINI_API_ERROR_MESSAGE } from '../../constants';
import { fileToAttachment } from '../../utils';

export interface MessagingHandlerDeps {
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  conversationsRef: React.MutableRefObject<Conversation[]>;
  conversations: Conversation[];
  availableWeeks: WeekRouteInfo[];
  students: Student[];
  masterContext: ReturnType<typeof useMasterContext>;
  useGoogleSearch: boolean;
  latestRequestRef: React.MutableRefObject<symbol | null>;
  updateConversation: (id: string, updater: Partial<Conversation> | ((c: Conversation) => Conversation)) => void;
  addMessageToConversation: (id: string, message: Message) => void;
  updateMessageInConversation: (id: string, messageId: string, updates: Partial<Message>) => void;
  updateConversationTitle: (id: string, newTitle: string) => void;
  handleEvaluationMessage: (conversation: Conversation, userInput: string) => void;
  processPlanningMessage: (args: {
    content: string;
    file?: File;
    actionPayload?: PlanningActionPayload;
    activeConversation: Conversation;
    masterContext: ReturnType<typeof useMasterContext>;
    currentModeId: string | undefined;
    students: Student[];
    useGoogleSearch: boolean;
    conversations: Conversation[];
    availableWeeks: WeekRouteInfo[];
  }) => Promise<void>;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setModalState: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}

export function createMessagingHandlers(deps: MessagingHandlerDeps) {
  const {
    activeConversationId, activeConversation, conversationsRef, conversations, availableWeeks,
    students, masterContext, useGoogleSearch, latestRequestRef,
    updateConversation, addMessageToConversation, updateMessageInConversation, updateConversationTitle,
    handleEvaluationMessage, processPlanningMessage, showToast, setIsLoading, setModalState,
  } = deps;

  const handleSendMessage = async (content: string, file?: File) => {
    if (!activeConversationId) {
      showToast('Seleziona una conversazione prima di inviare un messaggio.', 'info');
      return;
    }
    const activeConvo = conversationsRef.current.find(c => c.id === activeConversationId);
    if (!activeConvo || activeConvo.weekPlan) return;

    setIsLoading(true);
    const currentRequestId = Symbol('gemini-request');
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
        .catch(err => { console.error('Failed to generate title:', err); });
    }

    if (content.trim().toLowerCase() === '/valuta' && activeConvo.studentId) {
      updateConversation(activeConvo.id, { evaluationState: 'AWAITING_VALUE' });
      updateMessageInConversation(activeConvo.id, assistantPlaceholder.id, {
        content: "Inserisci la valutazione (es. 'Ottimo', 'In recupero', '7/10').",
      });
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
        activeConvo.messages, content, attachmentForMessage, masterContext,
        masterContext.currentModeId, useGoogleSearch, conversations, availableWeeks, undefined, students
      );

      let accumulatedResponse = '';
      let finalSources: GroundingSource[] = [];
      for await (const chunk of responseStream) {
        if (latestRequestRef.current !== currentRequestId) return;
        accumulatedResponse += (chunk.text ?? '');
        if (chunk.candidates?.[0]?.groundingMetadata?.groundingChunks) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          finalSources = chunk.candidates[0].groundingMetadata.groundingChunks
            .filter((c: any) => c.web && c.web.uri)
            .map((c: any) => ({ uri: c.web.uri, title: c.web.title || c.web.uri }));
        }
        updateMessageInConversation(activeConvo.id, assistantPlaceholder.id, { content: accumulatedResponse, sources: finalSources });
      }
    } catch (e) {
      if (latestRequestRef.current === currentRequestId) {
        console.error('Error calling Gemini API:', e);
        let errorString = GEMINI_API_ERROR_MESSAGE;
        if (e instanceof Error) {
          errorString = e.message;
        } else if (e && typeof e === 'object' && 'message' in e) {
          errorString = String((e as { message: unknown }).message);
        } else {
          try { errorString = JSON.stringify(e); } catch { /* noop */ }
        }
        const finalErrorMessage = `**Errore API:**\n\n\`\`\`\n${errorString}\n\`\`\``;
        updateMessageInConversation(activeConvo.id, assistantPlaceholder.id, { content: finalErrorMessage });
        showToast(errorString, 'error');
      }
    } finally {
      if (latestRequestRef.current === currentRequestId) setIsLoading(false);
    }
  };

  const handleGenerateImage = async (prompt: string, aspectRatio: string, numberOfImages: number, adaStyle: boolean) => {
    if (!activeConversationId) { showToast('Seleziona una conversazione.', 'info'); return; }
    const currentRequestId = Symbol('gemini-image-request');
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
      showToast('Immagini generate!', 'success');
    } catch (error) {
      if (latestRequestRef.current === currentRequestId) {
        const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto durante la generazione dell'immagine.";
        console.error('Error generating image:', error);
        showToast(errorMessage, 'error');
        updateMessageInConversation(activeConversationId, assistantPlaceholderId, { content: `Impossibile generare l'immagine: ${errorMessage}` });
      }
    } finally {
      if (latestRequestRef.current === currentRequestId) setIsLoading(false);
    }
  };

  const handleSendPlanningMessage = async (content: string, file?: File, actionPayload?: PlanningActionPayload) => {
    if (!activeConversation) return;

    if (content.trim().toLowerCase() === '/valida contenuto' && !actionPayload) {
      const block = activeConversation.weekPlan?.blocks[activeConversation.weekPlan.activeBlockIndex];
      const lastAssistantMessage = (block?.messages || [])
        .filter(m => m.role === 'assistant' && m.content && m.content !== '...' && m.actions)
        .pop();
      if (!lastAssistantMessage) {
        showToast("Non c'è una risposta dell'assistente da validare.", 'error');
        return;
      }
      actionPayload = { action: 'validate_and_archive', messageId: lastAssistantMessage.id };
    }

    const currentRequestId = Symbol('gemini-planning-request');
    latestRequestRef.current = currentRequestId;
    setIsLoading(true);

    let planningTimeoutId: ReturnType<typeof setTimeout>;
    const planningTimeoutPromise = new Promise<never>((_, reject) => {
      planningTimeoutId = setTimeout(
        () => reject(new Error('Ada non ha risposto in tempo. Controlla la connessione e riprova.')),
        120_000
      );
    });

    try {
      await Promise.race([
        processPlanningMessage({
          content, file, actionPayload, activeConversation, masterContext,
          currentModeId: masterContext.currentModeId, students, useGoogleSearch, conversations, availableWeeks,
        }),
        planningTimeoutPromise,
      ]);
    } catch (e) {
      if (latestRequestRef.current === currentRequestId) {
        console.error('Error in planning flow:', e);
        const errorMessage = e instanceof Error ? e.message : 'Si è verificato un errore durante la pianificazione.';
        showToast(errorMessage, 'error');
      }
    } finally {
      clearTimeout(planningTimeoutId!);
      if (latestRequestRef.current === currentRequestId) setIsLoading(false);
    }
  };

  return {
    handleSendMessage,
    handleGenerateImage,
    handleSendPlanningMessage,
  };
}
