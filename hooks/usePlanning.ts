import { useCallback } from 'react';
import type { Conversation, Message, BlockDetails, PlanningActionPayload, WeekPlan, Mode, Action, Student, ContentBlock, ModuleDetails, Evaluation, ValidateAndArchivePayload, WeekRouteInfo, BlockSource } from '../types';
import type { useMasterContext } from './useMasterContext';
import { fileToAttachment } from '../utils';
import * as GeminiService from '../services/gemini';
import { marked } from 'marked';
import { useConstitutionCache } from '../contexts/ConstitutionCacheContext';
import { GEMINI_API_ERROR_MESSAGE } from '../constants';

type UpdateConversationFunction = (convoId: string, updater: Partial<Conversation> | ((convo: Conversation) => Conversation)) => void;
type ShowToastFunction = (message: string, type?: 'success' | 'info' | 'error') => void;
type RecordAttendanceFunction = (block: BlockDetails, blockIndex: number, weekNumber: number, allWeekStudentIds: string[], presentStudentIds: string[]) => void;
type AddEvaluationFunction = (studentId: string, evaluation: Evaluation) => void;

interface PlanningMessageParams {
    content: string;
    file?: File;
    actionPayload?: PlanningActionPayload;
    activeConversation: Conversation;
    masterContext: ReturnType<typeof useMasterContext>;
    currentModeId: Mode['id'];
    students: Student[];
    useGoogleSearch: boolean;
    conversations: Conversation[];
    availableWeeks: WeekRouteInfo[];
}

const areAllBlocksFinalized = (blocks: BlockDetails[]): boolean => {
    return blocks.every(block => {
        if (block.status === 'saltato' || block.status === 'formazione scuola-lavoro') {
            return true; // These are final states by definition.
        }
        if (block.status === 'normale') {
            // A 'normale' block is final only if it has been validated and has content.
            return !!block.contentBlocks && block.contentBlocks.length > 0;
        }
        // Any other status (like 'da definire') is not final.
        return false;
    });
};

const createMasterContentHeader = async (block: BlockDetails, weekPlan: WeekPlan, blockIndex: number): Promise<string> => {
    const escapeHtml = (unsafe: string | undefined): string => {
        if (!unsafe) return '';
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    };

    let headerHtml = `<h1>Settimana ${weekPlan.weekNumber}: ${escapeHtml(weekPlan.theme)}</h1>`;
    headerHtml += `<h2>Blocco ${blockIndex + 1}: Obiettivo: ${escapeHtml(block.objective || 'Non definito')}</h2>`;
    
    if (block.lessonTitle) {
        // Use marked to parse the markdown from the strategic dashboard
        const contentFromConstitution = await marked.parse(block.lessonTitle);
        headerHtml += contentFromConstitution;
    } 
    else if (block.status === 'saltato') {
        headerHtml += `<p><strong>Stato:</strong> Blocco Saltato</p>`;
        if (block.reason) {
            headerHtml += `<p><strong>Motivo:</strong> ${escapeHtml(block.reason)}</p>`;
        }
    } else if (block.status === 'formazione scuola-lavoro') {
        headerHtml += `<p><strong>Stato:</strong> Formazione Scuola-Lavoro (FSL)</p>`;
    }
    
    headerHtml += `<hr><p><br></p>`;

    return headerHtml;
};


export const usePlanning = (updateConversation: UpdateConversationFunction, showToast: ShowToastFunction, recordAttendanceForBlock: RecordAttendanceFunction, addEvaluationToStudent: AddEvaluationFunction) => {
    const { moduleMap } = useConstitutionCache();
    
    const processPlanningMessage = useCallback(async (params: PlanningMessageParams) => {
        const { content, file, actionPayload, activeConversation, masterContext, currentModeId, students, useGoogleSearch, conversations, availableWeeks } = params;
        const { weekPlan } = activeConversation;
        if (!weekPlan) return;

        const attachmentForMessage = file ? await fileToAttachment(file) : undefined;
        const userMessage: Message = { id: `msg-user-${Date.now()}`, role: 'user', content, attachment: attachmentForMessage };

        const blockIndex = weekPlan.activeBlockIndex;
        const blockBeforeUpdate = weekPlan.blocks[blockIndex];

        // --- SECTION: ACTION PAYLOAD HANDLING ---
        // This section processes structured actions triggered by UI buttons, bypassing the AI for deterministic state changes.
        if (actionPayload) {
            
            switch (actionPayload.action) {
                case 'initialize_normal_block': {
                    const { day, objective, module, pillar } = actionPayload;
                    
                    const moduleData = moduleMap.get(module);

                    if (!moduleData) {
                        showToast(`Dettagli per il modulo "${module}" non trovati. Controlla la formattazione della Costituzione.`, 'error');
                        return; // Stop execution
                    }
                    
                    const constitutionExcerpt = moduleData.role ? `${moduleData.role.split('.')[0]}.` : "Ispirazione non trovata.";
                    
                    const firstAssistantMessage: Message = {
                        id: `msg-ada-${Date.now()}`,
                        role: 'assistant',
                        content: `Pannello di Contesto aggiornato con **${module}** e focus su **"${pillar}"**.\n\nIniziamo a progettare il contenuto. Descrivimi il flusso della lezione o elencami i punti chiave che vuoi sviluppare.`
                    };
                    
                    updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        newBlocks[blockIndex] = {
                            ...blockBeforeUpdate,
                            status: 'normale',
                            day,
                            objective,
                            module,
                            pillar,
                            messages: [firstAssistantMessage],
                            constitutionSummary: constitutionExcerpt,
                            moduleDetails: moduleData,
                        };
                        return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
                    });
                    return; 
                }

                case 'archive_simple_state': {
                    const { day } = actionPayload;
                    const finalStatus = actionPayload.status;
                    const reason = finalStatus === 'saltato' ? actionPayload.reason : undefined;
                    
                    const headerHtml = await createMasterContentHeader({ ...blockBeforeUpdate, day, status: finalStatus, reason }, weekPlan, blockIndex);
                    const contentBlock: ContentBlock = { id: `cb-${Date.now()}`, content: headerHtml };

                    updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        newBlocks[blockIndex] = { 
                            ...newBlocks[blockIndex], 
                            day,
                            status: finalStatus, 
                            reason: reason, 
                            contentBlocks: [contentBlock],
                            messages: [] 
                        };

                        const allBlocksFinalized = areAllBlocksFinalized(newBlocks);
                        const weekPlanUpdates: Partial<WeekPlan> = {};
                        if (allBlocksFinalized && convo.weekPlan?.status === 'in progettazione') {
                            weekPlanUpdates.status = 'progettazione completata';
                            showToast('Progettazione settimana completata!', 'success');
                        }
                        
                        return { ...convo, weekPlan: { ...convo.weekPlan!, ...weekPlanUpdates, blocks: newBlocks }};
                    });
                    
                    const statusText = finalStatus === 'saltato' ? 'Saltato' : 'Formazione Scuola-Lavoro';
                    showToast(`Blocco ${blockIndex + 1} registrato come "${statusText}".`, 'success');
                    return;
                }
                
                case 'update_block_day': {
                    const { blockIndex: idxToUpdate, day, updateDefault } = actionPayload;
                    
                    updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        newBlocks[idxToUpdate] = { ...newBlocks[idxToUpdate], day };
                        return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
                    });

                    if (updateDefault) {
                        const newDefaults = { ...masterContext.blockDayDefaults, [idxToUpdate]: day };
                        masterContext.handleSaveBlockDayDefaults(newDefaults);
                    }
                    return;
                }

                case 'update_objective': {
                    const { blockIndex: idxToUpdate, newObjective } = actionPayload;
                    updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        newBlocks[idxToUpdate] = { ...newBlocks[idxToUpdate], objective: newObjective };
                        return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
                    });
                    showToast('Obiettivo aggiornato.', 'success');
                    return;
                }
                
                case 'validate_and_archive': {
                    const { messageId } = actionPayload as ValidateAndArchivePayload;
                    const headerHtml = await createMasterContentHeader(blockBeforeUpdate, weekPlan, blockIndex);

                    updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        const blockToUpdate = newBlocks[blockIndex];
                        const messageToValidate = (blockToUpdate.messages || []).find(msg => msg.id === messageId);

                        if (!messageToValidate || !messageToValidate.content) {
                            showToast("Nessun contenuto da validare.", "error");
                            return convo;
                        }
                        
                        const htmlContent = messageToValidate.content;
                        const finalContent = headerHtml + htmlContent;

                        const newMessages = (blockToUpdate.messages || []).map(m => 
                            m.id === messageId ? { ...m, actionUsed: true } : m
                        );
                        
                        newBlocks[blockIndex] = {
                            ...blockToUpdate,
                            status: 'normale',
                            contentBlocks: [{ id: `cb-${Date.now()}`, content: finalContent }],
                            messages: newMessages,
                        };

                        showToast(`Blocco ${blockIndex + 1} archiviato.`, 'success');
                        const allBlocksFinalized = areAllBlocksFinalized(newBlocks);

                        if (allBlocksFinalized && convo.weekPlan?.status === 'in progettazione') {
                            showToast('Progettazione settimana completata!', 'success');
                            return { ...convo, weekPlan: { ...convo.weekPlan!, status: 'progettazione completata', blocks: newBlocks } };
                        }
                        return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
                    });
                    return;
                }
                
                case 'add_validated_content_as_new_block': {
                    const { messageId } = actionPayload;
                    
                    updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        const blockToUpdate = newBlocks[blockIndex];
                        const messageToAdd = (blockToUpdate.messages || []).find(msg => msg.id === messageId);
                        
                        if (!messageToAdd || !messageToAdd.content) return convo;
                        
                        const htmlContent = messageToAdd.content;
                        const newBlock: ContentBlock = { id: `cb-${Date.now()}`, content: htmlContent };

                        const newMessages = (blockToUpdate.messages || []).map(m => 
                            m.id === messageId ? { ...m, actionUsed: true } : m
                        );
                        newBlocks[blockIndex] = {
                            ...blockToUpdate,
                            status: 'normale',
                            contentBlocks: [...(blockToUpdate.contentBlocks || []), newBlock],
                            messages: newMessages
                        };
                        return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
                    });
                    showToast('Nuovo blocco aggiunto al Contenuto Master.', 'success');
                    return;
                }
                
                case 'replace_entire_master_content': {
                    const { messageId } = actionPayload;
                    const headerHtml = await createMasterContentHeader(blockBeforeUpdate, weekPlan, blockIndex);

                     updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        const blockToUpdate = newBlocks[blockIndex];
                        const messageToReplaceWith = (blockToUpdate.messages || []).find(msg => msg.id === messageId);

                        if (!messageToReplaceWith || !messageToReplaceWith.content) return convo;

                        const newHtmlContent = messageToReplaceWith.content;
                        const finalContent = headerHtml + newHtmlContent;
                        const newContentBlock: ContentBlock = { id: `cb-replaced-${Date.now()}`, content: finalContent };

                        const newMessages = (blockToUpdate.messages || []).map(m => 
                            m.id === messageId ? { ...m, actionUsed: true } : m
                        );
                        newBlocks[blockIndex] = {
                            ...blockToUpdate,
                            status: 'normale',
                            contentBlocks: [newContentBlock],
                            messages: newMessages
                        };
                         return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
                    });
                     showToast('Contenuto Master sostituito con successo.', 'success');
                    return;
                }
                
                case 'delete_content_block': {
                    const { contentBlockId } = actionPayload;
                    updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        const blockToUpdate = newBlocks[blockIndex];
                        const updatedContentBlocks = (blockToUpdate.contentBlocks || []).filter(cb => cb.id !== contentBlockId);
                        newBlocks[blockIndex] = { ...blockToUpdate, contentBlocks: updatedContentBlocks };
                        return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
                    });
                    showToast('Blocco di contenuto eliminato.', 'success');
                    return;
                }

                case 'update_content_block': {
                    const { contentBlockId, newContent } = actionPayload;
                    updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        const blockToUpdate = newBlocks[blockIndex];
                        const updatedContentBlocks = (blockToUpdate.contentBlocks || []).map(cb =>
                            cb.id === contentBlockId ? { ...cb, content: newContent } : cb
                        );
                        newBlocks[blockIndex] = { ...blockToUpdate, contentBlocks: updatedContentBlocks };
                        return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
                    });
                    return;
                }
                
                case 'consolidate_and_update_content': {
                    const { newContent } = actionPayload;
                    updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        const blockToUpdate = newBlocks[blockIndex];
                        const newContentBlock: ContentBlock = { id: `cb-consolidated-${Date.now()}`, content: newContent };
                        newBlocks[blockIndex] = { ...blockToUpdate, contentBlocks: [newContentBlock] };
                        showToast("Contenuto salvato", "success");
                        return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
                    });
                    return;
                }

                case 'record_groups': {
                    const { groups } = actionPayload;
                    const blockMessages = blockBeforeUpdate.messages || [];
                    const confirmationMessage: Message = {
                        id: `msg-system-${Date.now()}`,
                        role: 'system',
                        content: `Gruppi di lavoro registrati per questo blocco.`
                    };
                
                    updateConversation(activeConversation.id, convo => {
                        const newBlocks = [...convo.weekPlan!.blocks];
                        newBlocks[blockIndex] = {
                            ...newBlocks[blockIndex],
                            allocations: {
                                type: 'group',
                                data: { groups }
                            },
                            messages: [...blockMessages, confirmationMessage]
                        };
                        return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
                    });
                    showToast('Gruppi salvati con successo!', 'success');
                    return;
                }
            }
        }

        // --- SECTION: AI-DRIVEN FLOW (Default Creative Session) ---
        // This is the default path for creative dialogue and content generation with the AI.
        const assistantPlaceholder: Message = { id: `msg-assistant-${Date.now()}`, role: 'assistant', content: '...' };
        updateConversation(activeConversation.id, convo => {
            const newBlocks = [...convo.weekPlan!.blocks];
            newBlocks[blockIndex] = { ...newBlocks[blockIndex], messages: [...(blockBeforeUpdate.messages || []), userMessage, assistantPlaceholder] };
            return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
        });

        const blockContextPrompt = `Stai progettando il Blocco ${blockIndex + 1} (${blockBeforeUpdate.day}) per la Settimana ${weekPlan.weekNumber}. Tema della settimana: ${weekPlan.theme}. Stato del blocco: ${blockBeforeUpdate.status}. ${blockBeforeUpdate.objective ? `Obiettivo didattico: ${blockBeforeUpdate.objective}` : ''} ${blockBeforeUpdate.module ? `Modulo di riferimento: ${blockBeforeUpdate.module}` : ''} ${blockBeforeUpdate.pillar ? `Pilastro: ${blockBeforeUpdate.pillar}` : ''}. Dialoga con l'utente per definire il contenuto di questo blocco. Sii proattivo e fai domande per guidare la progettazione.`;

        try {
            const responseStream = await GeminiService.streamChatResponse(
                blockBeforeUpdate.messages || [], content, attachmentForMessage, masterContext, currentModeId, useGoogleSearch, conversations, availableWeeks, blockContextPrompt, students
            );

            let accumulatedResponse = "";
            for await (const chunk of responseStream) {
                accumulatedResponse += (chunk.text || '');
                updateConversation(activeConversation.id, convo => {
                    const newBlocks = [...convo.weekPlan!.blocks];
                    const targetBlock = newBlocks[blockIndex];
                    const newMessages = (targetBlock.messages || []).map(m => m.id === assistantPlaceholder.id ? { ...m, content: accumulatedResponse } : m);
                    newBlocks[blockIndex] = { ...targetBlock, messages: newMessages };
                    return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
                });
            }

            const finalHtmlContent = await marked.parse(accumulatedResponse);
            
            updateConversation(activeConversation.id, convo => {
                const newBlocks = [...convo.weekPlan!.blocks];
                const targetBlock = newBlocks[blockIndex];

                const hasExistingContent = targetBlock.contentBlocks && targetBlock.contentBlocks.length > 0;
                
                let finalActions: Action[];
                if (hasExistingContent) {
                    finalActions = [
                        { label: "Aggiungi in fondo al Master", payload: { action: 'add_validated_content_as_new_block', messageId: assistantPlaceholder.id } },
                        { label: "Sostituisci l'intero Master", payload: { action: 'replace_entire_master_content', messageId: assistantPlaceholder.id } }
                    ];
                } else {
                    finalActions = [{ 
                        label: 'Valida Contenuto', 
                        payload: { action: 'validate_and_archive', messageId: assistantPlaceholder.id } 
                    }];
                }

                const newMessages = (targetBlock.messages || []).map(m => m.id === assistantPlaceholder.id ? { ...m, content: finalHtmlContent, actions: finalActions } : m);
                newBlocks[blockIndex] = { ...targetBlock, messages: newMessages };
                return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks }};
            });
        } catch(e) {
          console.error("Error calling", e);
        }
    }, [moduleMap, showToast, updateConversation, addEvaluationToStudent, recordAttendanceForBlock]);

    const handleReEditBlock = useCallback((conversationId: string, blockIndex: number) => {
        updateConversation(conversationId, convo => {
            if (!convo.weekPlan) return convo;
            
            const newBlocks = [...convo.weekPlan.blocks];
            const blockToEdit = newBlocks[blockIndex];

            // The archived content will be kept as a base.
            // We reset the conversation to restart the design process.
            const systemMessage: Message = {
                id: `msg-sys-${Date.now()}`,
                role: 'system',
                content: "Modalità modifica riattivata. Il contenuto master esistente viene mantenuto come base. Descrivi le modifiche che vuoi apportare."
            };

            newBlocks[blockIndex] = {
                ...blockToEdit,
                status: 'normale', // Revert status to 'in progettazione'
                isReviewed: false, // Reset review status
                messages: [systemMessage], // Reset messages
                pendingValidationContent: undefined,
                isReplacingContent: false,
            };

            return {
                ...convo,
                weekPlan: {
                    ...convo.weekPlan,
                    status: 'in progettazione', // The week is back in planning
                    activeBlockIndex: blockIndex, // Focus on the block being edited
                    blocks: newBlocks
                }
            };
        });
    }, [updateConversation]);

    const addFonte = useCallback((
        conversationId: string,
        weekNumber: number,
        blockId: string,
        fonte: Omit<BlockSource, 'id' | 'addedAt'>
    ): void => {
        const newFonte: BlockSource = {
            ...fonte,
            id: crypto.randomUUID(),
            addedAt: Date.now(),
        };
        updateConversation(conversationId, conv => ({
            ...conv,
            weekPlan: {
                ...conv.weekPlan!,
                blocks: conv.weekPlan!.blocks.map(block =>
                    block.id === blockId
                        ? { ...block, fonti: [...(block.fonti ?? []), newFonte] }
                        : block
                ),
            },
        }));
    }, [updateConversation]);

    const removeFonte = useCallback((
        conversationId: string,
        weekNumber: number,
        blockId: string,
        fonteId: string
    ): void => {
        updateConversation(conversationId, conv => {
            const block = conv.weekPlan!.blocks.find(b => b.id === blockId);
            const fonteToRemove = (block?.fonti ?? []).find(f => f.id === fonteId);

            if (fonteToRemove?.dbFileKey) {
                import('../services/db').then(({ deleteBlockFile }) => {
                    deleteBlockFile(fonteToRemove.dbFileKey!).catch(console.error);
                });
            }

            return {
                ...conv,
                weekPlan: {
                    ...conv.weekPlan!,
                    blocks: conv.weekPlan!.blocks.map(block =>
                        block.id === blockId
                            ? { ...block, fonti: (block.fonti ?? []).filter(f => f.id !== fonteId) }
                            : block
                    ),
                },
            };
        });
    }, [updateConversation]);

    const updateFonte = useCallback((
        conversationId: string,
        weekNumber: number,
        blockId: string,
        fonteId: string,
        patch: Partial<BlockSource>
    ): void => {
        updateConversation(conversationId, conv => ({
            ...conv,
            weekPlan: {
                ...conv.weekPlan!,
                blocks: conv.weekPlan!.blocks.map(block =>
                    block.id === blockId
                        ? {
                            ...block,
                            fonti: (block.fonti ?? []).map(f =>
                                f.id === fonteId ? { ...f, ...patch } : f
                            ),
                          }
                        : block
                ),
            },
        }));
    }, [updateConversation]);

    const promoteFonteFromWebliografia = useCallback((
        conversationId: string,
        weekNumber: number,
        blockId: string,
        url: string,
        title?: string
    ): void => {
        let hostname = url;
        try {
            hostname = new URL(url).hostname;
        } catch {
            hostname = url;
        }

        addFonte(conversationId, weekNumber, blockId, {
            type: 'url',
            title: title ?? hostname,
            origin: 'promoted',
            url,
        });
    }, [addFonte]);

    return { processPlanningMessage, handleReEditBlock, addFonte, removeFonte, updateFonte, promoteFonteFromWebliografia };
};
