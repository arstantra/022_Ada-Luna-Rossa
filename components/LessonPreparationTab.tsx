import React, { useState, useMemo } from 'react';
import type { Conversation, BlockDetails, WeekPlan, Student, LessonMaterial } from '../types';
import { SparklesIcon, PlusCircleIcon, TrashIcon, ChevronDownIcon, LinkIcon, DocumentTextIcon } from './Icons';
import * as GeminiService from '../services/gemini';
import MarkdownRenderer from './MarkdownRenderer';
import Modal from './Modal';

// ── AddMaterialModal ──────────────────────────────────────────────────────────

const MATERIAL_TYPE_OPTIONS: { value: LessonMaterial['type']; label: string }[] = [
    { value: 'slide', label: 'Slide' },
    { value: 'video', label: 'Video' },
    { value: 'pdf', label: 'PDF' },
    { value: 'paper', label: 'Articolo' },
    { value: 'ricerca', label: 'Ricerca' },
    { value: 'stampa', label: 'Stampa' },
    { value: 'altro', label: 'Altro' },
];

const MATERIAL_TYPE_LABELS: Record<LessonMaterial['type'], string> = {
    slide: 'Slide', video: 'Video', pdf: 'PDF', paper: 'Articolo',
    ricerca: 'Ricerca', stampa: 'Stampa', altro: 'Altro',
};

const AddMaterialModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (material: Omit<LessonMaterial, 'id' | 'addedAt'>) => void;
}> = ({ isOpen, onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [type, setType] = useState<LessonMaterial['type']>('slide');
    const [targetAudience, setTargetAudience] = useState<LessonMaterial['targetAudience']>('classe');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (isOpen) { setTitle(''); setUrl(''); setType('slide'); setTargetAudience('classe'); setNotes(''); setError(''); }
    }, [isOpen]);

    const handleSave = () => {
        if (!title.trim()) { setError('Il titolo è obbligatorio.'); return; }
        if (!url.trim()) { setError("L'URL è obbligatorio."); return; }
        try { new URL(url); } catch { setError('URL non valido. Inserisci un link completo (es. https://...).'); return; }
        onSave({ title: title.trim(), url: url.trim(), type, targetAudience, notes: notes.trim() || undefined });
        onClose();
    };

    const footer = (
        <>
            <div />
            <div className="space-x-3">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Aggiungi</button>
            </div>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Aggiungi Materiale" footer={footer}>
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Titolo *</label>
                    <input
                        type="text" value={title} onChange={e => setTitle(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Es: Slide introduttive al Modulo 2"
                        autoFocus
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">URL *</label>
                    <input
                        type="url" value={url} onChange={e => setUrl(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="https://..."
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Tipo</label>
                        <select
                            value={type} onChange={e => setType(e.target.value as LessonMaterial['type'])}
                            className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-sm text-gray-200"
                        >
                            {MATERIAL_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Destinatari</label>
                        <select
                            value={targetAudience} onChange={e => setTargetAudience(e.target.value as LessonMaterial['targetAudience'])}
                            className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md text-sm text-gray-200"
                        >
                            <option value="classe">Tutta la classe</option>
                            <option value="gruppo">Gruppo specifico</option>
                            <option value="studente">Studente specifico</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">
                        Note <span className="text-gray-500">(opzionale)</span>
                    </label>
                    <input
                        type="text" value={notes} onChange={e => setNotes(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Es: Da stampare in anticipo"
                    />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
        </Modal>
    );
};

// ── Block option type ─────────────────────────────────────────────────────────

interface BlockOption {
    key: string;
    convoId: string;
    blockIndex: number;
    weekNumber: number;
    label: string;
    block: BlockDetails;
    weekPlan: WeekPlan;
}

// ── LessonPreparationTab ──────────────────────────────────────────────────────

interface LessonPreparationTabProps {
    conversations: Conversation[];
    students: Student[];
    onAddMaterial: (convoId: string, blockIndex: number, material: Omit<LessonMaterial, 'id' | 'addedAt'>) => void;
    onRemoveMaterial: (convoId: string, blockIndex: number, materialId: string) => void;
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

const LessonPreparationTab: React.FC<LessonPreparationTabProps> = ({
    conversations, onAddMaterial, onRemoveMaterial, showToast,
}) => {
    const blockOptions = useMemo<BlockOption[]>(() => {
        return conversations
            .filter(c => c.weekPlan)
            .flatMap(c =>
                c.weekPlan!.blocks
                    .map((block, index) => ({ block, index, weekPlan: c.weekPlan!, convoId: c.id }))
                    .filter(({ block }) =>
                        block.lessonState !== 'archiviata' &&
                        block.status !== 'saltato' &&
                        block.status !== 'annullato'
                    )
                    .map(({ block, index, weekPlan, convoId }) => ({
                        key: `${convoId}-${index}`,
                        convoId,
                        blockIndex: index,
                        weekNumber: weekPlan.weekNumber,
                        label: `Sett. ${weekPlan.weekNumber} · BL${index + 1}${block.day ? ` · ${block.day}` : ''} — ${block.lessonTitle || block.objective || 'Blocco senza titolo'}`,
                        block,
                        weekPlan,
                    }))
            )
            .sort((a, b) => a.weekNumber !== b.weekNumber ? a.weekNumber - b.weekNumber : a.blockIndex - b.blockIndex);
    }, [conversations]);

    const [selectedKey, setSelectedKey] = useState<string>(() => {
        // Default to active lesson block if present
        return conversations
            .filter(c => c.weekPlan)
            .flatMap(c => c.weekPlan!.blocks.map((b, i) => ({ key: `${c.id}-${i}`, b })))
            .find(({ b }) => b.lessonState === 'in_corso')?.key ?? '';
    });

    const [isMasterOpen, setIsMasterOpen] = useState(false);
    const [isAdaOpen, setIsAdaOpen] = useState(false);
    const [addMaterialOpen, setAddMaterialOpen] = useState(false);
    const [adaQuestion, setAdaQuestion] = useState('');
    const [adaResponse, setAdaResponse] = useState<string | null>(null);
    const [isAdaLoading, setIsAdaLoading] = useState(false);

    const selectedOption = useMemo(
        () => blockOptions.find(o => o.key === selectedKey) ?? blockOptions[0] ?? null,
        [blockOptions, selectedKey]
    );

    const handleAskAda = async () => {
        if (!adaQuestion.trim()) return;
        setIsAdaLoading(true);
        setAdaResponse(null);
        try {
            const masterSnippet = selectedOption?.block.contentBlocks
                ?.map(cb => cb.content).join('\n').slice(0, 800);
            const result = await GeminiService.generateToolSuggestion(adaQuestion, masterSnippet);
            setAdaResponse(result);
        } catch {
            showToast('Errore nella risposta di Ada.', 'error');
        } finally {
            setIsAdaLoading(false);
        }
    };

    if (blockOptions.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-20 gap-4">
                <DocumentTextIcon className="h-14 w-14 text-gray-700" />
                <p className="text-gray-400 font-semibold">Nessun blocco da preparare</p>
                <p className="text-gray-600 text-sm max-w-xs">
                    Vai a <strong className="text-gray-500">Progettazione del Corso</strong> per pianificare le settimane e abilitare i blocchi.
                </p>
            </div>
        );
    }

    const block = selectedOption?.block;
    const hasMasterContent = (block?.contentBlocks?.length ?? 0) > 0;
    const materials = block?.lessonMaterials ?? [];

    return (
        <>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto p-6 space-y-6">

                    {/* Block selector */}
                    <div>
                        <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">
                            Blocco da preparare
                        </label>
                        <select
                            value={selectedOption?.key ?? ''}
                            onChange={e => setSelectedKey(e.target.value)}
                            className="w-full p-2.5 bg-gray-800 border border-gray-700/60 rounded-lg text-sm text-gray-200 focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50"
                        >
                            {blockOptions.map(o => (
                                <option key={o.key} value={o.key}>{o.label}</option>
                            ))}
                        </select>
                    </div>

                    {selectedOption && (
                        <>
                            {/* Master Content collapsible */}
                            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
                                <button
                                    onClick={() => setIsMasterOpen(o => !o)}
                                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                                    aria-expanded={isMasterOpen}
                                >
                                    <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <DocumentTextIcon className="h-4 w-4 text-gray-500" />
                                        Contenuto Master
                                    </span>
                                    <span className="flex items-center gap-2">
                                        {!hasMasterContent && (
                                            <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wide">vuoto</span>
                                        )}
                                        <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isMasterOpen ? 'rotate-180' : ''}`} />
                                    </span>
                                </button>
                                {isMasterOpen && (
                                    <div className="px-4 pb-4 border-t border-gray-700/40">
                                        {hasMasterContent ? (
                                            <div className="mt-3 space-y-3">
                                                {block!.contentBlocks!.map((cb, i) => (
                                                    <div key={i} className="bg-gray-900/50 rounded-lg p-3 text-sm text-gray-300 max-h-48 overflow-y-auto custom-scrollbar">
                                                        <MarkdownRenderer content={cb.content} />
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="mt-3 text-sm text-gray-600 italic">
                                                Nessun contenuto master trasferito. Vai al Laboratorio per preparare e trasferire il contenuto del blocco.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Materials */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-medium text-gray-300">Materiali di Lezione</h3>
                                    <button
                                        onClick={() => setAddMaterialOpen(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-400 border border-blue-500/25 rounded-lg hover:bg-blue-500/10 hover:border-blue-400/40 transition-colors"
                                    >
                                        <PlusCircleIcon className="h-3.5 w-3.5" />
                                        Aggiungi
                                    </button>
                                </div>

                                {materials.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-gray-700/50 p-6 text-center">
                                        <p className="text-sm text-gray-600">Nessun materiale aggiunto.</p>
                                        <p className="text-xs text-gray-700 mt-1">Aggiungi slide, video, PDF o altri link utili per questa lezione.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {materials.map(mat => (
                                            <div
                                                key={mat.id}
                                                className="flex items-start gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700/40 hover:border-gray-600/50 transition-colors"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="text-[10px] font-mono uppercase tracking-wide text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded">
                                                            {MATERIAL_TYPE_LABELS[mat.type]}
                                                        </span>
                                                        {mat.targetAudience !== 'classe' && (
                                                            <span className="text-[10px] font-mono uppercase tracking-wide text-sky-500 bg-sky-900/30 px-1.5 py-0.5 rounded">
                                                                {mat.targetAudience === 'gruppo' ? 'Gruppo' : 'Studente'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-medium text-gray-200 truncate">{mat.title}</p>
                                                    {mat.notes && (
                                                        <p className="text-xs text-gray-500 mt-0.5 truncate">{mat.notes}</p>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1 flex-shrink-0">
                                                    <a
                                                        href={mat.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-1.5 rounded-md text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                                                        title="Apri link"
                                                    >
                                                        <LinkIcon className="h-4 w-4" />
                                                    </a>
                                                    <button
                                                        onClick={() => onRemoveMaterial(selectedOption.convoId, selectedOption.blockIndex, mat.id)}
                                                        className="p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                        title="Rimuovi materiale"
                                                    >
                                                        <TrashIcon className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Ada consiglia tool */}
                            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
                                <button
                                    onClick={() => setIsAdaOpen(o => !o)}
                                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                                    aria-expanded={isAdaOpen}
                                >
                                    <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <SparklesIcon className="h-4 w-4 text-purple-400" />
                                        Ada consiglia tool
                                    </span>
                                    <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isAdaOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isAdaOpen && (
                                    <div className="px-4 pb-4 border-t border-gray-700/40 space-y-3">
                                        <p className="mt-3 text-xs text-gray-500">
                                            Descrivi cosa vuoi fare in questa lezione e Ada ti suggerirà gli strumenti più adatti.
                                        </p>
                                        <textarea
                                            value={adaQuestion}
                                            onChange={e => setAdaQuestion(e.target.value)}
                                            rows={3}
                                            className="w-full p-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 resize-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50"
                                            placeholder="Es: Voglio fare un brainstorming collaborativo sulle idee chiave del modulo..."
                                        />
                                        <button
                                            onClick={handleAskAda}
                                            disabled={isAdaLoading || !adaQuestion.trim()}
                                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <SparklesIcon className="h-3.5 w-3.5" />
                                            {isAdaLoading ? 'Ada sta pensando...' : 'Chiedi ad Ada'}
                                        </button>
                                        {adaResponse && (
                                            <div className="mt-2 bg-gray-900/60 rounded-lg p-3 border border-purple-800/30 text-sm text-gray-300">
                                                <MarkdownRenderer content={adaResponse} />
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            <AddMaterialModal
                isOpen={addMaterialOpen}
                onClose={() => setAddMaterialOpen(false)}
                onSave={material => {
                    if (!selectedOption) return;
                    onAddMaterial(selectedOption.convoId, selectedOption.blockIndex, material);
                    showToast('Materiale aggiunto!', 'success');
                }}
            />
        </>
    );
};

export default LessonPreparationTab;
