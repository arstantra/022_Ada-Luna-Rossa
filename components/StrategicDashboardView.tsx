import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Conversation, WeekRouteInfo, BlockDetails, ModuleDetails, WeekPlan, BlockStatus, LessonType, CourseModule, Activity, CourseContentUnit } from '../types';
import { LESSON_TYPE_LABELS, COURSE_CONTENT_TYPE_LABELS } from '../constants';
import { ClipboardDocumentCheckIcon, WandIcon, SparklesIcon, ChevronDownIcon, ArrowDownTrayIcon } from './Icons';
import * as GeminiService from '../services/gemini';
import EditableField from './EditableField';
import EditableTextarea from './EditableTextarea';
import ObjectiveSuggestionModal from './ObjectiveSuggestionModal';
import TitleSuggestionModal from './TitleSuggestionModal';
import { getExactDateForBlock } from '../utils';

interface StrategicDashboardViewProps {
    conversations: Conversation[];
    weeks: WeekRouteInfo[];
    modules: ModuleDetails[];
    contentUnits: CourseContentUnit[];
    constitutionText: string;
    onClose: () => void;
    onUpdateWeekTheme: (weekNumber: number, theme: string) => void;
    onUpdateBlockObjective: (weekNumber: number, blockIndex: number, objective: string) => void;
    onUpdateBlockTitle: (weekNumber: number, blockIndex: number, blockTitle: string) => void;
    onGenerateStrategicSuggestions: (prompt: string, module: string) => Promise<{ theme: string; objectives: string[]; reasoning: string; }>;
    onSaveStrategicData: (weekNumber: number, theme: string, objectives: string[]) => void;
    onGenerateBlockDetails: (weekNumber: number, blockIndex: number) => Promise<void>;
    onUpdateWeekDetails: (weekNumber: number, details: Partial<Pick<WeekPlan, 'notes'>>) => void;
    onUpdateBlockDetails: (weekNumber: number, blockIndex: number, details: Partial<Pick<BlockDetails, 'lessonTitle' | 'lessonSyllabus' | 'lessonPlanMaterials' | 'isLocked'>>) => void;
    onStartPlanning: (weekInfo: WeekRouteInfo) => void;
    onUpdateBlockModule: (weekNumber: number, blockIndex: number, module: string, lessonTitle: string) => void;
    onUpdateBlockStatus: (weekNumber: number, blockIndex: number, status: BlockStatus, reason?: string) => void;
    onUpdateBlockTipologia: (weekNumber: number, blockIndex: number, tipologia: LessonType | '') => void;
    onToggleFslPeriod: (weekNumber: number, blockIndex: number, value: boolean) => void;
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
    teacherProfile: string;
}

const StrategicDashboardView: React.FC<StrategicDashboardViewProps> = ({ conversations, weeks, modules, contentUnits, constitutionText, onClose, onUpdateWeekTheme, onUpdateBlockObjective, onUpdateBlockTitle, onGenerateStrategicSuggestions, onSaveStrategicData, onGenerateBlockDetails, onUpdateWeekDetails, onUpdateBlockDetails, onStartPlanning, onUpdateBlockModule, onUpdateBlockStatus, onUpdateBlockTipologia, onToggleFslPeriod, showToast, teacherProfile }) => {
    const [generatingThemeFor, setGeneratingThemeFor] = useState<number | null>(null);
    const [objectiveModalInfo, setObjectiveModalInfo] = useState<{ weekNumber: number; blockIndex: number; } | null>(null);
    const [titleModalInfo, setTitleModalInfo] = useState<{ weekNumber: number; blockIndex: number; } | null>(null);
    const [allExpanded, setAllExpanded] = useState(false);
    const weeksContainerRef = useRef<HTMLDivElement>(null);

    const weekData = useMemo(() => {
        const convoMap = new Map<number, Conversation>();
        conversations.forEach(convo => {
            if (convo.weekPlan) {
                convoMap.set(convo.weekPlan.weekNumber, convo);
            }
        });
        return weeks.map(week => {
            const convo = convoMap.get(week.weekNumber);
            const plan = convo?.weekPlan;
            return {
                ...week,
                theme: plan?.theme || '',
                notes: plan?.notes || '',
                blocks: plan?.blocks || Array.from({ length: week.totalBlocks }, (_, i) => ({ id: `stub-${week.weekNumber}-${i}`, day: 'N/D', status: 'da definire' } as BlockDetails)),
                modules: convo?.modules || [] as CourseModule[],
            };
        });
    }, [weeks, conversations]);

    const handleGenerateTheme = async (week: typeof weekData[0]) => {
        const relevantBlocks = week.blocks.filter(b =>
            (b.status === 'normale' || b.status === 'da definire') && (b.blockTitle || b.objective) && (b.blockTitle || b.objective || '').trim()
        );

        const objectivesContext = relevantBlocks.map((b, i) =>
            `- Blocco ${i + 1}: ${b.blockTitle || b.objective}`
        ).join('\n');
    
        const notesContext = week.notes && week.notes.trim() ? `\n\nNote sulla settimana:\n${week.notes}` : '';
    
        let weekContext = `${objectivesContext}${notesContext}`;

        // Se non ci sono obiettivi, usiamo il contesto della rotta
        if (relevantBlocks.length === 0) {
             const weekInfoFromRoute = weeks.find(w => w.weekNumber === week.weekNumber);
             if (weekInfoFromRoute?.notes) {
                 weekContext += `\n\nContesto dalla rotta: ${weekInfoFromRoute.notes}`;
             }
        }
    
        if (!weekContext.trim()) {
            showToast("Definisci almeno un obiettivo o aggiungi una nota per generare un tema.", 'error');
            return;
        }
    
        setGeneratingThemeFor(week.weekNumber);
        try {
            const result = await GeminiService.generateThemeFromBlocks(weekContext);
            onUpdateWeekTheme(week.weekNumber, result.theme);
            showToast(`Tema suggerito: "${result.theme}"`, 'success');
        } catch (error) {
            console.error(error);
            showToast(error instanceof Error ? error.message : "Errore durante la generazione del tema.", 'error');
        } finally {
            setGeneratingThemeFor(null);
        }
    };
    
    const handleGenerateObjective = (weekNumber: number, blockIndex: number) => {
        const block = weekData.find(w => w.weekNumber === weekNumber)?.blocks[blockIndex];
        if (!block || !block.module) {
            showToast("Seleziona prima un'unità didattica per generare l'obiettivo.", 'error');
            return;
        }
        setObjectiveModalInfo({ weekNumber, blockIndex });
    };

    const handleGenerateTitle = (weekNumber: number, blockIndex: number) => {
        const block = weekData.find(w => w.weekNumber === weekNumber)?.blocks[blockIndex];
        if (!block || !block.objective?.trim()) {
            showToast("Definisci prima l'obiettivo didattico nel pannello espanso.", 'error');
            return;
        }
        setTitleModalInfo({ weekNumber, blockIndex });
    };

    const handleSelectObjective = (weekNumber: number, blockIndex: number, objective: string) => {
        onUpdateBlockObjective(weekNumber, blockIndex, objective);
        setObjectiveModalInfo(null);
        showToast(`Obiettivo didattico impostato per il Blocco ${blockIndex + 1}.`, 'success');
    };

    const handleSelectTitle = (weekNumber: number, blockIndex: number, title: string) => {
        onUpdateBlockTitle(weekNumber, blockIndex, title);
        setTitleModalInfo(null);
        showToast(`Titolo impostato per il Blocco ${blockIndex + 1}.`, 'success');
    };

    const handleModuleChange = (weekNumber: number, blockIndex: number, moduleName: string) => {
        let newLessonTitle = '';

        if (moduleName && constitutionText) {
            const moduleSections = constitutionText.split(/(?=^MODULO \d+:)/gm);
            const fullModuleText = moduleSections.find(s => s.trim().startsWith(moduleName))?.trim() || '';

            if (fullModuleText) {
                const firstPillarIndex = fullModuleText.search(/⦁\s*Pilastri|⦁\s*Attività Chiave:/);
                newLessonTitle = (firstPillarIndex !== -1)
                    ? fullModuleText.substring(0, firstPillarIndex).trim()
                    : fullModuleText;
            }
        }

        onUpdateBlockModule(weekNumber, blockIndex, moduleName, newLessonTitle);
    };

    const handleToggleAll = useCallback(() => {
        const next = !allExpanded;
        weeksContainerRef.current?.querySelectorAll('details').forEach(d => { d.open = next; });
        setAllExpanded(next);
    }, [allExpanded]);

    const handleExportHtml = useCallback(() => {
        if (weekData.length === 0) {
            console.warn("No data to export.");
            return;
        }

        const escapeHtml = (unsafe: string | undefined) => {
            if (!unsafe) return '';
            return unsafe
                 .replace(/&/g, "&amp;")
                 .replace(/</g, "&lt;")
                 .replace(/>/g, "&gt;")
                 .replace(/"/g, "&quot;")
                 .replace(/'/g, "&#039;");
        };
        
        const nl2br = (str: string | undefined) => (str || '').replace(/\n/g, '<br />');

        const styles = `
          body { font-family: 'Lora', serif; line-height: 1.7; color: #1f2937; background-color: #fff; max-width: 21cm; margin: 2rem auto; padding: 2.54cm; }
          h1, h2, h3, h4 { font-family: 'Inter', sans-serif; color: #111827; line-height: 1.3; }
          h1 { text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 1rem; margin-bottom: 2.5rem; font-size: 2.2em; }
          .week { margin-bottom: 2.5rem; page-break-inside: avoid; }
          .week-header { background-color: #f3f4f6; padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1.5rem; }
          .week-header h2 { font-size: 1.75em; margin: 0; }
          .week-header p { font-style: italic; color: #6b7280; margin: 0.25rem 0 0; }
          .block { margin-bottom: 1.5rem; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; page-break-inside: avoid; }
          .block-header { background-color: #f9fafb; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; }
          .block-header h3 { font-size: 1.25em; margin: 0; color: #111827; }
          .block-details { padding: 1rem; }
          .block-details h4 { margin-top: 1rem; margin-bottom: 0.5rem; font-size: 1em; font-weight: 600; color: #4b5563; border-bottom: 1px dotted #d1d5db; padding-bottom: 0.25rem; }
          .block-details p { margin: 0 0 1rem 0; white-space: pre-wrap; font-size: 0.95em; }
          .week-summary { margin-top: 2rem; padding-top: 1rem; border-top: 1px dashed #d1d5db; }
          .week-summary h4 { margin-top: 1rem; margin-bottom: 0.5rem; font-size: 1em; font-weight: 600; color: #4b5563; }
        `;

        const content = weekData.map(week => `
            <div class="week">
                <div class="week-header">
                    <h2>Settimana ${week.weekNumber}: ${escapeHtml(week.theme)}</h2>
                    <p>${escapeHtml(week.dates)}</p>
                </div>
                ${week.blocks.map((block, index) => `
                    <div class="block">
                        <div class="block-header">
                            <h3>Blocco ${index + 1}: ${escapeHtml(block.blockTitle || block.objective)}</h3>
                        </div>
                        <div class="block-details">
                            <h4>Obiettivo Didattico</h4>
                            <p>${nl2br(block.objective) || '<em>Non definito</em>'}</p>
                            <h4>Unità Didattica</h4>
                            <p>${escapeHtml(block.module) || '<em>Non specificata</em>'}</p>
                        </div>
                    </div>
                `).join('')}
                <div class="week-summary">
                    <h4>Note sulla Settimana</h4>
                    <p>${nl2br(week.notes) || '<em>Nessuna</em>'}</p>
                </div>
            </div>
        `).join('');

        const fullHtml = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Progettazione del Corso</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet">
    <style>${styles}</style>
</head>
<body>
    <h1>Progettazione del Corso — Quadro Sinottico</h1>
    ${content}
</body>
</html>`;

        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'visione_d_insieme.html';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

    }, [weekData]);

    // ── Derivazione stato blocco ────────────────────────────────────────────────
    const getBlockProgressState = (block: BlockDetails): 'da_fare' | 'in_corso' | 'completato' | 'speciale' => {
        if (block.status === 'saltato' || block.status === 'annullato') {
            return 'speciale';
        }
        if (block.contentBlocks && block.contentBlocks.length > 0) {
            return 'completato';
        }
        if (block.objective?.trim() || block.module?.trim() || (block.messages && block.messages.length > 0)) {
            return 'in_corso';
        }
        return 'da_fare';
    };

    // ── Dot per la riga compressa ───────────────────────────────────────────────
    const DOT_CONFIG = {
        da_fare:    { dot: 'bg-slate-500',   label: 'text-slate-400/80'  },
        in_corso:   { dot: 'bg-amber-400',   label: 'text-amber-400/80'  },
        completato: { dot: 'bg-emerald-500', label: 'text-emerald-500/80'},
        speciale:   { dot: 'bg-gray-500',    label: 'text-gray-500/80'   },
    } as const;

    const BlockDot: React.FC<{ state: keyof typeof DOT_CONFIG; label: string }> = ({ state, label }) => {
        const cfg = DOT_CONFIG[state];
        return (
            <div className="flex flex-col items-center gap-1" title={state.replace('_', ' ')}>
                <span className={`text-[9px] font-mono font-medium leading-none tracking-tight ${cfg.label}`}>{label}</span>
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
            </div>
        );
    };

    // ── Badge per il blocco espanso ─────────────────────────────────────────────
    const BADGE_CONFIG = {
        da_fare:    { label: 'Da fare',    cls: 'text-slate-400 bg-slate-500/10 border-slate-500/25'  },
        in_corso:   { label: 'In corso',   cls: 'text-amber-400 bg-amber-400/10 border-amber-400/25'  },
        completato: { label: 'Completato', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' },
        speciale:   { label: '—',          cls: 'text-gray-500 bg-gray-500/10 border-gray-500/20'     },
    } as const;

    const BlockStateBadge: React.FC<{ state: keyof typeof BADGE_CONFIG }> = ({ state }) => {
        const cfg = BADGE_CONFIG[state];
        return (
            <span className={`flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${cfg.cls}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${DOT_CONFIG[state].dot}`} />
                {cfg.label}
            </span>
        );
    };

    // ── Contenuti in sospeso (blocchi saltati con contenuto da ricollocare) ─────
    const pendingContentCount = useMemo(() => {
        return conversations.reduce((acc, c) => {
            const active = (c.pendingContent || []).filter(d => !d.archiviata);
            return acc + active.length;
        }, 0);
    }, [conversations]);

    // ── Progresso globale del corso ────────────────────────────────────────────
    const progressStats = useMemo(() => {
        let completate = 0, inCorso = 0, daFare = 0;
        weekData.forEach(week => {
            const states = week.blocks.map(b => getBlockProgressState(b));
            const allDone = states.every(s => s === 'completato' || s === 'speciale');
            const anyInCorso = states.some(s => s === 'in_corso');
            if (allDone) completate++;
            else if (anyInCorso) inCorso++;
            else daFare++;
        });
        return { completate, inCorso, daFare, total: weekData.length };
    }, [weekData]);

    // ── Attività — raccolta e mappa offset globale ──────────────────────────────
    const allActivities = useMemo(
        () => conversations.flatMap(c => c.activities ?? []) as Activity[],
        [conversations]
    );

    const globalOffsetMap = useMemo(() => {
        const map = new Map<number, number>();
        let offset = 0;
        weekData.forEach(w => {
            map.set(w.weekNumber, offset);
            offset += w.blocks.length;
        });
        return map;
    }, [weekData]);

    const selectKeyDownHandler = (e: React.KeyboardEvent<HTMLSelectElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
        }
    };

    return (
        <>
            <main className="flex-1 flex flex-col bg-[#0D1117] overflow-hidden print-container strategic-dashboard-print">
                <header className="flex-shrink-0 flex flex-col border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm no-print">
                    {/* Riga 1 — titolo + azioni */}
                    <div className="flex items-center justify-between px-6 pt-3.5 pb-2">
                        <div className="flex items-center gap-2.5">
                            <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            <h1 className="text-base font-display font-semibold text-white">Progettazione del Corso</h1>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleToggleAll}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-400 hover:text-white transition-colors rounded-md hover:bg-gray-800/60"
                            >
                                <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${allExpanded ? 'rotate-180' : ''}`} />
                                {allExpanded ? 'Comprimi' : 'Espandi'}
                            </button>
                            <div className="w-px h-4 bg-gray-700/60 mx-0.5" />
                            <button onClick={handleExportHtml} className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-400 border border-gray-700/80 rounded-lg hover:border-gray-500 hover:text-gray-200 transition-all">
                                <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                                Esporta
                            </button>
                        </div>
                    </div>

                    {/* Riga 2 — KPI + contenuti in sospeso */}
                    <div className="flex items-center gap-3 px-6 pb-2.5 flex-wrap">
                        {progressStats.total > 0 && (
                            <div className="flex items-center gap-2.5" title="Stato settimane: completate · in corso · da fare">
                                {progressStats.completate > 0 && (
                                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/80 whitespace-nowrap">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-500" />
                                        completata{progressStats.completate !== 1 ? 'e' : ''}
                                    </span>
                                )}
                                {progressStats.inCorso > 0 && (
                                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400/80 whitespace-nowrap">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-400" />
                                        in corso
                                    </span>
                                )}
                                <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400/80 whitespace-nowrap">
                                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-slate-500" />
                                    da fare
                                </span>
                                <span className="text-[10px] text-gray-600 font-mono">{progressStats.completate + progressStats.inCorso + progressStats.daFare} / {progressStats.total}</span>
                            </div>
                        )}
                        {pendingContentCount > 0 && (
                            <>
                                <span className="w-px h-3 bg-gray-800/70 flex-shrink-0" />
                                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[10px] font-mono text-amber-400/90 whitespace-nowrap" title="Contenuti distaccati da blocchi saltati, in attesa di collocazione">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                    {pendingContentCount} {pendingContentCount === 1 ? 'contenuto in sospeso' : 'contenuti in sospeso'}
                                </span>
                            </>
                        )}
                    </div>
                </header>

                <div className="print-header hidden">
                     <h1>Quadro Sinottico di Progettazione</h1>
                     <p>{new Date().toLocaleDateString('it-IT')}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div ref={weeksContainerRef} className="max-w-6xl mx-auto space-y-4">
                        {weekData.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                                <span className="text-4xl opacity-20">🗓</span>
                                <p className="text-sm text-gray-500 font-sans max-w-xs">
                                    Nessuna settimana configurata.<br />
                                    Vai in <span className="font-mono text-gray-400">Gestione del Corso → La Rotta</span> per aggiungere le settimane del corso.
                                </p>
                            </div>
                        )}
                        {weekData.map(week => {
                            return (
                            <details key={week.weekNumber} className="group rounded-xl border border-gray-600/55 bg-gray-800/55 overflow-hidden transition-all duration-200 hover:border-gray-500/70">
                                <summary className="list-none [&::-webkit-details-marker]:hidden px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-700/30 transition-colors select-none">
                                    <div className="flex-grow flex items-center gap-5 min-w-0">
                                        {/* Week info box */}
                                        <div className="flex-shrink-0 flex flex-col gap-2 bg-gray-800/60 border border-gray-700/35 rounded-xl px-3.5 py-2.5" style={{minWidth: '96px'}}>
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-display font-bold text-sm text-white leading-tight tracking-tight">
                                                    Settimana {week.weekNumber}
                                                </span>
                                                <span className="font-mono text-[10px] text-gray-500 leading-none">{week.dates}</span>
                                            </div>
                                            {/* Dots stato blocchi */}
                                            <div className="flex items-center gap-2">
                                                {week.blocks.map((block, i) => (
                                                    <BlockDot
                                                        key={block.id}
                                                        state={getBlockProgressState(block)}
                                                        label={`BL${i + 1}`}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex-grow min-w-0">
                                            <EditableField value={week.theme} onSave={(newTheme) => onUpdateWeekTheme(week.weekNumber, newTheme)} placeholder="Tema della settimana..." />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0 pl-4 no-print">
                                        <div className="relative group/ai-tip">
                                            <button
                                                onClick={(e) => { e.preventDefault(); handleGenerateTheme(week); }}
                                                disabled={generatingThemeFor === week.weekNumber}
                                                className="flex items-center justify-center w-8 h-8 text-purple-400/50 hover:text-purple-300 rounded-lg hover:bg-purple-500/10 transition-all disabled:opacity-30 disabled:cursor-wait"
                                                aria-label="Suggerisci il tema della settimana"
                                            >
                                                <SparklesIcon className={`h-4 w-4 ${generatingThemeFor === week.weekNumber ? 'animate-pulse' : ''}`} />
                                            </button>
                                            <div className="absolute bottom-full right-0 mb-2 px-2.5 py-1 text-[11px] font-medium text-purple-200/90 bg-gray-900 border border-purple-500/20 rounded-lg whitespace-nowrap opacity-0 group-hover/ai-tip:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg shadow-black/40">
                                                {generatingThemeFor === week.weekNumber ? 'Generando…' : 'Suggerisci il tema della settimana'}
                                            </div>
                                        </div>
                                        <button onClick={(e) => { e.preventDefault(); onStartPlanning(week); }} className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600/80 rounded-lg hover:bg-blue-500 transition-all shadow-sm shadow-blue-900/40" title="Apri il laboratorio tattico">
                                            Progetta
                                        </button>
                                        <ChevronDownIcon className="h-5 w-5 text-gray-400 transition-transform duration-200 group-open:rotate-180 ml-1 flex-shrink-0" />
                                    </div>
                                </summary>
                                <div className="border-t border-gray-600/50 bg-gray-800/70 px-5 py-4 space-y-3">
                                    {week.blocks.map((block, index) => {
                                        const isSpecialStatus = block.status === 'saltato';
                                        const blockDate = getExactDateForBlock(week.dates, block.day, teacherProfile);
                                        const dateString = blockDate ? ` - ${blockDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}` : '';
                                        const blockState = getBlockProgressState(block);
                                        // Attività attive su questo blocco
                                        const blockGlobalIdx = (globalOffsetMap.get(week.weekNumber) ?? 0) + index;
                                        const blockActivities = isSpecialStatus ? [] : allActivities.filter(a => {
                                            if (a.status === 'consegnata' || a.status === 'scaduta') return false;
                                            const launchGlobal = (globalOffsetMap.get(a.launchWeekNumber) ?? 0) + a.launchBlockIndex;
                                            const dueGlobal = launchGlobal + a.dueInBlocks;
                                            return blockGlobalIdx >= launchGlobal && blockGlobalIdx <= dueGlobal;
                                        });

                                        return (
                                        <details key={block.id} className="group/inner bg-gray-900/50 rounded-lg border border-gray-600/40">
                                            <summary className="list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-start justify-between cursor-pointer hover:bg-gray-800/50 transition-colors select-none">
                                                <div className="flex-grow flex flex-col gap-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="font-mono text-[11px] font-medium text-gray-500 flex-shrink-0 uppercase tracking-widest">Bl.{index + 1}{dateString}</span>
                                                        <BlockStateBadge state={blockState} />
                                                        {block.isFslPeriod && (
                                                            <span className="text-[9px] font-mono text-sky-400/70 border border-sky-500/20 rounded px-1.5 py-0.5 flex-shrink-0">
                                                                FSL
                                                            </span>
                                                        )}
                                                        {block.moduleId && (() => {
                                                            const mod = week.modules.find(m => m.id === block.moduleId);
                                                            if (!mod) return null;
                                                            return (
                                                                <span className="text-[9px] font-mono text-sky-400/60 flex-shrink-0">
                                                                    M{mod.order}
                                                                </span>
                                                            );
                                                        })()}
                                                        <div className="flex-grow">
                                                            {block.status === 'saltato' ? (
                                                                <EditableField
                                                                    value={block.reason || ''}
                                                                    onSave={(newReason) => onUpdateBlockStatus(week.weekNumber, index, 'saltato', newReason)}
                                                                    placeholder="Motivo per cui il blocco è saltato..."
                                                                    className="!text-red-400 placeholder:!text-red-400/50"
                                                                />
                                                            ) : (
                                                                <EditableField
                                                                    value={block.blockTitle || block.objective || ''}
                                                                    onSave={(val) => onUpdateBlockTitle(week.weekNumber, index, val)}
                                                                    placeholder="Titolo del blocco (generalo con Ada ✦)..."
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 no-print">
                                                            {(block.status === 'da definire' || block.status === 'normale') ? (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        onUpdateBlockStatus(week.weekNumber, index, 'saltato');
                                                                    }}
                                                                    className="px-2 py-1 text-xs font-medium text-red-400/70 border border-red-500/20 rounded-md hover:bg-red-500/15 hover:text-red-300 hover:border-red-400/35 transition-all"
                                                                    title="Imposta blocco come saltato"
                                                                >
                                                                    Salta
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        onUpdateBlockStatus(week.weekNumber, index, 'normale');
                                                                    }}
                                                                    className="px-2 py-1 text-xs font-medium text-gray-400 border border-gray-600/40 rounded-md hover:bg-gray-700/50 hover:text-gray-200 transition-all"
                                                                >
                                                                    Ripristina
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className={`flex items-center gap-3 pl-8 flex-wrap ${isSpecialStatus ? 'opacity-50 pointer-events-none' : ''}`}>
                                                        {/* Tendina "Cosa" — unità di contenuto dal Progetto Didattico */}
                                                        <select
                                                            value={block.module || ''}
                                                            onChange={(e) => handleModuleChange(week.weekNumber, index, e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={selectKeyDownHandler}
                                                            disabled={isSpecialStatus || block.isLocked}
                                                            className="w-full md:w-1/2 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="" disabled>— unità didattica —</option>
                                                            {contentUnits.length > 0
                                                                ? (['modulo', 'uda', 'educazione_civica', 'fsl'] as const).flatMap(type => {
                                                                    const units = contentUnits.filter(u => u.type === type);
                                                                    if (units.length === 0) return [];
                                                                    return [
                                                                        <optgroup key={type} label={COURSE_CONTENT_TYPE_LABELS[type]}>
                                                                            {units.map(u => (
                                                                                <option key={u.id} value={u.title}>{u.title}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    ];
                                                                })
                                                                : modules.map(m => <option key={m.name} value={m.name}>{m.name}</option>)
                                                            }
                                                        </select>
                                                        {/* Tendina "Come" — modalità pedagogica (5 voci stabili) */}
                                                        <select
                                                            value={block.tipologia || ''}
                                                            onChange={(e) => {
                                                                onUpdateBlockTipologia(week.weekNumber, index, e.target.value as LessonType | '');
                                                            }}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={selectKeyDownHandler}
                                                            disabled={isSpecialStatus}
                                                            className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed flex-shrink-0"
                                                        >
                                                            <option value="" disabled>— tipologia di lezione —</option>
                                                            {(Object.entries(LESSON_TYPE_LABELS) as [LessonType, string][]).map(([key, label]) => (
                                                                <option key={key} value={key}>{label}</option>
                                                            ))}
                                                        </select>
                                                        {/* Toggle periodo FSL */}
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                onToggleFslPeriod(week.weekNumber, index, !block.isFslPeriod);
                                                            }}
                                                            title={block.isFslPeriod ? 'Disattiva periodo FSL' : 'Attiva periodo FSL'}
                                                            className={`text-[10px] font-mono rounded px-1.5 py-0.5 border transition-all flex-shrink-0 ${
                                                                block.isFslPeriod
                                                                    ? 'text-sky-400 border-sky-500/40 bg-sky-500/10'
                                                                    : 'text-gray-600 border-gray-700/40 hover:text-sky-400/70 hover:border-sky-500/20'
                                                            }`}
                                                        >
                                                            FSL
                                                        </button>
                                                    </div>
                                                    {/* Attività attive su questo blocco */}
                                                    {blockActivities.length > 0 && (
                                                        <div className="flex items-center gap-1.5 pl-8 flex-wrap">
                                                            {blockActivities.slice(0, 2).map(a => {
                                                                const launchGlobal = (globalOffsetMap.get(a.launchWeekNumber) ?? 0) + a.launchBlockIndex;
                                                                const dueGlobal = launchGlobal + a.dueInBlocks;
                                                                const isLaunch = blockGlobalIdx === launchGlobal;
                                                                const isDue = blockGlobalIdx === dueGlobal;
                                                                return (
                                                                    <span key={a.id} className={`flex items-center gap-0.5 text-[9px] font-mono ${isDue ? 'text-amber-400' : 'text-rose-300/70'}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isDue ? 'bg-amber-400' : 'bg-rose-500'}`} />
                                                                        {isLaunch && '↗ '}
                                                                        {isDue && '⚑ '}
                                                                        <span className="max-w-[80px] truncate">{a.title}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                            {blockActivities.length > 2 && (
                                                                <span className="text-[9px] font-mono text-gray-600">+{blockActivities.length - 2}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2 flex-shrink-0 pl-4">
                                                    {block.isLocked && !isSpecialStatus && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                onUpdateBlockDetails(week.weekNumber, index, { isLocked: false });
                                                            }}
                                                            className="px-3 py-1 text-xs font-medium text-yellow-300 bg-yellow-900/50 rounded hover:bg-yellow-900/80 no-print"
                                                        >
                                                            Modifica
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleGenerateTitle(week.weekNumber, index); }}
                                                        disabled={isSpecialStatus}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 hover:text-purple-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed no-print"
                                                        title="Suggerisci titolo con Ada"
                                                    >
                                                        <SparklesIcon className="h-3.5 w-3.5" />
                                                        AI
                                                    </button>
                                                    <ChevronDownIcon className="h-5 w-5 text-gray-500 transition-transform duration-300 group-open/inner:rotate-180" />
                                                </div>
                                            </summary>
                                            <div className="border-t border-gray-700/30 px-4 py-3 space-y-3 bg-gray-900/20">
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="text-[9px] font-mono font-medium tracking-[0.14em] uppercase text-gray-500/80">Obiettivo Didattico</label>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleGenerateObjective(week.weekNumber, index); }}
                                                            disabled={isSpecialStatus}
                                                            className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-purple-400 border border-purple-500/25 rounded-md hover:bg-purple-500/10 hover:border-purple-400/40 hover:text-purple-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed no-print"
                                                            title="Suggerisci obiettivo didattico con Ada"
                                                        >
                                                            <SparklesIcon className="h-3 w-3" />
                                                            Suggerisci obiettivo
                                                        </button>
                                                    </div>
                                                    <EditableTextarea
                                                        value={block.objective || ''}
                                                        onSave={(val) => onUpdateBlockObjective(week.weekNumber, index, val)}
                                                        placeholder="Obiettivo pedagogico formale: cosa sapranno fare gli studenti al termine del blocco..."
                                                        rows={2}
                                                        disabled={isSpecialStatus}
                                                    />
                                                </div>
                                            </div>
                                        </details>
                                    )})}
                                    <div className="mt-3 pt-4 border-t border-gray-700/30">
                                        <label className="text-[9px] font-sans font-medium tracking-[0.14em] uppercase text-gray-500/80 mb-1 block">Note sulla Settimana</label>
                                        <EditableTextarea value={week.notes || ''} onSave={(val) => onUpdateWeekDetails(week.weekNumber, { notes: val })} placeholder="Appunti, promemoria, collegamenti interdisciplinari..." />
                                    </div>
                                </div>
                            </details>
                        )})}
                    </div>
                </div>
            </main>
            {objectiveModalInfo && (() => {
                const week = weekData.find(w => w.weekNumber === objectiveModalInfo.weekNumber);
                const block = week?.blocks[objectiveModalInfo.blockIndex];
                if (!week || !block) return null;

                return (
                    <ObjectiveSuggestionModal
                        isOpen={!!objectiveModalInfo}
                        onClose={() => setObjectiveModalInfo(null)}
                        onSelectObjective={(objective) => handleSelectObjective(objectiveModalInfo.weekNumber, objectiveModalInfo.blockIndex, objective)}
                        weekNumber={objectiveModalInfo.weekNumber}
                        blockIndex={objectiveModalInfo.blockIndex}
                        theme={week.theme || 'Nessun tema definito'}
                        moduleTitle={block.module || ''}
                        moduleContext={block.lessonTitle || ''}
                        tipologia={block.tipologia || ''}
                        teacherProfile={teacherProfile}
                    />
                );
            })()}
            {titleModalInfo && (() => {
                const week = weekData.find(w => w.weekNumber === titleModalInfo.weekNumber);
                const block = week?.blocks[titleModalInfo.blockIndex];
                if (!week || !block) return null;

                return (
                    <TitleSuggestionModal
                        isOpen={!!titleModalInfo}
                        onClose={() => setTitleModalInfo(null)}
                        onSelectTitle={(title) => handleSelectTitle(titleModalInfo.weekNumber, titleModalInfo.blockIndex, title)}
                        weekNumber={titleModalInfo.weekNumber}
                        blockIndex={titleModalInfo.blockIndex}
                        theme={week.theme || 'Nessun tema definito'}
                        objective={block.objective || ''}
                        moduleTitle={block.module || ''}
                        tipologia={block.tipologia || ''}
                    />
                );
            })()}
        </>
    );
};

export default StrategicDashboardView;
