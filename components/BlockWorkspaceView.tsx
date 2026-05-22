import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import type { BlockDetails, PlanningActionPayload, BlockSource } from '../types';
import type { ConfirmationModalProps } from './ConfirmationModal';
import MessageView from './MessageView';
import ChatInput from './ChatInput';
import DocumentEditor from './DocumentEditor';
import { ArrowDownTrayIcon, WebIcon, BookOpenIcon } from './Icons';
import ModePills from './ModePills';
import * as GeminiService from '../services/gemini';
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
    // Handlers per le fonti del blocco (passati da PlanningView)
    onAddFonte?: (fonte: Omit<BlockSource, 'id' | 'addedAt'>) => void;
    onRemoveFonte?: (fonteId: string) => void;
    onUpdateFonte?: (fonteId: string, patch: Partial<BlockSource>) => void;
    onPromoteFonte?: (url: string) => void;
}

const BlockWorkspaceView: React.FC<BlockWorkspaceViewProps> = ({ block, onSendMessage, isLoading, highlightQuery, currentResultId, activeTab, useGoogleSearch, onGoogleSearchChange, onShowConfirmation, currentModeId, onModeChange, onAddFonte, onRemoveFonte, onUpdateFonte, onPromoteFonte }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isExportingHtml, setIsExportingHtml] = useState(false);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer && !highlightQuery) {
            const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 150;
            if (isNearBottom) {
                const timer = setTimeout(() => {
                    scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
                }, 100);
                return () => clearTimeout(timer);
            }
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

    if (!block) {
         return (
            <div className="flex-1 flex items-center justify-center text-gray-500">
                Seleziona un blocco per iniziare.
            </div>
        );
    }

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

    return (
        <div className="relative flex-1 flex flex-col overflow-hidden bg-[#0D1117]">

            {activeTab === 'laboratorio' && (
                <>
                    {/* Mini-toolbar Laboratorio: pulsante Fonti */}
                    {onAddFonte && (
                        <div className="flex-shrink-0 flex items-center justify-end px-4 py-1.5 border-b border-gray-800/40 bg-[#0D1117]">
                            <button
                                onClick={() => setIsDrawerOpen(true)}
                                className="flex items-center gap-1.5 px-2.5 py-1 text-gray-300 hover:text-white rounded-md hover:bg-gray-800/60 transition-colors"
                                title="Fonti del blocco"
                            >
                                <BookOpenIcon className="h-4 w-4" />
                                <span className="text-sm">Fonti</span>
                                {(block.fonti?.length ?? 0) > 0 && (
                                    <span className="bg-purple-500/30 text-purple-300 text-[10px] font-mono rounded-full px-1.5">
                                        {block.fonti!.length}
                                    </span>
                                )}
                            </button>
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
                            {currentModeId && onModeChange && (
                                <div className="mb-2">
                                    <ModePills currentModeId={currentModeId} onModeChange={onModeChange} />
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