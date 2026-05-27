import React, { useState, useMemo, useEffect, useRef } from 'react';
import type { Conversation, BlockDetails, WeekPlan, Student, LessonEvaluation, LessonMaterial, LessonNoteAnalysis } from '../types';
import {
    SparklesIcon, TrashIcon, ChevronDownIcon, LinkIcon,
    PlusCircleIcon, XCircleIcon, DocumentTextIcon,
} from './Icons';
import MarkdownRenderer from './MarkdownRenderer';

// ── Util ──────────────────────────────────────────────────────────────────────

const EVAL_TYPE_LABELS: Record<LessonEvaluation['type'], string> = {
    orale: 'Orale', scritto: 'Scritto', pratico: 'Pratico',
    formativo: 'Formativo', altro: 'Altro',
};

const MATERIAL_TYPE_LABELS: Record<LessonMaterial['type'], string> = {
    slide: 'Slide', video: 'Video', pdf: 'PDF', paper: 'Articolo',
    ricerca: 'Ricerca', stampa: 'Stampa', altro: 'Altro',
};

const getInitials = (name: string) => name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

// ── Close confirmation modal ──────────────────────────────────────────────────

const CloseModal: React.FC<{
    isOpen: boolean;
    hasNotes: boolean;
    isAnalyzing: boolean;
    onCancel: () => void;
    onConfirm: (analyzeFirst: boolean) => void;
}> = ({ isOpen, hasNotes, isAnalyzing, onCancel, onConfirm }) => {
    const [analyzeFirst, setAnalyzeFirst] = useState(false);

    useEffect(() => { if (isOpen) setAnalyzeFirst(false); }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 space-y-4">
                <h3 className="text-white font-semibold text-base">Archivia lezione?</h3>
                <p className="text-gray-400 text-sm">
                    La lezione verrà archiviata. Potrai consultarla nel tab Archivio.
                </p>
                {hasNotes && (
                    <label className="flex items-start gap-3 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={analyzeFirst}
                            onChange={e => setAnalyzeFirst(e.target.checked)}
                            className="mt-0.5 h-4 w-4 rounded border-gray-500 text-purple-500 focus:ring-purple-600 bg-gray-700 flex-shrink-0"
                        />
                        <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                            Analizza le note con Ada prima di archiviare
                        </span>
                    </label>
                )}
                <div className="flex justify-end gap-3 pt-1">
                    <button
                        onClick={onCancel}
                        disabled={isAnalyzing}
                        className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={() => onConfirm(analyzeFirst)}
                        disabled={isAnalyzing}
                        className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-lg hover:bg-gray-500 transition-colors border border-gray-500 disabled:opacity-50"
                    >
                        {isAnalyzing ? 'Analisi in corso...' : 'Archivia'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Section wrapper ───────────────────────────────────────────────────────────

const Section: React.FC<{
    title: string;
    collapsible?: boolean;
    defaultOpen?: boolean;
    actions?: React.ReactNode;
    children: React.ReactNode;
}> = ({ title, collapsible, defaultOpen = true, actions, children }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
                {collapsible ? (
                    <button
                        onClick={() => setIsOpen(o => !o)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                        aria-expanded={isOpen}
                    >
                        <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                        {title}
                    </button>
                ) : (
                    <h3 className="text-sm font-medium text-gray-300">{title}</h3>
                )}
                {actions}
            </div>
            {(!collapsible || isOpen) && (
                <div className="px-4 pb-4 border-t border-gray-700/40">
                    {children}
                </div>
            )}
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────

interface LessonInCorsoTabProps {
    conversations: Conversation[];
    students: Student[];
    onSetAttendance: (convoId: string, blockIndex: number, presentIds: string[], lateIds: string[]) => void;
    onAddEvaluation: (convoId: string, blockIndex: number, evaluation: Omit<LessonEvaluation, 'id' | 'date'>) => void;
    onRemoveEvaluation: (convoId: string, blockIndex: number, evaluationId: string) => void;
    onAutoSaveNotes: (convoId: string, blockIndex: number, notes: string) => void;
    onGenerateLessonNoteAnalysis: (convoId: string, blockIndex: number) => Promise<void>;
    analysisLoadingBlockId: string | null;
    onAddMaterial: (convoId: string, blockIndex: number, material: Omit<LessonMaterial, 'id' | 'addedAt'>) => void;
    onChiudiLezione?: (convoId: string, blockIndex: number) => void;
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

type ActiveBlockData = BlockDetails & { convoId: string; blockIndex: number; weekPlan: WeekPlan };

interface EvalFormState {
    studentId: string;
    value: string;
    type: LessonEvaluation['type'];
    notes: string;
}

const LessonInCorsoTab: React.FC<LessonInCorsoTabProps> = ({
    conversations, students,
    onSetAttendance, onAddEvaluation, onRemoveEvaluation,
    onAutoSaveNotes, onGenerateLessonNoteAnalysis, analysisLoadingBlockId,
    onAddMaterial, onChiudiLezione, showToast,
}) => {
    // Derive active block
    const activeBlock = useMemo<ActiveBlockData | null>(() => {
        for (const c of conversations) {
            if (!c.weekPlan) continue;
            const idx = c.weekPlan.blocks.findIndex(b => b.lessonState === 'in_corso');
            if (idx !== -1) {
                return { ...c.weekPlan.blocks[idx], convoId: c.id, blockIndex: idx, weekPlan: c.weekPlan };
            }
        }
        return null;
    }, [conversations]);

    // ── All hooks must be before any conditional return ──────────────────────

    const [localNotes, setLocalNotes] = useState(activeBlock?.lessonNotes ?? '');
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
    const [evalForm, setEvalForm] = useState<EvalFormState | null>(null);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [quickAddMat, setQuickAddMat] = useState<{ title: string; url: string } | null>(null);

    const autosaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pendingNotesRef = useRef<string | null>(null);
    const onAutoSaveNotesRef = useRef(onAutoSaveNotes);
    const activeBlockRef = useRef(activeBlock);

    useEffect(() => { onAutoSaveNotesRef.current = onAutoSaveNotes; }, [onAutoSaveNotes]);
    useEffect(() => { activeBlockRef.current = activeBlock; }, [activeBlock]);

    // Reset notes when active block changes identity
    useEffect(() => {
        setLocalNotes(activeBlock?.lessonNotes ?? '');
    }, [activeBlock?.convoId, activeBlock?.blockIndex]); // eslint-disable-line react-hooks/exhaustive-deps

    // Autosave notes — debounced 1.5s
    useEffect(() => {
        if (!activeBlock) return;
        pendingNotesRef.current = localNotes;
        if (autosaveRef.current) clearTimeout(autosaveRef.current);
        autosaveRef.current = setTimeout(() => {
            const ab = activeBlockRef.current;
            const pending = pendingNotesRef.current;
            if (ab && pending !== null) {
                onAutoSaveNotesRef.current(ab.convoId, ab.blockIndex, pending);
                pendingNotesRef.current = null;
            }
        }, 1500);
    }, [localNotes]); // eslint-disable-line react-hooks/exhaustive-deps

    // Flush on unmount (same pattern as DocumentEditor)
    useEffect(() => {
        return () => {
            if (autosaveRef.current) {
                clearTimeout(autosaveRef.current);
                const ab = activeBlockRef.current;
                const pending = pendingNotesRef.current;
                if (ab && pending !== null) {
                    onAutoSaveNotesRef.current(ab.convoId, ab.blockIndex, pending);
                }
            }
        };
    }, []); // only on unmount

    // ── Guard ────────────────────────────────────────────────────────────────

    if (!activeBlock) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8 py-20 gap-4">
                <DocumentTextIcon className="h-14 w-14 text-gray-700" />
                <p className="text-gray-400 font-semibold">Nessuna lezione in corso</p>
                <p className="text-gray-600 text-sm max-w-xs">
                    Vai al tab <strong className="text-gray-500">Archivio</strong>, scegli un blocco e clicca <strong className="text-gray-500">Avvia Lezione</strong>.
                </p>
            </div>
        );
    }

    // ── Derived data ─────────────────────────────────────────────────────────

    const presentSet = new Set(activeBlock.presentStudentIds ?? []);
    const lateSet = new Set(activeBlock.lateStudentIds ?? []);
    const presentCount = [...presentSet].filter(id => !lateSet.has(id)).length;
    const lateCount = lateSet.size;
    const materials = activeBlock.lessonMaterials ?? [];
    const evaluations = activeBlock.lessonEvaluations ?? [];
    const analysis = activeBlock.lessonNoteAnalysis ?? null;
    const isAnalyzing = analysisLoadingBlockId === `${activeBlock.convoId}-${activeBlock.blockIndex}`;

    const toggleAttendance = (studentId: string, status: 'presente' | 'assente' | 'ritardo') => {
        const newPresent = new Set(presentSet);
        const newLate = new Set(lateSet);
        if (status === 'presente') { newPresent.add(studentId); newLate.delete(studentId); }
        else if (status === 'assente') { newPresent.delete(studentId); newLate.delete(studentId); }
        else { newPresent.add(studentId); newLate.add(studentId); }
        onSetAttendance(activeBlock.convoId, activeBlock.blockIndex, [...newPresent], [...newLate]);
    };

    const getStudentStatus = (studentId: string): 'presente' | 'ritardo' | 'assente' => {
        if (lateSet.has(studentId)) return 'ritardo';
        if (presentSet.has(studentId)) return 'presente';
        return 'assente';
    };

    const handleCloseConfirm = async (analyzeFirst: boolean) => {
        if (analyzeFirst && localNotes.trim()) {
            setIsClosing(true);
            await onGenerateLessonNoteAnalysis(activeBlock.convoId, activeBlock.blockIndex);
            setIsClosing(false);
        }
        setShowCloseModal(false);
        onChiudiLezione?.(activeBlock.convoId, activeBlock.blockIndex);
    };

    const handleAddEval = () => {
        if (!evalForm || !evalForm.value.trim()) { showToast('Inserisci un valore.', 'error'); return; }
        if (!evalForm.studentId) { showToast('Seleziona una studentessa.', 'error'); return; }
        onAddEvaluation(activeBlock.convoId, activeBlock.blockIndex, {
            studentId: evalForm.studentId,
            value: evalForm.value.trim(),
            type: evalForm.type,
            notes: evalForm.notes.trim() || undefined,
        });
        setEvalForm(null);
    };

    const handleQuickAddMaterial = () => {
        if (!quickAddMat?.title.trim() || !quickAddMat?.url.trim()) { showToast('Titolo e URL obbligatori.', 'error'); return; }
        try { new URL(quickAddMat.url); } catch { showToast('URL non valido.', 'error'); return; }
        onAddMaterial(activeBlock.convoId, activeBlock.blockIndex, {
            title: quickAddMat.title.trim(),
            url: quickAddMat.url.trim(),
            type: 'altro',
            targetAudience: 'classe',
        });
        setQuickAddMat(null);
        showToast('Materiale aggiunto!', 'success');
    };

    const studentNameById = (id: string) => students.find(s => s.id === id)?.name ?? id;

    // ── Render ───────────────────────────────────────────────────────────────

    return (
        <>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-3xl mx-auto p-6 space-y-4">

                    {/* Banner */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-emerald-900/20 border border-emerald-700/40">
                        <div>
                            <p className="text-[11px] text-emerald-500 font-mono uppercase tracking-wider mb-1">
                                Settimana {activeBlock.weekPlan.weekNumber} · {activeBlock.weekPlan.dates}
                            </p>
                            <p className="text-white font-semibold">
                                {activeBlock.lessonTitle || activeBlock.objective || `Blocco ${activeBlock.blockIndex + 1}`}
                            </p>
                            {activeBlock.tipologia && (
                                <p className="text-xs text-gray-400 mt-0.5">{activeBlock.tipologia.replace(/_/g, ' ')}</p>
                            )}
                        </div>
                        <button
                            onClick={() => setShowCloseModal(true)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-gray-200 text-sm font-medium transition-colors border border-gray-600 hover:bg-gray-700/60 hover:border-gray-500"
                        >
                            Chiudi Lezione
                        </button>
                    </div>

                    {/* Presenze */}
                    <Section
                        title={`Presenze — ${presentCount + lateCount}/${students.length} presenti${lateCount > 0 ? ` · ${lateCount} in ritardo` : ''}`}
                    >
                        {students.length === 0 ? (
                            <p className="mt-3 text-sm text-gray-600 italic">Nessuna studentessa nel registro.</p>
                        ) : (
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {students.map(student => {
                                    const status = getStudentStatus(student.id);
                                    return (
                                        <div key={student.id} className="flex items-center gap-2 py-1.5">
                                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${
                                                status === 'presente' ? 'bg-emerald-700/50 text-emerald-300' :
                                                status === 'ritardo' ? 'bg-amber-700/50 text-amber-300' :
                                                'bg-gray-700/50 text-gray-500'
                                            }`}>
                                                {getInitials(student.name)}
                                            </div>
                                            <span className="text-sm text-gray-300 flex-1 truncate">{student.name}</span>
                                            <div className="flex gap-0.5">
                                                {(['presente', 'ritardo', 'assente'] as const).map(s => (
                                                    <button
                                                        key={s}
                                                        onClick={() => toggleAttendance(student.id, s)}
                                                        className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                                                            status === s
                                                                ? s === 'presente' ? 'bg-emerald-700/60 text-emerald-300 border border-emerald-600/40'
                                                                : s === 'ritardo' ? 'bg-amber-700/60 text-amber-300 border border-amber-600/40'
                                                                : 'bg-gray-600/60 text-gray-300 border border-gray-500/40'
                                                                : 'text-gray-600 hover:text-gray-400 hover:bg-gray-700/40'
                                                        }`}
                                                    >
                                                        {s === 'presente' ? 'P' : s === 'ritardo' ? 'R' : 'A'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Section>

                    {/* Materiali attivi */}
                    <Section
                        title="Materiali attivi"
                        collapsible
                        defaultOpen={materials.length > 0}
                        actions={
                            <button
                                onClick={() => setQuickAddMat({ title: '', url: '' })}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors"
                                title="Aggiungi link rapido"
                            >
                                <PlusCircleIcon className="h-3.5 w-3.5" />
                                <span>Aggiungi</span>
                            </button>
                        }
                    >
                        {quickAddMat !== null && (
                            <div className="mt-3 flex gap-2 items-end">
                                <input
                                    type="text" placeholder="Titolo"
                                    value={quickAddMat.title}
                                    onChange={e => setQuickAddMat(q => q && ({ ...q, title: e.target.value }))}
                                    className="flex-1 p-2 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500"
                                />
                                <input
                                    type="url" placeholder="https://..."
                                    value={quickAddMat.url}
                                    onChange={e => setQuickAddMat(q => q && ({ ...q, url: e.target.value }))}
                                    className="flex-1 p-2 text-sm bg-gray-900 border border-gray-600 rounded-md focus:ring-1 focus:ring-blue-500"
                                />
                                <button onClick={handleQuickAddMaterial} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">OK</button>
                                <button onClick={() => setQuickAddMat(null)} className="p-2 text-gray-500 hover:text-gray-300"><XCircleIcon className="h-4 w-4" /></button>
                            </div>
                        )}
                        {materials.length === 0 && !quickAddMat ? (
                            <p className="mt-3 text-sm text-gray-600 italic">Nessun materiale preparato. Aggiungili dal tab Preparazione.</p>
                        ) : (
                            <div className="mt-3 space-y-1.5">
                                {materials.map(mat => (
                                    <a
                                        key={mat.id}
                                        href={mat.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-700/40 hover:border-blue-500/30 hover:bg-blue-900/10 transition-colors group"
                                    >
                                        <span className="text-[10px] font-mono uppercase tracking-wide text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded flex-shrink-0">
                                            {MATERIAL_TYPE_LABELS[mat.type]}
                                        </span>
                                        <span className="text-sm text-gray-300 group-hover:text-white flex-1 truncate">{mat.title}</span>
                                        <LinkIcon className="h-3.5 w-3.5 text-gray-600 group-hover:text-blue-400 flex-shrink-0" />
                                    </a>
                                ))}
                            </div>
                        )}
                    </Section>

                    {/* Valutazioni */}
                    <Section
                        title="Valutazioni"
                        collapsible
                        defaultOpen={evaluations.length > 0}
                        actions={
                            <button
                                onClick={() => setEvalForm(evalForm ? null : {
                                    studentId: students[0]?.id ?? '',
                                    value: '',
                                    type: 'orale',
                                    notes: '',
                                })}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-blue-400 transition-colors"
                            >
                                <PlusCircleIcon className="h-3.5 w-3.5" />
                                <span>Aggiungi</span>
                            </button>
                        }
                    >
                        {evalForm && (
                            <div className="mt-3 p-3 bg-gray-900/60 rounded-lg border border-gray-700/40 space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">Studentessa</label>
                                        <select
                                            value={evalForm.studentId}
                                            onChange={e => setEvalForm(f => f && ({ ...f, studentId: e.target.value }))}
                                            className="w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-gray-200"
                                        >
                                            {students.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">Tipo</label>
                                        <select
                                            value={evalForm.type}
                                            onChange={e => setEvalForm(f => f && ({ ...f, type: e.target.value as LessonEvaluation['type'] }))}
                                            className="w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded-md text-gray-200"
                                        >
                                            {Object.entries(EVAL_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">Voto / osservazione</label>
                                        <input
                                            type="text"
                                            value={evalForm.value}
                                            onChange={e => setEvalForm(f => f && ({ ...f, value: e.target.value }))}
                                            className="w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded-md"
                                            placeholder="Es: 7 oppure ottimo"
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-mono text-gray-500 uppercase mb-1">Note (opzionale)</label>
                                        <input
                                            type="text"
                                            value={evalForm.notes}
                                            onChange={e => setEvalForm(f => f && ({ ...f, notes: e.target.value }))}
                                            className="w-full p-2 text-sm bg-gray-800 border border-gray-600 rounded-md"
                                            placeholder="Breve commento..."
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button onClick={() => setEvalForm(null)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200">Annulla</button>
                                    <button onClick={handleAddEval} className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Salva</button>
                                </div>
                            </div>
                        )}
                        {evaluations.length === 0 && !evalForm ? (
                            <p className="mt-3 text-sm text-gray-600 italic">Nessuna valutazione inserita per questa lezione.</p>
                        ) : (
                            <div className="mt-3 space-y-1.5">
                                {evaluations.map(ev => (
                                    <div key={ev.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-700/40">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-sm font-medium text-gray-200">{studentNameById(ev.studentId)}</span>
                                            <span className="text-[10px] font-mono text-gray-500 uppercase ml-2">{EVAL_TYPE_LABELS[ev.type]}</span>
                                            <span className="text-sm text-white ml-2 font-semibold">{ev.value}</span>
                                            {ev.notes && <span className="text-xs text-gray-500 ml-2 italic truncate">· {ev.notes}</span>}
                                        </div>
                                        <button
                                            onClick={() => onRemoveEvaluation(activeBlock.convoId, activeBlock.blockIndex, ev.id)}
                                            className="p-1 text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                                        >
                                            <TrashIcon className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </Section>

                    {/* Note libere */}
                    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3">
                            <h3 className="text-sm font-medium text-gray-300">Note libere</h3>
                            <button
                                onClick={() => onGenerateLessonNoteAnalysis(activeBlock.convoId, activeBlock.blockIndex)}
                                disabled={isAnalyzing || !localNotes.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                <SparklesIcon className="h-3.5 w-3.5" />
                                {isAnalyzing ? 'Analisi...' : 'Analizza con Ada'}
                            </button>
                        </div>
                        <div className="px-4 pb-4 border-t border-gray-700/40 space-y-3">
                            <textarea
                                value={localNotes}
                                onChange={e => setLocalNotes(e.target.value)}
                                rows={6}
                                className="w-full mt-3 p-3 bg-gray-900/60 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-600 resize-y font-serif focus:ring-1 focus:ring-gray-500 focus:border-gray-500"
                                placeholder="Osservazioni, imprevisti, reazioni della classe... (salvataggio automatico)"
                            />

                            {analysis && (
                                <div className="rounded-lg border border-gray-700/40 overflow-hidden">
                                    <button
                                        onClick={() => setIsAnalysisOpen(o => !o)}
                                        className="w-full flex items-center justify-between px-3 py-2 text-left bg-gray-900/40 hover:bg-gray-900/60 transition-colors"
                                        aria-expanded={isAnalysisOpen}
                                    >
                                        <span className="flex items-center gap-2 text-xs font-medium text-purple-400">
                                            <SparklesIcon className="h-3.5 w-3.5" />
                                            Analisi Ada
                                            <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                                                analysis.engagementLevel === 'alto' ? 'text-emerald-400 border-emerald-700/40 bg-emerald-900/20' :
                                                analysis.engagementLevel === 'medio' ? 'text-amber-400 border-amber-700/40 bg-amber-900/20' :
                                                'text-gray-500 border-gray-700/40 bg-gray-900/40'
                                            }`}>
                                                {analysis.engagementLevel}
                                            </span>
                                        </span>
                                        <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-500 transition-transform ${isAnalysisOpen ? 'rotate-180' : ''}`} />
                                    </button>
                                    {isAnalysisOpen && (
                                        <div className="px-3 pb-3 pt-2 space-y-3 border-t border-gray-700/40">
                                            {analysis.classNotes.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wide mb-1.5">Classe</p>
                                                    <ul className="space-y-1">
                                                        {analysis.classNotes.map((n, i) => (
                                                            <li key={i} className="text-sm text-gray-300 flex gap-2">
                                                                <span className="text-gray-600 flex-shrink-0">·</span>{n}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {analysis.studentSignals.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wide mb-1.5">Segnali individuali</p>
                                                    <ul className="space-y-1">
                                                        {analysis.studentSignals.map((sig, i) => (
                                                            <li key={i} className="text-sm flex items-start gap-2">
                                                                <span className={`text-[10px] font-mono uppercase mt-0.5 flex-shrink-0 ${sig.type === 'positivo' ? 'text-emerald-500' : 'text-amber-500'}`}>
                                                                    {sig.type === 'positivo' ? '▲' : '▼'}
                                                                </span>
                                                                <span className="text-gray-300">
                                                                    <strong className="text-gray-200">{studentNameById(sig.studentId)}</strong> — {sig.signal}
                                                                </span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                            {analysis.groupNotes.length > 0 && (
                                                <div>
                                                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-wide mb-1.5">Gruppi</p>
                                                    <ul className="space-y-1">
                                                        {analysis.groupNotes.map((gn, i) => (
                                                            <li key={i} className="text-sm text-gray-300 flex gap-2">
                                                                <span className="text-gray-600 flex-shrink-0">·</span>{gn.note}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <CloseModal
                isOpen={showCloseModal}
                hasNotes={localNotes.trim().length > 0}
                isAnalyzing={isClosing}
                onCancel={() => setShowCloseModal(false)}
                onConfirm={handleCloseConfirm}
            />
        </>
    );
};

export default LessonInCorsoTab;
