import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import type { BlockDetails, PlanningActionPayload, BlockSource, LessonType, ActivityType, ModuleDetails, Activity } from '../types';
import { ACTIVITY_TYPE_LABELS, COURSE_CONTENT_TYPE_LABELS } from '../constants';
import { useProgettazioneCache } from '../contexts/ProgettazioneCacheContext';
import type { ConfirmationModalProps } from './ConfirmationModal';
import MessageView from './MessageView';
import ChatInput from './ChatInput';
import DocumentEditor from './DocumentEditor';
import { ArrowDownTrayIcon, WebIcon, BookOpenIcon } from './Icons';
import ModePills from './ModePills';
import FontiDrawer from './FontiDrawer';

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
    // Attività
    onAddActivity?: (title: string, type: ActivityType, dueInBlocks: number, description?: string) => void;
    blockActivities?: Activity[];
}

const BlockWorkspaceView: React.FC<BlockWorkspaceViewProps> = ({ block, onSendMessage, isLoading, highlightQuery, currentResultId, activeTab, useGoogleSearch, onGoogleSearchChange, onShowConfirmation, currentModeId, onModeChange, onAddFonte, onRemoveFonte, onUpdateFonte, onPromoteFonte, onAddActivity, blockActivities }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isExportingHtml, setIsExportingHtml] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    // Attività form state — Step 8
    const [isActivityFormOpen, setIsActivityFormOpen] = useState(false);
    const [activityTitle, setActivityTitle] = useState('');
    const [activityType, setActivityType] = useState<ActivityType>('produzione_scritta');
    const [activityDueInBlocks, setActivityDueInBlocks] = useState(4);
    const [activityDescription, setActivityDescription] = useState('');
    const editorRef = useRef<HTMLDivElement>(null);
    const [isModuleExpanded, setIsModuleExpanded] = useState(false);

    const { contentUnits, moduleMap } = useProgettazioneCache();

    const prevMsgCountRef = useRef(0);

    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (!scrollContainer || highlightQuery) return;
        const msgCount = block.messages?.length ?? 0;
        const newMessageAdded = msgCount > prevMsgCountRef.current;
        prevMsgCountRef.current = msgCount;

        const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 150;
        const shouldScroll = newMessageAdded || (isLoading && isNearBottom);

        if (shouldScroll) {
            const timer = setTimeout(() => {
                scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [block.messages, isLoading, highlightQuery]);

    // URL estratti dalle fonti di grounding dei messaggi del blocco (prima del return condizionale)
    const webliografiaRilevata = useMemo(() => {
        if (!block?.messages) return [];
        const uris = new Set<string>();
        block.messages.forEach(msg => {
            msg.sources?.forEach(s => { if (s.uri) uris.add(s.uri); });
        });
        return Array.from(uris);
    }, [block?.messages]);

    // Trova l'unità didattica del Progetto Didattico corrispondente al blocco corrente
    const matchingUnit = useMemo(() =>
        contentUnits?.find(u => u.title === block?.module),
        [contentUnits, block?.module]
    );

    // Trova i dettagli completi del modulo (Concetti Chiave, Competenze, Attività Chiave)
    // disponibili solo per i MODULI (non UDA/FSL/EC) tramite moduleMap
    const matchingModule = useMemo((): ModuleDetails | null => {
        if (!block?.module || !moduleMap) return null;
        const entry = [...moduleMap.entries()].find(([key]) => key.includes(block.module!));
        return entry?.[1] ?? null;
    }, [moduleMap, block?.module]);

    const mergedContentHtml = useMemo(() => {
        return (block.contentBlocks || [])
            .map(cb => cb.content)
            .join('<hr class="page-break">');
    }, [block.contentBlocks]);

    const allSources = useMemo(() => {
        if (!block.messages) return [];
        const sourcesMap = new Map<string, { title: string; uri: string }>();
        block.messages.forEach(message => {
            if (message.sources) {
                message.sources.forEach(source => {
                    if (!sourcesMap.has(source.uri)) {
                        sourcesMap.set(source.uri, source);
                    }
                });
            }
        });
        return Array.from(sourcesMap.values());
    }, [block.messages]);

    const handleSaveDocument = useCallback((newContent: string) => {
        onSendMessage('', undefined, { action: 'consolidate_and_update_content', newContent });
    }, [onSendMessage]);

    const handleAppendSources = useCallback(() => {
        if (!editorRef.current) return;
        if (editorRef.current.querySelector('#webliografia-master')) return;

        const sourcesHtml = `<hr id="webliografia-master"><h2>Webliografia</h2><ol>${allSources.map(source => `<li><a href="${source.uri}" target="_blank" rel="noopener noreferrer">${source.title || source.uri}</a></li>`).join('')}</ol>`;
        editorRef.current.innerHTML += sourcesHtml;
        handleSaveDocument(editorRef.current.innerHTML);
    }, [allSources, handleSaveDocument]);

    const handleExportHtml = useCallback(async () => {
        if (!editorRef.current || !editorRef.current.innerHTML.trim()) {
            console.warn("Editor content is empty, aborting HTML export.");
            return;
        }

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
    hr.page-break { border: 0; height: 1px; background-image: linear-gradient(to right, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)); margin: 2em 0; }
  </style>
</head>
<body>
${htmlContent}
</body>
</html>`;

            const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            const filename = `blocco_lezione_${block.day.toLowerCase().replace(/[^a-z0-9]/g, '_')}.html`;
            link.download = filename;

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            URL.revokeObjectURL(link.href);
        } catch (error) {
            console.error("HTML export failed", error);
        } finally {
            setIsExportingHtml(false);
        }
    }, [block.day, block.objective]);

    const handleSubmitActivity = useCallback(() => {
        if (!activityTitle.trim() || !onAddActivity) return;
        onAddActivity(activityTitle.trim(), activityType, activityDueInBlocks, activityDescription.trim() || undefined);
        setActivityTitle('');
        setActivityType('produzione_scritta');
        setActivityDueInBlocks(4);
        setActivityDescription('');
        setIsActivityFormOpen(false);
    }, [activityTitle, activityType, activityDueInBlocks, activityDescription, onAddActivity]);

    const editorToolbarActions = useMemo(() => (
        <button
            onClick={handleExportHtml}
            disabled={isExportingHtml}
            className="editor-toolbar-button flex items-center gap-2 !px-3 !bg-green-600/20 !text-green-300 hover:!bg-green-600/40 disabled:opacity-50 disabled:cursor-wait"
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

    return (
        <div className="relative flex-1 flex flex-col overflow-hidden bg-[#0D1117]">

            {activeTab === 'laboratorio' && (
                <>
                    {/* Pannello info blocco: accordion aperto di default con modulo e obiettivo */}
                    {(block.module || block.objective || onAddFonte) && (
                        <details className="flex-shrink-0 border-b border-gray-800/40 bg-[#0D1117] group" open>
                            <summary className="list-none flex items-center gap-2 px-4 py-1.5 cursor-pointer select-none hover:bg-gray-800/30 transition-colors">
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    {matchingUnit ? (
                                        <>
                                            <span className="text-[9px] font-mono tracking-[0.12em] uppercase text-gray-500 flex-shrink-0">
                                                {COURSE_CONTENT_TYPE_LABELS[matchingUnit.type]} {matchingUnit.order}
                                            </span>
                                            <span className="text-[10px] font-mono text-sky-400/60 truncate">{matchingUnit.title}</span>
                                        </>
                                    ) : block.module ? (
                                        <span className="text-[10px] font-mono text-sky-400/60 truncate">{block.module}</span>
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

                                {/* Contesto modulo — espandibile con un click */}
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
                                                                <span key={i} className="text-[9px] font-mono bg-gray-800/60 text-gray-400 rounded px-1.5 py-0.5 border border-gray-700/40">
                                                                    {p.name}
                                                                </span>
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

                                {/* Obiettivo didattico */}
                                {block.objective && (
                                    <div>
                                        <p className="text-[9px] font-mono uppercase tracking-[0.12em] text-gray-500 mb-0.5">Obiettivo</p>
                                        <p className="text-[11px] text-gray-400 leading-relaxed">{block.objective}</p>
                                    </div>
                                )}
                            </div>
                        </details>
                    )}
                    {/* Lista attività lanciate da questo blocco */}
                    {blockActivities && blockActivities.length > 0 && (
                        <div className="flex-shrink-0 border-b border-gray-800/40 bg-[#0D1117] px-4 py-2">
                            <div className="max-w-3xl mx-auto">
                                <p className="text-[9px] font-mono tracking-[0.12em] uppercase text-gray-500 mb-1.5">Attività lanciate</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {blockActivities.map(a => {
                                        const statusColor =
                                            a.status === 'consegnata' ? 'text-emerald-400/70 border-emerald-500/20' :
                                            a.status === 'scaduta'    ? 'text-gray-500 border-gray-600/30' :
                                            a.status === 'in_scadenza'? 'text-amber-400/70 border-amber-500/20' :
                                                                         'text-rose-400/70 border-rose-500/20';
                                        return (
                                            <span key={a.id} className={`flex items-center gap-1 text-[9px] font-mono border rounded px-1.5 py-0.5 ${statusColor}`}>
                                                <span>↗</span>
                                                <span className="max-w-[140px] truncate">{a.title}</span>
                                                <span className="opacity-60">· {ACTIVITY_TYPE_LABELS[a.type]}</span>
                                                {a.status === 'consegnata' && <span>✓</span>}
                                                {a.status === 'scaduta' && <span>⚑</span>}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar">
                        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
                            {(block.messages || []).filter(msg => (msg.content || msg.attachment || msg.generatedImages)).map((msg, index) => (
                                <div key={msg.id} id={`message-block-${block.id}-${msg.id}`}>
                                    <MessageView
                                        message={msg}
                                        onShowToast={() => {}}
                                        isLastMessage={index === (block.messages?.length || 0) - 1}
                                        onSendMessage={onSendMessage}
                                        highlightQuery={highlightQuery}
                                        isCurrentResult={msg.id === currentResultId}
                                        onShowConfirmation={onShowConfirmation}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                    <footer className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-gray-800/40 bg-gray-900/40 backdrop-blur-sm">
                        <div className="max-w-3xl mx-auto">
                            {/* Form inline "Lancia attività" */}
                            {isActivityFormOpen && onAddActivity && (
                                <div className="mb-3 rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                                    <p className="text-[10px] font-mono text-rose-400/80 mb-2">↗ Nuova attività</p>
                                    <input
                                        type="text"
                                        value={activityTitle}
                                        onChange={e => setActivityTitle(e.target.value)}
                                        placeholder="Titolo dell'attività..."
                                        className="w-full bg-transparent border border-gray-700/50 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/40 mb-2"
                                        autoFocus
                                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitActivity(); } }}
                                    />
                                    <div className="flex items-center gap-1 flex-wrap mb-2">
                                        {(['ricerca', 'audiovisivo', 'produzione_scritta', 'progetto', 'altro'] as ActivityType[]).map(t => (
                                            <button
                                                key={t}
                                                onClick={() => setActivityType(t)}
                                                className={`px-2 py-0.5 text-[10px] font-mono rounded-full transition-colors ${
                                                    activityType === t
                                                        ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                                                        : 'text-gray-600 hover:text-gray-400 border border-transparent'
                                                }`}
                                            >
                                                {ACTIVITY_TYPE_LABELS[t]}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[10px] font-mono text-gray-500">Scadenza:</span>
                                        <input
                                            type="number"
                                            min={1}
                                            max={20}
                                            value={activityDueInBlocks}
                                            onChange={e => setActivityDueInBlocks(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                                            className="w-12 bg-transparent border border-gray-700/50 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none focus:border-rose-500/40 text-center"
                                        />
                                        <span className="text-[10px] font-mono text-gray-500">blocchi</span>
                                    </div>
                                    <textarea
                                        value={activityDescription}
                                        onChange={e => setActivityDescription(e.target.value)}
                                        placeholder="Istruzioni per gli studenti (opzionale)"
                                        rows={2}
                                        className="w-full bg-transparent border border-gray-700/50 rounded px-2 py-1 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-rose-500/40 resize-none mb-2"
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleSubmitActivity}
                                            disabled={!activityTitle.trim()}
                                            className="px-3 py-1 text-[10px] font-mono text-rose-300 border border-rose-500/30 rounded hover:bg-rose-500/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Lancia
                                        </button>
                                        <button
                                            onClick={() => setIsActivityFormOpen(false)}
                                            className="px-3 py-1 text-[10px] font-mono text-gray-500 border border-gray-600/40 rounded hover:bg-gray-700/50 transition-colors"
                                        >
                                            Annulla
                                        </button>
                                    </div>
                                </div>
                            )}
                            {/* Riga ModePills + pulsante Lancia attività */}
                            {!isActivityFormOpen && (
                                <div className="mb-2 flex items-center justify-between min-h-[22px]">
                                    {currentModeId && onModeChange
                                        ? <ModePills currentModeId={currentModeId} onModeChange={onModeChange} />
                                        : <div />
                                    }
                                    {onAddActivity && (
                                        <button
                                            onClick={() => setIsActivityFormOpen(true)}
                                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono text-rose-400/70 border border-rose-500/20 rounded-lg hover:bg-rose-500/10 hover:border-rose-400/35 transition-colors ml-2 flex-shrink-0"
                                        >
                                            ↗ Lancia attività
                                        </button>
                                    )}
                                </div>
                            )}
                            <ChatInput
                                onSendMessage={onSendMessage}
                                isLoading={isLoading}
                                onShowToast={() => {}}
                            />
                        </div>
                    </footer>
                    {/* FontiDrawer — pannello slide-in assoluto, si sovrappone all'area Laboratorio */}
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

            {activeTab === 'contenutoMaster' && (
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
                    {/* Sezione Fonti — visibile solo se block.fonti contiene almeno una voce */}
                    {(block.fonti?.length ?? 0) > 0 && (
                        <div className="flex-shrink-0 px-8 py-5 border-t border-gray-700/50">
                            <p className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-400/80 mb-3">
                                Fonti
                            </p>
                            <div className="flex flex-col gap-y-2">
                                {block.fonti!.map(fonte => (
                                    <div key={fonte.id} className="flex items-start gap-2">
                                        {/* Icona tipo */}
                                        <span className="mt-0.5 flex-shrink-0 text-gray-500">
                                            {fonte.type === 'url' && (
                                                <WebIcon className="h-3.5 w-3.5" />
                                            )}
                                            {fonte.type === 'pdf' && (
                                                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                            )}
                                            {fonte.type === 'note' && (
                                                <BookOpenIcon className="h-3.5 w-3.5" />
                                            )}
                                        </span>
                                        {/* Contenuto */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-sm text-gray-300 truncate">
                                                    {fonte.title}
                                                </span>
                                                {fonte.origin === 'promoted' && (
                                                    <span className="text-[9px] font-mono bg-gray-800 text-gray-500 rounded px-1 flex-shrink-0">
                                                        rilevata
                                                    </span>
                                                )}
                                            </div>
                                            {/* Dettaglio secondario per tipo */}
                                            {fonte.type === 'url' && fonte.url && (
                                                <a
                                                    href={fonte.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-xs text-sky-400/70 hover:text-sky-300 underline-offset-2 underline break-all"
                                                >
                                                    {fonte.url}
                                                </a>
                                            )}
                                            {fonte.type === 'note' && fonte.content && (
                                                <p className="text-xs text-gray-500 italic">
                                                    {fonte.content.slice(0, 80)}{fonte.content.length > 80 ? '…' : ''}
                                                </p>
                                            )}
                                            {fonte.type === 'pdf' && (
                                                <p className="text-xs text-gray-500">
                                                    {fonte.fileName ?? ''}
                                                    {fonte.fileSize != null && (
                                                        <span className="ml-1">
                                                            ({(fonte.fileSize / 1024).toFixed(0)} KB)
                                                        </span>
                                                    )}
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
        </div>
    );
};

export default memo(BlockWorkspaceView);
