/**
 * LessonPreparationTab — Scrivania di preparazione lezione
 * Riscritta da zero (2026-06-04) — architettura a 5 sezioni:
 *   1. Selezione blocco (fix bug: deriva da availableWeeks, non da conversations filtrate)
 *   2. Scrivania Fonti (master + link + youtube + note + sinergia NotebookLM)
 *   3. Distribuzione Ada (suggerimento output contestuale + generazione)
 *   4. Gruppi (min 1 — anche singolo studente)
 *   5. Abbinamento gruppi → output (con adattamenti BES/DSA/PEI)
 */

import React, { useState, useMemo, useCallback, useRef } from 'react';
import type {
    Conversation, Student, GroupDefinition, LessonMaterial,
    PreparationSource, PrepSourceType, Notebook,
} from '../types';
import type { WeekRouteInfo } from '../types';
import type { useMasterContext } from '../hooks/useMasterContext';
import * as GeminiService from '../services/gemini';
import { LESSON_TYPE_LABELS, TEACHING_METHODOLOGY_LABELS } from '../constants';
import { getExactDateForBlock } from '../utils';
import {
    SparklesIcon, PlusCircleIcon, TrashIcon, ChevronDownIcon,
    LinkIcon, DocumentTextIcon, XIcon, UsersIcon, BookOpenIcon,
} from './Icons';
import MarkdownRenderer from './MarkdownRenderer';
import Modal from './Modal';

// ── Icone inline (YouTube, Note) ──────────────────────────────────────────────

const YouTubeIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.8 8s-.2-1.4-.8-2c-.8-.8-1.6-.8-2-.9C16.4 5 12 5 12 5s-4.4 0-7 .1c-.4.1-1.2.1-2 .9-.6.6-.8 2-.8 2S2 9.6 2 11.2v1.5c0 1.6.2 3.2.2 3.2s.2 1.4.8 2c.8.8 1.8.8 2.2.8C6.8 19 12 19 12 19s4.4 0 7-.1c.4-.1 1.2-.1 2-.9.6-.6.8-2 .8-2s.2-1.6.2-3.2v-1.5C22 9.6 21.8 8 21.8 8zM9.7 14.5V9.4l5.4 2.6-5.4 2.5z" />
    </svg>
);

const NoteIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
);

// ── Tipi locali ───────────────────────────────────────────────────────────────

interface BlockOption {
    key: string;
    convoId: string | null; // null = blocco non ancora inizializzato
    blockIndex: number;
    weekNumber: number;
    weekDates: string;
    label: string;
    block: import('../types').BlockDetails | null;
    isStub: boolean; // blocco dalla rotta ma senza weekPlan ancora
}

interface DistributionSuggestion {
    outputType: string;
    description: string;
    workflow: string[];
    toolSuggestion: string;
}

interface GeneratedOutput {
    groupId: string; // 'all' per output per tutta la classe
    outputType: string;
    content: string;
    isAdapted?: boolean;
    adaptationType?: 'BES' | 'DSA' | 'PEI';
}

// ── Costanti ──────────────────────────────────────────────────────────────────

const CRITERIA_OPTIONS = [
    { id: 'Livello competenza', label: 'Livello competenza' },
    { id: 'Stile apprendimento', label: 'Stile apprendimento' },
    { id: 'Dinamiche relazionali', label: 'Dinamiche relazionali' },
    { id: 'Mix casuale', label: 'Mix casuale' },
];

const OUTPUT_TYPE_LABELS: Record<string, string> = {
    slide: 'Slide (Canva / PP)',
    scheda_stampa: 'Scheda stampabile',
    manuale_lab: 'Manuale laboratorio',
    sito: 'Sito / Pagina web',
    guida_visuale: 'Guida visuale',
    spiegazione_adattata: 'Spiegazione adattata',
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface LessonPreparationTabProps {
    conversations: Conversation[];
    availableWeeks: WeekRouteInfo[];
    students: Student[];
    notebooks: Notebook[];
    onSaveGroups: (convoId: string, blockIndex: number, groups: GroupDefinition[]) => void;
    onSaveClassroomUrl: (convoId: string, blockIndex: number, url: string) => void;
    onSavePreparationSources: (convoId: string, blockIndex: number, sources: PreparationSource[]) => void;
    onAvviaLezione?: (convoId: string, blockIndex: number) => void;
    masterContext: ReturnType<typeof useMasterContext>;
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Aggrega il testo di tutte le fonti attive per l'invio ad Ada */
function buildSourcesText(
    block: import('../types').BlockDetails | null,
    sources: PreparationSource[],
    blockOptionsMap: Map<string, BlockOption>
): string {
    const parts: string[] = [];

    // Master blocco corrente
    const masterCurrent = sources.find(s => s.type === 'master_current' && s.isActive);
    if (masterCurrent && block?.contentBlocks?.length) {
        parts.push('## Master blocco corrente\n' + block.contentBlocks.map(cb => cb.content).join('\n\n'));
    }

    // Altri master
    sources.filter(s => s.type === 'master_other' && s.isActive && s.blockRef).forEach(s => {
        const opt = blockOptionsMap.get(s.blockRef!);
        if (opt?.block?.contentBlocks?.length) {
            parts.push(`## Master: ${s.label}\n` + opt.block.contentBlocks.map(cb => cb.content).join('\n\n'));
        }
    });

    // Note incollate
    sources.filter(s => s.type === 'note' && s.isActive && s.content).forEach(s => {
        parts.push(`## Nota: ${s.label}\n${s.content}`);
    });

    // Link / YouTube: solo label + url (Ada non può fetch, ma il contesto aiuta)
    sources.filter(s => (s.type === 'link' || s.type === 'youtube') && s.isActive && s.url).forEach(s => {
        parts.push(`## Risorsa: ${s.label}\nURL: ${s.url}`);
    });

    return parts.join('\n\n---\n\n').slice(0, 8000);
}

/** Genera il testo formattato da esportare in NotebookLM */
function buildLMExport(
    block: import('../types').BlockDetails | null,
    sources: PreparationSource[],
    blockOptionsMap: Map<string, BlockOption>
): string {
    const lines: string[] = ['# Fonti per NotebookLM', ''];
    if (block?.objective) lines.push(`**Obiettivo:** ${block.objective}`, '');

    const masterText = block?.contentBlocks?.map(cb => cb.content).join('\n\n');
    if (masterText) {
        lines.push('## Contenuto Master', masterText, '');
    }

    sources.filter(s => s.type === 'master_other' && s.blockRef).forEach(s => {
        const opt = blockOptionsMap.get(s.blockRef!);
        const text = opt?.block?.contentBlocks?.map(cb => cb.content).join('\n\n');
        if (text) lines.push(`## ${s.label}`, text, '');
    });

    sources.filter(s => s.type === 'note' && s.content).forEach(s => {
        lines.push(`## ${s.label}`, s.content!, '');
    });

    sources.filter(s => s.type === 'link' || s.type === 'youtube').forEach(s => {
        lines.push(`## Risorsa: ${s.label}`, `URL: ${s.url ?? ''}`, '');
    });

    return lines.join('\n');
}

// ── Componente principale ─────────────────────────────────────────────────────

const LessonPreparationTab: React.FC<LessonPreparationTabProps> = ({
    conversations, availableWeeks, students, notebooks,
    onSaveGroups, onSaveClassroomUrl, onSavePreparationSources,
    onAvviaLezione, masterContext, showToast,
}) => {

    // ── 1. SELEZIONE — deriva da availableWeeks × conversations (fix bug) ───
    const blockOptions = useMemo<BlockOption[]>(() => {
        const opts: BlockOption[] = [];
        for (const week of availableWeeks) {
            const convo = conversations.find(c => c.weekPlan?.weekNumber === week.weekNumber);
            for (let i = 0; i < week.totalBlocks; i++) {
                const block = convo?.weekPlan?.blocks[i] ?? null;
                if (block && (block.status === 'saltato' || block.status === 'annullato')) continue;
                if (block && block.lessonState === 'archiviata') continue; // le lezioni archiviate vivono nel tab Archivio
                const title = block?.blockTitle || block?.objective || block?.lessonTitle;
                opts.push({
                    key: convo ? `${convo.id}-${i}` : `stub-${week.weekNumber}-${i}`,
                    convoId: convo?.id ?? null,
                    blockIndex: i,
                    weekNumber: week.weekNumber,
                    weekDates: week.dates,
                    label: `Sett. ${week.weekNumber} · BL${i + 1}${block?.day && block.day !== 'Giorno da definire' ? ` · ${block.day}` : ''} — ${title ?? 'Blocco da pianificare'}`,
                    block,
                    isStub: !convo || !block,
                });
            }
        }
        return opts;
    }, [availableWeeks, conversations]);

    const blockOptionsMap = useMemo(() => {
        const m = new Map<string, BlockOption>();
        blockOptions.forEach(o => m.set(o.key, o));
        return m;
    }, [blockOptions]);

    const [selectedKey, setSelectedKey] = useState<string>(() => {
        const inCorso = conversations
            .filter(c => c.weekPlan)
            .flatMap(c => c.weekPlan!.blocks.map((b, i) => ({ key: `${c.id}-${i}`, b })))
            .find(({ b }) => b.lessonState === 'in_corso');
        return inCorso?.key ?? '';
    });

    // Auto-jump al blocco in_corso quando una lezione diventa attiva
    React.useEffect(() => {
        const inCorsoKey = conversations
            .filter(c => c.weekPlan)
            .flatMap(c => c.weekPlan!.blocks.map((b, i) => ({ key: `${c.id}-${i}`, b })))
            .find(({ b }) => b.lessonState === 'in_corso')?.key;
        if (inCorsoKey) setSelectedKey(prev => prev === inCorsoKey ? prev : inCorsoKey);
    }, [conversations]);

    const selectedOption = useMemo(
        () => blockOptions.find(o => o.key === selectedKey) ?? blockOptions[0] ?? null,
        [blockOptions, selectedKey]
    );
    const block = selectedOption?.block ?? null;

    // ── 2. SCRIVANIA FONTI — stato accordion e sources ───────────────────────
    const [isFontiOpen, setIsFontiOpen] = useState(true);
    const [isLMOpen, setIsLMOpen] = useState(false);
    const [lmPasteText, setLmPasteText] = useState('');
    const [showLMExport, setShowLMExport] = useState(false);
    const [lmExportText, setLmExportText] = useState('');
    const [copiedLMExport, setCopiedLMExport] = useState(false);

    // Fonti locali (sincronizzate con block.preparationSources)
    const [localSources, setLocalSources] = useState<PreparationSource[]>([]);
    const prevBlockKeyRef = useRef<string | null>(null);

    // Sincronizza localSources quando cambia il blocco
    React.useEffect(() => {
        const key = selectedOption?.key ?? null;
        if (key !== prevBlockKeyRef.current) {
            prevBlockKeyRef.current = key;
            const saved = block?.preparationSources ?? [];
            // Assicura che master_current ci sia sempre
            const hasMaster = saved.some(s => s.type === 'master_current');
            setLocalSources(hasMaster ? saved : [
                { id: 'master-current', type: 'master_current', label: 'Master blocco', isActive: true, addedAt: new Date().toISOString() },
                ...saved,
            ]);
        }
    }, [selectedOption?.key, block]);

    const saveSources = useCallback((sources: PreparationSource[]) => {
        setLocalSources(sources);
        if (selectedOption?.convoId) {
            onSavePreparationSources(selectedOption.convoId, selectedOption.blockIndex, sources);
        }
    }, [selectedOption, onSavePreparationSources]);

    const toggleSource = (id: string) => {
        const updated = localSources.map(s => s.id === id ? { ...s, isActive: !s.isActive } : s);
        saveSources(updated);
    };

    const removeSource = (id: string) => {
        saveSources(localSources.filter(s => s.id !== id && s.type !== 'master_current'));
        // Non permettere rimozione del master_current
        const src = localSources.find(s => s.id === id);
        if (src?.type === 'master_current') return;
        saveSources(localSources.filter(s => s.id !== id));
    };

    // Modal aggiungi fonte
    const [addSourceModal, setAddSourceModal] = useState<null | PrepSourceType>(null);
    const [newSourceLabel, setNewSourceLabel] = useState('');
    const [newSourceUrl, setNewSourceUrl] = useState('');
    const [newSourceContent, setNewSourceContent] = useState('');

    const handleAddSource = () => {
        if (!addSourceModal) return;
        const id = crypto.randomUUID();
        const base = { id, isActive: true, addedAt: new Date().toISOString() };
        let src: PreparationSource | null = null;

        if (addSourceModal === 'master_other') {
            // viene gestito inline con dropdown
            return;
        } else if (addSourceModal === 'link' || addSourceModal === 'youtube') {
            if (!newSourceUrl.trim()) { showToast('Inserisci un URL valido.', 'error'); return; }
            src = { ...base, type: addSourceModal, label: newSourceLabel.trim() || newSourceUrl, url: newSourceUrl.trim() };
        } else if (addSourceModal === 'note') {
            if (!newSourceContent.trim()) { showToast('Il testo non può essere vuoto.', 'error'); return; }
            src = { ...base, type: 'note', label: newSourceLabel.trim() || 'Nota', content: newSourceContent.trim() };
        }

        if (src) {
            saveSources([...localSources, src]);
            setAddSourceModal(null);
            setNewSourceLabel(''); setNewSourceUrl(''); setNewSourceContent('');
        }
    };

    // ── 3. DISTRIBUZIONE ADA ─────────────────────────────────────────────────
    const [isDistribuzioneOpen, setIsDistribuzioneOpen] = useState(false);
    const [distSuggestion, setDistSuggestion] = useState<DistributionSuggestion | null>(null);
    const [isLoadingDist, setIsLoadingDist] = useState(false);
    const [generatedOutputs, setGeneratedOutputs] = useState<GeneratedOutput[]>([]);
    const [generatingOutputFor, setGeneratingOutputFor] = useState<string | null>(null);

    const handleSuggestDistribution = async () => {
        if (!block) return;
        setIsLoadingDist(true);
        setDistSuggestion(null);
        try {
            const sourcesText = buildSourcesText(block, localSources, blockOptionsMap);
            const suggestion = await GeminiService.generateDistributionSuggestion(
                block.tipologia ? LESSON_TYPE_LABELS[block.tipologia] : undefined,
                block.metodologia ? TEACHING_METHODOLOGY_LABELS[block.metodologia] : undefined,
                !!block.isFuoriAula,
                !!block.hasExternalExpert,
                block.objective ?? '',
                sourcesText,
                masterContext.systemInstruction,
            );
            setDistSuggestion(suggestion);
        } catch (err) {
            console.error('[handleSuggestDistribution]', err);
            showToast('Errore nella generazione del suggerimento.', 'error');
        } finally {
            setIsLoadingDist(false);
        }
    };

    const handleGenerateOutput = async (outputType: string, groupId: string, adaptInfo?: { type: 'BES' | 'DSA' | 'PEI'; name: string; notes: string }) => {
        if (!block) return;
        const key = `${groupId}-${outputType}`;
        setGeneratingOutputFor(key);
        try {
            const sourcesText = buildSourcesText(block, localSources, blockOptionsMap);
            let content: string;
            if (adaptInfo) {
                content = await GeminiService.generateAdaptedMaterial(
                    sourcesText,
                    adaptInfo.name,
                    adaptInfo.type,
                    adaptInfo.notes,
                    masterContext.systemInstruction,
                );
            } else {
                const toolMap: Record<string, string> = {
                    slide: 'canva', scheda_stampa: 'ada_diretta', manuale_lab: 'ada_diretta',
                    sito: 'ada_diretta', guida_visuale: 'ada_diretta', spiegazione_adattata: 'ada_diretta',
                };
                content = await GeminiService.generateMaterialBrief(
                    sourcesText,
                    OUTPUT_TYPE_LABELS[outputType] ?? outputType,
                    distSuggestion?.toolSuggestion ?? toolMap[outputType] ?? 'ada_diretta',
                    groupId === 'all' ? 'tutta la classe' : `gruppo ${groupId}`,
                    '',
                    masterContext.systemInstruction,
                );
            }
            setGeneratedOutputs(prev => [
                ...prev.filter(o => !(o.groupId === groupId && o.outputType === outputType)),
                { groupId, outputType, content, isAdapted: !!adaptInfo, adaptationType: adaptInfo?.type },
            ]);
        } catch {
            showToast('Errore nella generazione dell\'output.', 'error');
        } finally {
            setGeneratingOutputFor(null);
        }
    };

    // ── 4. ASSEGNAZIONE GRUPPI ──────────────────────────────────────────────
    const [isGruppiOpen, setIsGruppiOpen] = useState(false);
    const [groupSize, setGroupSize] = useState(3);
    const [selectedCriteria, setSelectedCriteria] = useState<string[]>(['Livello competenza']);
    const [proposedGroups, setProposedGroups] = useState<GroupDefinition[]>([]);
    const [isLoadingGroups, setIsLoadingGroups] = useState(false);
    const [editingGroupNameIndex, setEditingGroupNameIndex] = useState<number | null>(null);
    const [draggingStudent, setDraggingStudent] = useState<{ sid: string; fromGroup: number } | null>(null);
    const [dragOverGroup, setDragOverGroup] = useState<number | null>(null);

    const toggleCriteria = (id: string) => {
        setSelectedCriteria(prev => prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]);
        setProposedGroups([]);
    };

    // Drag-and-drop: sposta uno studente tra gruppi proposti
    const handleDropStudentOnGroup = (toGroupIndex: number) => {
        if (!draggingStudent || draggingStudent.fromGroup === toGroupIndex) {
            setDraggingStudent(null); setDragOverGroup(null); return;
        }
        setProposedGroups(prev => {
            const next = prev.map(g => ({ ...g, studentIds: [...g.studentIds] }));
            next[draggingStudent.fromGroup].studentIds = next[draggingStudent.fromGroup].studentIds.filter(id => id !== draggingStudent.sid);
            next[toGroupIndex].studentIds = [...next[toGroupIndex].studentIds, draggingStudent.sid];
            return next;
        });
        setDraggingStudent(null); setDragOverGroup(null);
    };

    const getStudentName = (id: string) => students.find(s => s.id === id)?.name ?? 'Sconosciuto';

    const handleGenerateGroups = async () => {
        if (!selectedOption || selectedCriteria.length === 0) {
            showToast('Seleziona almeno un criterio.', 'error');
            return;
        }
        if (selectedCriteria.length === 1 && selectedCriteria[0] === 'Mix casuale') {
            const shuffled = [...students].sort(() => Math.random() - 0.5);
            const groups: GroupDefinition[] = [];
            let i = 0, n = 1;
            while (i < shuffled.length) {
                const slice = shuffled.slice(i, i + groupSize);
                groups.push({ name: groupSize === 1 ? slice[0]?.name ?? `Studente ${n}` : `Gruppo ${n}`, studentIds: slice.map(s => s.id), justification: groupSize === 1 ? 'Lavoro individuale.' : 'Composizione casuale.' });
                i += groupSize; n++;
            }
            setProposedGroups(groups);
            return;
        }
        setIsLoadingGroups(true);
        try {
            const groups = await GeminiService.generateGroupSuggestionWithCriteria(students, selectedCriteria, groupSize);
            setProposedGroups(groups);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Errore generazione gruppi.', 'error');
        } finally {
            setIsLoadingGroups(false);
        }
    };

    const handleSaveGroups = () => {
        if (!selectedOption?.convoId || proposedGroups.length === 0) return;
        onSaveGroups(selectedOption.convoId, selectedOption.blockIndex, proposedGroups);
        showToast('Gruppi salvati!', 'success');
        setProposedGroups([]);
        setIsGruppiOpen(false);
    };

    // ── 5. ABBINAMENTO ───────────────────────────────────────────────────────
    const [isAbbinamentoOpen, setIsAbbinamentoOpen] = useState(false);
    const [groupOutputMap, setGroupOutputMap] = useState<Record<string, string>>({});

    // I gruppi vengono salvati in block.allocations.data.groups (handleSaveGroupsForBlock);
    // block.lessonGroups è un campo legacy mai scritto — fallback per retrocompatibilità DB.
    const savedGroups = block?.allocations?.data.groups ?? block?.lessonGroups ?? [];
    const [openOutputIds, setOpenOutputIds] = useState<Set<string>>(new Set());

    const toggleOutput = (id: string) => setOpenOutputIds(prev => {
        const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
    });

    // ── Classroom URL ────────────────────────────────────────────────────────
    const [classroomDraft, setClassroomDraft] = useState(block?.classroomUrl ?? '');
    React.useEffect(() => { setClassroomDraft(block?.classroomUrl ?? ''); }, [selectedOption?.key, block?.classroomUrl]);

    // ── Stato vuoto ──────────────────────────────────────────────────────────
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

    const activeSources = localSources.filter(s => s.isActive);
    const hasMasterContent = (block?.contentBlocks?.length ?? 0) > 0;

    const exactDate = block?.day && selectedOption
        ? getExactDateForBlock(selectedOption.weekDates, block.day, masterContext.teacherProfile)
        : null;

    // ── RENDER ───────────────────────────────────────────────────────────────
    return (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            <div className="max-w-3xl mx-auto p-6 space-y-5">

                {/* ── 1. SELEZIONE ─────────────────────────────────────────── */}
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
                    {selectedOption?.isStub && (
                        <p className="text-xs text-amber-500/70 mt-1.5 font-mono">
                            ⚠ Questo blocco non è ancora stato aperto in Laboratorio. Le sezioni di distribuzione e abbinamento saranno limitate.
                        </p>
                    )}

                    {/* ── Mini-card metadati blocco ──────────────────────── */}
                    {block && (
                        <div className="mt-3 px-3 py-2.5 bg-gray-800/60 border border-gray-700/40 rounded-lg flex flex-wrap gap-x-4 gap-y-1.5">
                            {/* Data */}
                            {block.day && (
                                <span className="text-[10px] font-mono text-gray-400">
                                    {block.day}{exactDate ? ` ${exactDate.getDate()} ${exactDate.toLocaleString('it-IT', { month: 'short' })}` : ''}
                                </span>
                            )}
                            {/* Cosa */}
                            {block.module && (
                                <span className="text-[10px] font-mono text-sky-400/80 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-0.5">
                                    {block.module}
                                </span>
                            )}
                            {/* Come */}
                            {block.tipologia && (
                                <span className="text-[10px] font-mono text-blue-400/80 bg-blue-500/10 border border-blue-500/20 rounded px-1.5 py-0.5">
                                    {LESSON_TYPE_LABELS[block.tipologia]}
                                </span>
                            )}
                            {/* Approccio */}
                            {block.metodologia && (
                                <span className="text-[10px] font-mono text-violet-400/80 bg-violet-500/10 border border-violet-500/20 rounded px-1.5 py-0.5">
                                    {TEACHING_METHODOLOGY_LABELS[block.metodologia]}
                                </span>
                            )}
                            {/* Contesto */}
                            {block.isFslPeriod && (
                                <span className="text-[10px] font-mono text-sky-400/80 bg-sky-500/10 border border-sky-500/20 rounded px-1.5 py-0.5">FSL</span>
                            )}
                            {block.hasExternalExpert && (
                                <span className="text-[10px] font-mono text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
                                    ESP{block.externalExpertName ? ` · ${block.externalExpertName}` : ''}
                                </span>
                            )}
                            {block.isFuoriAula && (
                                <span className="text-[10px] font-mono text-teal-400/80 bg-teal-500/10 border border-teal-500/20 rounded px-1.5 py-0.5">
                                    Fuori aula{block.luogo ? ` · ${block.luogo}` : ''}
                                </span>
                            )}
                            {/* Fallback se nessun metadato */}
                            {!block.module && !block.tipologia && !block.metodologia && !block.isFslPeriod && !block.hasExternalExpert && !block.isFuoriAula && !block.day && (
                                <span className="text-[10px] font-mono text-gray-600">Nessun dettaglio configurato — vai in Progettazione del Corso</span>
                            )}
                        </div>
                    )}
                </div>

                {selectedOption && (
                    <>
                        {/* ── 2. SCRIVANIA FONTI ───────────────────────────── */}
                        <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
                            <button
                                onClick={() => setIsFontiOpen(o => !o)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left"
                            >
                                <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <DocumentTextIcon className="h-4 w-4 text-gray-500" />
                                    Scrivania Fonti
                                    <span className="text-[10px] font-mono text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded">
                                        {activeSources.length} attive
                                    </span>
                                </span>
                                <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isFontiOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isFontiOpen && (
                                <div className="border-t border-gray-700/40 divide-y divide-gray-700/30">

                                    {/* Lista fonti */}
                                    <div className="px-4 py-3 space-y-2">
                                        {localSources.map(src => {
                                            const isMasterCurrent = src.type === 'master_current';
                                            const icon = src.type === 'youtube' ? <YouTubeIcon className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                                                : src.type === 'note' ? <NoteIcon className="h-3.5 w-3.5 text-amber-400/80 flex-shrink-0" />
                                                : src.type === 'master_current' || src.type === 'master_other' ? <DocumentTextIcon className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                                : <LinkIcon className="h-3.5 w-3.5 text-sky-400 flex-shrink-0" />;

                                            return (
                                                <div
                                                    key={src.id}
                                                    className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-colors ${src.isActive ? 'border-gray-600/50 bg-gray-900/40' : 'border-gray-700/30 bg-gray-900/20 opacity-50'}`}
                                                >
                                                    {icon}
                                                    <span className="flex-1 min-w-0">
                                                        <span className="text-xs text-gray-300 truncate block">{src.label}</span>
                                                        {isMasterCurrent && !hasMasterContent && (
                                                            <span className="text-[10px] text-gray-600 font-mono">master vuoto — vai al Laboratorio</span>
                                                        )}
                                                        {(src.type === 'link' || src.type === 'youtube') && src.url && (
                                                            <a href={src.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-gray-600 hover:text-sky-400 truncate block transition-colors">
                                                                {src.url.slice(0, 50)}…
                                                            </a>
                                                        )}
                                                    </span>
                                                    {/* Toggle attivo */}
                                                    <button
                                                        onClick={() => toggleSource(src.id)}
                                                        title={src.isActive ? 'Disattiva' : 'Attiva'}
                                                        className={`w-7 h-4 rounded-full flex-shrink-0 transition-colors ${src.isActive ? 'bg-purple-600/70' : 'bg-gray-700'}`}
                                                    >
                                                        <span className={`block w-3 h-3 rounded-full bg-white shadow transition-transform mx-0.5 ${src.isActive ? 'translate-x-3' : 'translate-x-0'}`} />
                                                    </button>
                                                    {/* Rimuovi (non per master_current) */}
                                                    {!isMasterCurrent && (
                                                        <button onClick={() => removeSource(src.id)} className="text-gray-600 hover:text-red-400 flex-shrink-0 transition-colors">
                                                            <XIcon className="h-3.5 w-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Bottoni aggiungi fonte */}
                                    <div className="px-4 py-3">
                                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Aggiungi fonte</p>
                                        <div className="flex flex-wrap gap-2">
                                            {/* Master altro blocco */}
                                            <select
                                                value=""
                                                onChange={e => {
                                                    const key = e.target.value;
                                                    if (!key || localSources.some(s => s.blockRef === key)) return;
                                                    const opt = blockOptionsMap.get(key);
                                                    if (!opt) return;
                                                    saveSources([...localSources, {
                                                        id: crypto.randomUUID(), type: 'master_other', label: opt.label,
                                                        isActive: true, addedAt: new Date().toISOString(), blockRef: key,
                                                    }]);
                                                }}
                                                className="text-xs bg-gray-800 border border-gray-700/60 rounded-lg px-2 py-1.5 text-gray-400 focus:ring-1 focus:ring-blue-500/50"
                                            >
                                                <option value="">+ Master altro blocco…</option>
                                                {blockOptions
                                                    .filter(o => o.key !== selectedOption?.key && (o.block?.contentBlocks?.length ?? 0) > 0 && !localSources.some(s => s.blockRef === o.key))
                                                    .map(o => <option key={o.key} value={o.key}>{o.label}</option>)
                                                }
                                            </select>

                                            {[
                                                { type: 'link' as PrepSourceType, label: '+ Link', icon: <LinkIcon className="h-3 w-3" /> },
                                                { type: 'youtube' as PrepSourceType, label: '+ YouTube', icon: <YouTubeIcon className="h-3 w-3" /> },
                                                { type: 'note' as PrepSourceType, label: '+ Testo', icon: <NoteIcon className="h-3 w-3" /> },
                                            ].map(({ type, label, icon }) => (
                                                <button
                                                    key={type}
                                                    onClick={() => { setAddSourceModal(type); setNewSourceLabel(''); setNewSourceUrl(''); setNewSourceContent(''); }}
                                                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 border border-gray-700/50 rounded-lg hover:border-gray-600 hover:text-gray-200 transition-colors"
                                                >
                                                    {icon}{label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pannello NotebookLM */}
                                    <div>
                                        <button
                                            onClick={() => setIsLMOpen(o => !o)}
                                            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-gray-700/20 transition-colors"
                                        >
                                            <span className="text-xs text-gray-400 flex items-center gap-2">
                                                <BookOpenIcon className="h-3.5 w-3.5 text-indigo-400" />
                                                <span className="font-mono text-[10px] text-indigo-400/80 bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase tracking-wide">NotebookLM</span>
                                                Sinergia con le fonti
                                            </span>
                                            <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-600 transition-transform ${isLMOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        {isLMOpen && (
                                            <div className="px-4 pb-4 space-y-3 pt-2 border-t border-gray-700/30">
                                                {/* Notebook collegati */}
                                                {(block?.linkedNotebookIds ?? []).length > 0 && (
                                                    <div>
                                                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Notebook collegati</p>
                                                        <div className="space-y-1">
                                                            {block!.linkedNotebookIds!.map(nid => {
                                                                const nb = notebooks.find(n => n.id === nid);
                                                                if (!nb) return null;
                                                                return (
                                                                    <div key={nid} className="flex items-center gap-2">
                                                                        <a href={nb.url} target="_blank" rel="noopener noreferrer"
                                                                            className="flex-1 text-xs text-indigo-400/80 hover:text-indigo-300 truncate transition-colors">
                                                                            {nb.title}
                                                                        </a>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Esporta fonti */}
                                                <div>
                                                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Esporta fonti → NotebookLM</p>
                                                    <p className="text-xs text-gray-600 mb-2">Genera un testo da incollare come fonte in un nuovo notebook.</p>
                                                    <button
                                                        onClick={() => {
                                                            const text = buildLMExport(block, localSources, blockOptionsMap);
                                                            setLmExportText(text);
                                                            setShowLMExport(true);
                                                        }}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-indigo-400 border border-indigo-500/25 rounded-lg hover:bg-indigo-500/10 hover:border-indigo-400/40 transition-colors"
                                                    >
                                                        <BookOpenIcon className="h-3.5 w-3.5" />
                                                        Prepara fonti per LM
                                                    </button>
                                                </div>

                                                {/* Incolla risposta LM */}
                                                <div>
                                                    <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Incolla risposta da NotebookLM</p>
                                                    <textarea
                                                        value={lmPasteText}
                                                        onChange={e => setLmPasteText(e.target.value)}
                                                        rows={3}
                                                        className="w-full p-2 bg-gray-900 border border-gray-700/60 rounded-lg text-xs text-gray-200 placeholder-gray-600 resize-none focus:ring-1 focus:ring-indigo-500/50"
                                                        placeholder="Incolla qui l'output di NotebookLM…"
                                                    />
                                                    <button
                                                        onClick={() => {
                                                            if (!lmPasteText.trim()) return;
                                                            saveSources([...localSources, {
                                                                id: crypto.randomUUID(), type: 'note',
                                                                label: `Risposta LM — ${new Date().toLocaleDateString('it-IT')}`,
                                                                isActive: true, addedAt: new Date().toISOString(),
                                                                content: lmPasteText.trim(),
                                                            }]);
                                                            setLmPasteText('');
                                                            showToast('Risposta LM aggiunta alle fonti!', 'success');
                                                        }}
                                                        disabled={!lmPasteText.trim()}
                                                        className="mt-1.5 px-2.5 py-1.5 text-xs text-indigo-400 border border-indigo-500/25 rounded-lg hover:bg-indigo-500/10 hover:border-indigo-400/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                        Aggiungi come fonte
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* ── 3. DISTRIBUZIONE ADA ─────────────────────────── */}
                        <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
                            <button
                                onClick={() => setIsDistribuzioneOpen(o => !o)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left"
                            >
                                <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <SparklesIcon className="h-4 w-4 text-purple-400" />
                                    Materiali per la lezione
                                </span>
                                <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isDistribuzioneOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isDistribuzioneOpen && (
                                <div className="px-4 pb-4 border-t border-gray-700/40 pt-3 space-y-4">
                                    {/* Chips contesto blocco */}
                                    {block && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {block.tipologia && (
                                                <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400/80 border border-blue-500/20 rounded-md px-1.5 py-0.5">
                                                    {LESSON_TYPE_LABELS[block.tipologia]}
                                                </span>
                                            )}
                                            {block.metodologia && (
                                                <span className="text-[10px] font-mono bg-violet-500/10 text-violet-400/80 border border-violet-500/20 rounded-md px-1.5 py-0.5">
                                                    {TEACHING_METHODOLOGY_LABELS[block.metodologia]}
                                                </span>
                                            )}
                                            {block.isFuoriAula && (
                                                <span className="text-[10px] font-mono bg-teal-500/10 text-teal-400/80 border border-teal-500/20 rounded-md px-1.5 py-0.5">
                                                    Fuori aula{block.luogo ? ` · ${block.luogo}` : ''}
                                                </span>
                                            )}
                                            {block.hasExternalExpert && (
                                                <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400/80 border border-amber-500/20 rounded-md px-1.5 py-0.5">
                                                    Esperto{block.externalExpertName ? ` · ${block.externalExpertName}` : ''}
                                                </span>
                                            )}
                                            {!block.tipologia && !block.metodologia && (
                                                <span className="text-[10px] font-mono text-gray-600">
                                                    Configura tipologia e metodologia in Progettazione per suggerimenti precisi.
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Pulsante suggerisci */}
                                    <button
                                        onClick={handleSuggestDistribution}
                                        disabled={isLoadingDist || !block}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoadingDist
                                            ? <><span className="h-3.5 w-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Ada analizza…</>
                                            : <><SparklesIcon className="h-3.5 w-3.5" />{distSuggestion ? 'Rigenera suggerimento' : 'Suggerisci materiale da preparare'}</>
                                        }
                                    </button>

                                    {/* Suggerimento */}
                                    {distSuggestion && (
                                        <div className="bg-gray-900/60 rounded-lg border border-purple-800/30 p-3 space-y-3">
                                            <div>
                                                <span className="text-[10px] font-mono text-purple-400/70 uppercase tracking-widest">Output suggerito</span>
                                                <p className="text-sm font-medium text-white mt-0.5">{OUTPUT_TYPE_LABELS[distSuggestion.outputType] ?? distSuggestion.outputType}</p>
                                                <p className="text-xs text-gray-400 mt-1">{distSuggestion.description}</p>
                                            </div>
                                            {distSuggestion.workflow.length > 0 && (
                                                <div>
                                                    <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Workflow</span>
                                                    <ol className="mt-1 space-y-0.5">
                                                        {distSuggestion.workflow.map((step, i) => (
                                                            <li key={i} className="text-xs text-gray-400 flex gap-1.5">
                                                                <span className="font-mono text-gray-600 flex-shrink-0">{i + 1}.</span>
                                                                {step}
                                                            </li>
                                                        ))}
                                                    </ol>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono text-gray-600">Tool:</span>
                                                <span className="text-[10px] font-mono text-gray-400 bg-gray-700/60 px-1.5 py-0.5 rounded">{distSuggestion.toolSuggestion}</span>
                                            </div>
                                            <button
                                                onClick={() => handleGenerateOutput(distSuggestion.outputType, 'all')}
                                                disabled={generatingOutputFor === `all-${distSuggestion.outputType}` || activeSources.length === 0}
                                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {generatingOutputFor === `all-${distSuggestion.outputType}`
                                                    ? <><span className="h-3 w-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generazione…</>
                                                    : <><SparklesIcon className="h-3 w-3" />Genera con Ada</>
                                                }
                                            </button>
                                        </div>
                                    )}

                                    {/* Output generati */}
                                    {generatedOutputs.filter(o => o.groupId === 'all').map((out, i) => {
                                        const isOpen = openOutputIds.has(`all-${out.outputType}`);
                                        return (
                                            <div key={i} className="rounded-lg border border-gray-700/50 bg-gray-900/40 overflow-hidden">
                                                <button
                                                    onClick={() => toggleOutput(`all-${out.outputType}`)}
                                                    className="w-full flex items-center justify-between px-3 py-2 text-left"
                                                >
                                                    <span className="text-xs font-medium text-gray-300">
                                                        {OUTPUT_TYPE_LABELS[out.outputType] ?? out.outputType}
                                                    </span>
                                                    <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-600 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                                </button>
                                                {isOpen && (
                                                    <div className="px-3 pb-3 border-t border-gray-700/30 pt-2 text-sm text-gray-300 max-h-80 overflow-y-auto custom-scrollbar">
                                                        <MarkdownRenderer content={out.content} />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        {/* ── Link Classroom ────────────────────────────────── */}
                        <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 px-4 py-3 space-y-2">
                            <div>
                                <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest">
                                    Google Classroom — Compito / Materiali
                                </label>
                                <p className="text-[11px] text-gray-600 mt-0.5">
                                    Incolla qui il link del compito Classroom dove carichi i materiali da distribuire alla classe.
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="url"
                                    value={classroomDraft}
                                    onChange={e => setClassroomDraft(e.target.value)}
                                    onBlur={() => {
                                        if (!selectedOption?.convoId) return;
                                        const trimmed = classroomDraft.trim();
                                        if (trimmed !== (block?.classroomUrl ?? '')) {
                                            onSaveClassroomUrl(selectedOption.convoId, selectedOption.blockIndex, trimmed);
                                        }
                                    }}
                                    placeholder="https://classroom.google.com/..."
                                    className="flex-1 p-2 bg-gray-800 border border-gray-700/60 rounded-lg text-sm text-gray-200 placeholder-gray-600 focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50"
                                />
                                {classroomDraft && (
                                    <a href={classroomDraft} target="_blank" rel="noopener noreferrer"
                                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-sky-400 border border-sky-500/25 rounded-lg hover:bg-sky-500/10 hover:border-sky-400/40 transition-colors whitespace-nowrap">
                                        <LinkIcon className="h-3.5 w-3.5" />Apri
                                    </a>
                                )}
                            </div>
                        </div>

                        {/* ── 4. ASSEGNAZIONE GRUPPI ────────────────────────── */}
                        <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
                            <button
                                onClick={() => setIsGruppiOpen(o => !o)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left"
                            >
                                <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                    <UsersIcon className="h-4 w-4 text-indigo-400" />
                                    Assegnazione gruppi
                                    {savedGroups.length > 0 && (
                                        <span className="text-[10px] font-mono text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded">
                                            {savedGroups.length} salvati
                                        </span>
                                    )}
                                </span>
                                <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isGruppiOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {isGruppiOpen && (
                                <div className="px-4 pb-4 border-t border-gray-700/40 pt-3 space-y-4">
                                    {students.length === 0 ? (
                                        <p className="text-sm text-gray-600">Nessuno studente nel registro. Aggiungili prima in "Studenti".</p>
                                    ) : (
                                        <>
                                            {/* Dimensione gruppo */}
                                            <div>
                                                <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-1.5">
                                                    Persone per gruppo
                                                    {groupSize === 1 && <span className="ml-1.5 text-sky-400/70">— individuale</span>}
                                                </label>
                                                <div className="flex gap-2">
                                                    {[1, 2, 3, 4, 5].map(n => (
                                                        <button
                                                            key={n}
                                                            onClick={() => { setGroupSize(n); setProposedGroups([]); }}
                                                            className={`w-10 h-10 rounded-lg text-sm font-semibold border transition-colors ${groupSize === n ? 'bg-purple-600/80 border-purple-500 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white'}`}
                                                        >
                                                            {n}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Criteri (solo se gruppi > 1) */}
                                            {groupSize > 1 && (
                                                <div>
                                                    <label className="block text-[10px] font-mono text-gray-400 uppercase tracking-widest mb-1.5">Criteri di bilanciamento</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {CRITERIA_OPTIONS.map(c => (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => toggleCriteria(c.id)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedCriteria.includes(c.id) ? 'bg-indigo-600/60 border-indigo-500/60 text-indigo-200' : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white'}`}
                                                            >
                                                                {selectedCriteria.includes(c.id) ? '✓ ' : ''}{c.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <button
                                                onClick={handleGenerateGroups}
                                                disabled={isLoadingGroups || (groupSize > 1 && selectedCriteria.length === 0)}
                                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {isLoadingGroups
                                                    ? <><span className="h-3.5 w-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generazione…</>
                                                    : <><SparklesIcon className="h-3.5 w-3.5" />
                                                        {groupSize === 1 ? 'Assegna individuale' : (selectedCriteria.length === 1 && selectedCriteria[0] === 'Mix casuale') ? 'Genera casuale' : 'Suggerisci con Ada'}
                                                      </>
                                                }
                                            </button>

                                            {/* Gruppi proposti con drag-and-drop e nome editabile */}
                                            {proposedGroups.length > 0 && (
                                                <div className="space-y-3">
                                                    <p className="text-[10px] font-mono text-gray-400 uppercase tracking-widest">
                                                        Trascina gli studenti tra i gruppi per riorganizzarli
                                                    </p>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {proposedGroups.map((group, gi) => (
                                                            <div
                                                                key={gi}
                                                                className={`bg-gray-900/60 rounded-lg border p-3 transition-colors ${dragOverGroup === gi ? 'border-indigo-500/60 bg-indigo-900/20' : 'border-gray-700/50'}`}
                                                                onDragOver={e => { e.preventDefault(); setDragOverGroup(gi); }}
                                                                onDragLeave={() => setDragOverGroup(null)}
                                                                onDrop={() => handleDropStudentOnGroup(gi)}
                                                            >
                                                                {/* Nome editabile */}
                                                                <div className="flex items-center gap-1.5 mb-2">
                                                                    <span className="text-[10px] font-mono text-gray-600">{gi + 1}.</span>
                                                                    {editingGroupNameIndex === gi ? (
                                                                        <input
                                                                            autoFocus
                                                                            type="text"
                                                                            value={group.name}
                                                                            onChange={e => setProposedGroups(prev => {
                                                                                const next = [...prev];
                                                                                next[gi] = { ...next[gi], name: e.target.value };
                                                                                return next;
                                                                            })}
                                                                            onBlur={() => setEditingGroupNameIndex(null)}
                                                                            onKeyDown={e => { if (e.key === 'Enter') setEditingGroupNameIndex(null); }}
                                                                            className="flex-1 text-xs font-semibold bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-white focus:outline-none focus:border-indigo-400"
                                                                        />
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => setEditingGroupNameIndex(gi)}
                                                                            className="text-xs font-semibold text-white hover:text-indigo-300 transition-colors truncate text-left"
                                                                            title="Clicca per rinominare"
                                                                        >
                                                                            {group.name}
                                                                        </button>
                                                                    )}
                                                                    <span className="text-[10px] text-gray-600 ml-auto flex-shrink-0">{group.studentIds.length} pers.</span>
                                                                </div>

                                                                {/* Tag studenti draggable */}
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {group.studentIds.map(sid => {
                                                                        const stu = students.find(s => s.id === sid);
                                                                        return (
                                                                            <span
                                                                                key={sid}
                                                                                draggable
                                                                                onDragStart={() => setDraggingStudent({ sid, fromGroup: gi })}
                                                                                onDragEnd={() => { setDraggingStudent(null); setDragOverGroup(null); }}
                                                                                className="flex items-center gap-1 text-[11px] text-gray-300 bg-gray-700/60 border border-gray-600/40 px-2 py-0.5 rounded-full cursor-grab active:cursor-grabbing select-none"
                                                                                title="Trascina per spostare"
                                                                            >
                                                                                {stu?.name ?? 'Sconosciuto'}
                                                                                {stu?.hasBES && <span className="text-[9px] font-mono text-amber-400/80">BES</span>}
                                                                                {stu?.hasDSA && <span className="text-[9px] font-mono text-sky-400/80">DSA</span>}
                                                                                {stu?.hasPEI && <span className="text-[9px] font-mono text-purple-400/80">PEI</span>}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                    {group.studentIds.length === 0 && (
                                                                        <span className="text-[10px] text-gray-600 italic">Nessuno studente</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <button
                                                        onClick={handleSaveGroups}
                                                        className="px-4 py-2 rounded-lg bg-blue-600/80 text-white text-xs font-semibold hover:bg-blue-500 shadow-sm shadow-blue-900/40 transition-colors"
                                                    >
                                                        Salva composizione
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* ── 5. ABBINAMENTO ───────────────────────────────── */}
                        {savedGroups.length > 0 && distSuggestion && (
                            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
                                <button
                                    onClick={() => setIsAbbinamentoOpen(o => !o)}
                                    className="w-full flex items-center justify-between px-4 py-3 text-left"
                                >
                                    <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                        <UsersIcon className="h-4 w-4 text-emerald-400" />
                                        Abbinamento Gruppi → Output
                                    </span>
                                    <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isAbbinamentoOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isAbbinamentoOpen && (
                                    <div className="px-4 pb-4 border-t border-gray-700/40 pt-3 space-y-3">
                                        {savedGroups.map((group, gi) => {
                                            const groupStudents = group.studentIds.map(id => students.find(s => s.id === id)).filter(Boolean);
                                            const hasSpecialNeeds = groupStudents.some(s => s?.hasBES || s?.hasDSA || s?.hasPEI);
                                            const assigned = groupOutputMap[group.name];
                                            const out = generatedOutputs.find(o => o.groupId === group.name);

                                            return (
                                                <div key={gi} className="rounded-lg border border-gray-700/40 bg-gray-900/30 p-3 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-semibold text-white">{group.name}</span>
                                                        <div className="flex items-center gap-1">
                                                            {hasSpecialNeeds && (
                                                                <span className="text-[9px] font-mono text-amber-400/70 bg-amber-500/10 px-1.5 py-0.5 rounded">necessità speciali</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Studenti del gruppo */}
                                                    <div className="flex flex-wrap gap-1">
                                                        {groupStudents.map(s => s && (
                                                            <span key={s.id} className="text-[10px] text-gray-400 bg-gray-700/50 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                                {s.name}
                                                                {s.hasBES && <span className="text-amber-400/80">BES</span>}
                                                                {s.hasDSA && <span className="text-sky-400/80">DSA</span>}
                                                                {s.hasPEI && <span className="text-purple-400/80">PEI</span>}
                                                            </span>
                                                        ))}
                                                    </div>

                                                    {/* Selettore output */}
                                                    <div className="flex items-center gap-2">
                                                        <select
                                                            value={assigned ?? distSuggestion.outputType}
                                                            onChange={e => setGroupOutputMap(prev => ({ ...prev, [group.name]: e.target.value }))}
                                                            className="flex-1 p-1.5 bg-gray-800 border border-gray-700/60 rounded-lg text-xs text-gray-200"
                                                        >
                                                            {Object.entries(OUTPUT_TYPE_LABELS).map(([val, lbl]) => (
                                                                <option key={val} value={val}>{lbl}</option>
                                                            ))}
                                                        </select>
                                                        <button
                                                            onClick={() => {
                                                                const outputType = assigned ?? distSuggestion.outputType;
                                                                // Trova studenti con bisogni speciali nel gruppo
                                                                const specialStudent = groupStudents.find(s => s?.hasBES || s?.hasDSA || s?.hasPEI);
                                                                if (specialStudent && hasSpecialNeeds) {
                                                                    const type = specialStudent.hasPEI ? 'PEI' : specialStudent.hasDSA ? 'DSA' : 'BES';
                                                                    const notes = (type === 'BES' ? specialStudent.besNotes : type === 'DSA' ? specialStudent.dsaNotes : specialStudent.peiNotes) ?? '';
                                                                    handleGenerateOutput(outputType, group.name, { type, name: specialStudent.name, notes });
                                                                } else {
                                                                    handleGenerateOutput(outputType, group.name);
                                                                }
                                                            }}
                                                            disabled={!!generatingOutputFor}
                                                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                                                        >
                                                            {generatingOutputFor === `${group.name}-${assigned ?? distSuggestion.outputType}`
                                                                ? <span className="h-3 w-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                                                : <SparklesIcon className="h-3 w-3" />
                                                            }
                                                            {hasSpecialNeeds ? 'Adatta' : 'Genera'}
                                                        </button>
                                                    </div>

                                                    {/* Output generato per questo gruppo */}
                                                    {out && (
                                                        <div className="rounded-md border border-gray-700/40 bg-gray-800/40 overflow-hidden">
                                                            <button
                                                                onClick={() => toggleOutput(`group-${group.name}`)}
                                                                className="w-full flex items-center justify-between px-3 py-1.5 text-left"
                                                            >
                                                                <span className="text-[10px] text-gray-400 flex items-center gap-1.5">
                                                                    {out.isAdapted && <span className="text-amber-400/80 font-mono">adattato</span>}
                                                                    {OUTPUT_TYPE_LABELS[out.outputType] ?? out.outputType}
                                                                </span>
                                                                <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-600 transition-transform ${openOutputIds.has(`group-${group.name}`) ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            {openOutputIds.has(`group-${group.name}`) && (
                                                                <div className="px-3 pb-3 border-t border-gray-700/30 pt-2 text-sm text-gray-300 max-h-60 overflow-y-auto custom-scrollbar">
                                                                    <MarkdownRenderer content={out.content} />
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* ── Pulsante Avvia Lezione ────────────────────────────────── */}
                {selectedOption?.convoId && block && block.lessonState !== 'in_corso' && block.lessonState !== 'archiviata' && onAvviaLezione && (
                    <div className="pt-2 pb-4">
                        <button
                            onClick={() => onAvviaLezione(selectedOption.convoId!, selectedOption.blockIndex)}
                            className="w-full py-3 rounded-xl bg-emerald-600/80 text-white font-semibold text-sm hover:bg-emerald-500 shadow-sm shadow-emerald-900/40 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="text-base">▶</span>
                            Avvia Lezione
                        </button>
                    </div>
                )}
                {selectedOption?.convoId && block?.lessonState === 'in_corso' && (
                    <div className="pt-2 pb-4">
                        <div className="w-full py-3 rounded-xl bg-emerald-900/30 border border-emerald-700/40 text-emerald-400 font-medium text-sm flex items-center justify-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            Lezione in corso
                        </div>
                    </div>
                )}
            </div>

            {/* ── Modal aggiungi fonte ──────────────────────────────────────── */}
            <Modal
                isOpen={!!addSourceModal && addSourceModal !== 'master_other'}
                onClose={() => setAddSourceModal(null)}
                title={addSourceModal === 'youtube' ? 'Aggiungi YouTube' : addSourceModal === 'link' ? 'Aggiungi Link' : 'Aggiungi Testo'}
                footer={
                    <>
                        <div />
                        <div className="space-x-3">
                            <button onClick={() => setAddSourceModal(null)} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
                            <button onClick={handleAddSource} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Aggiungi</button>
                        </div>
                    </>
                }
            >
                <div className="space-y-3">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Etichetta</label>
                        <input
                            type="text" value={newSourceLabel} onChange={e => setNewSourceLabel(e.target.value)} autoFocus
                            className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                            placeholder={addSourceModal === 'note' ? 'Es: Note lezione precedente' : 'Es: Slide capitolo 3'}
                        />
                    </div>
                    {(addSourceModal === 'link' || addSourceModal === 'youtube') && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">URL *</label>
                            <input
                                type="url" value={newSourceUrl} onChange={e => setNewSourceUrl(e.target.value)}
                                className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder={addSourceModal === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://...'}
                            />
                        </div>
                    )}
                    {addSourceModal === 'note' && (
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Testo *</label>
                            <textarea
                                value={newSourceContent} onChange={e => setNewSourceContent(e.target.value)} rows={6}
                                className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                                placeholder="Incolla il testo da usare come fonte…"
                            />
                        </div>
                    )}
                </div>
            </Modal>

            {/* ── Modal esporta per NotebookLM ─────────────────────────────── */}
            <Modal
                isOpen={showLMExport}
                onClose={() => setShowLMExport(false)}
                title="Fonti per NotebookLM"
                footer={
                    <>
                        <div />
                        <div className="space-x-3">
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(lmExportText).then(() => {
                                        setCopiedLMExport(true);
                                        setTimeout(() => setCopiedLMExport(false), 2000);
                                    });
                                }}
                                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${copiedLMExport ? 'bg-emerald-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                            >
                                {copiedLMExport ? '✓ Copiato!' : 'Copia tutto'}
                            </button>
                            <button onClick={() => setShowLMExport(false)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Chiudi</button>
                        </div>
                    </>
                }
            >
                <div>
                    <p className="text-xs text-gray-500 mb-3">Copia questo testo e incollalo come nuova fonte in NotebookLM.</p>
                    <textarea
                        readOnly value={lmExportText} rows={12}
                        className="w-full p-2 bg-gray-900 border border-gray-700/60 rounded-md text-xs text-gray-300 resize-none font-mono"
                    />
                </div>
            </Modal>
        </div>
    );
};

export default LessonPreparationTab;
