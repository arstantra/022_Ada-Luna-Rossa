import React, { useMemo, useState, useEffect, useCallback, memo } from 'react';
import type { Conversation, WeekPlan, BlockDetails, BlockSource, PlanningActionPayload, BlockStatus, Activity, ActivityContesto, ContentBlock, Message } from '../types';
import type { ConfirmationModalProps } from './ConfirmationModal';
import { SparklesIcon, XIcon, SearchIcon, ChevronDownIcon, ChevronUpIcon, BookOpenIcon, CogIcon, ClipboardDocumentCheckIcon } from './Icons';
import BlockWorkspaceView from './BlockWorkspaceView';
import { useMasterContext } from '../hooks/useMasterContext';
import ConfirmationModal from './ConfirmationModal';
import { getBlockPlanningStatus, getExactDateForBlock, isWeekInFslPeriod } from '../utils';
import BlockEditModal from './BlockEditModal';
import { LESSON_TYPE_LABELS } from '../constants';
import * as GeminiService from '../services/gemini';

const TIPOLOGIA_COLORS: Record<string, string> = {
    frontale_teorica:   'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/25',
    frontale_operativa: 'bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/25',
    laboratorio:        'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/25',
    verifica:           'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/25',
    discussione:        'bg-purple-500/15 text-purple-300 ring-1 ring-inset ring-purple-500/25',
};

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
  onAddActivity?: (activity: Omit<Activity, 'id'>) => void;
  onUpdateActivityMessages?: (activityId: string, messages: Message[]) => void;
  onUpdateActivityContent?: (activityId: string, content: ContentBlock[]) => void;
}

const PlanningView: React.FC<PlanningViewProps> = ({ conversation, onUpdateWeekPlan, isLoading, onSendMessage, onReEditBlock, onClose, masterContext, initialTab, onInitialTabConsumed, useGoogleSearch, onGoogleSearchChange, onShowConfirmation, currentModeId, onModeChange, onAddActivity, onUpdateActivityMessages, onUpdateActivityContent }) => {
    const { weekPlan } = conversation;
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'laboratorio' | 'contenutoMaster'>(initialTab || 'laboratorio');
    const [labMode, setLabMode] = useState<'lesson' | 'activity'>('lesson');
    const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
    const [isActivityLoading, setIsActivityLoading] = useState(false);
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

    // Reset labMode e selectedActivity quando cambia il blocco attivo
    useEffect(() => {
        setLabMode('lesson');
        setSelectedActivityId(null);
    }, [weekPlan?.activeBlockIndex]);

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


    // Attività lanciate dal blocco attivo
    const activeBlockActivities = useMemo(() => {
        if (!activeBlock) return [];
        return (conversation.activities ?? []).filter(a => a.launchBlockId === activeBlock.id);
    }, [activeBlock, conversation.activities]);

    // Attività selezionata nel laboratorio
    const selectedActivity = useMemo(() => {
        if (!selectedActivityId) return null;
        return activeBlockActivities.find(a => a.id === selectedActivityId) ?? null;
    }, [selectedActivityId, activeBlockActivities]);

    // Crea nuova attività nel laboratorio (campi semplificati: titolo + durata + contesto)
    const handleCreateActivityInLab = useCallback((title: string, durationInBlocks: number, contesto: ActivityContesto) => {
        if (!weekPlan || !activeBlock || !onAddActivity) return;
        const newId = crypto.randomUUID();
        onAddActivity({
            id: newId,
            title,
            durationInBlocks,
            contesto,
            blockId: activeBlock.id,
            weekNumber: weekPlan.weekNumber,
            launchBlockId: activeBlock.id,
            launchWeekNumber: weekPlan.weekNumber,
            launchBlockIndex: weekPlan.activeBlockIndex,
            objectiveLink: activeBlock.objective?.trim() || undefined,
            status: 'progettata',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as any);
        // Seleziona la nuova attività dopo la creazione (sarà disponibile al prossimo render)
        setSelectedActivityId(newId);
        setLabMode('activity');
    }, [weekPlan, activeBlock, onAddActivity]);

    // Invia messaggio nel canale chat dell'attività
    const handleSendActivityMessage = useCallback(async (content: string) => {
        if (!selectedActivity || !onUpdateActivityMessages) return;
        const userMsg: Message = { id: `msg-user-${Date.now()}`, role: 'user', content };
        const aiPlaceholder: Message = { id: `msg-ai-${Date.now() + 1}`, role: 'assistant', content: '…' };
        const currentMessages = selectedActivity.messages ?? [];
        const withUser = [...currentMessages, userMsg, aiPlaceholder];
        onUpdateActivityMessages(selectedActivity.id, withUser);
        setIsActivityLoading(true);
        try {
            const activityContext = `# ATTIVITÀ IN PROGETTAZIONE
Titolo: ${selectedActivity.title}
Durata: ${selectedActivity.durationInBlocks != null ? `${selectedActivity.durationInBlocks} blocchi` : 'non definita'}
Dove si svolge: ${selectedActivity.contesto ?? 'in aula'}
${selectedActivity.objectiveLink ? `Obiettivo collegato: ${selectedActivity.objectiveLink}` : ''}
${selectedActivity.description ? `Descrizione: ${selectedActivity.description}` : ''}

Stai aiutando il docente a progettare il briefing e il contenuto master di questa attività. Fornisci idee, strutture, testi pronti all'uso.`;
            const stream = await GeminiService.streamChatResponse(
                currentMessages, content, undefined, masterContext,
                masterContext.currentModeId, false, [], [], activityContext,
            );
            let accumulated = '';
            for await (const chunk of stream) {
                accumulated += chunk.text ?? '';
                onUpdateActivityMessages(selectedActivity.id, [
                    ...currentMessages, userMsg, { ...aiPlaceholder, content: accumulated },
                ]);
            }
        } catch (e) {
            const error = e instanceof Error ? e.message : 'Errore sconosciuto';
            onUpdateActivityMessages(selectedActivity.id, [
                ...currentMessages, userMsg, { ...aiPlaceholder, content: `**Errore:** ${error}` },
            ]);
        } finally {
            setIsActivityLoading(false);
        }
    }, [selectedActivity, onUpdateActivityMessages, masterContext]);

    // Salva il contenuto master dell'attività
    const handleSaveActivityContent = useCallback((html: string) => {
        if (!selectedActivity || !onUpdateActivityContent) return;
        onUpdateActivityContent(selectedActivity.id, [{ id: 'activity-master', content: html }]);
    }, [selectedActivity, onUpdateActivityContent]);

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
                            {/* Tab toggle — etichette dinamiche in base a labMode */}
                            <div className="flex items-center bg-gray-800/80 rounded-md p-0.5 border border-gray-700/40 mr-1">
                                <button
                                    onClick={() => setActiveWorkspaceTab('laboratorio')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors
                                        ${activeWorkspaceTab === 'laboratorio' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    <SparklesIcon className="h-3 w-3" />
                                    {labMode === 'activity' && selectedActivity ? (
                                        <span className="max-w-[90px] truncate">{selectedActivity.title}</span>
                                    ) : 'Laboratorio'}
                                </button>
                                <button
                                    onClick={() => setActiveWorkspaceTab('contenutoMaster')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors
                                        ${activeWorkspaceTab === 'contenutoMaster' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    <BookOpenIcon className="h-3 w-3" />
                                    {labMode === 'activity' && selectedActivity ? 'Master Attività' : 'Contenuto'}
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

                    {/* Riga 2: toggle Lezione/Attività + pill blocchi (+ pill attività in activity mode) */}
                    <div className="flex items-center gap-2 px-5 pb-2 flex-wrap">
                        {/* Toggle Lezione / Attività */}
                        {onAddActivity && (
                            <div className="flex items-center bg-gray-900/60 rounded-md p-0.5 flex-shrink-0">
                                <button
                                    onClick={() => { setLabMode('lesson'); setSelectedActivityId(null); }}
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                                        labMode === 'lesson' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                                >Lezione</button>
                                <button
                                    onClick={() => setLabMode('activity')}
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                                        labMode === 'activity' ? 'bg-rose-900/60 text-rose-300' : 'text-gray-500 hover:text-gray-300'
                                    }`}
                                >Attività</button>
                            </div>
                        )}
                        {/* Separatore */}
                        {onAddActivity && <span className="w-px h-3.5 bg-gray-700/50 flex-shrink-0" />}
                        {/* Block pills */}
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
                        {/* Activity pills — visibili solo in activity mode */}
                        {labMode === 'activity' && activeBlockActivities.length > 0 && (
                            <>
                                <span className="w-px h-3.5 bg-gray-700/50 flex-shrink-0" />
                                {activeBlockActivities.map(a => (
                                    <button
                                        key={a.id}
                                        onClick={() => { setSelectedActivityId(a.id); setActiveWorkspaceTab('laboratorio'); }}
                                        className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono transition-colors ${
                                            selectedActivityId === a.id
                                                ? 'bg-rose-900/50 text-rose-300 border border-rose-700/40'
                                                : 'text-rose-500/60 hover:text-rose-300 hover:bg-rose-900/30'
                                        }`}
                                        title={a.title}
                                    >
                                        <span className="max-w-[100px] truncate">{a.title}</span>
                                        {a.durationInBlocks != null && (
                                            <span className="opacity-50 text-[9px]">{a.durationInBlocks}bl</span>
                                        )}
                                    </button>
                                ))}
                            </>
                        )}
                    </div>

                    {/* Riga 3: tipologia + titolo blocco — solo Laboratorio */}
                    {activeWorkspaceTab === 'laboratorio' && activeBlock && (
                        <div className="px-5 py-1.5 border-t border-gray-700/30 flex items-center gap-2.5 min-w-0">
                            {activeBlock.status === 'saltato' ? (
                                <span className="text-[11px] font-mono text-red-400/70 italic truncate">
                                    {activeBlock.reason ? `Saltato: ${activeBlock.reason}` : 'Blocco saltato'}
                                </span>
                            ) : activeBlock.status === 'annullato' ? (
                                <span className="text-[11px] font-mono text-gray-500 italic line-through truncate">
                                    Annullato
                                </span>
                            ) : (
                                <>
                                    {activeBlock.tipologia && (
                                        <span className={`text-[10px] font-mono rounded-full px-2 py-0.5 flex-shrink-0 ${TIPOLOGIA_COLORS[activeBlock.tipologia] ?? 'text-gray-500'}`}>
                                            {LESSON_TYPE_LABELS[activeBlock.tipologia]}
                                        </span>
                                    )}
                                    {(activeBlock.blockTitle || activeBlock.objective) ? (
                                        <span className="text-xs text-gray-300 truncate">
                                            {activeBlock.blockTitle || activeBlock.objective}
                                        </span>
                                    ) : (
                                        <span className="text-[11px] text-gray-700 italic">Titolo non ancora definito</span>
                                    )}
                                </>
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
                    blockActivities={activeBlockActivities}
                    isFslActive={weekPlan ? isWeekInFslPeriod(weekPlan.weekNumber, masterContext.fslPeriods) : false}
                    labMode={labMode}
                    selectedActivity={selectedActivity ?? undefined}
                    isActivityLoading={isActivityLoading}
                    onSendActivityMessage={handleSendActivityMessage}
                    onSaveActivityContent={handleSaveActivityContent}
                    onCreateActivityInLab={onAddActivity ? handleCreateActivityInLab : undefined}
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
