import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import type { BlockDetails, PlanningActionPayload, BlockSource, LessonType, TeachingMethodology, ModuleDetails, Activity, ActivityContesto, ContentBlock, Message } from '../types';
import { COURSE_CONTENT_TYPE_LABELS, LESSON_TYPE_LABELS, TEACHING_METHODOLOGY_LABELS } from '../constants';
import { useProgettazioneCache } from '../contexts/ProgettazioneCacheContext';
import type { ConfirmationModalProps } from './ConfirmationModal';
import MessageView from './MessageView';
import ChatInput from './ChatInput';
import DocumentEditor from './DocumentEditor';
import { ArrowDownTrayIcon, WebIcon, BookOpenIcon } from './Icons';
import ModePills from './ModePills';
import FontiDrawer from './FontiDrawer';

const ATTIVITA_CONTESTO_LABELS: Record<ActivityContesto, string> = {
    in_aula: 'In aula',
    misto: 'Misto',
    autonoma: 'Autonoma',
};

// --- MAIN WORKSPACE VIEW ---

interface BlockWorkspaceViewProps {
    block: BlockDetails;
    onSendMessage: (content: string, file?: File, actionPayload?: PlanningActionPayload) => void;
    isLoading: boolean;
    highlightQuery?: string;
    currentResultId?: string | null;
    activeTab: 'laboratorio' | 'contenutoMaster';
    useGoogleSearch: boolean;
    onGoogleSearchChange: (enabled: boolean) => void;
    onShowConfirmation: (props: Omit<ConfirmationModalProps, 'isOpen' | 'onClose'>) => void;
    currentModeId?: string;
    onModeChange?: (modeId: string) => void;
    // Fonti del blocco
    onAddFonte?: (fonte: Omit<BlockSource, 'id' | 'addedAt'>) => void;
    onRemoveFonte?: (fonteId: string) => void;
    onUpdateFonte?: (fonteId: string, patch: Partial<BlockSource>) => void;
    onPromoteFonte?: (url: string) => void;
    // Attività del blocco (solo lettura — creazione avviene tramite form in activity mode)
    blockActivities?: Activity[];
    // FSL: derivato automaticamente in PlanningView, passato come booleano
    isFslActive?: boolean;
    // Lab mode — controllato da PlanningView
    labMode: 'lesson' | 'activity';
    // Attività selezionata nel laboratorio (Opzione A)
    selectedActivity?: Activity;
    isActivityLoading?: boolean;
    onSendActivityMessage?: (content: string) => void;
    onSaveActivityContent?: (content: ContentBlock[]) => void;
    // Creazione nuova attività dal laboratorio (form semplificato)
    onCreateActivityInLab?: (title: string, durationInBlocks: number, contesto: ActivityContesto) => void;
}

const BlockWorkspaceView: React.FC<BlockWorkspaceViewProps> = ({
    block, onSendMessage, isLoading, highlightQuery, currentResultId,
    activeTab, useGoogleSearch, onGoogleSearchChange, onShowConfirmation,
    currentModeId, onModeChange,
    onAddFonte, onRemoveFonte, onUpdateFonte, onPromoteFonte,
    blockActivities, isFslActive = false,
    labMode, selectedActivity, isActivityLoading = false,
    onSendActivityMessage, onSaveActivityContent, onCreateActivityInLab,
}) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isExportingHtml, setIsExportingHtml] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    // Form creazione nuova attività (semplificato)
    const [newActivityTitle, setNewActivityTitle] = useState('');
    const [newActivityDuration, setNewActivityDuration] = useState(3);
    const [newActivityContesto, setNewActivityContesto] = useState<ActivityContesto>('in_aula');
    const editorRef = useRef<HTMLDivElement>(null);
    const activityEditorRef = useRef<HTMLDivElement>(null);
    const [isModuleExpanded, setIsModuleExpanded] = useState(false);

    const { contentUnits, moduleMap } = useProgettazioneCache();

    const prevMsgCountRef = useRef(0);

    // Messaggi correnti: attività o blocco in base al mode
    const activeMessages: Message[] = useMemo(() => {
        if (labMode === 'activity' && selectedActivity) {
            return selectedActivity.messages ?? [];
        }
        return block.messages ?? [];
    }, [labMode, selectedActivity, block.messages]);

    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer || highlightQuery) return;
        const msgCount = activeMessages.length;
        const newMessageAdded = msgCount > prevMsgCountRef.current;
        prevMsgCountRef.current = msgCount;
        const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 150;
        const shouldScroll = newMessageAdded || ((isLoading || isActivityLoading) && isNearBottom);
        if (shouldScroll) {
            const timer = setTimeout(() => {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [activeMessages, isLoading, isActivityLoading, highlightQuery]);

    // URL estratti dalle fonti di grounding dei messaggi del blocco
    const webliografiaRilevata = useMemo(() => {
        if (!block?.messages) return [];
        const uris = new Set<string>();
        block.messages.forEach(msg => {
            msg.sources?.forEach(s => { if (s.uri) uris.add(s.uri); });
        });
        return Array.from(uris);
    }, [block?.messages]);

    // Unità didattica del Progetto Didattico corrispondente al blocco
    const matchingUnit = useMemo(() =>
        contentUnits?.find(u => u.title === block?.module),
        [contentUnits, block?.module]
    );

    // Dettagli completi del modulo (solo per MODULI)
    const matchingModule = useMemo((): ModuleDetails | null => {
        if (!block?.module || !moduleMap) return null;
        const entry = [...moduleMap.entries()].find(([key]) => key.includes(block.module!));
        return entry?.[1] ?? null;
    }, [moduleMap, block?.module]);

    const mergedContentHtml = useMemo(() => {
        return (block.contentBlocks || []).map(cb => cb.content).join('<hr class="page-break">');
    }, [block.contentBlocks]);

    const activityMasterHtml = useMemo(() => {
        if (!selectedActivity?.masterContent?.length) return '';
        return selectedActivity.masterContent.map(cb => cb.content).join('<hr class="page-break">');
    }, [selectedActivity?.masterContent]);

    const allSources = useMemo(() => {
        if (!block.messages) return [];
        const sourcesMap = new Map<string, { title: string; uri: string }>();
        block.messages.forEach(message => {
            if (message.sources) {
                message.sources.forEach(source => {
                    if (!sourcesMap.has(source.uri)) sourcesMap.set(source.uri, source);
                });
            }
        });
        return Array.from(sourcesMap.values());
    }, [block.messages]);

    const handleSaveDocument = useCallback((newContent: string) => {
        onSendMessage('', undefined, { action: 'consolidate_and_update_content', newContent });
    }, [onSendMessage]);

    const handleSaveActivityDocument = useCallback((html: string) => {
        if (!onSaveActivityContent) return;
        onSaveActivityContent([{ id: 'activity-master', content: html }]);
    }, [onSaveActivityContent]);

    const handleAppendSources = useCallback(() => {
        if (!editorRef.current) return;
        if (editorRef.current.querySelector('#webliografia-master')) return;
        const sourcesHtml = `<hr id="webliografia-master"><h2>Webliografia</h2><ol>${allSources.map(source => `<li><a href="${source.uri}" target="_blank" rel="noopener noreferrer">${source.title || source.uri}</a></li>`).join('')}</ol>`;
        editorRef.current.innerHTML += sourcesHtml;
        handleSaveDocument(editorRef.current.innerHTML);
    }, [allSources, handleSaveDocument]);

    const handleExportHtml = useCallback(async () => {
        if (!editorRef.current || !editorRef.current.innerHTML.trim()) return;
        setIsExportingHtml(true);
        try {
            const htmlContent = editorRef.current.innerHTML;
            const fullHtml = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${block.objective || `Blocco ${block.day}`}</title>
  <style>
    body { font-family: 'Lora', serif; line-height: 1.7; color: #1f2937; max-width: 21cm; margin: 2rem auto; padding: 2.54cm; }
    h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.17em; }
    blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; font-style: italic; color: #4b5563; }
    a { color: #2563eb; }
    hr.page-break { border: 0; height: 1px; background-image: linear-gradient(to right, rgba(0,0,0,0), rgba(0,0,0,0.2), rgba(0,0,0,0)); margin: 2em 0; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;
            const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `blocco_lezione_${block.day.toLowerCase().replace(/[^a-z0-9]/g, '_')}.html`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error('HTML export failed', error);
        } finally {
            setIsExportingHtml(false);
        }
    }, [block.day, block.objective]);

    const handleSubmitNewActivity = useCallback(() => {
        if (!newActivityTitle.trim() || !onCreateActivityInLab) return;
        onCreateActivityInLab(newActivityTitle.trim(), newActivityDuration, newActivityContesto);
        setNewActivityTitle('');
        setNewActivityDuration(3);
        setNewActivityContesto('in_aula');
    }, [newActivityTitle, newActivityDuration, newActivityContesto, onCreateActivityInLab]);

    const editorToolbarActions = useMemo(() => (
        <button
            onClick={handleExportHtml}
            disabled={isExportingHtml}
            className="editor-toolbar-button flex items-center gap-2 !px-3 !bg-emerald-600/20 !text-emerald-300 hover:!bg-emerald-600/40 disabled:opacity-50 disabled:cursor-wait"
            title="Esporta in HTML"
        >
            <ArrowDownTrayIcon className="h-5 w-5" />
            {isExportingHtml ? 'Esportazione...' : 'Esporta HTML'}
        </button>
    ), [handleExportHtml, isExportingHtml]);

    if (!block) {
        return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                Seleziona un blocco per iniziare.
            </div>
        );
    }

    // Determina il send handler e lo stato di loading correnti
    const effectiveSendMessage = labMode === 'activity' && selectedActivity && onSendActivityMessage
        ? (content: string) => onSendActivityMessage(content)
        : (content: string, file?: File, payload?: PlanningActionPayload) => onSendMessage(content, file, payload);
    const effectiveIsLoading = labMode === 'activity' ? isActivityLoading : isLoading;

    return (
        <div className="relative flex-1 flex flex-col overflow-hidden bg-[#0D1117]">

            {activeTab === 'laboratorio' && (
                <>
                    {/* Pannello info blocco (solo in lesson mode) */}
                    {labMode === 'lesson' && (block.module || block.objective || onAddFonte) && (
                        <details className="flex-shrink-0 border-b border-gray-800/40 bg-[#0D1117] group" open>
                            <summary className="list-none flex items-center gap-2 px-4 py-1.5 cursor-pointer select-none hover:bg-gray-800/30 transition-colors">
                                <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
                                    {matchingUnit ? (
                                        <>
                                            <span className="text-[9px] font-mono tracking-[0.12em] uppercase text-gray-500 flex-shrink-0">
                                                {COURSE_CONTENT_TYPE_LABELS[matchingUnit.type]} {matchingUnit.order}
                                            </span>
                                            <span className="text-[10px] font-mono text-sky-400/60 truncate flex-shrink min-w-0">{matchingUnit.title}</span>
                                        </>
                                    ) : block.module ? (
                                        <span className="text-[10px] font-mono text-sky-400/60 truncate flex-shrink min-w-0">{block.module}</span>
                                    ) : (
                                        <span className="text-[11px] text-gray-600 italic">Dettagli blocco</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {onAddFonte && (
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsDrawerOpen(true); }}
                                            className="flex items-center gap-1.5 px-2 py-0.5 text-gray-400 hover:text-white rounded-md hover:bg-gray-800/60 transition-colors text-xs"
                                            title="Fonti del blocco"
                                        >
                                            <BookOpenIcon className="h-3.5 w-3.5" />
                                            <span>Fonti</span>
                                            {(block.fonti?.length ?? 0) > 0 && (
                                                <span className="bg-purple-500/30 text-purple-300 text-[9px] font-mono rounded-full px-1.5">
                                                    {block.fonti!.length}
                                                </span>
                                            )}
                                        </button>
                                    )}
                                    <svg className="h-3 w-3 text-gray-600 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </div>
                            </summary>

                            <div className="px-4 pb-2.5 pt-1 flex flex-col gap-2">
                                {matchingUnit && (matchingModule || matchingUnit.role || matchingUnit.significance) && (
                                    <div>
                                        <button
                                            onClick={() => setIsModuleExpanded(v => !v)}
                                            className="flex items-center gap-1.5 text-left w-full hover:opacity-80 transition-opacity"
                                        >
                                            <span className="text-[9px] font-mono tracking-[0.12em] uppercase text-gray-500">
                                                {COURSE_CONTENT_TYPE_LABELS[matchingUnit.type]} {matchingUnit.order} — Contesto
                                            </span>
                                            <svg
                                                className={`h-2.5 w-2.5 text-gray-600 transition-transform flex-shrink-0 ${isModuleExpanded ? 'rotate-180' : ''}`}
                                                fill="none" viewBox="0 0 24 24" stroke="currentColor"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </button>
                                        {isModuleExpanded && (
                                            <div className="mt-2 flex flex-col gap-2 border-l border-gray-700/40 pl-3 ml-0.5">
                                                {matchingUnit.role && (
                                                    <div>
                                                        <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-gray-500 mb-0.5">Ruolo</p>
                                                        <p className="text-[11px] text-gray-400 leading-relaxed">{matchingUnit.role}</p>
                                                    </div>
                                                )}
                                                {matchingUnit.significance && (
                                                    <div>
                                                        <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-gray-500 mb-0.5">Significato</p>
                                                        <p className="text-[11px] text-gray-400 leading-relaxed">{matchingUnit.significance}</p>
                                                    </div>
                                                )}
                                                {matchingModule && matchingModule.sintonizzazione.length > 0 && (
                                                    <div>
                                                        <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-gray-500 mb-1">Concetti Chiave</p>
                                                        <div className="flex flex-wrap gap-1">
                                                            {matchingModule.sintonizzazione.map((p, i) => (
                                                                <span key={i} className="text-[9px] font-mono bg-gray-800/60 text-gray-400 rounded px-1.5 py-0.5 border border-gray-700/40">{p.name}</span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                                {matchingModule && matchingModule.operativi.length > 0 && (
                                                    <div>
                                                        <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-gray-500 mb-0.5">Competenze Operative</p>
                                                        <ul className="space-y-0.5">
                                                            {matchingModule.operativi.map((p, i) => (
                                                                <li key={i} className="text-[11px] text-gray-400 leading-relaxed flex gap-1.5">
                                                                    <span className="text-gray-600 flex-shrink-0 mt-0.5">·</span>
                                                                    <span>{p.name}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                {matchingModule && matchingModule.attivitaChiave.length > 0 && (
                                                    <div>
                                                        <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-gray-500 mb-0.5">Attività Chiave</p>
                                                        <ul className="space-y-0.5">
                                                            {matchingModule.attivitaChiave.map((a, i) => (
                                                                <li key={i} className="text-[11px] text-gray-400 leading-relaxed flex gap-1.5">
                                                                    <span className="text-gray-600 flex-shrink-0 mt-0.5">·</span>
                                                                    <span>{a}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {block.objective && (
                                    <div>
                                        <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-gray-500 mb-0.5">Obiettivo</p>
                                        <p className="text-[11px] text-gray-400 leading-relaxed">{block.objective}</p>
                                    </div>
                                )}
                                {(block.tipologia || block.metodologia || isFslActive || block.hasExternalExpert || block.isFuoriAula) && (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        {block.tipologia && (
                                            <span className="text-[9px] font-mono bg-gray-800/70 text-gray-400 rounded px-1.5 py-0.5 border border-gray-700/40" title="Come">
                                                {LESSON_TYPE_LABELS[block.tipologia as LessonType]}
                                            </span>
                                        )}
                                        {block.metodologia && (
                                            <span className="text-[9px] font-mono bg-gray-800/70 text-gray-400 rounded px-1.5 py-0.5 border border-gray-700/40" title="Approccio">
                                                {TEACHING_METHODOLOGY_LABELS[block.metodologia as TeachingMethodology]}
                                            </span>
                                        )}
                                        {(block.tipologia || block.metodologia) && (isFslActive || block.hasExternalExpert || block.isFuoriAula) && (
                                            <span className="w-px h-3 bg-gray-700/50" />
                                        )}
                                        {isFslActive && <span className="text-[9px] font-mono text-sky-400/70 border border-sky-500/20 rounded px-1.5 py-0.5">FSL</span>}
                                        {block.hasExternalExpert && (
                                            <span className="text-[9px] font-mono text-amber-400/70 border border-amber-500/20 rounded px-1.5 py-0.5" title={block.externalExpertName || 'Esperto esterno'}>
                                                ESP{block.externalExpertName ? ` · ${block.externalExpertName}` : ''}
                                            </span>
                                        )}
                                        {block.isFuoriAula && (
                                            <span className="text-[9px] font-mono text-teal-400/70 border border-teal-500/20 rounded px-1.5 py-0.5" title={block.luogo || 'Fuori aula'}>
                                                FUORI{block.luogo ? ` · ${block.luogo}` : ''}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </details>
                    )}

                    {/* Pannello info attività selezionata (activity mode) */}
                    {labMode === 'activity' && selectedActivity && (
                        <div className="flex-shrink-0 border-b border-rose-900/30 bg-rose-950/20 px-4 py-2 flex items-center gap-3 min-w-0">
                            <span className="text-[9px] font-mono tracking-[0.12em] uppercase text-rose-700/70 flex-shrink-0">Attività</span>
                            <span className="text-sm font-display font-medium text-rose-300/90 truncate">{selectedActivity.title}</span>
                            {selectedActivity.durationInBlocks != null && (
                                <span className="text-[9px] font-mono text-rose-700/60 flex-shrink-0">{selectedActivity.durationInBlocks} blocchi</span>
                            )}
                            {selectedActivity.contesto && (
                                <span className="text-[9px] font-mono text-rose-700/60 flex-shrink-0 border border-rose-800/40 rounded px-1.5 py-0.5">
                                    {ATTIVITA_CONTESTO_LABELS[selectedActivity.contesto] ?? selectedActivity.contesto}
                                </span>
                            )}
                        </div>
                    )}

                    {/* Form creazione nuova attività (activity mode, nessuna attività selezionata/esistente) */}
                    {labMode === 'activity' && !selectedActivity && onCreateActivityInLab && (
                        <div className="flex-shrink-0 border-b border-rose-900/30 bg-rose-950/20 px-4 py-3 space-y-2.5">
                            <p className="text-[10px] font-mono text-rose-600/70 uppercase tracking-[0.12em]">Nuova attività</p>
                            <input
                                type="text"
                                value={newActivityTitle}
                                onChange={e => setNewActivityTitle(e.target.value)}
                                placeholder="Titolo dell'attività…"
                                className="w-full bg-transparent border border-rose-800/40 rounded px-2.5 py-1.5 text-sm text-white placeholder-rose-800/60 focus:outline-none focus:border-rose-600/50"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && newActivityTitle.trim()) { e.preventDefault(); handleSubmitNewActivity(); }}}
                            />
                            <div className="flex items-center gap-3 flex-wrap">
                                {/* Durata */}
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-rose-700/70">Durata:</span>
                                    <input
                                        type="number" min={1} max={30} value={newActivityDuration}
                                        onChange={e => setNewActivityDuration(Math.max(1, Math.min(30, parseInt(e.target.value) || 1)))}
                                        className="w-12 bg-transparent border border-rose-800/40 rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:border-rose-600/50"
                                    />
                                    <span className="text-[10px] font-mono text-rose-700/70">blocchi</span>
                                </div>
                                {/* Contesto */}
                                <div className="flex items-center gap-1">
                                    <span className="text-[10px] font-mono text-rose-700/70 mr-1">Dove:</span>
                                    {(Object.keys(ATTIVITA_CONTESTO_LABELS) as ActivityContesto[]).map(k => (
                                        <button
                                            key={k}
                                            onClick={() => setNewActivityContesto(k)}
                                            className={`px-2 py-0.5 text-[10px] font-mono rounded-full transition-colors ${
                                                newActivityContesto === k
                                                    ? 'bg-rose-800/50 text-rose-300 border border-rose-700/50'
                                                    : 'text-rose-700/50 hover:text-rose-400 border border-transparent'
                                            }`}
                                        >
                                            {ATTIVITA_CONTESTO_LABELS[k]}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <button
                                onClick={handleSubmitNewActivity}
                                disabled={!newActivityTitle.trim()}
                                className="px-3 py-1 text-[10px] font-mono text-rose-300 border border-rose-700/40 rounded hover:bg-rose-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                Crea attività
                            </button>
                        </div>
                    )}

                    {/* Area messaggi */}
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar">
                        {labMode === 'activity' && !selectedActivity ? (
                            // Activity mode ma nessuna attività selezionata/creata
                            <div className="flex items-center justify-center h-full text-center px-8">
                                <div className="space-y-2">
                                    <p className="text-sm text-rose-700/50 font-mono">
                                        {blockActivities && blockActivities.length > 0
                                            ? 'Seleziona un\'attività dai pill in alto per aprire il laboratorio.'
                                            : 'Crea una nuova attività per iniziare a lavorarci con Ada.'
                                        }
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
                                {activeMessages.filter(msg => (msg.content || msg.attachment || msg.generatedImages)).map((msg, index) => (
                                    <div
                                        key={msg.id}
                                        id={labMode === 'lesson' ? `message-block-${block.id}-${msg.id}` : `message-activity-${selectedActivity?.id}-${msg.id}`}
                                    >
                                        <MessageView
                                            message={msg}
                                            onShowToast={() => {}}
                                            isLastMessage={index === activeMessages.length - 1}
                                            onSendMessage={labMode === 'lesson' ? onSendMessage : undefined}
                                            highlightQuery={labMode === 'lesson' ? highlightQuery : undefined}
                                            isCurrentResult={labMode === 'lesson' && msg.id === currentResultId}
                                            onShowConfirmation={onShowConfirmation}
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer con ChatInput */}
                    {(labMode === 'lesson' || (labMode === 'activity' && selectedActivity)) && (
                        <footer className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-gray-800/40 bg-gray-900/40 backdrop-blur-sm">
                            <div className="max-w-3xl mx-auto">
                                {labMode === 'lesson' && currentModeId && onModeChange && (
                                    <div className="mb-2">
                                        <ModePills currentModeId={currentModeId} onModeChange={onModeChange} />
                                    </div>
                                )}
                                {labMode === 'activity' && selectedActivity && (
                                    <p className="text-[9px] font-mono text-rose-700/50 mb-2">
                                        ↗ chat attività · Ada risponderà nel contesto di "{selectedActivity.title}"
                                    </p>
                                )}
                                <ChatInput
                                    onSendMessage={effectiveSendMessage as any}
                                    isLoading={effectiveIsLoading}
                                    onShowToast={() => {}}
                                />
                            </div>
                        </footer>
                    )}

                    {/* FontiDrawer */}
                    {onAddFonte && (
                        <FontiDrawer
                            isOpen={isDrawerOpen}
                            onClose={() => setIsDrawerOpen(false)}
                            fonti={block.fonti ?? []}
                            webliografiaRilevata={webliografiaRilevata}
                            onAddFonte={onAddFonte}
                            onRemoveFonte={onRemoveFonte ?? (() => {})}
                            onUpdateFonte={onUpdateFonte ?? (() => {})}
                            onPromote={onPromoteFonte ?? (() => {})}
                        />
                    )}
                </>
            )}

            {/* ── Tab Contenuto Master / Master Attività ── */}
            {activeTab === 'contenutoMaster' && labMode === 'lesson' && (
                <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-gray-800">
                    <DocumentEditor
                        ref={editorRef}
                        initialContent={mergedContentHtml}
                        onSave={handleSaveDocument}
                        mode="html"
                        isEditable={true}
                        className=""
                        toolbarChildren={editorToolbarActions}
                        includeAlignmentInToolbar={true}
                    />
                    {(block.fonti?.length ?? 0) > 0 && (
                        <div className="flex-shrink-0 px-8 py-5 border-t border-gray-700/50">
                            <p className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-400/80 mb-3">Fonti</p>
                            <div className="flex flex-col gap-y-2">
                                {block.fonti!.map(fonte => (
                                    <div key={fonte.id} className="flex items-start gap-2">
                                        <span className="mt-0.5 flex-shrink-0 text-gray-500">
                                            {fonte.type === 'url' && <WebIcon className="h-3.5 w-3.5" />}
                                            {fonte.type === 'pdf' && <ArrowDownTrayIcon className="h-3.5 w-3.5" />}
                                            {fonte.type === 'note' && <BookOpenIcon className="h-3.5 w-3.5" />}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-sm text-gray-300 truncate">{fonte.title}</span>
                                                {fonte.origin === 'promoted' && (
                                                    <span className="text-[9px] font-mono bg-gray-800 text-gray-500 rounded px-1 flex-shrink-0">rilevata</span>
                                                )}
                                            </div>
                                            {fonte.type === 'url' && fonte.url && (
                                                <a href={fonte.url} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400/70 hover:text-sky-300 underline-offset-2 underline break-all">{fonte.url}</a>
                                            )}
                                            {fonte.type === 'note' && fonte.content && (
                                                <p className="text-xs text-gray-500 italic">{fonte.content.slice(0, 80)}{fonte.content.length > 80 ? '…' : ''}</p>
                                            )}
                                            {fonte.type === 'pdf' && (
                                                <p className="text-xs text-gray-500">
                                                    {fonte.fileName ?? ''}
                                                    {fonte.fileSize != null && <span className="ml-1">({(fonte.fileSize / 1024).toFixed(0)} KB)</span>}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Master Attività ── */}
            {activeTab === 'contenutoMaster' && labMode === 'activity' && selectedActivity && (
                <div className="flex-1 flex flex-col overflow-y-auto custom-scrollbar bg-gray-800">
                    <div className="flex-shrink-0 px-6 pt-3 pb-2 border-b border-rose-900/30 bg-rose-950/10">
                        <p className="text-[9px] font-mono tracking-[0.12em] uppercase text-rose-700/70">
                            Master — {selectedActivity.title}
                        </p>
                    </div>
                    <DocumentEditor
                        ref={activityEditorRef}
                        initialContent={activityMasterHtml}
                        onSave={handleSaveActivityDocument}
                        mode="html"
                        isEditable={true}
                        className=""
                        includeAlignmentInToolbar={true}
                    />
                </div>
            )}

            {/* Fallback: activity mode + master tab ma nessuna attività selezionata */}
            {activeTab === 'contenutoMaster' && labMode === 'activity' && !selectedActivity && (
                <div className="flex-1 flex items-center justify-center text-rose-700/40 text-sm font-mono">
                    Seleziona un'attività per accedere al suo master.
                </div>
            )}
        </div>
    );
};

export default memo(BlockWorkspaceView);
