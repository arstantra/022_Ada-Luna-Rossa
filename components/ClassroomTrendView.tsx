import React, { useState, useMemo, useEffect } from 'react';
import type { Conversation, Student, LessonType, Activity } from '../types';
import { UsersIcon, XIcon, ChevronDownIcon, HomeIcon } from './Icons';
import DidacticRadarChart, { type RadarDataPoint } from './DidacticRadarChart';
import { getAllActivities } from '../services/db';

interface ClassroomTrendViewProps {
    conversations: Conversation[];
    students: Student[];
    onClose: () => void;
    /** Drill-down: click su uno studente apre la sua scheda personale */
    onSelectStudent?: (student: Student) => void;
    /** Zoom intermedio: apre l'Archivio/Report Gruppi */
    onOpenGroups?: () => void;
}

const ClassroomTrendView: React.FC<ClassroomTrendViewProps> = ({ conversations, students, onClose, onSelectStudent, onOpenGroups }) => {
    // ── Consuntivo data ──────────────────────────────────────────────────────

    const archivedBlocks = useMemo(() => {
        const blocks: { convoId: string; blockIndex: number; weekNumber: number; day: string; presentIds: string[]; lateIds: string[]; tipologia?: LessonType; engagementLevel?: 'basso' | 'medio' | 'alto'; adaSignals: { studentId: string; signal: string; type: 'positivo' | 'attenzione' }[] }[] = [];
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            convo.weekPlan.blocks.forEach((block, i) => {
                if (block.lessonState !== 'archiviata') return;
                blocks.push({
                    convoId: convo.id,
                    blockIndex: i,
                    weekNumber: convo.weekPlan!.weekNumber,
                    day: block.day || `BL${i + 1}`,
                    presentIds: block.presentStudentIds ?? [],
                    lateIds: block.lateStudentIds ?? [],
                    tipologia: block.tipologia,
                    engagementLevel: block.lessonNoteAnalysis?.engagementLevel,
                    adaSignals: block.lessonNoteAnalysis?.studentSignals ?? [],
                });
            });
        }
        return blocks;
    }, [conversations]);

    const consuntivoRadarData = useMemo<RadarDataPoint[]>(() => {
        const counts = new Map<LessonType, number>();
        for (const b of archivedBlocks) {
            if (b.tipologia) counts.set(b.tipologia, (counts.get(b.tipologia) ?? 0) + 1);
        }
        return Array.from(counts.entries()).map(([tipologia, count]) => ({ tipologia, count }));
    }, [archivedBlocks]);

    const progettoRadarData = useMemo<RadarDataPoint[]>(() => {
        const counts = new Map<LessonType, number>();
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            for (const block of convo.weekPlan.blocks) {
                if (block.tipologia && block.status === 'normale') {
                    counts.set(block.tipologia, (counts.get(block.tipologia) ?? 0) + 1);
                }
            }
        }
        return Array.from(counts.entries()).map(([tipologia, count]) => ({ tipologia, count }));
    }, [conversations]);

    const attendanceAlerts = useMemo<string[]>(() => {
        const alerts: string[] = [];
        const studentNameById = new Map(students.map(s => [s.id, s.name]));
        // Consecutive absences per student
        const consecutiveAbsences = new Map<string, number>();
        for (const b of archivedBlocks) {
            const presentSet = new Set([...b.presentIds, ...b.lateIds]);
            for (const s of students) {
                if (!presentSet.has(s.id)) {
                    consecutiveAbsences.set(s.id, (consecutiveAbsences.get(s.id) ?? 0) + 1);
                } else {
                    consecutiveAbsences.set(s.id, 0);
                }
            }
        }
        for (const [sid, count] of consecutiveAbsences.entries()) {
            if (count >= 2) {
                alerts.push(`${studentNameById.get(sid) ?? sid}: ${count} assenze consecutive`);
            }
        }
        // Repeated Ada attention signals
        const signalCount = new Map<string, number>();
        for (const b of archivedBlocks) {
            for (const sig of b.adaSignals) {
                if (sig.type === 'attenzione') {
                    signalCount.set(sig.studentId, (signalCount.get(sig.studentId) ?? 0) + 1);
                }
            }
        }
        for (const [sid, count] of signalCount.entries()) {
            if (count >= 2) {
                alerts.push(`${studentNameById.get(sid) ?? sid}: ${count} segnali Ada di attenzione`);
            }
        }
        // Engagement drop
        const engagementSeries = archivedBlocks.filter(b => b.engagementLevel).map(b => b.engagementLevel!);
        if (engagementSeries.length >= 3) {
            const last3 = engagementSeries.slice(-3);
            if (last3.every(e => e === 'basso')) {
                alerts.push('Engagement basso nelle ultime 3 lezioni');
            }
        }
        return alerts;
    }, [archivedBlocks, students]);

    const [isConsuntivoOpen, setIsConsuntivoOpen] = useState(true);
    const [isProgVsRealOpen, setIsProgVsRealOpen] = useState(true);
    const [isSentimentOpen, setIsSentimentOpen] = useState(true);
    const [isDiarioOpen, setIsDiarioOpen] = useState(true);

    // ── KPI di sintesi aula ──────────────────────────────────────────────────
    const aulaKpi = useMemo(() => {
        const totalStudents = students.length;
        let attendanceSum = 0, attendanceCount = 0;
        const engScore = { basso: 0, medio: 50, alto: 100 } as const;
        let engSum = 0, engCount = 0;
        for (const b of archivedBlocks) {
            if (totalStudents > 0 && (b.presentIds.length > 0 || b.lateIds.length > 0)) {
                attendanceSum += new Set([...b.presentIds, ...b.lateIds]).size / totalStudents;
                attendanceCount++;
            }
            if (b.engagementLevel) { engSum += engScore[b.engagementLevel]; engCount++; }
        }
        return {
            lessons: archivedBlocks.length,
            avgAttendance: attendanceCount > 0 ? Math.round((attendanceSum / attendanceCount) * 100) : null,
            avgEngagement: engCount > 0 ? Math.round(engSum / engCount) : null,
        };
    }, [archivedBlocks, students]);

    // ── Diario qualitativo aula (note di classe e di gruppo dalle analisi Ada) ──
    const diarioEntries = useMemo(() => {
        const entries: { weekNumber: number; day: string; kind: 'classe' | 'gruppo'; text: string; analyzedAt: string }[] = [];
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            for (const [i, block] of convo.weekPlan.blocks.entries()) {
                const analysis = block.lessonNoteAnalysis;
                if (!analysis) continue;
                const weekNumber = convo.weekPlan.weekNumber;
                const day = block.day || `BL${i + 1}`;
                for (const note of analysis.classNotes ?? []) {
                    entries.push({ weekNumber, day, kind: 'classe', text: note, analyzedAt: analysis.analyzedAt });
                }
                for (const gn of analysis.groupNotes ?? []) {
                    entries.push({ weekNumber, day, kind: 'gruppo', text: gn.groupId ? `[${gn.groupId}] ${gn.note}` : gn.note, analyzedAt: analysis.analyzedAt });
                }
            }
        }
        return entries.sort((a, b) => new Date(b.analyzedAt).getTime() - new Date(a.analyzedAt).getTime());
    }, [conversations]);

    const [activities, setActivities] = useState<Activity[]>([]);
    useEffect(() => {
        getAllActivities().then(setActivities).catch(() => {});
    }, []);

    const activityStats = useMemo(() => {
        const planned = activities.length;
        const withDeadline = activities.filter(a => !!a.deadline).length;
        const withRubric = activities.filter(a => (a.rubric?.length ?? 0) > 0).length;
        const launched = activities.filter(a => a.status === 'lanciata' || a.status === 'in_corso').length;
        const delivered = activities.filter(a => a.status === 'consegnata').length;
        const expired = activities.filter(a => a.status === 'scaduta').length;
        const maxVal = Math.max(planned, 1);
        return { planned, withDeadline, withRubric, launched, delivered, expired, maxVal };
    }, [activities]);

    const studentQuadrantData = useMemo(() => {
        const totalBlocks = archivedBlocks.length;
        if (totalBlocks === 0) return [];
        const sentimentScore = { positivo: 1.0, neutro: 0.5, critico: 0.0 } as const;
        const result: { id: string; name: string; engagement: number; sentiment: number }[] = [];
        for (const student of students) {
            const presentCount = archivedBlocks.filter(b =>
                b.presentIds.includes(student.id) || b.lateIds.includes(student.id)
            ).length;
            const engagement = presentCount / totalBlocks;
            const scores: number[] = [];
            for (const act of activities) {
                for (const obs of act.observations ?? []) {
                    if (obs.refType === 'student' && obs.refId === student.id && obs.adaInsights?.sentiment) {
                        scores.push(sentimentScore[obs.adaInsights.sentiment]);
                    }
                }
            }
            if (scores.length === 0) continue;
            const sentiment = scores.reduce((a, b) => a + b, 0) / scores.length;
            result.push({ id: student.id, name: student.name, engagement, sentiment });
        }
        return result;
    }, [students, archivedBlocks, activities]);

    return (
        <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-6 pt-3.5 pb-2 border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="flex-shrink-0 p-1.5 text-gray-500 hover:text-purple-400 rounded-lg hover:bg-purple-500/10 transition-colors" title="Torna alla home">
                        <HomeIcon className="h-4 w-4" />
                    </button>
                    <UsersIcon className="h-5 w-5 text-gray-400" />
                    <h2 className="text-base font-display font-semibold text-white">Andamento Aula</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" aria-label="Chiudi">
                    <XIcon className="h-5 w-5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                {/* ── KPI di sintesi + zoom ─────────────────────────────────────── */}
                <div className="flex flex-wrap items-center gap-2.5 mb-6">
                    {[
                        { label: 'lezioni archiviate', value: String(aulaKpi.lessons) },
                        { label: 'presenza media', value: aulaKpi.avgAttendance !== null ? `${aulaKpi.avgAttendance}%` : '–' },
                        { label: 'engagement medio', value: aulaKpi.avgEngagement !== null ? `${aulaKpi.avgEngagement}/100` : '–' },
                        { label: 'alert attivi', value: String(attendanceAlerts.length) },
                    ].map(kpi => (
                        <div key={kpi.label} className="flex items-baseline gap-1.5 bg-gray-800/50 border border-gray-700/40 rounded-lg px-3 py-1.5">
                            <span className="text-lg font-display font-bold text-white tabular-nums">{kpi.value}</span>
                            <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">{kpi.label}</span>
                        </div>
                    ))}
                    {onOpenGroups && (
                        <button
                            onClick={onOpenGroups}
                            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 border border-gray-700/80 rounded-lg hover:border-gray-500 hover:text-white transition-all"
                            title="Zoom sul livello Gruppi: report delle attività di gruppo"
                        >
                            <UsersIcon className="h-3.5 w-3.5" />
                            Attività di Gruppo →
                        </button>
                    )}
                </div>

                {/* ── Sezione Monitoraggio Consuntivo ───────────────────────────── */}
                <div className="rounded-xl border border-gray-600/55 bg-gray-800/30 mb-6 overflow-hidden">
                    <button
                        onClick={() => setIsConsuntivoOpen(p => !p)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-700/30 transition-colors"
                    >
                        <span className="text-sm font-semibold text-white">Monitoraggio Consuntivo</span>
                        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isConsuntivoOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isConsuntivoOpen && (
                        <div className="border-t border-gray-700/50 p-5 space-y-5">
                            {archivedBlocks.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">Nessuna lezione archiviata. Archivia una lezione per vedere i dati consuntivi.</p>
                            ) : (
                                <div className="flex flex-col lg:flex-row gap-5">
                                    {/* Left: Heatmap + Engagement */}
                                    <div className="flex-1 min-w-0 space-y-4">
                                        {/* Heatmap presenze */}
                                        <div>
                                            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Presenze</p>
                                            <div className="overflow-x-auto custom-scrollbar pb-1">
                                                <table className="text-[10px] font-mono border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th className="text-left pr-3 text-gray-500 font-normal whitespace-nowrap py-1">Studente</th>
                                                            {archivedBlocks.slice(-12).map((b, i) => (
                                                                <th key={i} className="px-1 text-gray-500 font-normal whitespace-nowrap py-1 text-center">
                                                                    S{b.weekNumber}<br />{b.day.slice(0, 3)}
                                                                </th>
                                                            ))}
                                                            <th className="px-2 text-gray-400 font-semibold whitespace-nowrap py-1 text-center">%</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {students.map(s => {
                                                            const recentBlocks = archivedBlocks.slice(-12);
                                                            const presentCount = recentBlocks.filter(b => b.presentIds.includes(s.id) || b.lateIds.includes(s.id)).length;
                                                            return (
                                                                <tr key={s.id}>
                                                                    <td className="pr-3 whitespace-nowrap py-0.5 max-w-[120px] truncate">
                                                                        {onSelectStudent ? (
                                                                            <button onClick={() => onSelectStudent(s)} className="text-gray-400 hover:text-white hover:underline" title={`Apri la scheda di ${s.name}`}>{s.name}</button>
                                                                        ) : (
                                                                            <span className="text-gray-400">{s.name}</span>
                                                                        )}
                                                                    </td>
                                                                    {recentBlocks.map((b, i) => {
                                                                        const isLate = b.lateIds.includes(s.id);
                                                                        const isPresent = b.presentIds.includes(s.id);
                                                                        return (
                                                                            <td key={i} className="px-1 py-0.5 text-center">
                                                                                <span
                                                                                    title={isLate ? 'Ritardo' : isPresent ? 'Presente' : 'Assente'}
                                                                                    className={`inline-flex w-5 h-5 rounded-sm text-[9px] items-center justify-center ${isLate ? 'bg-amber-500/70 text-amber-100' : isPresent ? 'bg-emerald-600/70 text-emerald-100' : 'bg-red-800/50 text-red-300'}`}
                                                                                >
                                                                                    {isLate ? 'R' : isPresent ? 'P' : 'A'}
                                                                                </span>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                    <td className="px-2 py-0.5 text-center font-semibold text-gray-300">
                                                                        {recentBlocks.length > 0 ? Math.round((presentCount / recentBlocks.length) * 100) : 0}%
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                    <tfoot>
                                                        <tr>
                                                            <td className="pr-3 text-gray-500 text-[9px] pt-1">% presenti</td>
                                                            {archivedBlocks.slice(-12).map((b, i) => {
                                                                const total = students.length;
                                                                const present = total > 0 ? new Set([...b.presentIds, ...b.lateIds]).size : 0;
                                                                const pct = total > 0 ? Math.round((present / total) * 100) : 0;
                                                                return (
                                                                    <td key={i} className="px-1 pt-1 text-center font-semibold" style={{ color: pct >= 80 ? '#34d399' : pct >= 60 ? '#fbbf24' : '#f87171' }}>{pct}%</td>
                                                                );
                                                            })}
                                                            <td />
                                                        </tr>
                                                    </tfoot>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Engagement trend */}
                                        {archivedBlocks.some(b => b.engagementLevel) && (
                                            <div>
                                                <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Indice Engagement</p>
                                                <div className="flex items-end gap-1.5 flex-wrap">
                                                    {archivedBlocks.filter(b => b.engagementLevel).slice(-12).map((b, i) => {
                                                        const colorMap = { alto: 'bg-emerald-500', medio: 'bg-amber-400', basso: 'bg-red-500' };
                                                        const labelMap = { alto: 'Alto', medio: 'Medio', basso: 'Basso' };
                                                        const h = { alto: 'h-8', medio: 'h-5', basso: 'h-2.5' }[b.engagementLevel!];
                                                        return (
                                                            <div key={i} className="flex flex-col items-center gap-1" title={`S${b.weekNumber} ${b.day}: ${labelMap[b.engagementLevel!]}`}>
                                                                <div className={`w-5 ${h} rounded-sm ${colorMap[b.engagementLevel!]}`} />
                                                                <span className="text-[8px] font-mono text-gray-600">S{b.weekNumber}</span>
                                                            </div>
                                                        );
                                                    })}
                                                    <div className="ml-2 flex flex-col gap-1 text-[9px] font-mono text-gray-500">
                                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />Alto</span>
                                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block" />Medio</span>
                                                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Basso</span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right: Radar consuntivo + Alerts */}
                                    <div className="w-full lg:w-72 flex-shrink-0 space-y-4">
                                        {/* Radar equilibrio consuntivo */}
                                        <div>
                                            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Equilibrio Didattico Consuntivo</p>
                                            {consuntivoRadarData.length > 0 ? (
                                                <DidacticRadarChart
                                                    data={consuntivoRadarData}
                                                    idealData={progettoRadarData.length > 0 ? progettoRadarData : undefined}
                                                />
                                            ) : (
                                                <p className="text-xs text-gray-600 text-center py-4">Imposta una tipologia sulle lezioni archiviate per vedere il radar consuntivo.</p>
                                            )}
                                        </div>

                                        {/* Alerts */}
                                        {attendanceAlerts.length > 0 && (
                                            <div>
                                                <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Alert</p>
                                                <ul className="space-y-1.5">
                                                    {attendanceAlerts.map((alert, i) => (
                                                        <li key={i} className="flex items-start gap-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-700/30 rounded-lg px-3 py-2">
                                                            <span className="flex-shrink-0 mt-0.5">⚠</span>
                                                            <span>{alert}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Sezione Progettato vs Realizzato ─────────────────────────── */}
                <div className="rounded-xl border border-gray-600/55 bg-gray-800/30 mb-6 overflow-hidden">
                    <button
                        onClick={() => setIsProgVsRealOpen(p => !p)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-700/30 transition-colors"
                    >
                        <span className="text-sm font-semibold text-white">Progettato vs Realizzato</span>
                        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isProgVsRealOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isProgVsRealOpen && (
                        <div className="border-t border-gray-700/50 p-5">
                            {activities.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">Nessuna attività registrata.</p>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-6">
                                    {/* Colonna Pianificato */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-3">Pianificato</p>
                                        <svg width="100%" viewBox="0 0 220 72" className="overflow-visible">
                                            {[
                                                { label: 'Progettate', value: activityStats.planned, color: '#64748b' },
                                                { label: 'Con deadline', value: activityStats.withDeadline, color: '#f59e0b' },
                                                { label: 'Con rubric', value: activityStats.withRubric, color: '#6366f1' },
                                            ].map((item, i) => {
                                                const barW = activityStats.maxVal > 0 ? Math.round((item.value / activityStats.maxVal) * 160) : 0;
                                                const y = i * 24;
                                                return (
                                                    <g key={item.label}>
                                                        <text x="0" y={y + 10} fontSize="9" fill="#9ca3af" fontFamily="monospace">{item.label}</text>
                                                        <rect x="0" y={y + 14} width={barW} height="7" rx="2" fill={item.color} fillOpacity="0.7" />
                                                        <text x={barW + 4} y={y + 21} fontSize="9" fill="#d1d5db" fontFamily="monospace">{item.value}</text>
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    </div>

                                    {/* Separatore verticale */}
                                    <div className="hidden sm:block w-px bg-gray-700/50 self-stretch" />

                                    {/* Colonna Realizzato */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-3">Realizzato</p>
                                        <svg width="100%" viewBox="0 0 220 72" className="overflow-visible">
                                            {[
                                                { label: 'Lanciate', value: activityStats.launched, color: '#10b981' },
                                                { label: 'Consegnate', value: activityStats.delivered, color: '#34d399' },
                                                { label: 'Scadute', value: activityStats.expired, color: '#f43f5e' },
                                            ].map((item, i) => {
                                                const barW = activityStats.maxVal > 0 ? Math.round((item.value / activityStats.maxVal) * 160) : 0;
                                                const y = i * 24;
                                                return (
                                                    <g key={item.label}>
                                                        <text x="0" y={y + 10} fontSize="9" fill="#9ca3af" fontFamily="monospace">{item.label}</text>
                                                        <rect x="0" y={y + 14} width={barW} height="7" rx="2" fill={item.color} fillOpacity="0.7" />
                                                        <text x={barW + 4} y={y + 21} fontSize="9" fill="#d1d5db" fontFamily="monospace">{item.value}</text>
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Sezione Sentiment Aula: diagramma a quadranti ────────────── */}
                <div className="rounded-xl border border-gray-600/55 bg-gray-800/30 mb-6 overflow-hidden">
                    <button
                        onClick={() => setIsSentimentOpen(p => !p)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-700/30 transition-colors"
                    >
                        <span className="text-sm font-semibold text-white">Sentiment Aula</span>
                        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isSentimentOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isSentimentOpen && (
                        <div className="border-t border-gray-700/50 p-5">
                            {studentQuadrantData.length < 3 ? (
                                <p className="text-sm text-gray-500 text-center py-6">
                                    {studentQuadrantData.length === 0
                                        ? 'Nessuno studente ha osservazioni Ada. Aggiungi osservazioni nelle attività per vedere il diagramma.'
                                        : `Solo ${studentQuadrantData.length} studente${studentQuadrantData.length === 1 ? '' : 'i'} con osservazioni. Ne servono almeno 3 per il diagramma.`}
                                </p>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <svg
                                        viewBox="0 0 400 400"
                                        className="w-full max-w-md"
                                        style={{ userSelect: 'none' }}
                                        aria-label="Diagramma a quadranti Sentiment Aula"
                                    >
                                        {/* Quadrant backgrounds */}
                                        {/* Q2 basso/alto — Noia produttiva (sky) */}
                                        <rect x="0" y="0" width="200" height="200" fill="rgba(14,165,233,0.07)" />
                                        {/* Q1 alto/alto — Zona di flusso (emerald) */}
                                        <rect x="200" y="0" width="200" height="200" fill="rgba(16,185,129,0.08)" />
                                        {/* Q4 basso/basso — Zona critica (rose) */}
                                        <rect x="0" y="200" width="200" height="200" fill="rgba(244,63,94,0.08)" />
                                        {/* Q3 alto/basso — Energia dispersa (amber) */}
                                        <rect x="200" y="200" width="200" height="200" fill="rgba(245,158,11,0.07)" />

                                        {/* Quadrant labels */}
                                        <text x="100" y="18" textAnchor="middle" fontSize="9" fill="rgba(14,165,233,0.7)" fontFamily="monospace">Noia produttiva</text>
                                        <text x="300" y="18" textAnchor="middle" fontSize="9" fill="rgba(16,185,129,0.7)" fontFamily="monospace">Zona di flusso</text>
                                        <text x="300" y="395" textAnchor="middle" fontSize="9" fill="rgba(245,158,11,0.7)" fontFamily="monospace">Energia dispersa</text>
                                        <text x="100" y="395" textAnchor="middle" fontSize="9" fill="rgba(244,63,94,0.7)" fontFamily="monospace">Zona critica</text>

                                        {/* Axes */}
                                        <line x1="0" y1="200" x2="400" y2="200" stroke="rgba(156,163,175,0.3)" strokeWidth="1" />
                                        <line x1="200" y1="0" x2="200" y2="400" stroke="rgba(156,163,175,0.3)" strokeWidth="1" />

                                        {/* Axis labels */}
                                        <text x="5" y="198" fontSize="8" fill="#6b7280" fontFamily="monospace">basso</text>
                                        <text x="350" y="198" fontSize="8" fill="#6b7280" fontFamily="monospace">alto</text>
                                        <text x="202" y="10" fontSize="8" fill="#6b7280" fontFamily="monospace">alta</text>
                                        <text x="202" y="398" fontSize="8" fill="#6b7280" fontFamily="monospace">bassa</text>
                                        <text x="200" y="215" textAnchor="middle" fontSize="8" fill="#6b7280" fontFamily="monospace">← engagement →</text>

                                        {/* Student dots */}
                                        {studentQuadrantData.map(s => {
                                            const cx = Math.round(s.engagement * 380 + 10);
                                            const cy = Math.round((1 - s.sentiment) * 380 + 10);
                                            const inRightHalf = cx >= 200;
                                            const inTopHalf = cy <= 200;
                                            const fill = inRightHalf && inTopHalf ? '#10b981'
                                                : !inRightHalf && inTopHalf ? '#0ea5e9'
                                                : inRightHalf && !inTopHalf ? '#f59e0b'
                                                : '#f43f5e';
                                            const studentObj = students.find(st => st.id === s.id);
                                            return (
                                                <circle
                                                    key={s.id} cx={cx} cy={cy} r="6" fill={fill} fillOpacity="0.85"
                                                    stroke="rgba(255,255,255,0.15)" strokeWidth="1"
                                                    style={onSelectStudent ? { cursor: 'pointer' } : undefined}
                                                    onClick={() => { if (onSelectStudent && studentObj) onSelectStudent(studentObj); }}
                                                >
                                                    <title>{s.name} — engagement: {Math.round(s.engagement * 100)}%, qualità: {Math.round(s.sentiment * 100)}%{onSelectStudent ? ' (click per aprire la scheda)' : ''}</title>
                                                </circle>
                                            );
                                        })}
                                    </svg>

                                    {/* Legenda */}
                                    <div className="flex flex-wrap gap-3 justify-center text-[10px] font-mono text-gray-400">
                                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block opacity-85" />Zona di flusso</span>
                                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-sky-500 inline-block opacity-85" />Noia produttiva</span>
                                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400 inline-block opacity-85" />Energia dispersa</span>
                                        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block opacity-85" />Zona critica</span>
                                    </div>
                                    <p className="text-[10px] font-mono text-gray-600 text-center">
                                        Posizione calcolata su presenze (asse X) e sentiment medio osservazioni Ada (asse Y). Hover per nome.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Sezione Diario Qualitativo (note classe/gruppo dalle analisi Ada) ── */}
                <div className="rounded-xl border border-gray-600/55 bg-gray-800/30 mb-6 overflow-hidden">
                    <button
                        onClick={() => setIsDiarioOpen(p => !p)}
                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-700/30 transition-colors"
                    >
                        <span className="text-sm font-semibold text-white">Diario Qualitativo</span>
                        <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isDiarioOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isDiarioOpen && (
                        <div className="border-t border-gray-700/50 p-5">
                            {diarioEntries.length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-4">
                                    Nessuna nota qualitativa. Le note compaiono quando analizzi con Ada gli appunti liberi delle lezioni (Lezione → In Corso).
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {diarioEntries.map((e, i) => (
                                        <div key={i} className="bg-gray-900/50 border border-gray-700/40 rounded-lg px-3 py-2 text-xs">
                                            <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-gray-500">
                                                <span className={`w-1.5 h-1.5 rounded-full inline-block ${e.kind === 'classe' ? 'bg-indigo-400/80' : 'bg-teal-400/80'}`} />
                                                S{e.weekNumber} · {e.day} · {e.kind}
                                            </span>
                                            <p className="text-gray-300 mt-0.5">{e.text}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </main>
    );
};

export default React.memo(ClassroomTrendView);
