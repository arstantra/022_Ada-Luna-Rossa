import React, { useState, useMemo } from 'react';
import type { Conversation, BlockDetails, WeekPlan, Student, LessonMaterial, GroupDefinition } from '../types';
import { SparklesIcon, PlusCircleIcon, TrashIcon, ChevronDownIcon, LinkIcon, DocumentTextIcon, XIcon, UsersIcon } from './Icons';
import * as GeminiService from '../services/gemini';
import MarkdownRenderer from './MarkdownRenderer';
import Modal from './Modal';
import type { useMasterContext } from '../hooks/useMasterContext';

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

const CRITERIA_OPTIONS = [
    { id: 'Livello competenza', label: 'Livello competenza' },
    { id: 'Stile apprendimento', label: 'Stile apprendimento' },
    { id: 'Dinamiche relazionali', label: 'Dinamiche relazionali' },
    { id: 'Mix casuale', label: 'Mix casuale' },
];

interface LessonPreparationTabProps {
    conversations: Conversation[];
    students: Student[];
    onAddMaterial: (convoId: string, blockIndex: number, material: Omit<LessonMaterial, 'id' | 'addedAt'>) => void;
    onRemoveMaterial: (convoId: string, blockIndex: number, materialId: string) => void;
    onSaveGroups: (convoId: string, blockIndex: number, groups: GroupDefinition[]) => void;
    onSaveClassroomUrl: (convoId: string, blockIndex: number, url: string) => void;
    masterContext: ReturnType<typeof useMasterContext>;
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

const LessonPreparationTab: React.FC<LessonPreparationTabProps> = ({
    conversations, students, onAddMaterial, onRemoveMaterial, onSaveGroups, onSaveClassroomUrl, masterContext, showToast,
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

    // ── Gruppi state ──────────────────────────────────────────────────────────
    const [isGroupsOpen, setIsGroupsOpen] = useState(false);
    const [groupSize, setGroupSize] = useState(3);
    const [selectedCriteria, setSelectedCriteria] = useState<string[]>(['Livello competenza']);
    const [proposedGroups, setProposedGroups] = useState<GroupDefinition[]>([]);
    const [isLoadingGroupSuggestion, setIsLoadingGroupSuggestion] = useState(false);

    // ── Classroom URL state ───────────────────────────────────────────────────
    const [classroomDraft, setClassroomDraft] = useState('');

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

    // Sync classroomDraft when selected block changes
    const currentClassroomUrl = selectedOption?.block.classroomUrl ?? '';
    React.useEffect(() => {
        setClassroomDraft(currentClassroomUrl);
    }, [selectedOption?.key, currentClassroomUrl]);

    const getStudentNameById = (id: string) => students.find(s => s.id === id)?.name ?? 'Sconosciuto';

    const toggleCriteria = (criterionId: string) => {
        setSelectedCriteria(prev =>
            prev.includes(criterionId)
                ? prev.filter(c => c !== criterionId)
                : [...prev, criterionId]
        );
        setProposedGroups([]);
    };

    const handleGenerateGroups = async () => {
        if (!selectedOption) return;
        if (selectedCriteria.length === 0) {
            showToast('Seleziona almeno un criterio.', 'error');
            return;
        }
        if (selectedCriteria.length === 1 && selectedCriteria[0] === 'Mix casuale') {
            const shuffled = [...students].sort(() => Math.random() - 0.5);
            const groups: GroupDefinition[] = [];
            let i = 0; let groupNum = 1;
            while (i < shuffled.length) {
                groups.push({ name: `Gruppo ${groupNum}`, studentIds: shuffled.slice(i, i + groupSize).map(s => s.id), justification: 'Composizione casuale.' });
                i += groupSize; groupNum++;
            }
            setProposedGroups(groups);
            return;
        }
        setIsLoadingGroupSuggestion(true);
        try {
            const groups = await GeminiService.generateGroupSuggestionWithCriteria(students, selectedCriteria, groupSize);
            setProposedGroups(groups);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Errore durante la generazione dei gruppi.', 'error');
        } finally {
            setIsLoadingGroupSuggestion(false);
        }
    };

    const handleSaveGroups = () => {
        if (!selectedOption || proposedGroups.length === 0) return;
        onSaveGroups(selectedOption.convoId, selectedOption.blockIndex, proposedGroups);
        showToast('Gruppi salvati!', 'success');
        setProposedGroups([]);
        setIsGroupsOpen(false);
    };

    const handleRemoveStudentFromGroup = (groupIndex: number, studentId: string) => {
        setProposedGroups(prev => {
            const next = [...prev];
            next[groupIndex] = { ...next[groupIndex], studentIds: next[groupIndex].studentIds.filter(id => id !== studentId) };
            return next;
        });
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

                            {/* Classroom URL */}
                            <div>
                                <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">
                                    Link Classroom
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="url"
                                        value={classroomDraft}
                                        onChange={e => setClassroomDraft(e.target.value)}
                                        onBlur={() => {
                                            if (!selectedOption) return;
                                            const trimmed = classroomDraft.trim();
                                            if (trimmed !== (selectedOption.block.classroomUrl ?? '')) {
                                                onSaveClassroomUrl(selectedOption.convoId, selectedOption.blockIndex, trimmed);
                                            }
                                        }}
                                        placeholder="https://classroom.google.com/..."
                                        className="flex-1 p-2 bg-gray-800 border border-gray-700/60 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
                                    />
                                    {classroomDraft && (
                                        <a
                                            href={classroomDraft}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-sky-400 border border-sky-500/25 rounded-lg hover:bg-sky-500/10 hover:border-sky-400/40 transition-colors whitespace-nowrap"
                                        >
                                            <LinkIcon className="h-3.5 w-3.5" />
                                            Apri
                                        </a>
                                    )}
                                </div>
                            </div>

                            {/* Crea Gruppi con Ada */}
                            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
                                <button
                                    onClick={() => setIsGroupsOpen(o => !o)}
                                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                                    aria-expanded={isGroupsOpen}
                                >
                                    <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <UsersIcon className="h-4 w-4 text-indigo-400" />
                                        Crea Gruppi con Ada
                                    </span>
                                    <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isGroupsOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {isGroupsOpen && (
                                    <div className="px-4 pb-4 border-t border-gray-700/40 space-y-4 pt-3">
                                        {students.length === 0 ? (
                                            <p className="text-sm text-gray-600">Nessuno studente nel registro. Aggiungili prima in "L'Equipaggio".</p>
                                        ) : (
                                            <>
                                                {/* Group size */}
                                                <div>
                                                    <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-1.5">Persone per gruppo</label>
                                                    <div className="flex gap-2">
                                                        {[2, 3, 4, 5].map(n => (
                                                            <button key={n} onClick={() => { setGroupSize(n); setProposedGroups([]); }}
                                                                className={`w-10 h-10 rounded-lg text-sm font-semibold border transition-colors ${groupSize === n ? 'bg-purple-600/80 border-purple-500 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white'}`}>
                                                                {n}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                {/* Criteria chips */}
                                                <div>
                                                    <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-1.5">Criteri di bilanciamento</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {CRITERIA_OPTIONS.map(c => (
                                                            <button key={c.id} onClick={() => toggleCriteria(c.id)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedCriteria.includes(c.id) ? 'bg-indigo-600/60 border-indigo-500/60 text-indigo-200' : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white'}`}>
                                                                {selectedCriteria.includes(c.id) ? '✓ ' : ''}{c.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                                {/* Generate button */}
                                                <button onClick={handleGenerateGroups}
                                                    disabled={isLoadingGroupSuggestion || selectedCriteria.length === 0}
                                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                                    {isLoadingGroupSuggestion
                                                        ? <><span className="h-3.5 w-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generazione...</>
                                                        : <><SparklesIcon className="h-3.5 w-3.5" />{selectedCriteria.length === 1 && selectedCriteria[0] === 'Mix casuale' ? 'Genera Casuale' : 'Suggerisci con Ada'}</>
                                                    }
                                                </button>
                                                {/* Proposed groups */}
                                                {proposedGroups.length > 0 && (
                                                    <div className="space-y-3">
                                                        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Proposta Ada</p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {proposedGroups.map((group, gi) => (
                                                                <div key={gi} className="bg-gray-900/60 rounded-lg border border-gray-700/50 p-3">
                                                                    <p className="text-xs font-semibold text-white mb-1">{group.name}</p>
                                                                    {group.justification && <p className="text-[11px] text-gray-500 mb-2 italic">{group.justification}</p>}
                                                                    <ul className="space-y-0.5">
                                                                        {group.studentIds.map(sid => (
                                                                            <li key={sid} className="flex items-center justify-between text-xs text-gray-300">
                                                                                <span>{getStudentNameById(sid)}</span>
                                                                                <button onClick={() => handleRemoveStudentFromGroup(gi, sid)} className="text-gray-600 hover:text-red-400 ml-2"><XIcon className="h-3 w-3" /></button>
                                                                            </li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <button onClick={handleSaveGroups}
                                                            className="px-4 py-2 rounded-lg bg-blue-600/80 text-white text-xs font-semibold hover:bg-blue-500 shadow-sm shadow-blue-900/40 transition-colors">
                                                            Salva composizione
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
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
