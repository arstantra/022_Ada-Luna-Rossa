import React, { useState, useRef, useCallback, useMemo } from 'react';
import type { BlockSource } from '../types';
import { saveBlockFile } from '../services/db';
import {
    XIcon,
    TrashIcon,
    LinkIcon,
    DocumentTextIcon,
    PaperclipIcon,
    WebIcon,
    ChevronDownIcon,
    ChevronUpIcon,
} from './Icons';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FontiDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    fonti: BlockSource[];
    webliografiaRilevata: string[]; // URL estratti dai messaggi
    onAddFonte: (fonte: Omit<BlockSource, 'id' | 'addedAt'>) => void;
    onRemoveFonte: (fonteId: string) => void;
    onUpdateFonte: (fonteId: string, patch: Partial<BlockSource>) => void;
    onPromote: (url: string) => void;
}

type ActiveForm = 'url' | 'note' | 'pdf' | null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getDomain = (url: string): string => {
    try {
        return new URL(url).hostname.replace('www.', '');
    } catch {
        return url.length > 40 ? url.slice(0, 40) + '…' : url;
    }
};

const truncateUrl = (url: string, maxLen = 48): string => {
    if (url.length <= maxLen) return url;
    return url.slice(0, maxLen) + '…';
};

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Icona per il tipo di fonte */
const SourceTypeIcon: React.FC<{ type: BlockSource['type'] }> = ({ type }) => {
    if (type === 'url') return <LinkIcon className="h-4 w-4 text-sky-400 flex-shrink-0" />;
    if (type === 'note') return <DocumentTextIcon className="h-4 w-4 text-amber-400 flex-shrink-0" />;
    return <PaperclipIcon className="h-4 w-4 text-purple-400 flex-shrink-0" />;
};

/** Preview testuale breve sotto al titolo */
const SourcePreview: React.FC<{ source: BlockSource }> = ({ source }) => {
    if (source.type === 'url' && source.url) {
        return (
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {truncateUrl(source.url)}
            </p>
        );
    }
    if (source.type === 'note' && source.content) {
        const preview = source.content.trim().slice(0, 60);
        return (
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {preview}{source.content.length > 60 ? '…' : ''}
            </p>
        );
    }
    if (source.type === 'pdf') {
        const parts: string[] = [];
        if (source.fileName) parts.push(source.fileName);
        if (source.fileSize) parts.push(formatFileSize(source.fileSize));
        return (
            <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {parts.join(' · ')}
            </p>
        );
    }
    return null;
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const FontiDrawer: React.FC<FontiDrawerProps> = ({
    isOpen,
    onClose,
    fonti,
    webliografiaRilevata,
    onAddFonte,
    onRemoveFonte,
    onUpdateFonte,
    onPromote,
}) => {
    // --- Form accordion state ---
    const [activeForm, setActiveForm] = useState<ActiveForm>(null);

    // --- URL form state ---
    const [urlValue, setUrlValue] = useState('');
    const [urlTitle, setUrlTitle] = useState('');

    // --- Note form state ---
    const [noteTitle, setNoteTitle] = useState('');
    const [noteContent, setNoteContent] = useState('');

    // --- PDF form state ---
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfTitle, setPdfTitle] = useState('');
    const [isUploadingPdf, setIsUploadingPdf] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // --- Webliografia filtrata (rimuove URL già presenti come fonti) ---
    const existingUrls = useMemo(
        () => new Set(fonti.filter(f => f.url).map(f => f.url!)),
        [fonti]
    );
    const urlsNonPromossi = useMemo(
        () => webliografiaRilevata.filter(url => !existingUrls.has(url)),
        [webliografiaRilevata, existingUrls]
    );

    // -----------------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------------

    const toggleForm = useCallback((form: ActiveForm) => {
        setActiveForm(prev => (prev === form ? null : form));
    }, []);

    const resetUrlForm = () => {
        setUrlValue('');
        setUrlTitle('');
    };

    const resetNoteForm = () => {
        setNoteTitle('');
        setNoteContent('');
    };

    const resetPdfForm = () => {
        setPdfFile(null);
        setPdfTitle('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAddUrl = useCallback(() => {
        const trimmedUrl = urlValue.trim();
        if (!trimmedUrl) return;
        onAddFonte({
            type: 'url',
            title: urlTitle.trim() || getDomain(trimmedUrl),
            origin: 'manual',
            url: trimmedUrl,
        });
        resetUrlForm();
        setActiveForm(null);
    }, [urlValue, urlTitle, onAddFonte]);

    const handleAddNote = useCallback(() => {
        const trimmedTitle = noteTitle.trim();
        const trimmedContent = noteContent.trim();
        if (!trimmedTitle && !trimmedContent) return;
        onAddFonte({
            type: 'note',
            title: trimmedTitle || 'Nota',
            origin: 'manual',
            content: trimmedContent,
        });
        resetNoteForm();
        setActiveForm(null);
    }, [noteTitle, noteContent, onAddFonte]);

    const handlePdfFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] ?? null;
        if (file) {
            setPdfFile(file);
            setPdfTitle(file.name.replace(/\.pdf$/i, ''));
        }
    }, []);

    const handleAddPdf = useCallback(async () => {
        if (!pdfFile) return;
        setIsUploadingPdf(true);
        try {
            const dbFileKey = crypto.randomUUID();
            await saveBlockFile(dbFileKey, pdfFile);
            onAddFonte({
                type: 'pdf',
                title: pdfTitle.trim() || pdfFile.name,
                origin: 'manual',
                fileName: pdfFile.name,
                fileSize: pdfFile.size,
                dbFileKey,
            });
            resetPdfForm();
            setActiveForm(null);
        } catch (err) {
            console.error('FontiDrawer: errore salvataggio PDF', err);
        } finally {
            setIsUploadingPdf(false);
        }
    }, [pdfFile, pdfTitle, onAddFonte]);

    const handleUrlKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleAddUrl();
    };

    // -----------------------------------------------------------------------
    // Render helpers
    // -----------------------------------------------------------------------

    /** Pulsante "Aggiungi tipo" nella riga in alto */
    const AddTypeButton: React.FC<{
        form: ActiveForm;
        label: string;
        isActive: boolean;
    }> = ({ form, label, isActive }) => (
        <button
            onClick={() => toggleForm(form)}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border transition-colors ${
                isActive
                    ? 'text-sky-300 border-sky-400/50 bg-sky-500/15'
                    : 'text-sky-400/70 border border-sky-500/20 hover:bg-sky-500/15 hover:text-sky-300'
            }`}
        >
            {label}
            {isActive
                ? <ChevronUpIcon className="h-3 w-3" />
                : <ChevronDownIcon className="h-3 w-3" />}
        </button>
    );

    // -----------------------------------------------------------------------
    // JSX
    // -----------------------------------------------------------------------

    return (
        <div
            className={`
                absolute top-0 right-0 h-full w-80 flex flex-col
                bg-gray-900 border-l border-gray-700/50
                transition-transform duration-200 z-20
                ${isOpen ? 'translate-x-0' : 'translate-x-full'}
            `}
        >
            {/* ---- HEADER ---- */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-700/50">
                <h2 className="font-sans font-semibold text-sm text-white">
                    Fonti del Blocco
                </h2>
                <button
                    onClick={onClose}
                    aria-label="Chiudi pannello fonti"
                    className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-gray-800/60 transition-colors"
                >
                    <XIcon className="h-4 w-4" />
                </button>
            </div>

            {/* ---- PULSANTI AGGIUNGI ---- */}
            <div className="flex-shrink-0 flex gap-2 px-4 py-3 border-b border-gray-800/60">
                <AddTypeButton form="url" label="+ URL" isActive={activeForm === 'url'} />
                <AddTypeButton form="note" label="+ Nota" isActive={activeForm === 'note'} />
                <AddTypeButton form="pdf" label="+ PDF" isActive={activeForm === 'pdf'} />
            </div>

            {/* ---- FORM ACCORDIONS ---- */}

            {/* Form URL */}
            {activeForm === 'url' && (
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800/60 space-y-2 bg-gray-900/70">
                    <input
                        type="url"
                        value={urlValue}
                        onChange={e => setUrlValue(e.target.value)}
                        onKeyDown={handleUrlKeyDown}
                        placeholder="https://..."
                        autoFocus
                        className="w-full px-3 py-1.5 text-sm bg-gray-800/80 border border-gray-700/60 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-colors"
                    />
                    <input
                        type="text"
                        value={urlTitle}
                        onChange={e => setUrlTitle(e.target.value)}
                        placeholder="Titolo fonte (opzionale)"
                        className="w-full px-3 py-1.5 text-sm bg-gray-800/80 border border-gray-700/60 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-colors"
                    />
                    <button
                        onClick={handleAddUrl}
                        disabled={!urlValue.trim()}
                        className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-600/80 text-white hover:bg-blue-500 shadow-sm shadow-blue-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Aggiungi
                    </button>
                </div>
            )}

            {/* Form NOTA */}
            {activeForm === 'note' && (
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800/60 space-y-2 bg-gray-900/70">
                    <input
                        type="text"
                        value={noteTitle}
                        onChange={e => setNoteTitle(e.target.value)}
                        placeholder="Titolo"
                        autoFocus
                        className="w-full px-3 py-1.5 text-sm bg-gray-800/80 border border-gray-700/60 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-colors"
                    />
                    <textarea
                        value={noteContent}
                        onChange={e => setNoteContent(e.target.value)}
                        placeholder="Contenuto della nota…"
                        rows={4}
                        className="w-full px-3 py-1.5 text-sm bg-gray-800/80 border border-gray-700/60 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-colors resize-none custom-scrollbar"
                    />
                    <button
                        onClick={handleAddNote}
                        disabled={!noteTitle.trim() && !noteContent.trim()}
                        className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-600/80 text-white hover:bg-blue-500 shadow-sm shadow-blue-900/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        Aggiungi
                    </button>
                </div>
            )}

            {/* Form PDF */}
            {activeForm === 'pdf' && (
                <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800/60 space-y-2 bg-gray-900/70">
                    {/* Input file nascosto */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfFileChange}
                        className="hidden"
                        id="fonti-pdf-input"
                    />
                    <label
                        htmlFor="fonti-pdf-input"
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-sm text-sky-400/70 border border-sky-500/20 rounded-md hover:bg-sky-500/15 hover:text-sky-300 cursor-pointer transition-colors"
                    >
                        <PaperclipIcon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                            {pdfFile ? pdfFile.name : 'Scegli un file PDF…'}
                        </span>
                    </label>
                    {pdfFile && (
                        <>
                            <input
                                type="text"
                                value={pdfTitle}
                                onChange={e => setPdfTitle(e.target.value)}
                                placeholder="Titolo documento"
                                className="w-full px-3 py-1.5 text-sm bg-gray-800/80 border border-gray-700/60 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500/60 focus:ring-1 focus:ring-sky-500/30 transition-colors"
                            />
                            <button
                                onClick={handleAddPdf}
                                disabled={isUploadingPdf}
                                className="w-full px-3 py-1.5 text-sm font-semibold rounded-lg bg-blue-600/80 text-white hover:bg-blue-500 shadow-sm shadow-blue-900/40 disabled:opacity-50 disabled:cursor-wait transition-colors"
                            >
                                {isUploadingPdf ? 'Salvataggio…' : 'Aggiungi'}
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ---- AREA SCROLLABILE ---- */}
            <div className="flex-1 overflow-y-auto custom-scrollbar px-4 py-3 space-y-4">

                {/* Lista fonti aggiunte */}
                {fonti.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-6">
                        Nessuna fonte aggiunta al blocco.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {fonti.map(fonte => (
                            <div
                                key={fonte.id}
                                className="flex items-start gap-2.5 bg-gray-800/60 rounded-lg border border-gray-700/40 p-3"
                            >
                                {/* Icona tipo */}
                                <div className="mt-0.5">
                                    <SourceTypeIcon type={fonte.type} />
                                </div>

                                {/* Testo */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-200 truncate leading-tight">
                                        {fonte.title || '—'}
                                    </p>
                                    <SourcePreview source={fonte} />
                                </div>

                                {/* Pulsante rimuovi */}
                                <button
                                    onClick={() => onRemoveFonte(fonte.id)}
                                    aria-label="Rimuovi fonte"
                                    className="flex-shrink-0 p-1 rounded-md text-red-400/60 border border-transparent hover:border-red-500/20 hover:bg-red-500/15 hover:text-red-400 transition-colors"
                                >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Sezione "Rilevate dai messaggi" */}
                {urlsNonPromossi.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                        {/* Label sezione stile CollapsibleSectionLabel */}
                        <p className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-400/80 px-0.5">
                            Rilevate dai messaggi
                        </p>

                        <div className="space-y-1.5">
                            {urlsNonPromossi.map(url => (
                                <div
                                    key={url}
                                    className="flex items-center gap-2 bg-gray-800/40 rounded-lg border border-gray-700/30 px-3 py-2"
                                >
                                    <WebIcon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                                    <span
                                        className="flex-1 text-xs text-gray-400 truncate"
                                        title={url}
                                    >
                                        {getDomain(url)}
                                    </span>
                                    <button
                                        onClick={() => onPromote(url)}
                                        className="flex-shrink-0 text-[10px] px-2 py-0.5 text-sky-400/70 border border-sky-500/20 rounded-md hover:bg-sky-500/15 hover:text-sky-300 transition-colors whitespace-nowrap"
                                    >
                                        + Promuovi
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FontiDrawer;
