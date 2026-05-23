import React, { useMemo, useState, useEffect, useCallback, memo } from 'react';
import type { Conversation, WeekPlan, BlockDetails, BlockSource, PlanningActionPayload, BlockStatus, LessonType, CourseModule } from '../types';
import type { ConfirmationModalProps } from './ConfirmationModal';
import { SparklesIcon, XIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon, BookOpenIcon, CogIcon, ClipboardDocumentCheckIcon } from './Icons';
import BlockWorkspaceView from './BlockWorkspaceView';
import { useMasterContext } from '../hooks/useMasterContext';
import ConfirmationModal from './ConfirmationModal';
import MarkdownRenderer from './MarkdownRenderer';
import { getBlockPlanningStatus, getExactDateForBlock } from '../utils';
import BlockEditModal from './BlockEditModal';
import EditableField from './EditableField';

const getBlockDotColor = (block: BlockDetails): string => {
    if (block.isReviewed) return 'bg-emerald-500';
    const status = getBlockPlanningStatus(block);
    switch (status) {
        case 'concluso':
        case 'in_revisione':    // ha contentBlocks: è "completato" a livello corso
                                return 'bg-emerald-500';
        case 'in_progettazione':return 'bg-amber-400';
        case 'da_progettare':
            // 'da_progettare' copre due casi:
            // 1. status='da definire' + ha objective/module → amber (lavoro iniziato, giorno non ancora fissato)
            // 2. status='normale' + niente fatto → slate (non ancora iniziato)
            return block.status === 'da definire' ? 'bg-amber-400' : 'bg-slate-500';
        case 'da_definire':     // nessun contenuto, giorno non fissato → neutro come in StrategicDashboard
                                return 'bg-slate-500';
        case 'fsl':             return 'bg-sky-500';
        case 'saltato':
        case 'annullato':       return 'bg-gray-500';
        default:                return 'bg-gray-500';
    }
};



interface PlanningViewProps {
  conversation: Conversation;
  onUpdateWeekPlan: (updater: (plan: WeekPlan) => WeekPlan) => void;
  isLoading: boolean;
  onSendMessage: (content: string, file?: File, actionPayload?: PlanningActionPayload) => void;
  onReEditBlock: (conversationId: string, blockIndex: number) => void;
  onClose: () => void;
  masterContext: ReturnType<typeof useMasterContext>;
  initialTab?: 'laboratorio' | 'contenutoMaster';
  onInitialTabConsumed?: () => void;
  useGoogleSearch: boolean;
  onGoogleSearchChange: (enabled: boolean) => void;
  onShowConfirmation: (props: Omit<ConfirmationModalProps, 'isOpen' | 'onClose'>) => void;
  currentModeId?: string;
  onModeChange?: (modeId: string) => void;
  onSaveModules?: (modules: CourseModule[]) => void;
}

const PlanningView: React.FC<PlanningViewProps> = ({ conversation, onUpdateWeekPlan, isLoading, onSendMessage, onReEditBlock, onClose, masterContext, initialTab, onInitialTabConsumed, useGoogleSearch, onGoogleSearchChange, onShowConfirmation, currentModeId, onModeChange, onSaveModules }) => {
    const { weekPlan } = conversation;
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'laboratorio' | 'contenutoMaster'>(initialTab || 'laboratorio');
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

    useEffect(() => {
        if (initialTab) {
            setActiveWorkspaceTab(initialTab);
            onInitialTabConsumed?.();
        }
    }, [initialTab, onInitialTabConsumed]);

    // --- Hooks moved above conditional returns (React Rules of Hooks) ---

    const activeBlock = useMemo(
        () => weekPlan?.blocks[weekPlan.activeBlockIndex],
        [weekPlan?.blocks, weekPlan?.activeBlockIndex]
    );

    const handleUpdateBlockDetails = useCallback((updates: Partial<BlockDetails>) => {
        onUpdateWeekPlan(plan => {
            const newBlocks = [...plan.blocks];
            newBlocks[plan.activeBlockIndex] = { ...newBlocks[plan.activeBlockIndex], ...updates };
            return { ...plan, blocks: newBlocks };
        });
    }, [onUpdateWeekPlan]);

    // --- Fonti handlers ---

    const handleAddFonte = useCallback((fonte: Omit<BlockSource, 'id' | 'addedAt'>) => {
        const newFonte: BlockSource = { ...fonte, id: crypto.randomUUID(), addedAt: Date.now() };
        handleUpdateBlockDetails({ fonti: [...(activeBlock?.fonti ?? []), newFonte] });
    }, [activeBlock?.fonti, handleUpdateBlockDetails]);

    const handleRemoveFonte = useCallback((fonteId: string) => {
        handleUpdateBlockDetails({ fonti: (activeBlock?.fonti ?? []).filter(f => f.id !== fonteId) });
    }, [activeBlock?.fonti, handleUpdateBlockDetails]);

    const handleUpdateFonte = useCallback((fonteId: string, patch: Partial<BlockSource>) => {
        handleUpdateBlockDetails({
            fonti: (activeBlock?.fonti ?? []).map(f => f.id === fonteId ? { ...f, ...patch } : f),
        });
    }, [activeBlock?.fonti, handleUpdateBlockDetails]);

    const handleUpdateTipologia = useCallback((tipologia: LessonType | undefined) => {
        handleUpdateBlockDetails({ tipologia });
    }, [handleUpdateBlockDetails]);

    const handleUpdateBlockModuleId = useCallback((
        moduleId: string | undefined,
        sectionId?: string | undefined,
        inheritedTipologia?: LessonType
    ) => {
        // Eredita la tipologia dalla sezione solo se il blocco non ne ha già una
        const updates: Partial<BlockDetails> = { moduleId, sectionId };
        if (inheritedTipologia && !activeBlock?.tipologia) {
            updates.tipologia = inheritedTipologia;
        }
        handleUpdateBlockDetails(updates);
    }, [handleUpdateBlockDetails, activeBlock?.tipologia]);

    const handlePromote = useCallback((url: string) => {
        let title = url;
        try { title = new URL(url).hostname.replace('www.', ''); } catch { /* noop */ }
        const promoted: BlockSource = {
            id: crypto.randomUUID(),
            type: 'url',
            title,
            addedAt: Date.now(),
            origin: 'promoted',
            url,
        };
        handleUpdateBlockDetails({ fonti: [...(activeBlock?.fonti ?? []), promoted] });
    }, [activeBlock?.fonti, handleUpdateBlockDetails]);

    const objectiveContent = useMemo(() => {
        if (!activeBlock) return null;
        switch (activeBlock.status) {
            case 'saltato':
                return <div className="italic text-red-400/80">{activeBlock.reason || 'Blocco saltato, motivo non specificato'}</div>;
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
        if (currentResultIndex !== -1 && searchResults[currentResultIndex] && activeBlock?.id) {
            const { messageId } = searchResults[currentResultIndex];
            const element = document.getElementById(`message-block-${activeBlock.id}-${messageId}`);
            element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, [currentResultIndex, searchResults, activeBlock?.id]);

    const handleNextResult = useCallback(() => { if (searchResults.length > 0) setCurrentResultIndex(prev => (prev + 1) % searchResults.length); }, [searchResults.length]);
    const handlePrevResult = useCallback(() => { if (searchResults.length > 0) setCurrentResultIndex(prev => (prev - 1 + searchResults.length) % searchResults.length); }, [searchResults.length]);

    const handleBlockSelect = useCallback((index: number) => {
        if (weekPlan && index !== weekPlan.activeBlockIndex) {
            onUpdateWeekPlan(plan => ({ ...plan, activeBlockIndex: index }));
            handleCloseSearch();
        }
    }, [weekPlan, onUpdateWeekPlan, handleCloseSearch]);

    // --- Conditional returns after all hooks ---

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
            <main className="flex-1 flex flex-col bg-gray-800 overflow-hidden relative">
                {/* ── Header unificato — stesso skeleton in entrambi i tab ──────── */}
                <div className="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50">

                    {/* Riga 1: Zona A (titolo) · Zona C (toggle tab + azioni + X) */}
                    <div className="flex items-center gap-3 px-5 py-3">
                        {/* Zona A — icona + titolo settimana */}
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <ClipboardDocumentCheckIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                            <h2 className="text-sm font-display font-semibold text-white truncate" title={weekPlan.theme}>
                                {`Settimana ${weekPlan.weekNumber}: ${weekPlan.theme}`}
                            </h2>
                        </div>

                        {/* Zona C — toggle tab + azioni contestuali + X */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {/* Tab toggle — sempre visibile */}
                            <div className="flex items-center bg-gray-800/80 rounded-md p-0.5 border border-gray-700/40 mr-1">
                                <button
                                    onClick={() => setActiveWorkspaceTab('laboratorio')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors
                                        ${activeWorkspaceTab === 'laboratorio' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    <SparklesIcon className="h-3 w-3" />
                                    Laboratorio
                                </button>
                                <button
                                    onClick={() => setActiveWorkspaceTab('contenutoMaster')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors
                                        ${activeWorkspaceTab === 'contenutoMaster' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    <BookOpenIcon className="h-3 w-3" />
                                    Contenuto
                                </button>
                            </div>

                            {/* Search — solo Laboratorio */}
                            {activeWorkspaceTab === 'laboratorio' && (
                                isSearchOpen ? (
                                    <div className="flex items-center gap-1 px-2 py-1 bg-gray-800/60 border border-gray-600/60 rounded-lg">
                                        <input
                                            type="text"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            placeholder="Cerca..."
                                            className="w-32 bg-transparent focus:outline-none text-xs text-white placeholder-gray-600"
                                            autoFocus
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') { e.preventDefault(); if (e.shiftKey) handlePrevResult(); else handleNextResult(); }
                                                else if (e.key === 'Escape') { handleCloseSearch(); }
                                            }}
                                        />
                                        <span className="text-[10px] text-gray-500 font-mono select-none px-1">
                                            {searchQuery.length > 2 ? (searchResults.length > 0 ? `${currentResultIndex + 1}/${searchResults.length}` : '0/0') : '—'}
                                        </span>
                                        <button onClick={handlePrevResult} disabled={searchResults.length < 2} className="p-0.5 rounded text-gray-400 hover:bg-gray-700 disabled:opacity-30"><ChevronUpIcon className="h-3.5 w-3.5" /></button>
                                        <button onClick={handleNextResult} disabled={searchResults.length < 2} className="p-0.5 rounded text-gray-400 hover:bg-gray-700 disabled:opacity-30"><ChevronDownIcon className="h-3.5 w-3.5" /></button>
                                        <button onClick={handleCloseSearch} className="p-0.5 rounded text-gray-400 hover:bg-gray-700 ml-0.5"><XIcon className="h-3.5 w-3.5" /></button>
                                    </div>
                                ) : (
                                    <button onClick={() => setIsSearchOpen(true)} className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-700/60 transition-colors" aria-label="Cerca">
                                        <SearchIcon className="h-4 w-4" />
                                    </button>
                                )
                            )}

                            {/* Impostazioni blocco — solo Laboratorio */}
                            {activeWorkspaceTab === 'laboratorio' && !isSearchOpen && (
                                <button onClick={() => setIsEditModalOpen(true)} className="p-1.5 rounded-md text-gray-500 hover:text-gray-200 hover:bg-gray-700/60 transition-colors" aria-label="Impostazioni blocco">
                                    <CogIcon className="h-4 w-4" />
                                </button>
                            )}

                            <div className="w-px h-4 bg-gray-700/50 mx-0.5" />

                            {/* X chiudi — sempre a destra */}
                            <button onClick={onClose} className="p-1.5 rounded-md text-gray-500 hover:text-white hover:bg-gray-700/60 transition-colors" aria-label="Torna alla panoramica">
                                <XIcon className="h-4 w-4" />
                            </button>
                        </div>
                    </div>

                    {/* Riga 2: pill blocchi — full width, sempre visibile */}
                    <div className="flex items-center gap-1 px-5 pb-2">
                        {weekPlan.blocks.map((block, index) => {
                            const isActive = index === weekPlan.activeBlockIndex;
                            const dotColor = getBlockDotColor(block);
                            const blockDate = getExactDateForBlock(weekPlan.dates, block.day, masterContext.teacherProfile);
                            const dateString = blockDate
                                ? blockDate.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })
                                : block.day;
                            return (
                                <button
                                    key={block.id}
                                    onClick={() => handleBlockSelect(index)}
                                    title={`Blocco ${index + 1} — ${dateString}`}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-1 focus:ring-gray-500
                                        ${isActive ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'}`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                                    <span>B{index + 1}</span>
                                    <span className="text-gray-400 font-normal hidden sm:inline">{dateString}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Riga 3: obiettivo blocco attivo — solo Laboratorio, solo se presente */}
                    {activeWorkspaceTab === 'laboratorio' && activeBlock && (() => {
                        const isSpecial = ['saltato', 'annullato'].includes(activeBlock.status);
                        const hasObjective = activeBlock.objective?.trim();
                        const isEmpty = !hasObjective && !isSpecial && !activeBlock.lessonTitle;

                        if (isEmpty) {
                            return (
                                <div className="px-5 py-1.5 border-t border-gray-700/30 flex items-center gap-2">
                                    <BookOpenIcon className="h-3 w-3 text-gray-700 flex-shrink-0" />
                                    <span className="text-[11px] text-gray-700 italic">Obiettivo non ancora definito</span>
                                </div>
                            );
                        }

                        return (
                            <div className="px-5 py-2 border-t border-gray-700/30 bg-gray-800/40">
                                {activeBlock.lessonTitle ? (
                                    <details className="group">
                                        <summary className="list-none flex items-center justify-between cursor-pointer gap-2">
                                            <div className="text-white text-sm flex-grow flex items-center gap-2 min-w-0">
                                                <BookOpenIcon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                                <div className="flex-grow truncate text-xs text-gray-300">{objectiveContent}</div>
                                            </div>
                                            <ChevronDownIcon className="h-3.5 w-3.5 text-gray-600 flex-shrink-0 transition-transform duration-200 group-open:rotate-180" />
                                        </summary>
                                        <div className="mt-2 pt-2 border-t border-gray-700/50">
                                            <div className="max-h-48 overflow-y-auto custom-scrollbar border border-gray-700/40 rounded-lg p-3 text-sm">
                                                <MarkdownRenderer content={activeBlock.lessonTitle} />
                                            </div>
                                        </div>
                                    </details>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <BookOpenIcon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                        <div className="flex-grow truncate text-xs text-gray-300">{objectiveContent}</div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
                
                <BlockWorkspaceView
                    block={activeBlock}
                    onSendMessage={onSendMessage}
                    isLoading={isLoading}
                    highlightQuery={isSearchOpen && searchQuery.length > 2 ? searchQuery : undefined}
                    currentResultId={currentResultId}
                    activeTab={activeWorkspaceTab}
                    useGoogleSearch={useGoogleSearch}
                    onGoogleSearchChange={onGoogleSearchChange}
                    onShowConfirmation={onShowConfirmation}
                    currentModeId={currentModeId}
                    onModeChange={onModeChange}
                    onAddFonte={handleAddFonte}
                    onRemoveFonte={handleRemoveFonte}
                    onUpdateFonte={handleUpdateFonte}
                    onPromoteFonte={handlePromote}
                    onUpdateTipologia={handleUpdateTipologia}
                    conversationModules={conversation.modules}
                    onSaveModules={onSaveModules}
                    onUpdateBlockModuleId={handleUpdateBlockModuleId}
                    teacherProfile={masterContext.teacherProfile}
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