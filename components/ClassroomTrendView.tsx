import React, { useState, useMemo } from 'react';
import type { Conversation, Student, LessonType } from '../types';
import { UsersIcon, XIcon, ChevronDownIcon } from './Icons';
import DidacticRadarChart, { type RadarDataPoint } from './DidacticRadarChart';

interface ClassroomTrendViewProps {
    conversations: Conversation[];
    students: Student[];
    onClose: () => void;
}

const ClassroomTrendView: React.FC<ClassroomTrendViewProps> = ({ conversations, students, onClose }) => {
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

    return (
        <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-6 pt-3.5 pb-2 border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <UsersIcon className="h-5 w-5 text-gray-400" />
                    <h2 className="text-base font-display font-semibold text-white">Andamento Aula</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" aria-label="Chiudi">
                    <XIcon className="h-5 w-5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

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
                                                                    <td className="pr-3 text-gray-400 whitespace-nowrap py-0.5 max-w-[120px] truncate">{s.name}</td>
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

            </div>
        </main>
    );
};

export default React.memo(ClassroomTrendView);
