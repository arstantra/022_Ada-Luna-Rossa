// hooks/useConversations.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Conversation, Message } from '../types';
import * as db from '../services/db';

export const useConversations = (showToast: (message: string, type?: 'success' | 'info' | 'error') => void) => {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const conversationsRef = useRef(conversations);
    // IDs di conversazioni da salvare dopo il prossimo commit React
    // (fallback per quando React non esegue il functional updater in modo eager)
    const pendingSavesRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    // Flush dei salvataggi pendenti dopo ogni commit React.
    // Garantisce che db.saveConversation venga sempre chiamato con lo stato corretto,
    // anche quando React 18 con batching automatico non esegue il functional updater
    // in modo eager (es. aggiornamenti sincroni dentro event handler con pending lanes).
    useEffect(() => {
        if (pendingSavesRef.current.size === 0) return;
        const toSave = [...pendingSavesRef.current];
        pendingSavesRef.current.clear();
        toSave.forEach(convoId => {
            const convo = conversations.find(c => c.id === convoId);
            if (convo) {
                db.saveConversation(convo).catch(err =>
                    console.error("Pending save failed for", convoId, err)
                );
            }
        });
    }, [conversations]);

    useEffect(() => {
        async function loadData() {
            try {
                const savedConvos = await db.getAllConversations();
                
                // VALIDATION: Ensure all conversations are valid objects before processing.
                const validConvos = savedConvos.filter((c: any): c is Conversation => 
                    c && typeof c.id === 'string' && typeof c.title === 'string' && Array.isArray(c.messages)
                );

                // Most recent first, using robust string comparison
                const sortedConvos = validConvos.sort((a, b) => b.id.localeCompare(a.id));
                
                setConversations(sortedConvos);
            } catch (error) {
                console.error("Failed to load conversations from DB:", error);
                showToast("Errore nel caricamento delle conversazioni.", "error");
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [showToast]); // Only on initial mount

    const handleNewConversation = useCallback(async () => {
        const newConversation: Conversation = {
            id: `conv-${Date.now()}`,
            title: `Nuova Conversazione`,
            messages: [],
            labelIds: [],
        };
        setConversations(prev => [newConversation, ...prev]);
        setActiveConversationId(newConversation.id);
        try {
            await db.saveConversation(newConversation);
        } catch (error) {
            console.error("Failed to save new conversation:", error);
            showToast("Errore nel salvataggio della conversazione.", "error");
        }
    }, [showToast]);

    const handleSelectConversation = useCallback((id: string) => {
        setActiveConversationId(id);
    }, []);

    const handleRenameConversation = useCallback(async (id: string, newTitle: string) => {
        let convoToUpdate: Conversation | undefined;
        setConversations(prev => prev.map(c => {
            if (c.id === id) {
                convoToUpdate = { ...c, title: newTitle };
                return convoToUpdate;
            }
            return c;
        }));
        if (convoToUpdate) {
            try {
                await db.saveConversation(convoToUpdate);
            } catch (error) {
                console.error("Failed to rename conversation:", error);
                showToast("Errore nel rinominare la conversazione.", "error");
            }
        }
    }, [showToast]);

    const handleDeleteConversation = useCallback(async (idToDelete: string) => {
        const remaining = conversationsRef.current.filter(c => c.id !== idToDelete);
        setConversations(remaining);

        if (activeConversationId === idToDelete) {
            setActiveConversationId(remaining.length > 0 ? remaining[0].id : null);
        }
        
        try {
            await db.deleteConversation(idToDelete);
            showToast('Conversazione eliminata', 'success');
        } catch (error) {
            console.error("Failed to delete conversation:", error);
            showToast("Errore nell'eliminazione della conversazione.", "error");
        }
    }, [activeConversationId, showToast]);

    const handleReorderConversations = useCallback(async (draggedId: string, targetId: string) => {
        let reorderedConversations: Conversation[] = [];
        setConversations(prev => {
            const list = [...prev];
            const draggedIndex = list.findIndex(c => c.id === draggedId);
            const targetIndex = list.findIndex(c => c.id === targetId);
            if (draggedIndex === -1 || targetIndex === -1) return prev;
            const [draggedItem] = list.splice(draggedIndex, 1);
            list.splice(targetIndex, 0, draggedItem);
            reorderedConversations = list;
            return list;
        });
        if (reorderedConversations.length > 0) {
            try {
                await db.bulkSaveConversations(reorderedConversations);
            } catch (error) {
                console.error("Failed to reorder conversations:", error);
                showToast("Errore nel riordinare le conversazioni.", "error");
            }
        }
    }, [showToast]);

    const updateConversation = useCallback(async (convoId: string, updater: Partial<Conversation> | ((convo: Conversation) => Conversation)) => {
        let updatedConvo: Conversation | null = null;
        setConversations(prev =>
            prev.map(c => {
                if (c.id === convoId) {
                    updatedConvo = typeof updater === 'function' ? updater(c) : { ...c, ...updater };
                    return updatedConvo;
                }
                return c;
            })
        );
        if (updatedConvo) {
            // Percorso rapido: React ha eseguito il functional updater in modo eager
            // (ottimizzazione standard quando non ci sono pending lanes).
            try {
                await db.saveConversation(updatedConvo);
            } catch (error) {
                console.error("Failed to update conversation:", error);
                showToast("Errore nell'aggiornare la conversazione.", "error");
            }
        } else {
            // Percorso di fallback: React ha rimandato l'esecuzione del functional updater
            // (accade quando ci sono pending state updates, es. durante lo streaming).
            // Aggiungiamo l'ID alla lista dei salvataggi pendenti: il useEffect li salverà
            // dopo il prossimo commit React, quando lo stato è già corretto.
            pendingSavesRef.current.add(convoId);
        }
    }, [showToast]);
    
    const addMessageToConversation = useCallback((convoId: string, message: Message) => {
        updateConversation(convoId, c => ({ ...c, messages: [...c.messages, message] }));
    }, [updateConversation]);
    
    const updateMessageInConversation = useCallback((convoId: string, messageId: string, updates: Partial<Message>) => {
        updateConversation(convoId, c => ({ ...c, messages: c.messages.map(m => m.id === messageId ? { ...m, ...updates } : m) }));
    }, [updateConversation]);

    const updateConversationTitle = useCallback((convoId: string, newTitle: string) => {
        updateConversation(convoId, { title: newTitle });
    }, [updateConversation]);
    
    const updateConversationLabels = useCallback((convoId: string, labelIds: string[]) => {
      updateConversation(convoId, { labelIds });
    }, [updateConversation]);

    const bulkUpdateConversations = useCallback(async (newConversations: Conversation[]) => {
        setConversations(newConversations);
        try {
            await db.bulkSaveConversations(newConversations);
        } catch (error) {
            console.error("Failed to bulk update conversations:", error);
            showToast("Errore nel salvataggio multiplo delle conversazioni.", "error");
        }
    }, [showToast]);

    return {
        conversations,
        isLoading,
        setConversations: bulkUpdateConversations,
        activeConversationId,
        handleNewConversation,
        handleSelectConversation,
        handleRenameConversation,
        handleDeleteConversation,
        handleReorderConversations,
        addMessageToConversation,
        updateMessageInConversation,
        updateConversation,
        updateConversationTitle,
        updateConversationLabels,
        conversationsRef,
    };
};
