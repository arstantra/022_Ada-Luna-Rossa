import React from 'react';
import {
    BoldIcon, ItalicIcon, UnderlineIcon, StrikethroughIcon,
    QuoteIcon, ListOlIcon, ListUlIcon,
    AlignLeftIcon, AlignCenterIcon, AlignRightIcon,
    TableIcon, EyeIcon, EyeOffIcon
} from './Icons';

type SaveStatus = 'saved' | 'editing' | 'saving';

interface EditorToolbarProps {
    editorRef: React.RefObject<HTMLDivElement>;
    includeAlignment?: boolean;
    children?: React.ReactNode;
    mode: 'html' | 'markdown';
    isPreviewOpen?: boolean;
    onTogglePreview?: () => void;
    saveStatus?: SaveStatus;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({ 
    editorRef, 
    includeAlignment = false, 
    children,
    mode,
    isPreviewOpen,
    onTogglePreview,
    saveStatus,
}) => {
    const execCmd = (cmd: string, value: string | null = null) => {
        if (editorRef.current) {
            document.execCommand(cmd, false, value);
            editorRef.current.focus();
        }
    };
    
    const formatBlock = (tag: string) => {
        execCmd('formatBlock', `<${tag}>`);
    };

    const insertTable = () => {
        const tableHTML = `<br><table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="border: 1px solid #6b7280; padding: 8px; background-color: #374151;">Header 1</th>
                    <th style="border: 1px solid #6b7280; padding: 8px; background-color: #374151;">Header 2</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="border: 1px solid #6b7280; padding: 8px;">Cell 1</td>
                    <td style="border: 1px solid #6b7280; padding: 8px;">Cell 2</td>
                </tr>
                <tr>
                    <td style="border: 1px solid #6b7280; padding: 8px;">Cell 3</td>
                    <td style="border: 1px solid #6b7280; padding: 8px;">Cell 4</td>
                </tr>
            </tbody>
        </table><p><br></p>`;
        execCmd('insertHTML', tableHTML);
    };

    const statusMap: Record<SaveStatus, { text: string; className: string }> = {
        saved: { text: 'Salvato', className: 'text-gray-500' },
        editing: { text: 'Modifiche non salvate', className: 'text-yellow-400' },
        saving: { text: 'Salvataggio...', className: 'text-blue-400 animate-pulse' },
    };
    const currentStatus = statusMap[saveStatus || 'saved'];

    return (
        <div className="editor-toolbar bg-gray-900 border-b border-gray-700/50 p-2 flex items-center gap-1 flex-wrap justify-between shadow-lg">
            <div className="flex items-center gap-1 flex-wrap">
                {mode === 'html' ? (
                    <>
                        <select onChange={(e) => formatBlock(e.target.value)} className="editor-toolbar-button editor-format-select !p-1.5 !text-sm !font-normal bg-black text-sky-300 border border-gray-700 hover:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                            <option value="p">Testo Normale</option>
                            <option value="h1">Titolo 1</option>
                            <option value="h2">Titolo 2</option>
                            <option value="h3">Titolo 3</option>
                        </select>
                        <div className="w-px h-6 bg-gray-600 mx-1"></div>
                        <button onClick={() => execCmd('bold')} className="editor-toolbar-button" title="Grassetto"><BoldIcon className="h-5 w-5" /></button>
                        <button onClick={() => execCmd('italic')} className="editor-toolbar-button" title="Corsivo"><ItalicIcon className="h-5 w-5" /></button>
                        <button onClick={() => execCmd('underline')} className="editor-toolbar-button" title="Sottolineato"><UnderlineIcon className="h-5 w-5" /></button>
                        <button onClick={() => execCmd('strikeThrough')} className="editor-toolbar-button" title="Barrato"><StrikethroughIcon className="h-5 w-5" /></button>
                        <div className="w-px h-6 bg-gray-600 mx-1"></div>
                        <button onClick={() => execCmd('insertUnorderedList')} className="editor-toolbar-button" title="Lista Puntata"><ListUlIcon className="h-5 w-5" /></button>
                        <button onClick={() => execCmd('insertOrderedList')} className="editor-toolbar-button" title="Lista Numerata"><ListOlIcon className="h-5 w-5" /></button>
                        <button onClick={() => formatBlock('blockquote')} className="editor-toolbar-button" title="Citazione"><QuoteIcon className="h-5 w-5" /></button>
                        <button onClick={insertTable} className="editor-toolbar-button" title="Inserisci Tabella"><TableIcon className="h-5 w-5" /></button>
                        {includeAlignment && (
                            <>
                                <div className="w-px h-6 bg-gray-600 mx-1"></div>
                                <button onClick={() => execCmd('justifyLeft')} className="editor-toolbar-button" title="Allinea a Sinistra"><AlignLeftIcon className="h-5 w-5" /></button>
                                <button onClick={() => execCmd('justifyCenter')} className="editor-toolbar-button" title="Allinea al Centro"><AlignCenterIcon className="h-5 w-5" /></button>
                                <button onClick={() => execCmd('justifyRight')} className="editor-toolbar-button" title="Allinea a Destra"><AlignRightIcon className="h-5 w-5" /></button>
                            </>
                        )}
                    </>
                ) : (
                    onTogglePreview && (
                        <button onClick={onTogglePreview} className="editor-toolbar-button" title={isPreviewOpen ? "Nascondi Anteprima" : "Mostra Anteprima"}>
                            {isPreviewOpen ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                    )
                )}
            </div>
             <div className="flex items-center gap-2">
                {children}
                {saveStatus && (
                    <span className={`text-xs font-medium transition-colors ${currentStatus.className}`}>
                        {currentStatus.text}
                    </span>
                )}
            </div>
        </div>
    );
};

export default EditorToolbar;
