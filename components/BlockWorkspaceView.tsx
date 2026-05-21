import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import type { BlockDetails, Message, PlanningActionPayload } from '../types';
import MessageView from './MessageView';
import ChatInput from './ChatInput';
import DocumentEditor from './DocumentEditor';
import { ArrowDownTrayIcon, WebIcon } from './Icons';
import ModePills from './ModePills';
import * as GeminiService from '../services/gemini';

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
    onShowConfirmation: (props: any) => void;
    currentModeId?: string;
    onModeChange?: (modeId: string) => void;
}

const BlockWorkspaceView: React.FC<BlockWorkspaceViewProps> = ({ block, onSendMessage, isLoading, highlightQuery, currentResultId, activeTab, useGoogleSearch, onGoogleSearchChange, onShowConfirmation, currentModeId, onModeChange }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isExportingHtml, setIsExportingHtml] = useState(false);
    const editorRef = useRef<HTMLDivElement>(null);
    
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (scrollContainer && !highlightQuery) {
            const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 150;
            if (isNearBottom) {
                // A small delay can help ensure the DOM has fully updated.
                setTimeout(() => {
                    scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
                }, 100);
            }
        }
    }, [block.messages, isLoading, highlightQuery]);
    
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
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0D1117]">

            {activeTab === 'laboratorio' && (
                <>
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
                    {allSources.length > 0 && (
                        <div className="flex-shrink-0 p-6 bg-gray-800 border-t-2 border-gray-700/50">
                            <div className="flex justify-between items-center mb-3">
                                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                    <WebIcon className="h-5 w-5 text-sky-400" />
                                    Webliografia Rilevata
                                </h3>
                                <button
                                    onClick={handleAppendSources}
                                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
                                >
                                    Includi nel Contenuto Master
                                </button>
                            </div>
                            <ul className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar pr-2">
                                {allSources.map((source, index) => (
                                    <li key={source.uri} className="text-sm">
                                        <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline break-all">
                                            {index + 1}. {source.title || source.uri}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default memo(BlockWorkspaceView);