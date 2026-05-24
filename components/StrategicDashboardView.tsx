import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Conversation, WeekRouteInfo, BlockDetails, ModuleDetails, WeekPlan, BlockStatus, LessonType, CourseModule, Activity } from '../types';
import { LESSON_TYPE_LABELS } from '../constants';
import { ClipboardDocumentCheckIcon, WandIcon, SparklesIcon, ChevronDownIcon, ArrowDownTrayIcon } from './Icons';
import * as GeminiService from '../services/gemini';
import EditableField from './EditableField';
import EditableTextarea from './EditableTextarea';
import ObjectiveSuggestionModal from './ObjectiveSuggestionModal';
import { getExactDateForBlock } from '../utils';
import DidacticRadarChart from './DidacticRadarChart';


interface StrategicDashboardViewProps {
    conversations: Conversation[];
    weeks: WeekRouteInfo[];
    modules: ModuleDetails[];
    constitutionText: string;
    onClose: () => void;
    onUpdateWeekTheme: (weekNumber: number, theme: string) => void;
    onUpdateBlockObjective: (weekNumber: number, blockIndex: number, objective: string) => void;
    onGenerateStrategicSuggestions: (prompt: string, module: string) => Promise<{ theme: string; objectives: string[]; reasoning: string; }>;
    onSaveStrategicData: (weekNumber: number, theme: string, objectives: string[]) => void;
    onGenerateBlockDetails: (weekNumber: number, blockIndex: number) => Promise<void>;
    onUpdateWeekDetails: (weekNumber: number, details: Partial<Pick<WeekPlan, 'notes'>>) => void;
    onUpdateBlockDetails: (weekNumber: number, blockIndex: number, details: Partial<Pick<BlockDetails, 'lessonTitle' | 'lessonSyllabus' | 'lessonMaterials' | 'isLocked'>>) => void;
    onStartPlanning: (weekInfo: WeekRouteInfo) => void;
    onUpdateBlockModule: (weekNumber: number, blockIndex: number, module: string, lessonTitle: string) => void;
    onUpdateBlockStatus: (weekNumber: number, blockIndex: number, status: BlockStatus, reason?: string) => void;
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
    teacherProfile: string;
}

const StrategicDashboardView: React.FC<StrategicDashboardViewProps> = ({ conversations, weeks, modules, constitutionText, onClose, onUpdateWeekTheme, onUpdateBlockObjective, onGenerateStrategicSuggestions, onSaveStrategicData, onGenerateBlockDetails, onUpdateWeekDetails, onUpdateBlockDetails, onStartPlanning, onUpdateBlockModule, onUpdateBlockStatus, showToast, teacherProfile }) => {
    const [generatingThemeFor, setGeneratingThemeFor] = useState<number | null>(null);
    const [objectiveModalInfo, setObjectiveModalInfo] = useState<{ weekNumber: number; blockIndex: number; } | null>(null);
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
            (b.status === 'normale' || b.status === 'da definire') && b.objective && b.objective.trim()
        );
    
        const objectivesContext = relevantBlocks.map((b, i) => 
            `- Obiettivo ${i + 1}: ${b.objective}`
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
        if (!block || !block.lessonSyllabus || !block.module) {
            showToast("Assicurati di aver inserito un'idea/prompt e selezionato un modulo.", 'error');
            return;
        }
        setObjectiveModalInfo({ weekNumber, blockIndex });
    };

    const handleSelectObjective = (weekNumber: number, blockIndex: number, objective: string) => {
        onUpdateBlockObjective(weekNumber, blockIndex, objective);
        onUpdateBlockDetails(weekNumber, blockIndex, { isLocked: true });
        setObjectiveModalInfo(null);
        showToast(`Obiettivo aggiornato per il Blocco ${blockIndex + 1}.`, 'success');
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
                            <h3>Blocco ${index + 1}: ${escapeHtml(block.objective)}</h3>
                        </div>
                        <div class="block-details">
                            <h4>Titolo Lezione</h4>
                            <p>${nl2br(block.lessonTitle) || '<em>Non definito</em>'}</p>
                            <h4>Idea / Prompt per Ada</h4>
                            <p>${nl2br(block.lessonSyllabus) || '<em>Non definito</em>'}</p>
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

    // ── Radar equilibrio didattico ─────────────────────────────────────────────
    const radarData = useMemo(() => {
        const counts: Partial<Record<LessonType, number>> = {};
        conversations.forEach(conv => {
            if (!conv.weekPlan) return;
            conv.weekPlan.blocks.forEach(block => {
                if (!block.tipologia) return;
                if (block.status === 'saltato' || block.status === 'annullato') return;
                counts[block.tipologia] = (counts[block.tipologia] || 0) + 1;
            });
        });
        return (Object.entries(counts) as [LessonType, number][])
            .map(([tipologia, count]) => ({ tipologia, count }));
    }, [conversations]);

    // Ideal distribution: sum of estimatedBlocks per lessonType across all modules/sections
    const idealRadarData = useMemo(() => {
        const counts: Partial<Record<LessonType, number>> = {};
        conversations.forEach(conv => {
            (conv.modules ?? []).forEach(mod => {
                mod.sections.forEach(sec => {
                    if (!sec.lessonType || sec.estimatedBlocks <= 0) return;
                    counts[sec.lessonType] = (counts[sec.lessonType] || 0) + sec.estimatedBlocks;
                });
            });
        });
        return (Object.entries(counts) as [LessonType, number][])
            .map(([tipologia, count]) => ({ tipologia, count }))
            .filter(d => d.count > 0);
    }, [conversations]);

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
                <div className="flex-shrink-0 flex items-center gap-4 px-5 py-3 border-b border-gray-800/60 bg-gray-900/80 backdrop-blur-sm no-print">
                    {/* Zona A — titolo fisso */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <ClipboardDocumentCheckIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        <h1 className="text-sm font-display font-semibold text-white">Progettazione del Corso</h1>
                    </div>

                    {/* Zona B — KPI progressStats (espansi, non nel mezzo del nulla) */}
                    {progressStats.total > 0 && (
                        <div className="flex items-center gap-2.5 flex-shrink-0" title="Stato blocchi: completati · in corso · da fare">
                            <div className="w-px h-3.5 bg-gray-700/60" />
                            {progressStats.completate > 0 && (
                                <span className="flex items-center gap-1 text-[11px] text-emerald-400/80 font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                                    {progressStats.completate}
                                </span>
                            )}
                            {progressStats.inCorso > 0 && (
                                <span className="flex items-center gap-1 text-[11px] text-amber-400/80 font-mono">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                    {progressStats.inCorso}
                                </span>
                            )}
                            <span className="flex items-center gap-1 text-[11px] text-slate-400/80 font-mono">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 flex-shrink-0" />
                                {progressStats.daFare}
                            </span>
                            <span className="text-[10px] text-gray-600 font-mono">/ {progressStats.total}</span>
                        </div>
                    )}

                    {/* Zona B2 — contenuti in sospeso */}
                    {pendingContentCount > 0 && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="w-px h-3.5 bg-gray-700/60" />
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] font-mono text-amber-400/90" title="Contenuti distaccati da blocchi saltati, in attesa di collocazione">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                                {pendingContentCount} {pendingContentCount === 1 ? 'contenuto in sospeso' : 'contenuti in sospeso'}
                            </span>
                        </div>
                    )}

                    {/* Zona B3 — radar equilibrio didattico */}
                    {radarData.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                            <div className="w-px h-3.5 bg-gray-700/60" />
                            <DidacticRadarChart
                                data={radarData}
                                idealData={idealRadarData.length > 0 ? idealRadarData : undefined}
                            />
                        </div>
                    )}

                    {/* Zona C — azioni (sempre a destra) */}
                    <div className="flex items-center gap-1 ml-auto">
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

                <div className="print-header hidden">
                     <h1>Quadro Sinottico di Progettazione</h1>
                     <p>{new Date().toLocaleDateString('it-IT')}</p>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div ref={weeksContainerRef} className="max-w-6xl mx-auto space-y-4">
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
                                                        {block.tipologia && (
                                                            <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">
                                                                {LESSON_TYPE_LABELS[block.tipologia]}
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
                                                                    value={block.objective || ''}
                                                                    onSave={(newObjective) => {
                                                                        onUpdateBlockObjective(week.weekNumber, index, newObjective);
                                                                        if (newObjective) {
                                                                            onUpdateBlockDetails(week.weekNumber, index, { isLocked: true });
                                                                        }
                                                                    }}
                                                                    placeholder="Definisci l'obiettivo del blocco..."
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
                                                    <div className={`flex items-center gap-3 pl-8 ${isSpecialStatus ? 'opacity-50 pointer-events-none' : ''}`}>
                                                        <select
                                                            value={block.module || ''}
                                                            onChange={(e) => handleModuleChange(week.weekNumber, index, e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={selectKeyDownHandler}
                                                            disabled={isSpecialStatus || block.isLocked}
                                                            className="w-full md:w-1/2 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="">Seleziona Modulo...</option>
                                                            {modules.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
                                                        </select>
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
                                                        onClick={(e) => { e.preventDefault(); handleGenerateObjective(week.weekNumber, index); }}
                                                        disabled={isSpecialStatus}
                                                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 hover:text-purple-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed no-print"
                                                        title="Suggerisci obiettivo con AI"
                                                    >
                                                        <SparklesIcon className="h-3.5 w-3.5" />
                                                        AI
                                                    </button>
                                                    <ChevronDownIcon className="h-5 w-5 text-gray-500 transition-transform duration-300 group-open/inner:rotate-180" />
                                                </div>
                                            </summary>
                                            <div className="border-t border-gray-700/30 px-4 py-3 space-y-3 bg-gray-900/20">
                                                <div>
                                                    <label className="text-[9px] font-sans font-medium tracking-[0.14em] uppercase text-gray-500/80">Estratto dalla Costituzione</label>
                                                    <EditableTextarea value={block.lessonTitle || ''} onSave={(val) => onUpdateBlockDetails(week.weekNumber, index, { lessonTitle: val })} placeholder="Verrà popolato selezionando un modulo..." rows={1} disabled={isSpecialStatus || block.isLocked} />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-sans font-medium tracking-[0.14em] uppercase text-gray-500/80">Idea / Prompt per Ada</label>
                                                    <EditableTextarea value={block.lessonSyllabus || ''} onSave={(val) => onUpdateBlockDetails(week.weekNumber, index, { lessonSyllabus: val })} placeholder="Sequenza attività, concept, domande stimolo..." rows={2} disabled={isSpecialStatus || block.isLocked} />
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

                const moduleContext = block.lessonTitle || '';

                return (
                    <ObjectiveSuggestionModal
                        isOpen={!!objectiveModalInfo}
                        onClose={() => setObjectiveModalInfo(null)}
                        onSelectObjective={(objective) => handleSelectObjective(objectiveModalInfo.weekNumber, objectiveModalInfo.blockIndex, objective)}
                        weekNumber={objectiveModalInfo.weekNumber}
                        blockIndex={objectiveModalInfo.blockIndex}
                        theme={week.theme || 'Nessun tema definito'}
                        prompt={block.lessonSyllabus || ''}
                        moduleContext={moduleContext}
                    />
                );
            })()}
        </>
    );
};

export default StrategicDashboardView;
