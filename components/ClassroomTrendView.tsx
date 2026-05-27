import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { Conversation, Student, QualitativeAnalysisData, InferredStudentGrowth, GrowthLevel, LessonType } from '../types';
import { UsersIcon, XIcon, SparklesIcon, RefreshIcon, ChevronDownIcon, Bars3Icon } from './Icons';
import * as GeminiService from '../services/gemini';
import MarkdownRenderer from './MarkdownRenderer';
import { useConstitutionCache } from '../contexts/ConstitutionCacheContext';
import ParticipationThermometer from './ParticipationThermometer';
import EnergySeismograph from './EnergySeismograph';
import RadarChart from './RadarChart';
import ConceptMap from './ConceptMap';
import AchievementChart from './AchievementChart';
import DidacticRadarChart, { type RadarDataPoint } from './DidacticRadarChart';

interface ClassroomTrendViewProps {
    conversations: Conversation[];
    students: Student[];
    onClose: () => void;
}

const criteria: (keyof InferredStudentGrowth['criteria'])[] = ['QualitàElaborati', 'Partecipazione', 'Collaborazione', 'ResilienzaCreativa'];
const levels: GrowthLevel[] = ['Da Potenziare', 'Stabile', 'Punto di Forza'];
const levelToValue = (level: GrowthLevel): number => levels.indexOf(level) + 1;

type Dashboard = { 
    id: string; 
    title: string; 
    component: React.ReactNode; 
    selector?: React.ReactNode;
    colSpan?: 'lg:col-span-2';
};

const ClassroomTrendView: React.FC<ClassroomTrendViewProps> = ({ conversations, students, onClose }) => {
    const [analysisData, setAnalysisData] = useState<QualitativeAnalysisData | null>(null);
    const [attendanceData, setAttendanceData] = useState<{ module: string, presence: number }[]>([]);
    const [professorNotes, setProfessorNotes] = useState('');
    const [adaSummary, setAdaSummary] = useState('');
    const [isAnalysisOpen, setIsAnalysisOpen] = useState(false);
    
    const [selectedStudentRadar, setSelectedStudentRadar] = useState<string>('');
    const [selectedStudentLog, setSelectedStudentLog] = useState<string>('');
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [dashboards, setDashboards] = useState<Dashboard[]>([]);
    const [draggedId, setDraggedId] = useState<string | null>(null);

    const { modules: constitutionModules } = useConstitutionCache();

    useEffect(() => {
        if (adaSummary) {
            setIsAnalysisOpen(true);
        }
    }, [adaSummary]);

    const allPillars = useMemo(() => {
        const pillars: { name: string, type: 'Sintonizzazione' | 'Operativo' | 'Attività Chiave' }[] = [];
        constitutionModules.forEach(mod => {
            mod.sintonizzazione.forEach(p => pillars.push({ name: p.name, type: 'Sintonizzazione' }));
            mod.operativi.forEach(p => pillars.push({ name: p.name, type: 'Operativo' }));
            mod.attivitaChiave.forEach(p => pillars.push({ name: p, type: 'Attività Chiave' }));
        });
        return pillars;
    }, [constitutionModules]);

    const handleGenerateAnalysis = useCallback(async () => {
        setIsLoading(true);
        setError('');
        setAnalysisData(null);
        setAdaSummary('');

        try {
            const textCorpus: string[] = [];
            const planningConvos = conversations.filter(c => c.weekPlan);

            planningConvos.forEach(convo => {
                convo.weekPlan!.blocks.forEach(block => {
                    if (block.lessonNotes) textCorpus.push(`Nota Settimana ${convo.weekPlan?.weekNumber}: ${block.lessonNotes}`);
                });
            });
            students.forEach(student => {
                if (student.notes) textCorpus.push(`Nota su ${student.name}: ${student.notes}`);
            });
            
            if (textCorpus.length === 0 && !professorNotes.trim()) {
                setError("Nessuna nota qualitativa trovata. Aggiungi note alle lezioni o note generali per generare un'analisi.");
                setIsLoading(false);
                return;
            }
            
            const fullCorpus = [...textCorpus, `Note Generali del Docente: ${professorNotes}`].join('\n\n---\n\n');

            const studentNames = students.map(s => s.name);
            const inferredMetrics = await GeminiService.inferQualitativeMetrics(fullCorpus, studentNames, allPillars);
            setAnalysisData(inferredMetrics);

            const qualitativeSummary = `Energia Classe: ${inferredMetrics.classEnergy.map(e => `S${e.weekNumber}:${e.energyLevel}`).join(', ')}. Concetti Chiave: ${inferredMetrics.conceptMastery.map(c => `${c.concept} (${c.mastery})`).join(', ')}.`;
            const finalSummary = await GeminiService.generateClassroomTrendAnalysis(qualitativeSummary, professorNotes);
            setAdaSummary(finalSummary);

        } catch (err) {
            console.error("Analysis generation failed:", err);
            setError(err instanceof Error ? err.message : "Si è verificato un errore sconosciuto durante l'analisi.");
        } finally {
            setIsLoading(false);
        }
    }, [conversations, students, professorNotes, allPillars]);

    useEffect(() => {
        const moduleAttendance: Record<string, { present: number, total: number }> = {};

        students.forEach(student => {
            student.evaluations.forEach(ev => {
                if (ev.module && (ev.value === 'Presente' || ev.value === 'Assente')) {
                    if (!moduleAttendance[ev.module]) {
                        moduleAttendance[ev.module] = { present: 0, total: 0 };
                    }
                    moduleAttendance[ev.module].total++;
                    if (ev.value === 'Presente') {
                        moduleAttendance[ev.module].present++;
                    }
                }
            });
        });

        const data = Object.entries(moduleAttendance).map(([module, counts]) => ({
            module,
            presence: counts.total > 0 ? (counts.present / counts.total) * 100 : 0,
        }));
        setAttendanceData(data);
    }, [students, conversations]);

    const studentGrowthData = useMemo<InferredStudentGrowth | undefined>(() => {
        if (!analysisData || !selectedStudentRadar) return undefined;
        return analysisData.studentGrowth.find(s => s.studentName === selectedStudentRadar);
    }, [analysisData, selectedStudentRadar]);

    const classGrowthData = useMemo<InferredStudentGrowth | undefined>(() => {
        if (!analysisData || analysisData.studentGrowth.length === 0) return undefined;
        
        const totals: Record<keyof InferredStudentGrowth['criteria'], number> = { QualitàElaborati: 0, Partecipazione: 0, Collaborazione: 0, ResilienzaCreativa: 0 };
        const counts: Record<keyof InferredStudentGrowth['criteria'], number> = { QualitàElaborati: 0, Partecipazione: 0, Collaborazione: 0, ResilienzaCreativa: 0 };

        for (const student of analysisData.studentGrowth) {
            for (const key of criteria) {
                const value = levelToValue(student.criteria[key]);
                totals[key] += value;
                counts[key]++;
            }
        }
        
        const getLevelFromAvg = (avg: number): GrowthLevel => {
            if (avg < 1.5) return 'Da Potenziare';
            if (avg < 2.5) return 'Stabile';
            return 'Punto di Forza';
        };

        return {
            studentName: 'Media Classe',
            criteria: {
                QualitàElaborati: getLevelFromAvg(counts.QualitàElaborati > 0 ? totals.QualitàElaborati / counts.QualitàElaborati : 0),
                Partecipazione: getLevelFromAvg(counts.Partecipazione > 0 ? totals.Partecipazione / counts.Partecipazione : 0),
                Collaborazione: getLevelFromAvg(counts.Collaborazione > 0 ? totals.Collaborazione / counts.Collaborazione : 0),
                ResilienzaCreativa: getLevelFromAvg(counts.ResilienzaCreativa > 0 ? totals.ResilienzaCreativa / counts.ResilienzaCreativa : 0),
            }
        };
    }, [analysisData]);

    const individualLog = useMemo<string>(() => {
        if (!selectedStudentLog) return '';
        const student = students.find(s => s.name === selectedStudentLog);
        if (!student) return '';

        const logs: string[] = [];
        if (student.notes) {
            logs.push(`**Note Generali:**\n${student.notes}`);
        }

        const lessonNotes = conversations
            .filter(c => c.weekPlan)
            .flatMap(c => c.weekPlan!.blocks.map(b => ({...b, week: c.weekPlan!.weekNumber})))
            .filter(b => b.lessonNotes && b.lessonNotes.toLowerCase().includes(student.name.toLowerCase()));
        
        if (lessonNotes.length > 0) {
            logs.push(`**Menzioni nelle Note di Lezione:**\n` + lessonNotes.map(b => `- **S${b.week}, Blocco ${b.day}:** ${b.lessonNotes}`).join('\n'));
        }
        
        return logs.join('\n\n---\n\n');
    }, [selectedStudentLog, students, conversations]);
    
    const moduleAchievement = useMemo(() => {
        const moduleTotals: Record<string, number> = {};
        const moduleReviewed: Record<string, number> = {};

        conversations.filter(c => c.weekPlan).forEach(c => {
            c.weekPlan!.blocks.forEach(b => {
                if (b.module) {
                    moduleTotals[b.module] = (moduleTotals[b.module] || 0) + 1;
                    if (b.isReviewed) {
                        moduleReviewed[b.module] = (moduleReviewed[b.module] || 0) + 1;
                    }
                }
            });
        });

        return Object.keys(moduleTotals).map(name => ({
            name,
            percentage: (moduleReviewed[name] || 0) / moduleTotals[name] * 100
        })).sort((a, b) => b.percentage - a.percentage);
    }, [conversations]);

    useEffect(() => {
        const dashboardList: Dashboard[] = [
            { id: 'participation', title: 'Termometro della Partecipazione', component: <ParticipationThermometer data={attendanceData} /> },
            { id: 'energy', title: 'Sismografo dell\'Energia', component: <EnergySeismograph data={analysisData?.classEnergy || []} /> },
            { 
                id: 'growth_individual', 
                title: 'Radar della Crescita Individuale', 
                component: <RadarChart data={studentGrowthData} />,
                selector: <select value={selectedStudentRadar} onChange={e => setSelectedStudentRadar(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-md px-3 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">Seleziona Studentessa</option>
                                {students.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>
            },
            { 
                id: 'growth_class', 
                title: 'Radar della Crescita (Classe)', 
                component: <RadarChart data={classGrowthData} /> 
            },
            { 
                id: 'concepts', 
                title: 'Mappa dei Concetti', 
                component: <ConceptMap data={analysisData?.conceptMastery || []} allPillars={allPillars} /> 
            },
            { 
                id: 'achievement', 
                title: 'Copertura Didattica', 
                component: (
                    <div className="space-y-6">
                        <AchievementChart title="Copertura Moduli" data={moduleAchievement} />
                    </div>
                )
            },
            { 
                id: 'log', 
                title: 'Diario di Bordo Individuale', 
                component: <div className="prose prose-sm max-w-none text-gray-300 bg-gray-900/50 p-3 rounded-md h-64 overflow-y-auto custom-scrollbar">
                                {selectedStudentLog ? <MarkdownRenderer content={individualLog} /> : <p className="text-gray-500 italic">Seleziona una studentessa per vedere le sue note.</p>}
                            </div>,
                selector: <select value={selectedStudentLog} onChange={e => setSelectedStudentLog(e.target.value)} className="bg-gray-900 border border-gray-600 rounded-md px-3 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">Seleziona Studentessa</option>
                                {students.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                            </select>,
                colSpan: 'lg:col-span-2'
            },
        ];
        setDashboards(prev => {
            if (prev.length === 0) return dashboardList;
            const newMap = new Map(dashboardList.map(d => [d.id, d]));
            return prev.map(p => newMap.get(p.id)!).filter(Boolean);
        });
    }, [analysisData, attendanceData, studentGrowthData, classGrowthData, allPillars, moduleAchievement, individualLog, selectedStudentRadar, selectedStudentLog, students]);


    // ── Consuntivo data (Step 7) ─────────────────────────────────────────────

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

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, id: string) => {
        setDraggedId(id);
    };
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };
    const handleDrop = (e: React.DragEvent<HTMLDivElement>, dropId: string) => {
        if (!draggedId || draggedId === dropId) return;
        
        setDashboards(prev => {
            const draggedIndex = prev.findIndex(d => d.id === draggedId);
            const dropIndex = prev.findIndex(d => d.id === dropId);
            if (draggedIndex === -1 || dropIndex === -1) return prev;
            
            const newDashboards = [...prev];
            const [draggedItem] = newDashboards.splice(draggedIndex, 1);
            newDashboards.splice(dropIndex, 0, draggedItem);
            return newDashboards;
        });
        setDraggedId(null);
    };

    return (
        <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-3.5 pl-6 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <UsersIcon className="h-6 w-6 text-green-400" />
                    <h2 className="text-lg font-semibold truncate">Andamento Aula - Cruscotto Qualitativo</h2>
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

                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 mb-6">
                    <h3 className="text-lg font-bold text-white mb-2">Note e Analisi Strategica</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <div>
                            <p className="text-sm text-gray-400 mb-3">Aggiungi qui le tue osservazioni generali. Ada le userà per arricchire la sua analisi.</p>
                            <textarea
                                value={professorNotes}
                                onChange={(e) => setProfessorNotes(e.target.value)}
                                placeholder="Es: Noto un calo generale di attenzione, ma grande entusiasmo per le attività pratiche..."
                                className="w-full h-48 p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-200 resize-y"
                            />
                        </div>
                        <div className="flex flex-col">
                           <div className="flex-grow">
                                {isLoading && <div className="text-gray-400">Analisi di Ada in corso...</div>}
                                {error && <div className="text-red-400">{error}</div>}
                                {adaSummary && (
                                    <div className="bg-gray-700/30 rounded-lg border border-gray-600/50">
                                        <button onClick={() => setIsAnalysisOpen(!isAnalysisOpen)} className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-700 transition-colors">
                                            <span className="font-semibold text-purple-300">Apri/Chiudi Analisi Strategica di Ada</span>
                                            <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isAnalysisOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isAnalysisOpen && (
                                            <div className="border-t border-gray-600/50 p-3 prose prose-sm max-w-none text-gray-300 animate-fade-in-down">
                                                <MarkdownRenderer content={adaSummary} />
                                            </div>
                                        )}
                                    </div>
                                )}
                           </div>
                            <button onClick={handleGenerateAnalysis} disabled={isLoading} className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">
                                {isLoading ? <RefreshIcon className="h-5 w-5 animate-spin" /> : <SparklesIcon className="h-5 w-5" />}
                                {isLoading ? 'Analisi in corso...' : 'Genera Analisi di Ada'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {dashboards.map(dashboard => (
                        <div
                            key={dashboard.id}
                            draggable
                            onDragStart={e => handleDragStart(e, dashboard.id)}
                            onDragOver={handleDragOver}
                            onDrop={e => handleDrop(e, dashboard.id)}
                            className={`transition-opacity ${draggedId === dashboard.id ? 'opacity-30' : ''} ${dashboard.colSpan ? dashboard.colSpan : ''}`}
                        >
                            <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 h-full flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                    <h3 className="text-lg font-bold text-white flex items-center gap-2 cursor-grab active:cursor-grabbing">
                                        <Bars3Icon className="h-5 w-5 text-gray-500" />
                                        {dashboard.title}
                                    </h3>
                                    {dashboard.selector} 
                                </div>
                                <div className="flex-grow">
                                    {dashboard.component}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
};

export default React.memo(ClassroomTrendView);
