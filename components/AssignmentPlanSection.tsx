/**
 * @deprecated DORMIENTE — 2026-06-04
 * Sostituito dalla sezione Abbinamento in LessonPreparationTab.tsx (v2).
 * Non eliminare: mantenuto per retrocompatibilità nel caso in cui venga richiamato altrove.
 */
import React, { useState, useCallback } from 'react';
import type { LessonAssignment, LessonAssignmentChannel, LessonMaterial, GroupDefinition, Student } from '../types';
import { LESSON_ASSIGNMENT_CHANNEL_LABELS } from '../types';
import { SparklesIcon, ChevronDownIcon } from './Icons';
import * as GeminiService from '../services/gemini';

const CHANNELS: LessonAssignmentChannel[] = ['classroom', 'stampa', 'qr_code', 'padlet', 'drive_link', 'verbale'];

const MATERIAL_TYPE_LABELS: Record<LessonMaterial['type'], string> = {
    slide: 'Slide', video: 'Video', pdf: 'PDF', paper: 'Articolo',
    ricerca: 'Ricerca', stampa: 'Stampa', altro: 'Altro',
};

interface AssignmentPlanSectionProps {
    groups: GroupDefinition[];
    materials: LessonMaterial[];
    students: Student[];
    blockObjective: string;
    classroomUrl?: string;
    assignments: LessonAssignment[];
    systemInstruction: string;
    showToast: (msg: string, type: 'success' | 'info' | 'error') => void;
    onSaveAssignments: (assignments: LessonAssignment[]) => void;
    onUpdateChannel: (assignmentId: string, channel: LessonAssignmentChannel) => void;
}

const AssignmentPlanSection: React.FC<AssignmentPlanSectionProps> = ({
    groups, materials, students, blockObjective, classroomUrl,
    assignments, systemInstruction, showToast, onSaveAssignments, onUpdateChannel,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isDistributionPlanOpen, setIsDistributionPlanOpen] = useState(false);
    const [copiedPlan, setCopiedPlan] = useState(false);
    const [groupSize, setGroupSize] = useState(3);

    const materialMap = new Map<string, LessonMaterial>(materials.map(m => [m.id, m]));
    const studentMap = new Map(students.map(s => [s.id, s]));

    const buildGroups = useCallback((): GroupDefinition[] => {
        if (groups.length > 0) return groups;
        // Auto-build groups from students with given groupSize
        const shuffled = [...students];
        const result: GroupDefinition[] = [];
        let i = 0; let n = 1;
        while (i < shuffled.length) {
            const slice = shuffled.slice(i, i + groupSize);
            result.push({
                name: slice.length === 1 ? (slice[0].name) : `Gruppo ${n}`,
                studentIds: slice.map(s => s.id),
            });
            i += groupSize; n++;
        }
        return result;
    }, [groups, students, groupSize]);

    const handleGenerate = async () => {
        const effectiveGroups = buildGroups();
        if (effectiveGroups.length === 0) {
            showToast('Nessun gruppo o studente disponibile.', 'error');
            return;
        }
        setIsGenerating(true);
        try {
            const result = await GeminiService.generateAssignmentPlan(
                effectiveGroups, materials, students, blockObjective, systemInstruction
            );
            onSaveAssignments(result);
            showToast('Piano consegne generato!', 'success');
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Errore durante la generazione.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const buildDistributionText = (): string => {
        if (assignments.length === 0) return '';
        return assignments.map(a => {
            const channel = a.distributionChannel ? LESSON_ASSIGNMENT_CHANNEL_LABELS[a.distributionChannel] : '—';
            const mats = a.materialIds
                .map(id => materialMap.get(id)?.title ?? id)
                .map(t => `    • ${t}`)
                .join('\n');
            return `${a.groupLabel} → ${channel}\n${mats || '    • (nessun materiale specifico)'}`;
        }).join('\n\n');
    };

    const handleCopyPlan = () => {
        const text = buildDistributionText();
        navigator.clipboard.writeText(text).then(() => {
            setCopiedPlan(true);
            setTimeout(() => setCopiedPlan(false), 2000);
        });
    };

    const hasGroups = groups.length > 0;

    return (
        <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
            <button
                onClick={() => setIsOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                aria-expanded={isOpen}
            >
                <span className="text-sm font-medium text-gray-300 flex items-center gap-2">
                    <SparklesIcon className="h-4 w-4 text-indigo-400" />
                    Piano Consegne
                    {assignments.length > 0 && (
                        <span className="text-[10px] font-mono text-gray-500 bg-gray-700/60 px-1.5 py-0.5 rounded">
                            {assignments.length}
                        </span>
                    )}
                </span>
                <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="px-4 pb-4 border-t border-gray-700/40 space-y-4 pt-3">

                    {students.length === 0 ? (
                        <p className="text-sm text-gray-600">Nessuno studente nel registro.</p>
                    ) : (
                        <>
                            {/* Dimensione gruppi — solo se non ci sono gruppi pre-esistenti */}
                            {!hasGroups && (
                                <div>
                                    <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">
                                        Dimensione gruppi
                                    </label>
                                    <div className="flex gap-2">
                                        {[1, 2, 3, 4].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => setGroupSize(n)}
                                                className={`w-9 h-9 rounded-lg text-sm font-semibold border transition-colors ${
                                                    groupSize === n
                                                        ? 'bg-indigo-600/80 border-indigo-500 text-white'
                                                        : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white'
                                                }`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {hasGroups && (
                                <p className="text-[10px] font-mono text-gray-500">
                                    Usando i {groups.length} gruppi esistenti per questo blocco.
                                </p>
                            )}

                            <button
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-400 border border-indigo-500/25 rounded-lg hover:bg-indigo-500/10 hover:border-indigo-400/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGenerating
                                    ? <><span className="h-3.5 w-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />Generazione...</>
                                    : <><SparklesIcon className="h-3.5 w-3.5" />Crea gruppi e assegna materiali</>
                                }
                            </button>

                            {/* Schede assegnazione */}
                            {assignments.length > 0 && (
                                <div className="space-y-3">
                                    {assignments.map(a => {
                                        const mats = a.materialIds.map(id => materialMap.get(id)).filter(Boolean) as LessonMaterial[];
                                        return (
                                            <div key={a.id} className="bg-gray-900/60 rounded-lg border border-gray-700/50 p-3 space-y-2">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-xs font-semibold text-white">
                                                        {a.isIndividual ? '● ' : '◆ '}{a.groupLabel}
                                                    </span>
                                                </div>

                                                {/* Materiali assegnati */}
                                                {mats.length > 0 ? (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {mats.map(m => (
                                                            <span key={m.id} className="flex items-center gap-1 text-[10px] font-mono text-gray-400 bg-gray-800/60 px-1.5 py-0.5 rounded">
                                                                <span className="text-gray-600">{MATERIAL_TYPE_LABELS[m.type]}</span>
                                                                {m.title.slice(0, 30)}
                                                            </span>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <p className="text-[11px] text-gray-600 italic">Nessun materiale specifico assegnato.</p>
                                                )}

                                                {/* Rationale */}
                                                <p className="text-[11px] text-gray-500 italic">"{a.rationale}"</p>

                                                {/* Canale distribuzione */}
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-mono text-gray-600 uppercase tracking-widest">Distribuisci via:</span>
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {CHANNELS.map(ch => {
                                                            const isActive = a.distributionChannel === ch;
                                                            return (
                                                                <button
                                                                    key={ch}
                                                                    onClick={() => onUpdateChannel(a.id, ch)}
                                                                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md transition-colors ${
                                                                        isActive
                                                                            ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                                                                            : 'text-gray-500 hover:text-gray-300'
                                                                    }`}
                                                                >
                                                                    {LESSON_ASSIGNMENT_CHANNEL_LABELS[ch]}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                    {a.distributionChannel === 'classroom' && (
                                                        <div className="mt-1">
                                                            {classroomUrl ? (
                                                                <a
                                                                    href={classroomUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-sky-400/70 text-[11px] hover:text-sky-400 transition-colors"
                                                                >
                                                                    Apri Classroom →
                                                                </a>
                                                            ) : (
                                                                <p className="text-gray-500 text-[10px]">
                                                                    Aggiungi URL Classroom in questa pagina per attivare il link diretto.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {/* Piano di distribuzione riepilogativo */}
                                    <div className="border-t border-gray-700/30 pt-3">
                                        <button
                                            onClick={() => setIsDistributionPlanOpen(o => !o)}
                                            className="w-full flex items-center justify-between text-left"
                                        >
                                            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">Piano Lezione</span>
                                            <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-600 transition-transform ${isDistributionPlanOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isDistributionPlanOpen && (
                                            <div className="mt-2 space-y-2">
                                                <button
                                                    onClick={handleCopyPlan}
                                                    className={`text-[10px] font-mono px-2 py-0.5 rounded-md transition-colors ${
                                                        copiedPlan
                                                            ? 'text-emerald-400 bg-emerald-500/10'
                                                            : 'text-gray-500 hover:text-gray-300 border border-gray-700/50'
                                                    }`}
                                                >
                                                    {copiedPlan ? '✓ Copiato' : 'Copia testo'}
                                                </button>
                                                <pre className="text-[11px] text-gray-400 bg-gray-900/50 rounded-lg p-3 whitespace-pre-wrap font-mono leading-relaxed">
                                                    {buildDistributionText()}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default AssignmentPlanSection;
