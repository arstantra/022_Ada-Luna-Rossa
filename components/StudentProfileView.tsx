import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import type { Student, Evaluation, Conversation, Activity, ActivityObservation, LessonType } from '../types';
import { XIcon, UserIcon, ChevronDownIcon, CheckCircleIcon, XCircleIcon, SparklesIcon, ClipboardDocumentCheckIcon } from './Icons';
import * as GeminiService from '../services/gemini';
import * as db from '../services/db';
import MarkdownRenderer from './MarkdownRenderer';
import DidacticRadarChart, { type RadarDataPoint } from './DidacticRadarChart';


interface StudentProfileViewProps {
    student: Student;
    onClose: () => void;
    onUpdateNotes: (studentId: string, notes: string) => void;
    onUpdateSummary: (studentId: string, summary: { content: string; date: string; }) => void;
    onOpenImportModal: (student: Student) => void;
    conversations?: Conversation[];
}

interface LogbookEntry extends Evaluation {
    id: string; // Use date as a unique ID for rendering
}

interface GroupedLogbook {
    [weekNumber: number]: {
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
                                ? <CheckCircleIcon className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" /> 
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

const StudentProfileView: React.FC<StudentProfileViewProps> = ({ student, onClose, onUpdateNotes, onUpdateSummary, onOpenImportModal, conversations = [] }) => {
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
                student.evaluations || []
            );
            onUpdateSummary(student.id, {
                content: summaryContent,
                date: new Date().toISOString(),
            });
        } catch (error) {
            console.error("Failed to generate student summary", error);
            // In a real app, you'd show a toast notification here.
        } finally {
            setIsSummarizing(false);
        }
    };

    const logbookData = useMemo<GroupedLogbook>(() => {
        return student.evaluations
            .filter((e): e is LogbookEntry => typeof e.weekNumber === 'number')
            .reduce((acc, entry) => {
                const week = entry.weekNumber!;
                if (!acc[week]) {
                    acc[week] = { blocks: [] };
                }
                acc[week].blocks.push({ ...entry, id: entry.date });
                return acc;
            }, {} as GroupedLogbook);
    }, [student.evaluations]);

    const sortedWeeks = useMemo(() => Object.keys(logbookData).sort((a, b) => parseInt(a) - parseInt(b)), [logbookData]);

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

    const sentimentScore = useMemo<number | null>(() => {
        const values: number[] = [];
        for (const v of Object.values(obsInsights)) {
            if (!v) continue;
            values.push(v.sentiment === 'positivo' ? 100 : v.sentiment === 'neutro' ? 50 : 0);
        }
        if (values.length === 0) return null;
        return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    }, [obsInsights]);

    const allAlerts = useMemo(() => {
        const result: { key: string; text: string; urgent: boolean }[] = [];
        for (const [actId, insights] of Object.entries(obsInsights)) {
            if (!insights) continue;
            insights.alerts.forEach((alert, i) => {
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
        } finally {
            setIsAnalyzingObs(false);
        }
    };

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
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-colors"
                                    >
                                        <ClipboardDocumentCheckIcon className="h-4 w-4"/>
                                        Importa Valutazione
                                    </button>
                                    <button 
                                        onClick={handleGenerateSummary} 
                                        disabled={isSummarizing}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-60"
                                    >
                                        <SparklesIcon className={`h-4 w-4 ${isSummarizing ? 'animate-pulse' : ''}`}/>
                                        {isSummarizing ? 'Analisi...' : (student.adaSummary ? 'Aggiorna' : 'Crea Sintesi')}
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={currentNotes}
                                onChange={(e) => setCurrentNotes(e.target.value)}
                                placeholder="Inserisci qui note non strutturate sulla studentessa (estratti PEI, osservazioni, stile di apprendimento...)"
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
                                        key={weekNum}
                                        weekNumber={parseInt(weekNum)}
                                        blocks={logbookData[parseInt(weekNum)].blocks}
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