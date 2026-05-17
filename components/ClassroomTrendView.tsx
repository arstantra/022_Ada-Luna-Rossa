import React, { useState, useCallback, useEffect, useMemo } from 'react';
import type { Conversation, Student, QualitativeAnalysisData, InferredStudentGrowth, GrowthLevel } from '../types';
import { UsersIcon, XIcon, SparklesIcon, RefreshIcon, ChevronDownIcon, Bars3Icon } from './Icons';
import * as GeminiService from '../services/gemini';
import MarkdownRenderer from './MarkdownRenderer';
import { useConstitutionCache } from '../contexts/ConstitutionCacheContext';
import ParticipationThermometer from './ParticipationThermometer';
import EnergySeismograph from './EnergySeismograph';
import RadarChart from './RadarChart';
import ConceptMap from './ConceptMap';
import AchievementChart from './AchievementChart';

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
    
    const { moduleAchievement, pillarAchievement } = useMemo(() => {
        const moduleTotals: Record<string, number> = {};
        const moduleReviewed: Record<string, number> = {};
        const pillarTotals: Record<string, number> = {};
        const pillarReviewed: Record<string, number> = {};

        conversations.filter(c => c.weekPlan).forEach(c => {
            c.weekPlan!.blocks.forEach(b => {
                if (b.module) {
                    moduleTotals[b.module] = (moduleTotals[b.module] || 0) + 1;
                    if (b.isReviewed) {
                        moduleReviewed[b.module] = (moduleReviewed[b.module] || 0) + 1;
                    }
                }
                if (b.pillar) {
                    pillarTotals[b.pillar] = (pillarTotals[b.pillar] || 0) + 1;
                    if (b.isReviewed) {
                        pillarReviewed[b.pillar] = (pillarReviewed[b.pillar] || 0) + 1;
                    }
                }
            });
        });

        const moduleData = Object.keys(moduleTotals).map(name => ({
            name,
            percentage: (moduleReviewed[name] || 0) / moduleTotals[name] * 100
        })).sort((a,b) => b.percentage - a.percentage);
        
        const pillarData = Object.keys(pillarTotals).map(name => ({
            name,
            percentage: (pillarReviewed[name] || 0) / pillarTotals[name] * 100
        })).sort((a,b) => b.percentage - a.percentage);

        return { moduleAchievement: moduleData, pillarAchievement: pillarData };
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
                        <AchievementChart title="Copertura Pilastri" data={pillarAchievement} />
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
    }, [analysisData, attendanceData, studentGrowthData, classGrowthData, allPillars, moduleAchievement, pillarAchievement, individualLog, selectedStudentRadar, selectedStudentLog, students]);


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
