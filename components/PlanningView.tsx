import React, { useMemo, useState, useEffect, useCallback, memo } from 'react';
import type { Conversation, WeekPlan, Student, Message, BlockDetails, PlanningActionPayload, BlockStatus } from '../types';
import { SparklesIcon, XIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon, BookOpenIcon, CogIcon, CalendarIcon } from './Icons';
import BlockWorkspaceView from './BlockWorkspaceView';
import { useMasterContext } from '../hooks/useMasterContext';
import ConfirmationModal from './ConfirmationModal';
import MarkdownRenderer from './MarkdownRenderer';
import { getBlockPlanningStatus, getExactDateForBlock } from '../utils';
import BlockEditModal from './BlockEditModal';
import EditableField from './EditableField';

const getBlockTabStyle = (block: BlockDetails): { bgColor: string; textColor: string; } => {
    if (block.isReviewed) {
        return { bgColor: 'bg-green-600', textColor: 'text-white' };
    }
    const status = getBlockPlanningStatus(block);

    switch (status) {
        case 'concluso':
            return { bgColor: 'bg-green-700', textColor: 'text-white' };
        
        case 'da_progettare':
        case 'in_progettazione':
        case 'in_revisione': 
            return { bgColor: 'bg-amber-600', textColor: 'text-white' };

        case 'saltato':
        case 'annullato':
            return { bgColor: 'bg-gray-700', textColor: 'text-gray-300' };
        
        case 'fsl':
            return { bgColor: 'bg-sky-500', textColor: 'text-white' };

        case 'da_definire':
            return { bgColor: 'bg-red-800', textColor: 'text-red-200' };
            
        case 'sconosciuto':
        default:
            return { bgColor: 'bg-gray-700', textColor: 'text-gray-300' };
    }
};

const BlockNavigator: React.FC<{
    blocks: BlockDetails[];
    activeIndex: number;
    onSelect: (index: number) => void;
    weekDates: string;
    teacherProfile: string;
}> = memo(({ blocks, activeIndex, onSelect, weekDates, teacherProfile }) => {
    
    return (
        <div className="flex items-stretch border-b-2 border-gray-700/50">
            {blocks.map((block, index) => {
                const isActive = index === activeIndex;
                const { bgColor, textColor } = getBlockTabStyle(block);
                const blockDate = getExactDateForBlock(weekDates, block.day, teacherProfile);
                const dateString = blockDate ? blockDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' }) : block.day;
                
                return (
                     <button
                        key={block.id}
                        onClick={() => onSelect(index)}
                        className={`
                            relative flex-1 text-center p-3 transition-all duration-200 focus:outline-none focus:z-10
                            border-r border-gray-900/50 last:border-r-0
                            ${bgColor} 
                            ${isActive 
                                ? 'shadow-lg' 
                                : 'opacity-75 hover:opacity-100'
                            }
                        `}
                     >
                        <p className={`font-semibold text-sm ${textColor}`}>Blocco {index + 1}</p>
                        <p className={`text-xs mt-1 ${textColor} opacity-80`}>{dateString}</p>
                        {isActive && (
                            <div className="absolute bottom-[-2px] left-4 right-4 h-0.5 bg-white rounded-t-full"></div>
                        )}
                    </button>
                );
            })}
        </div>
    );
});


interface PlanningViewProps {
  conversation: Conversation;
  onUpdateWeekPlan: (updater: (plan: WeekPlan) => WeekPlan) => void;
  isLoading: boolean;
  onSendMessage: (content: string, file?: File, actionPayload?: any) => void;
  onReEditBlock: (conversationId: string, blockIndex: number) => void;
  students: Student[];
  masterContext: ReturnType<typeof useMasterContext>;
  initialTab?: 'laboratorio' | 'contenutoMaster';
  onInitialTabConsumed?: () => void;
  useGoogleSearch: boolean;
  onGoogleSearchChange: (enabled: boolean) => void;
  onShowConfirmation: (props: any) => void;
}

const PlanningView: React.FC<PlanningViewProps> = ({ conversation, onUpdateWeekPlan, isLoading, onSendMessage, onReEditBlock, masterContext, initialTab, onInitialTabConsumed, useGoogleSearch, onGoogleSearchChange, onShowConfirmation }) => {
    const { weekPlan } = conversation;
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    
    // Search State
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<{ messageId: string }[]>([]);
    const [currentResultIndex, setCurrentResultIndex] = useState(-1);

    const visibleBlocks = useMemo(() =>
        (weekPlan?.blocks || [])
            .map((block, index) => ({ block, originalIndex: index }))
            .filter(item => item.block.status !== 'saltato'),
        [weekPlan?.blocks]
    );

    useEffect(() => {
        if (!weekPlan) return;

        // Auto-apply default days on first load
        if (weekPlan.status === 'in progettazione') {
            const { blockDayDefaults } = masterContext;
            const needsUpdate = weekPlan.blocks.some((block, index) => 
                block.day === 'Giorno da definire' && blockDayDefaults[index]
            );

            if (needsUpdate) {
                onUpdateWeekPlan(plan => {
                    const updatedBlocks = plan.blocks.map((block, index) => {
                        const defaultDay = blockDayDefaults[index];
                        if (block.day === 'Giorno da definire' && defaultDay) {
                            return { ...block, day: defaultDay };
                        }
                        return block;
                    });
                    return { ...plan, blocks: updatedBlocks };
                });
            }
        }
        
        // Auto-select a valid block if the current one is hidden
        if (visibleBlocks.length > 0) {
            const isActiveBlockVisible = visibleBlocks.some(item => item.originalIndex === weekPlan.activeBlockIndex);
            if (!isActiveBlockVisible) {
                onUpdateWeekPlan(plan => ({ ...plan, activeBlockIndex: visibleBlocks[0].originalIndex }));
            }
        }

    }, [weekPlan, masterContext.blockDayDefaults, onUpdateWeekPlan, visibleBlocks]);
    
    useEffect(() => {
        if (!weekPlan) return;
        const block = weekPlan.blocks[weekPlan.activeBlockIndex];

        // If the block has a prompt from the strategic dashboard and no messages yet,
        // automatically send it as the first message to kick off the design process.
        if (block && block.lessonSyllabus && (!block.messages || block.messages.length === 0)) {
            onSendMessage(block.lessonSyllabus);

            // Clear the prompt to prevent re-triggering this effect.
            onUpdateWeekPlan(currentPlan => {
                const newBlocks = [...currentPlan.blocks];
                newBlocks[currentPlan.activeBlockIndex] = { ...newBlocks[currentPlan.activeBlockIndex], lessonSyllabus: '' };
                return { ...currentPlan, blocks: newBlocks };
            });
        }
    }, [weekPlan?.activeBlockIndex, conversation.id]); // Re-run when active block or conversation changes


    if (!weekPlan) return null;

    if (!Array.isArray(weekPlan.blocks) || weekPlan.activeBlockIndex >= weekPlan.blocks.length) {
        return (
            <main className="flex-1 flex flex-col bg-gray-800 items-center justify-center text-center p-4">
                <div className="bg-gray-900/50 p-8 rounded-lg border border-red-500/30">
                    <h2 className="text-xl font-semibold text-red-400">Errore di Caricamento</h2>
                    <p className="text-gray-300 mt-2">I dati di questa pianificazione sembrano essere corrotti.</p>
                </div>
            </main>
        );
    }

    useEffect(() => {
        if (initialTab && onInitialTabConsumed) {
            onInitialTabConsumed();
        }
    }, [initialTab, onInitialTabConsumed]);

    const activeBlock = useMemo(() => weekPlan.blocks[weekPlan.activeBlockIndex], [weekPlan.blocks, weekPlan.activeBlockIndex]);
    
    const handleUpdateBlockDetails = useCallback((updates: Partial<BlockDetails>) => {
        onUpdateWeekPlan(plan => {
            const newBlocks = [...plan.blocks];
            newBlocks[plan.activeBlockIndex] = { ...newBlocks[plan.activeBlockIndex], ...updates };
            return { ...plan, blocks: newBlocks };
        });
    }, [onUpdateWeekPlan]);
    
    const objectiveContent = useMemo(() => {
        if (!activeBlock) return null;
        switch (activeBlock.status) {
            case 'saltato':
                return <div className="italic text-red-400/80">{activeBlock.reason || 'Blocco saltato, motivo non specificato'}</div>;
            case 'formazione scuola-lavoro':
                return (
                    <div className="flex-grow flex items-center gap-2">
                        <span className="font-semibold text-sky-400 flex-shrink-0">Attività FSL: </span>
                        <EditableField 
                            value={activeBlock.objective || ''}
                            onSave={(newObjective) => handleUpdateBlockDetails({ objective: newObjective })}
                            placeholder="Descrivi l'attività FSL..."
                            className="!py-0"
                        />
                    </div>
                );
            case 'annullato':
                return (
                    <div className="line-through text-gray-500">
                        Annullato: {activeBlock.objective || 'Obiettivo non definito'}
                    </div>
                );
            default:
                return (
                    <div>
                        <span className="font-semibold">Obiettivo: </span>
                        <span>{activeBlock.objective || "Non definito"}</span>
                    </div>
                );
        }
    }, [activeBlock, handleUpdateBlockDetails]);


    // Search Logic
    const handleCloseSearch = useCallback(() => {
        setIsSearchOpen(false);
        setSearchQuery('');
    }, []);

    useEffect(() => {
        if (searchQuery.length > 2 && activeBlock) {
            const results = (activeBlock.messages || [])
                .filter(msg => msg.content && msg.content.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(msg => ({ messageId: msg.id }));
            setSearchResults(results);
            setCurrentResultIndex(results.length > 0 ? 0 : -1);
        } else {
            setSearchResults([]);
            setCurrentResultIndex(-1);
        }
    }, [searchQuery, activeBlock]);

    useEffect(() => {
        if (currentResultIndex !== -1 && searchResults[currentResultIndex]) {
            const { messageId } = searchResults[currentResultIndex];
            const element = document.getElementById(`message-block-${activeBlock.id}-${messageId}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentResultIndex, searchResults, activeBlock.id]);

    const handleNextResult = useCallback(() => { if (searchResults.length > 0) setCurrentResultIndex(prev => (prev + 1) % searchResults.length); }, [searchResults.length]);
    const handlePrevResult = useCallback(() => { if (searchResults.length > 0) setCurrentResultIndex(prev => (prev - 1 + searchResults.length) % searchResults.length); }, [searchResults.length]);
    
    const handleBlockSelect = useCallback((index: number) => {
        if (index !== weekPlan.activeBlockIndex) {
            onUpdateWeekPlan(plan => ({ ...plan, activeBlockIndex: index }));
            handleCloseSearch();
        }
    }, [weekPlan, onUpdateWeekPlan, handleCloseSearch]);

    const handleUpdateBlockStatus = (status: BlockStatus, reason?: string) => {
        const newReason = status === 'saltato' ? reason : undefined;
        handleUpdateBlockDetails({ status, reason: newReason });
    }
    
    const handleResetBlock = () => {
        onReEditBlock(conversation.id, weekPlan.activeBlockIndex);
    }

    const currentResultId = searchResults.length > 0 && currentResultIndex > -1 ? searchResults[currentResultIndex].messageId : null;

    return (
        <>
            <main className="flex-1 flex flex-col bg-gray-800 overflow-hidden">
                <div className="flex-shrink-0 bg-gray-800/80 backdrop-blur-sm border-b border-gray-700/50">
                    <div className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <CalendarIcon className="h-6 w-6 text-blue-400" />
                            <h2 className="text-lg font-bold text-white truncate" title={weekPlan.theme}>{`Settimana ${weekPlan.weekNumber}: ${weekPlan.theme}`}</h2>
                        </div>
                        <div className="flex items-center gap-3 pl-4">
                             {isSearchOpen ? (
                                <div className="flex items-center gap-1 p-1 bg-gray-900/50 border border-gray-600 rounded-lg animate-fade-in-down">
                                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Cerca..." className="w-36 bg-transparent focus:outline-none px-2 text-sm text-white" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) handlePrevResult(); else handleNextResult(); } else if (e.key === 'Escape') { handleCloseSearch(); } }}/>
                                    <span className="text-xs text-gray-400 select-none">{searchQuery.length > 2 ? (searchResults.length > 0 ? `${currentResultIndex + 1}/${searchResults.length}` : '0/0') : '-/-'}</span>
                                    <button onClick={handlePrevResult} disabled={searchResults.length < 2} className="p-1 rounded text-gray-400 hover:bg-gray-700 disabled:opacity-50"><ChevronUpIcon className="h-4 w-4" /></button>
                                    <button onClick={handleNextResult} disabled={searchResults.length < 2} className="p-1 rounded text-gray-400 hover:bg-gray-700 disabled:opacity-50"><ChevronDownIcon className="h-4 w-4" /></button>
                                    <button onClick={handleCloseSearch} className="p-1 rounded text-gray-400 hover:bg-gray-700"><XIcon className="h-4 w-4" /></button>
                                </div>
                            ) : (
                                <button onClick={() => setIsSearchOpen(true)} className="p-2 rounded-full text-gray-400 hover:bg-gray-700" aria-label="Cerca"><SearchIcon className="h-5 w-5" /></button>
                            )}
                            <button onClick={() => setIsEditModalOpen(true)} className="p-2 rounded-full text-gray-400 hover:bg-gray-700" aria-label="Modifica Blocco">
                                <CogIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <BlockNavigator 
                        blocks={weekPlan.blocks} 
                        activeIndex={weekPlan.activeBlockIndex} 
                        onSelect={handleBlockSelect} 
                        weekDates={weekPlan.dates}
                        teacherProfile={masterContext.teacherProfile}
                    />
                    
                    {activeBlock && (
                        <div className="p-4 bg-gray-800/60">
                            {activeBlock.lessonTitle ? (
                                <details className="group" open>
                                    <summary className="list-none flex items-center justify-between cursor-pointer">
                                        <div className="text-white text-sm flex-grow flex items-start gap-2">
                                            <BookOpenIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                            <div className="flex-grow">{objectiveContent}</div>
                                        </div>
                                        <ChevronDownIcon className="h-5 w-5 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
                                    </summary>
                                    <div className="mt-2 pt-3 border-t border-gray-700/50">
                                        <div className="max-h-64 overflow-y-auto custom-scrollbar border border-gray-700/50 rounded-lg p-3">
                                            <MarkdownRenderer content={activeBlock.lessonTitle} />
                                        </div>
                                    </div>
                                </details>
                            ) : (
                                <div className="text-white text-sm flex items-start gap-2">
                                    <BookOpenIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                                    <div className="flex-grow">{objectiveContent}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                
                <BlockWorkspaceView 
                    block={activeBlock}
                    onSendMessage={onSendMessage}
                    isLoading={isLoading}
                    highlightQuery={isSearchOpen && searchQuery.length > 2 ? searchQuery : undefined}
                    currentResultId={currentResultId}
                    initialTab={initialTab || undefined}
                    useGoogleSearch={useGoogleSearch}
                    onGoogleSearchChange={onGoogleSearchChange}
                    onShowConfirmation={onShowConfirmation}
                />
            </main>
            {activeBlock && (
                <BlockEditModal
                    isOpen={isEditModalOpen}
                    onClose={() => setIsEditModalOpen(false)}
                    block={activeBlock}
                    blockIndex={weekPlan.activeBlockIndex}
                    onUpdateDay={(day) => handleUpdateBlockDetails({ day })}
                    onUpdateStatus={handleUpdateBlockStatus}
                    onReset={handleResetBlock}
                />
            )}
        </>
    );
};

export default memo(PlanningView);