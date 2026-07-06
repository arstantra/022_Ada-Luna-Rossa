import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import type { Student, Evaluation, Conversation, Activity, ActivityObservation, LessonType } from '../types';
import { XIcon, UserIcon, ChevronDownIcon, CheckCircleIcon, XCircleIcon, SparklesIcon, ClipboardDocumentCheckIcon } from './Icons';
import * as GeminiService from '../services/gemini';
import * as db from '../services/db';
import MarkdownRenderer from './MarkdownRenderer';
import DidacticRadarChart, { type RadarDataPoint } from './DidacticRadarChart';
import StudentDimensionRadar, { type StudentDimension } from './StudentDimensionRadar';

/** Converte una valutazione testuale in punteggio 0–100 (best effort, null se non interpretabile). */
const parseEvaluationScore = (value: string): number | null => {
    const v = value.trim().toLowerCase();
    const frac = v.match(/(\d+(?:[.,]\d+)?)\s*\/\s*(\d+)/);
    if (frac) {
        const num = parseFloat(frac[1].replace(',', '.'));
        const den = parseInt(frac[2], 10);
        if (den > 0) return Math.max(0, Math.min(100, Math.round((num / den) * 100)));
    }
    const plain = v.match(/^(\d+(?:[.,]\d+)?)$/);
    if (plain) {
        const n = parseFloat(plain[1].replace(',', '.'));
        if (n <= 10) return Math.max(0, Math.min(100, Math.round(n * 10)));
        if (n <= 100) return Math.round(n);
        return null;
    }
    if (/gravemente insufficiente/.test(v)) return 25;
    if (/insufficiente/.test(v)) return 40;
    if (/sufficiente/.test(v)) return 60;
    if (/discreto/.test(v)) return 68;
    if (/buono|bene/.test(v)) return 78;
    if (/distinto/.test(v)) return 88;
    if (/ottimo|eccellente/.test(v)) return 95;
    return null;
};


interface StudentProfileViewProps {
    student: Student;
    onClose: () => void;
    onUpdateNotes: (studentId: string, notes: string) => void;
    onUpdateSummary: (studentId: string, summary: { content: string; date: string; }) => void;
    onOpenImportModal: (student: Student) => void;
    conversations?: Conversation[];
    showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

interface LogbookEntry extends Evaluation {
    id: string; // Use date as a unique ID for rendering
}

interface GroupedLogbook {
    [weekNumber: string]: {
        blocks: LogbookEntry[];
    };
}

const LogbookAccordion: React.FC<{ weekNumber: number; blocks: LogbookEntry[] }> = memo(({ weekNumber, blocks }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-gray-700/50 rounded-lg">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-700 transition-colors"
            >
                <span className="font-semibold text-white">Settimana {weekNumber}</span>
                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="border-t border-gray-600/50 p-3 space-y-2">
                    {blocks.sort((a, b) => (a.blockIndex ?? 0) - (b.blockIndex ?? 0)).map(block => (
                         <div key={block.id} className="flex items-start gap-3 p-2 rounded-md bg-gray-800/50">
                            {block.value === 'Presente'
                                ? <CheckCircleIcon className="h-5 w-5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                : <XCircleIcon className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />}
                           <div>
                               <p className="font-medium text-gray-200">{block.notes}</p>
                               <p className="text-xs text-gray-400">
                                   {block.module}{block.pillar ? ` > ${block.pillar}`: ''}
                               </p>
                           </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

const StudentProfileView: React.FC<StudentProfileViewProps> = ({ student, onClose, onUpdateNotes, onUpdateSummary, onOpenImportModal, conversations = [], showToast }) => {
    const [currentNotes, setCurrentNotes] = useState(student.notes || '');
    const autosaveTimeoutRef = useRef<number | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);

    // ── Attività ────────────────────────────────────────────────────────────
    const [allActivities, setAllActivities] = useState<Activity[]>([]);
    const [newObsText, setNewObsText] = useState('');
    const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
    const [isAnalyzingObs, setIsAnalyzingObs] = useState(false);
    const [obsInsights, setObsInsights] = useState<Record<string, { sentiment: 'positivo' | 'neutro' | 'critico'; tags: string[]; alerts: string[]; summary: string } | null>>({});
    const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());

    useEffect(() => {
        db.getAllActivities().then(setAllActivities).catch(console.error);
    }, [student.id]);

    useEffect(() => {
        setCurrentNotes(student.notes || '');
    }, [student]);

    useEffect(() => {
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }
        autosaveTimeoutRef.current = window.setTimeout(() => {
            if (currentNotes !== student.notes) {
                onUpdateNotes(student.id, currentNotes);
            }
        }, 1500); // Autosave after 1.5 seconds of inactivity

        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
        };
    }, [currentNotes, student.id, student.notes, onUpdateNotes]);

    const handleGenerateSummary = async () => {
        setIsSummarizing(true);
        try {
            const summaryContent = await GeminiService.generateStudentSummary(
                student.name,
                student.notes || '',
                student.evaluations ?? []
            );
            onUpdateSummary(student.id, {
                content: summaryContent,
                date: new Date().toISOString(),
            });
        } catch (error) {
            console.error("Failed to generate student summary", error);
            showToast("Errore nella generazione della sintesi. Riprova.", 'error');
        } finally {
            setIsSummarizing(false);
        }
    };

    const logbookData = useMemo<GroupedLogbook>(() => {
        return (student.evaluations ?? [])
            .filter((e): e is LogbookEntry => typeof e.weekNumber === 'number')
            .reduce((acc, entry) => {
                const week = String(entry.weekNumber!);
                if (!acc[week]) {
                    acc[week] = { blocks: [] };
                }
                acc[week].blocks.push({ ...entry, id: `${entry.date}-${acc[week].blocks.length}` });
                return acc;
            }, {} as GroupedLogbook);
    }, [student.evaluations]);

    const sortedWeeks = useMemo(() => Object.keys(logbookData).sort((a, b) => parseInt(a, 10) - parseInt(b, 10)), [logbookData]);

    // ── Data from archived blocks (Step 8) ───────────────────────────────────

    const presenzaStats = useMemo(() => {
        let total = 0, present = 0, late = 0, absent = 0;
        const absenceDates: string[] = [];
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            for (const [i, block] of convo.weekPlan.blocks.entries()) {
                if (block.lessonState !== 'archiviata') continue;
                const presentIds = block.presentStudentIds ?? [];
                const lateIds = block.lateStudentIds ?? [];
                // Salta blocchi senza presenze registrate (arrays vuoti = nessun dato di presenza)
            if (presentIds.length === 0 && lateIds.length === 0) continue;
                total++;
                if (lateIds.includes(student.id)) { present++; late++; }
                else if (presentIds.includes(student.id)) { present++; }
                else {
                    absent++;
                    absenceDates.push(`S${convo.weekPlan.weekNumber} · ${block.day || `BL${i + 1}`}`);
                }
            }
        }
        return { total, present, late, absent, absenceDates, pct: total > 0 ? Math.round((present / total) * 100) : null };
    }, [conversations, student.id]);

    const lessonEvaluations = useMemo(() => {
        const evals: { weekNumber: number; day: string; value: string; type: string; notes?: string; date: string }[] = [];
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            for (const block of convo.weekPlan.blocks) {
                if (!block.lessonEvaluations) continue;
                for (const ev of block.lessonEvaluations) {
                    if (ev.studentId === student.id) {
                        evals.push({
                            weekNumber: convo.weekPlan.weekNumber,
                            day: block.day || '',
                            value: ev.value,
                            type: ev.type,
                            notes: ev.notes,
                            date: ev.date,
                        });
                    }
                }
            }
        }
        return evals.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [conversations, student.id]);

    const adaSignals = useMemo(() => {
        const signals: { weekNumber: number; day: string; signal: string; type: 'positivo' | 'attenzione'; analyzedAt: string }[] = [];
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            for (const block of convo.weekPlan.blocks) {
                const analysis = block.lessonNoteAnalysis;
                if (!analysis) continue;
                for (const sig of analysis.studentSignals) {
                    if (sig.studentId === student.id) {
                        signals.push({
                            weekNumber: convo.weekPlan.weekNumber,
                            day: block.day || '',
                            signal: sig.signal,
                            type: sig.type,
                            analyzedAt: analysis.analyzedAt,
                        });
                    }
                }
            }
        }
        return signals.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
    }, [conversations, student.id]);

    const studentActivities = useMemo(() => {
        return allActivities.filter(a =>
            a.submissionRecords?.some(r => r.refType === 'student' && r.refId === student.id) ||
            a.studentOverrides?.some(o => o.studentId === student.id)
        );
    }, [allActivities, student.id]);

    const radarActualData = useMemo<RadarDataPoint[]>(() => {
        const counts = new Map<LessonType, number>();
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            for (const block of convo.weekPlan.blocks) {
                if (block.lessonState !== 'archiviata') continue;
                if (!(block.presentStudentIds ?? []).includes(student.id)) continue;
                if (!block.tipologia) continue;
                counts.set(block.tipologia, (counts.get(block.tipologia) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries()).map(([tipologia, count]) => ({ tipologia, count }));
    }, [conversations, student.id]);

    const radarIdealData = useMemo<RadarDataPoint[]>(() => {
        const counts = new Map<LessonType, number>();
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            for (const block of convo.weekPlan.blocks) {
                if (!block.tipologia) continue;
                counts.set(block.tipologia, (counts.get(block.tipologia) ?? 0) + 1);
            }
        }
        return Array.from(counts.entries()).map(([tipologia, count]) => ({ tipologia, count }));
    }, [conversations]);

    const presenzaByWeek = useMemo(() => {
        const weekMap = new Map<number, { present: number; total: number }>();
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            for (const block of convo.weekPlan.blocks) {
                if (block.lessonState !== 'archiviata') continue;
                const presentIds = block.presentStudentIds ?? [];
                const lateIds = block.lateStudentIds ?? [];
                if (presentIds.length === 0 && lateIds.length === 0) continue;
                const wn = convo.weekPlan.weekNumber;
                if (!weekMap.has(wn)) weekMap.set(wn, { present: 0, total: 0 });
                const entry = weekMap.get(wn)!;
                entry.total++;
                if (presentIds.includes(student.id)) entry.present++;
            }
        }
        return Array.from(weekMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([week, { present, total }]) => ({ week, pct: total > 0 ? Math.round((present / total) * 100) : 0 }));
    }, [conversations, student.id]);

    // ── Lavori di gruppo dello studente (zoom inverso: studente → gruppi) ────
    const studentGroupWorks = useMemo(() => {
        const works: { weekNumber: number; day: string; groupName: string; size: number; isComplete: boolean; completionDate?: string; objective?: string }[] = [];
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            for (const [i, block] of convo.weekPlan.blocks.entries()) {
                const groups = block.allocations?.data.groups ?? [];
                for (const g of groups) {
                    if (!g.studentIds.includes(student.id)) continue;
                    works.push({
                        weekNumber: convo.weekPlan.weekNumber,
                        day: block.day || `BL${i + 1}`,
                        groupName: g.name,
                        size: g.studentIds.length,
                        isComplete: !!g.isComplete,
                        completionDate: g.completionDate,
                        objective: block.objective,
                    });
                }
            }
        }
        return works.sort((a, b) => b.weekNumber - a.weekNumber);
    }, [conversations, student.id]);

    // ── Dimensioni operative (radar studente) ────────────────────────────────
    const operationalDimensions = useMemo<StudentDimension[]>(() => {
        // Partecipazione: % presenze sulle lezioni archiviate
        const partecipazione = presenzaStats.total > 0 ? presenzaStats.pct : null;
        // Puntualità: quota di presenze senza ritardo
        const puntualita = presenzaStats.present > 0
            ? Math.round(((presenzaStats.present - presenzaStats.late) / presenzaStats.present) * 100)
            : null;
        // Completamento: % lavori di gruppo conclusi
        const completamento = studentGroupWorks.length > 0
            ? Math.round((studentGroupWorks.filter(w => w.isComplete).length / studentGroupWorks.length) * 100)
            : null;
        // Valutazioni: media dei punteggi interpretabili
        const scores = lessonEvaluations
            .map(ev => parseEvaluationScore(ev.value))
            .filter((s): s is number => s !== null);
        const valutazioni = scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null;
        // Segnali Ada: quota di segnali positivi
        const segnali = adaSignals.length > 0
            ? Math.round((adaSignals.filter(s => s.type === 'positivo').length / adaSignals.length) * 100)
            : null;
        return [
            { key: 'partecipazione', label: 'Partecipazione', axisLabel: 'Part.', value: partecipazione, detail: presenzaStats.total > 0 ? `${presenzaStats.present}/${presenzaStats.total} lezioni` : undefined },
            { key: 'puntualita', label: 'Puntualità', axisLabel: 'Punt.', value: puntualita, detail: presenzaStats.late > 0 ? `${presenzaStats.late} ritardi` : undefined },
            { key: 'completamento', label: 'Completamento', axisLabel: 'Compl.', value: completamento, detail: studentGroupWorks.length > 0 ? `${studentGroupWorks.filter(w => w.isComplete).length}/${studentGroupWorks.length} lavori` : undefined },
            { key: 'valutazioni', label: 'Valutazioni', axisLabel: 'Valut.', value: valutazioni, detail: scores.length > 0 ? `${scores.length} valutazioni` : undefined },
            { key: 'segnali', label: 'Segnali Ada', axisLabel: 'Segn.', value: segnali, detail: adaSignals.length > 0 ? `${adaSignals.length} segnali` : undefined },
        ];
    }, [presenzaStats, studentGroupWorks, lessonEvaluations, adaSignals]);

    const sentimentScore = useMemo<number | null>(() => {
        const values: number[] = [];
        for (const v of Object.values(obsInsights)) {
            if (!v) continue;
            const sv = v as { sentiment: 'positivo' | 'neutro' | 'critico' };
            values.push(sv.sentiment === 'positivo' ? 100 : sv.sentiment === 'neutro' ? 50 : 0);
        }
        if (values.length === 0) return null;
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }, [obsInsights]);

    const allAlerts = useMemo(() => {
        const result: { key: string; text: string; urgent: boolean }[] = [];
        for (const [actId, insights] of Object.entries(obsInsights)) {
            if (!insights) continue;
            const typedInsights = insights as { alerts: string[] };
            typedInsights.alerts.forEach((alert, i) => {
                result.push({
                    key: `${actId}-${i}`,
                    text: alert,
                    urgent: /critico|urgente/i.test(alert),
                });
            });
        }
        return result;
    }, [obsInsights]);

    const handleAddObservation = async () => {
        if (!selectedActivityId || !newObsText.trim()) return;
        const activity = allActivities.find(a => a.id === selectedActivityId);
        if (!activity) return;
        const obs: ActivityObservation = {
            id: crypto.randomUUID(),
            timestamp: new Date().toISOString(),
            text: newObsText.trim(),
            refId: student.id,
            refType: 'student',
        };
        const updated: Activity = {
            ...activity,
            observations: [...(activity.observations ?? []), obs],
            updatedAt: new Date().toISOString(),
        };
        await db.saveActivity(updated);
        setAllActivities(prev => prev.map(a => a.id === selectedActivityId ? updated : a));
        setNewObsText('');
    };

    const handleAnalyzeObservations = async (activityId: string) => {
        const activity = allActivities.find(a => a.id === activityId);
        if (!activity) return;
        const obs = (activity.observations ?? []).filter(o => o.refId === student.id && o.refType === 'student');
        setIsAnalyzingObs(true);
        try {
            const insights = await GeminiService.generateActivityObservationInsights(obs, student.name, activity.title);
            setObsInsights(prev => ({ ...prev, [activityId]: insights }));
        } catch (err) {
            console.error(err);
            showToast("Errore nell'analisi delle osservazioni.", 'error');
        } finally {
            setIsAnalyzingObs(false);
        }
    };

    if (!student) return null; // guard difensivo — non dovrebbe mai arrivare qui

    return (
        <main className="flex-1 flex flex-col bg-gray-800 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-3.5 pl-6 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <UserIcon className="h-6 w-6 text-gray-300" />
                    <h2 className="text-lg font-semibold truncate">Scheda Personale: {student.name}</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" aria-label="Chiudi scheda">
                    <XIcon className="h-5 w-5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT COLUMN */}
                    <div className="flex flex-col gap-8">
                        {/* Notes Section */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xl font-bold text-white">Note e Osservazioni</h3>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => onOpenImportModal(student)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-sky-400/70 border border-sky-500/20 rounded-md hover:bg-sky-500/15 transition-colors"
                                    >
                                        <ClipboardDocumentCheckIcon className="h-4 w-4"/>
                                        Importa Valutazione
                                    </button>
                                    <button
                                        onClick={handleGenerateSummary}
                                        disabled={isSummarizing}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-50"
                                    >
                                        <SparklesIcon className={`h-4 w-4 ${isSummarizing ? 'animate-pulse' : ''}`}/>
                                        {isSummarizing ? 'Analisi...' : (student.adaSummary ? 'Aggiorna' : 'Crea Sintesi')}
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={currentNotes}
                                onChange={(e) => setCurrentNotes(e.target.value)}
                                placeholder="Inserisci note non strutturate sullo studente: stile di apprendimento, estratti PEI/DSA, osservazioni..."
                                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-200 resize-none min-h-[250px]"
                            />
                            <p className="text-xs text-right text-gray-400 mt-2">Le note vengono salvate automaticamente.</p>
                        </div>
                        
                        {/* Ada Summary Section */}
                        {isSummarizing && !student.adaSummary && (
                             <div className="bg-gray-700/30 p-4 rounded-lg border border-purple-500/30 flex items-center justify-center h-48">
                                <p className="text-purple-300 flex items-center gap-2"><SparklesIcon className="h-5 w-5 animate-pulse" /> Sto generando la sintesi...</p>
                            </div>
                        )}
                        {student.adaSummary && (
                            <div className="bg-gray-700/30 p-4 rounded-lg border border-purple-500/30 animate-fade-in-down">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-purple-300 flex items-center gap-2">
                                        <SparklesIcon className="h-5 w-5"/>
                                        Sintesi Analitica di Ada
                                    </h4>
                                    <p className="text-xs text-gray-400">
                                        Analisi del {new Date(student.adaSummary.date).toLocaleDateString('it-IT')}
                                    </p>
                                </div>
                                <MarkdownRenderer content={student.adaSummary.content} />
                            </div>
                        )}
                    </div>
                    {/* Logbook Section */}
                    <div>
                        <h3 className="text-xl font-bold text-white mb-3">Diario di Bordo Individuale</h3>
                        <div className="space-y-3">
                            {sortedWeeks.length > 0 ? (
                                sortedWeeks.map(weekNum => (
                                    <LogbookAccordion
                                        key={`week-${weekNum}`}
                                        weekNumber={parseInt(weekNum, 10)}
                                        blocks={logbookData[weekNum].blocks}
                                    />
                                ))
                            ) : (
                                <div className="text-center p-8 bg-gray-700/30 rounded-lg">
                                    <p className="text-gray-400">Nessuna attività registrata nel diario di bordo.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Sezioni consuntive (Step 8) ──────────────────────────── */}
                <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

                    {/* Presenze */}
                    <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/40">
                        <h3 className="text-sm font-semibold text-white mb-3">Presenze</h3>
                        {presenzaStats.total === 0 ? (
                            <p className="text-xs text-gray-500">Nessuna lezione archiviata con presenze registrate.</p>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold text-white">{presenzaStats.pct}%</span>
                                    <span className="text-xs text-gray-400">{presenzaStats.present}/{presenzaStats.total} lezioni</span>
                                </div>
                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${presenzaStats.pct! >= 80 ? 'bg-emerald-500' : presenzaStats.pct! >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                                        style={{ width: `${presenzaStats.pct}%` }}
                                    />
                                </div>
                                <div className="flex gap-3 text-xs text-gray-400">
                                    <span className="text-emerald-400">{presenzaStats.present - presenzaStats.late} P</span>
                                    {presenzaStats.late > 0 && <span className="text-amber-400">{presenzaStats.late} R</span>}
                                    {presenzaStats.absent > 0 && <span className="text-red-400">{presenzaStats.absent} A</span>}
                                </div>
                                {presenzaStats.absenceDates.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Assenze</p>
                                        <ul className="space-y-0.5">
                                            {presenzaStats.absenceDates.map((d, i) => (
                                                <li key={i} className="text-xs text-red-400/80">{d}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Valutazioni in aula */}
                    <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/40">
                        <h3 className="text-sm font-semibold text-white mb-3">Valutazioni in Aula</h3>
                        {lessonEvaluations.length === 0 ? (
                            <p className="text-xs text-gray-500">Nessuna valutazione inserita durante le lezioni.</p>
                        ) : (
                            <ul className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                {lessonEvaluations.map((ev, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs">
                                        <span className="flex-shrink-0 mt-0.5 font-mono text-gray-500">S{ev.weekNumber}</span>
                                        <div>
                                            <span className="text-white font-semibold">{ev.value}</span>
                                            <span className="text-gray-500 ml-1">({ev.type})</span>
                                            {ev.notes && <p className="text-gray-400 text-[11px] mt-0.5">{ev.notes}</p>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {/* Segnali Ada */}
                    <div className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/40">
                        <h3 className="text-sm font-semibold text-white mb-3">Segnali Ada</h3>
                        {adaSignals.length === 0 ? (
                            <p className="text-xs text-gray-500">Nessun segnale Ada registrato per questo studente.</p>
                        ) : (
                            <ul className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                {adaSignals.map((sig, i) => (
                                    <li key={i} className={`flex items-start gap-2 text-xs px-2 py-1.5 rounded-md ${sig.type === 'positivo' ? 'bg-emerald-900/20 border border-emerald-700/30' : 'bg-amber-900/20 border border-amber-700/30'}`}>
                                        <span className="flex-shrink-0 mt-0.5">{sig.type === 'positivo' ? '✓' : '⚠'}</span>
                                        <div>
                                            <span className={`font-mono text-[9px] uppercase tracking-wider ${sig.type === 'positivo' ? 'text-emerald-400' : 'text-amber-400'}`}>S{sig.weekNumber} · {sig.day}</span>
                                            <p className={`mt-0.5 ${sig.type === 'positivo' ? 'text-emerald-200' : 'text-amber-200'}`}>{sig.signal}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                {/* ── Cruscotto Qualitativo ────────────────────────────── */}
                <div className="mt-8">
                    <p className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-400/80 mb-4">Cruscotto Qualitativo</p>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                        {/* Cella 0 — Radar dimensioni operative */}
                        <div className="bg-gray-800/55 border border-gray-600/40 rounded-xl p-4">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-3">Radar Operativo</p>
                            <StudentDimensionRadar dimensions={operationalDimensions} />
                        </div>

                        {/* Cella 0b — Lavori di Gruppo (zoom studente → gruppi) */}
                        <div className="bg-gray-800/55 border border-gray-600/40 rounded-xl p-4">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-3">Lavori di Gruppo</p>
                            {studentGroupWorks.length === 0 ? (
                                <p className="text-xs text-gray-500">Nessun lavoro di gruppo registrato per questo studente.</p>
                            ) : (
                                <ul className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar pr-1">
                                    {studentGroupWorks.map((w, i) => (
                                        <li key={i} className={`flex items-start gap-2 text-xs px-2.5 py-2 rounded-lg border ${w.isComplete ? 'bg-emerald-900/15 border-emerald-700/25' : 'bg-gray-900/40 border-gray-700/40'}`}>
                                            <span className={`flex-shrink-0 mt-0.5 w-2 h-2 rounded-full ${w.isComplete ? 'bg-emerald-500' : 'bg-slate-500'}`} />
                                            <div className="flex-1 min-w-0">
                                                <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500">
                                                    S{w.weekNumber} · {w.day} · {w.groupName}
                                                    {w.size === 1 && <span className="text-indigo-400/80 ml-1.5">individuale</span>}
                                                </span>
                                                {w.objective && <p className="text-gray-300 mt-0.5 truncate" title={w.objective}>{w.objective}</p>}
                                                <p className={`text-[10px] mt-0.5 ${w.isComplete ? 'text-emerald-400/80' : 'text-gray-500'}`}>
                                                    {w.isComplete
                                                        ? `Concluso${w.completionDate ? ` il ${new Date(w.completionDate).toLocaleDateString('it-IT')}` : ''}`
                                                        : 'In corso'}
                                                </p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        {/* Cella 1 — Radar competenze */}
                        <div className="bg-gray-800/55 border border-gray-600/40 rounded-xl p-4">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-3">Radar Competenze</p>
                            {radarActualData.length === 0 ? (
                                <p className="text-xs text-gray-500">Nessuna lezione archiviata con presenza registrata.</p>
                            ) : (
                                <DidacticRadarChart data={radarActualData} idealData={radarIdealData} />
                            )}
                        </div>

                        {/* Cella 2 — Trend partecipazione */}
                        <div className="bg-gray-800/55 border border-gray-600/40 rounded-xl p-4">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-3">Trend Partecipazione</p>
                            {presenzaByWeek.length < 3 ? (
                                <p className="text-xs text-gray-500">Dati insufficienti (min. 3 settimane con presenze registrate).</p>
                            ) : (() => {
                                const n = presenzaByWeek.length;
                                const W = 200, H = 62, padX = 20, padY = 8;
                                const drawW = W - 2 * padX, drawH = H - padY - 12;
                                const pts = presenzaByWeek.map((d, i) => ({
                                    x: padX + (i / (n - 1)) * drawW,
                                    y: padY + (1 - d.pct / 100) * drawH,
                                }));
                                const ptsArr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`);
                                const polyline = ptsArr.join(' ');
                                const area = [
                                    `${pts[0].x.toFixed(1)},${(padY + drawH).toFixed(1)}`,
                                    ...ptsArr,
                                    `${pts[n - 1].x.toFixed(1)},${(padY + drawH).toFixed(1)}`,
                                ].join(' ');
                                const diff = presenzaByWeek[n - 1].pct - presenzaByWeek[0].pct;
                                const trend = diff > 10 ? 'up' : diff < -10 ? 'down' : 'stable';
                                const color = trend === 'up' ? '#10b981' : trend === 'down' ? '#f43f5e' : '#f59e0b';
                                const trendLabel = trend === 'up' ? '↑ in crescita' : trend === 'down' ? '↓ in calo' : '→ stabile';
                                const trendCls = trend === 'up' ? 'text-emerald-400' : trend === 'down' ? 'text-rose-400' : 'text-amber-400';
                                return (
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs text-gray-400">% presenze per settimana</span>
                                            <span className={`text-[10px] font-mono ${trendCls}`}>{trendLabel}</span>
                                        </div>
                                        <svg width="100%" viewBox={`0 0 ${W} ${H}`}>
                                            {[0, 50, 100].map(pct => {
                                                const y = padY + (1 - pct / 100) * drawH;
                                                return (
                                                    <g key={pct}>
                                                        <line x1={padX} y1={y} x2={W - padX} y2={y}
                                                            stroke="rgba(255,255,255,0.05)" strokeWidth="0.7" />
                                                        <text x={padX - 3} y={y} textAnchor="end"
                                                            dominantBaseline="middle" fontSize="4.5"
                                                            fill="rgba(156,163,175,0.5)" fontFamily="monospace">
                                                            {pct}%
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                            <polygon points={area} fill={color} fillOpacity="0.08" />
                                            <polyline points={polyline} fill="none" stroke={color}
                                                strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
                                            {pts.map((p, i) => (
                                                <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} />
                                            ))}
                                            {presenzaByWeek.map((d, i) => (
                                                <text key={i} x={pts[i].x} y={H - 1} textAnchor="middle"
                                                    fontSize="4" fill="rgba(156,163,175,0.4)" fontFamily="monospace">
                                                    S{d.week}
                                                </text>
                                            ))}
                                        </svg>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Cella 3 — Sentiment attività */}
                        <div className="bg-gray-800/55 border border-gray-600/40 rounded-xl p-4">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-3">Sentiment Attività</p>
                            {(() => {
                                const cx = 100, cy = 88, R = 60;
                                const p33x = cx + R * Math.cos(Math.PI * 0.67);
                                const p33y = cy - R * Math.sin(Math.PI * 0.67);
                                const p66x = cx + R * Math.cos(Math.PI * 0.34);
                                const p66y = cy - R * Math.sin(Math.PI * 0.34);
                                const roseArc = `M 40 88 A 60 60 0 0 1 ${p33x.toFixed(1)} ${p33y.toFixed(1)}`;
                                const amberArc = `M ${p33x.toFixed(1)} ${p33y.toFixed(1)} A 60 60 0 0 1 ${p66x.toFixed(1)} ${p66y.toFixed(1)}`;
                                const emeraldArc = `M ${p66x.toFixed(1)} ${p66y.toFixed(1)} A 60 60 0 0 1 160 88`;
                                let nx = cx, ny = cy - R * 0.78;
                                if (sentimentScore !== null) {
                                    const angle = Math.PI * (1 - sentimentScore / 100);
                                    nx = cx + R * 0.78 * Math.cos(angle);
                                    ny = cy - R * 0.78 * Math.sin(angle);
                                }
                                const analysisCount = Object.values(obsInsights).filter(v => v !== null).length;
                                return (
                                    <div>
                                        <svg width="100%" viewBox="0 0 200 100">
                                            <path d="M 40 88 A 60 60 0 0 1 160 88" fill="none"
                                                stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                                            <path d={roseArc} fill="none" stroke="#f43f5e"
                                                strokeWidth="10" strokeOpacity="0.65" />
                                            <path d={amberArc} fill="none" stroke="#f59e0b"
                                                strokeWidth="10" strokeOpacity="0.65" />
                                            <path d={emeraldArc} fill="none" stroke="#10b981"
                                                strokeWidth="10" strokeOpacity="0.65" />
                                            {sentimentScore !== null && (
                                                <>
                                                    <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)}
                                                        stroke="white" strokeWidth="2" strokeLinecap="round" />
                                                    <circle cx={cx} cy={cy} r={4} fill="rgba(255,255,255,0.9)" />
                                                </>
                                            )}
                                            <text x={cx} y={72} textAnchor="middle" fontSize="16"
                                                fontWeight="700" fill="white" fontFamily="monospace">
                                                {sentimentScore !== null ? sentimentScore : '–'}
                                            </text>
                                            <text x={cx} y={83} textAnchor="middle" fontSize="6"
                                                fill="rgba(156,163,175,0.6)" fontFamily="monospace">
                                                {sentimentScore === null ? 'nessuna analisi'
                                                    : sentimentScore >= 66 ? 'positivo'
                                                    : sentimentScore >= 33 ? 'neutro'
                                                    : 'critico'}
                                            </text>
                                            <text x={36} y={97} textAnchor="middle" fontSize="5"
                                                fill="rgba(244,63,94,0.55)" fontFamily="monospace">critico</text>
                                            <text x={164} y={97} textAnchor="middle" fontSize="5"
                                                fill="rgba(16,185,129,0.55)" fontFamily="monospace">positivo</text>
                                        </svg>
                                        <p className="text-[10px] font-mono text-gray-600 text-center mt-1">
                                            {analysisCount === 0
                                                ? 'Esegui "Analizza con ADA" sulle attività per popolare il gauge'
                                                : `Basato su ${analysisCount} analisi Ada`}
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Cella 4 — Alert ADA */}
                        <div className="bg-gray-800/55 border border-gray-600/40 rounded-xl p-4">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-gray-500 mb-3">Alert ADA</p>
                            {(() => {
                                const visible = allAlerts.filter(a => !dismissedAlerts.has(a.key));
                                if (visible.length === 0) {
                                    return (
                                        <p className="text-xs text-gray-500">
                                            {allAlerts.length > 0
                                                ? 'Tutti gli alert sono stati ignorati.'
                                                : 'Nessun alert attivo. Esegui "Analizza con ADA" sulle attività per generarli.'}
                                        </p>
                                    );
                                }
                                return (
                                    <ul className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                                        {visible.map(alert => (
                                            <li key={alert.key} className={`flex items-start gap-2 text-xs px-2.5 py-2 rounded-lg border ${alert.urgent ? 'bg-red-900/15 border-red-700/30' : 'bg-amber-900/15 border-amber-700/30'}`}>
                                                <span className={`flex-shrink-0 mt-0.5 font-mono text-[10px] ${alert.urgent ? 'text-red-400' : 'text-amber-400'}`}>
                                                    {alert.urgent ? '!!' : '⚠'}
                                                </span>
                                                <div className="flex-1 min-w-0">
                                                    {alert.urgent && (
                                                        <span className="text-[9px] font-mono uppercase tracking-wider text-red-400 block mb-0.5">urgente</span>
                                                    )}
                                                    <p className={alert.urgent ? 'text-red-200' : 'text-amber-200'}>{alert.text}</p>
                                                </div>
                                                <button
                                                    onClick={() => setDismissedAlerts(prev => new Set([...prev, alert.key]))}
                                                    className="flex-shrink-0 text-[9px] font-mono text-gray-600 hover:text-gray-400 ml-1 mt-0.5"
                                                    title="Ignora alert"
                                                >
                                                    Ignora
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default React.memo(StudentProfileView);