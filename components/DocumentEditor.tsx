import React, { useRef, useMemo, useEffect, useState } from 'react';
import { marked } from 'marked';
import EditorToolbar from './EditorToolbar';
import MarkdownRenderer from './MarkdownRenderer';

type SaveStatus = 'saved' | 'editing' | 'saving';

interface DocumentEditorProps {
    initialContent: string;
    onSave: (content: string) => void;
    mode: 'html' | 'markdown';
    isEditable: boolean;
    className?: string;
    toolbarChildren?: React.ReactNode;
    includeAlignmentInToolbar?: boolean;
}

const DocumentEditor = React.forwardRef<HTMLDivElement, DocumentEditorProps>(({
    initialContent,
    onSave,
    mode,
    isEditable,
    className,
    toolbarChildren,
    includeAlignmentInToolbar = false,
}, ref) => {
    // Refs
    const internalRef = useRef<HTMLDivElement>(null);
    const editorRef = (ref || internalRef) as React.RefObject<HTMLDivElement>;
    const autosaveTimeoutRef = useRef<number | null>(null);
    const lastSavedContent = useRef(initialContent);

    // State
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
    const [markdownContent, setMarkdownContent] = useState('');
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    
    // Sync markdown content with prop
    useEffect(() => {
        if (mode === 'markdown') {
            setMarkdownContent(initialContent);
        }
        lastSavedContent.current = initialContent;
        setSaveStatus('saved');
    }, [initialContent, mode]);

    // Sync HTML content with prop
    useEffect(() => {
        if (mode === 'html' && editorRef.current) {
            const contentToSet = initialContent || '<p></p>';
            if (editorRef.current.innerHTML !== contentToSet) {
                editorRef.current.innerHTML = contentToSet;
            }
        }
    }, [initialContent, mode, editorRef]);

    const triggerAutosave = (content: string) => {
        if (!isEditable) return;
        setSaveStatus('editing');
        if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
        
        autosaveTimeoutRef.current = window.setTimeout(() => {
            if (content.trim() !== lastSavedContent.current.trim()) {
                setSaveStatus('saving');
                onSave(content);
                lastSavedContent.current = content;
                setTimeout(() => setSaveStatus('saved'), 500);
            } else {
                setSaveStatus('saved');
            }
        }, 1500);
    };

    const handleMarkdownChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setMarkdownContent(newContent);
        triggerAutosave(newContent);
    };

    const handleHtmlInput = () => {
        if (editorRef.current) {
            triggerAutosave(editorRef.current.innerHTML);
        }
    };
    
    // --- Drag and Drop Handlers ---
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (isEditable && e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            const isImage = Array.from(e.dataTransfer.items).some((item: DataTransferItem) => item.type.startsWith('image/'));
            if (isImage) {
                setIsDraggingOver(true);
            }
        }
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        // Use relatedTarget to prevent flickering when moving over child elements
        if (!editorRef.current?.contains(e.relatedTarget as Node)) {
             setIsDraggingOver(false);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault(); // This is crucial to allow dropping
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);

        if (!isEditable) return;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0]; // Process only the first file
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (readerEvent) => {
                    const img = document.createElement('img');
                    img.src = readerEvent.target?.result as string;
                    img.style.maxWidth = '80%';
                    img.style.display = 'block';
                    img.style.marginLeft = 'auto';
                    img.style.marginRight = 'auto';
                    img.style.height = 'auto';
                    img.style.borderRadius = '4px';
                    img.style.marginBlock = '1em';
                    
                    if (editorRef.current) {
                        editorRef.current.focus();
                        const selection = window.getSelection();
                        let range;

                        // Create a range at the drop position
                        if (document.caretRangeFromPoint) {
                            range = document.caretRangeFromPoint(e.clientX, e.clientY);
                        } else {
                            if (selection && selection.rangeCount > 0) {
                                range = selection.getRangeAt(0);
                            }
                        }

                        // Set the editor's selection to the drop point
                        if (range && selection) {
                            selection.removeAllRanges();
                            selection.addRange(range);
                        }
                        
                        document.execCommand('insertHTML', false, `<p>${img.outerHTML}</p>`);
                        handleHtmlInput(); // Trigger autosave
                    }
                };
                reader.readAsDataURL(file);
            }
        }
    };

    const containerClasses = `bg-gray-800/50 rounded-lg border ${ isEditable ? 'border-gray-700/50' : 'border-transparent' }`;

    // --- RENDER LOGIC ---
    if (mode === 'markdown') {
        return (
            <div className={`flex flex-col h-[80vh] ${containerClasses}`}>
                {isEditable && (
                    <EditorToolbar 
                        editorRef={editorRef}
                        mode="markdown"
                        isPreviewOpen={isPreviewOpen}
                        onTogglePreview={() => setIsPreviewOpen(!isPreviewOpen)}
                        saveStatus={saveStatus}
                    />
                )}
                <div className="flex-grow flex overflow-hidden rounded-b-lg">
                    {!isEditable ? (
                        <div className="p-6 custom-scrollbar overflow-y-auto w-full bg-gray-900/30">
                            <MarkdownRenderer content={markdownContent} />
                        </div>
                    ) : isPreviewOpen ? (
                        <>
                            <textarea
                                value={markdownContent}
                                onChange={handleMarkdownChange}
                                className="w-1/2 h-full p-6 bg-gray-900 text-gray-200 focus:outline-none custom-scrollbar font-mono text-sm resize-none"
                                placeholder="Scrivi qui in Markdown..."
                            />
                            <div className="w-1/2 h-full overflow-y-auto p-6 border-l border-gray-700 custom-scrollbar bg-gray-800/50">
                                <MarkdownRenderer content={markdownContent} />
                            </div>
                        </>
                    ) : (
                        <textarea
                            value={markdownContent}
                            onChange={handleMarkdownChange}
                            className="w-full h-full p-6 bg-gray-900 text-gray-200 focus:outline-none custom-scrollbar font-mono text-sm resize-none"
                            placeholder="Scrivi qui in Markdown..."
                        />
                    )}
                </div>
            </div>
        );
    }
    
    // Fallback for mode === 'html'
    return (
        <div className={containerClasses}>
            {isEditable && (
                <EditorToolbar 
                    editorRef={editorRef}
                    mode="html"
                    includeAlignment={includeAlignmentInToolbar}
                    saveStatus={saveStatus}
                >
                    {toolbarChildren}
                </EditorToolbar>
            )}
            <div
                ref={editorRef}
                contentEditable={isEditable}
                onInput={handleHtmlInput}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                suppressContentEditableWarning={true}
                className={`document-editor-page !shadow-none focus:outline-none transition-all ${className} ${isEditable ? '!rounded-t-none !rounded-b-lg' : '!rounded-lg !bg-gray-900/30'} ${isDraggingOver ? 'ring-2 ring-blue-500 ring-inset' : ''}`}
            >
                {isDraggingOver && (
                    <div className="absolute inset-0 bg-blue-500/10 border-2 border-dashed border-blue-400 rounded-lg flex items-center justify-center pointer-events-none">
                        <span className="text-blue-300 font-semibold">Rilascia l'immagine per caricarla</span>
                    </div>
                )}
            </div>
        </div>
    );
});

DocumentEditor.displayName = 'DocumentEditor';
export default DocumentEditor;