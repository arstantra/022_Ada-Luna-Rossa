import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Conversation, WeekRouteInfo, BlockDetails, ModuleDetails, WeekPlan, BlockStatus, LessonType, TeachingMethodology, CourseModule, Activity, CourseContentUnit, FslPeriod } from '../types';
import { LESSON_TYPE_LABELS, COURSE_CONTENT_TYPE_LABELS, TEACHING_METHODOLOGY_LABELS } from '../constants';
import { ClipboardDocumentCheckIcon, WandIcon, SparklesIcon, ChevronDownIcon, ArrowDownTrayIcon, PencilIcon, HomeIcon } from './Icons';
import * as GeminiService from '../services/gemini';
import EditableField from './EditableField';
import EditableTextarea from './EditableTextarea';
import ObjectiveSuggestionModal from './ObjectiveSuggestionModal';
import TitleSuggestionModal from './TitleSuggestionModal';
import { getExactDateForBlock, isWeekInFslPeriod } from '../utils';

interface StrategicDashboardViewProps {
    conversations: Conversation[];
    weeks: WeekRouteInfo[];
    modules: ModuleDetails[];
    contentUnits: CourseContentUnit[];
    progettazioneText: string;
    onClose: () => void;
    onUpdateWeekTheme: (weekNumber: number, theme: string) => void;
    onUpdateBlockObjective: (weekNumber: number, blockIndex: number, objective: string) => void;
    onUpdateBlockSubject: (weekNumber: number, blockIndex: number, lessonSubject: string) => void;
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
    onUpdateBlockMetodologia: (weekNumber: number, blockIndex: number, metodologia: TeachingMethodology | '') => void;
    parsedMethodologies: TeachingMethodology[]; // metodologie trovate nel Progetto Didattico
    fslPeriods: FslPeriod[]; // periodi FSL globali — badge derivato automaticamente
    onToggleExternalExpert: (weekNumber: number, blockIndex: number, value: boolean) => void;
    onUpdateExternalExpertName: (weekNumber: number, blockIndex: number, name: string) => void;
    onToggleFuoriAula: (weekNumber: number, blockIndex: number, value: boolean) => void;
    onUpdateLuogo: (weekNumber: number, blockIndex: number, luogo: string) => void;
    allActivities?: Activity[];
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
    teacherProfile: string;
    /** Coda dei contenuti: archivia un contenuto distaccato (resta nella storia, esce dalla coda) */
    onArchiveDetached?: (convoId: string, detachedId: string) => void;
    /** Coda dei contenuti: ricolloca un contenuto distaccato sul primo blocco libero */
    onRelocateDetached?: (convoId: string, detachedId: string) => void;
}

const StrategicDashboardView: React.FC<StrategicDashboardViewProps> = ({ conversations, weeks, modules, contentUnits, progettazioneText, onClose, onUpdateWeekTheme, onUpdateBlockObjective, onUpdateBlockSubject, onUpdateBlockTitle, onGenerateStrategicSuggestions, onSaveStrategicData, onGenerateBlockDetails, onUpdateWeekDetails, onUpdateBlockDetails, onStartPlanning, onUpdateBlockModule, onUpdateBlockStatus, onUpdateBlockTipologia, onUpdateBlockMetodologia, parsedMethodologies, fslPeriods, onToggleExternalExpert, onUpdateExternalExpertName, onToggleFuoriAula, onUpdateLuogo, allActivities: allActivitiesProp, showToast, teacherProfile, onArchiveDetached, onRelocateDetached }) => {
    const [generatingThemeFor, setGeneratingThemeFor] = useState<number | null>(null);
    const [objectiveModalInfo, setObjectiveModalInfo] = useState<{ weekNumber: number; blockIndex: number; } | null>(null);
    const [titleModalInfo, setTitleModalInfo] = useState<{ weekNumber: number; blockIndex: number; } | null>(null);
    const [allExpanded, setAllExpanded] = useState(false);
    const weeksContainerRef = useRef<HTMLDivElement>(null);
    // Dropdown CONTESTO — chiave `${weekNumber}-${blockIndex}`
    const [openContextMenu, setOpenContextMenu] = useState<string | null>(null);
    // Chiavi dei blocchi il cui TITOLO è in modalità modifica manuale
    const [editingTitleKeys, setEditingTitleKeys] = useState<Set<string>>(new Set());
    const contextMenuRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

    // Chiudi CONTESTO dropdown su click fuori
    useEffect(() => {
        if (!openContextMenu) return;
        const handler = (e: MouseEvent) => {
            const el = contextMenuRefs.current.get(openContextMenu);
            if (el && !el.contains(e.target as Node)) setOpenContextMenu(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [openContextMenu]);

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
        if (!block || (!block.lessonSubject?.trim() && !block.objective?.trim())) {
            showToast("Definisci prima l'argomento della lezione o l'obiettivo didattico.", 'error');
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

        if (moduleName && progettazioneText) {
            const moduleSections = progettazioneText.split(/(?=^MODULO \d+:)/gm);
            const fullModuleText = moduleSections.find(s => s.trim().startsWith(moduleName))?.trim() || '';

            if (fullModuleText) {
                const firstSectionIndex = fullModuleText.search(/⦁\s*Concetti Chiave|⦁\s*Competenze Operative|⦁\s*Attività Chiave:/);
                newLessonTitle = (firstSectionIndex !== -1)
                    ? fullModuleText.substring(0, firstSectionIndex).trim()
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
          .block-header { background-color: #f9fafb; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; }
          .block-header h3 { font-size: 1.25em; margin: 0; color: #111827; }
          .block-saltato { background-color: #fef2f2; }
          .block-saltato .block-header { background-color: #fee2e2; border-bottom-color: #fecaca; }
          .block-saltato .block-header h3 { color: #b91c1c; }
          .block-da-definire { background-color: #f9fafb; border-style: dashed; }
          .block-details { padding: 1rem; }
          .block-details h4 { margin-top: 1rem; margin-bottom: 0.5rem; font-size: 1em; font-weight: 600; color: #4b5563; border-bottom: 1px dotted #d1d5db; padding-bottom: 0.25rem; }
          .block-details p { margin: 0 0 1rem 0; white-space: pre-wrap; font-size: 0.95em; }
          .block-subject { font-style: italic; font-size: 0.9em; color: #6b7280; margin: 0.2rem 0 0.6rem; }
          .meta-row { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
          .meta-pill { font-family: 'Inter', monospace; font-size: 0.8em; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 0.1em 0.5em; color: #374151; }
          .badge { font-family: 'Inter', sans-serif; font-size: 0.72em; font-weight: 600; border-radius: 4px; padding: 0.15em 0.5em; white-space: nowrap; }
          .badge-fsl { background: #e0f2fe; color: #0369a1; }
          .badge-esp { background: #fef3c7; color: #92400e; }
          .badge-fuori { background: #ccfbf1; color: #0f766e; }
          .badge-da-definire { background: #f3f4f6; color: #6b7280; border: 1px dashed #d1d5db; }
          .motivo { font-size: 0.88em; color: #b91c1c; font-style: italic; margin-top: 0.25rem; }
          .week-summary { margin-top: 2rem; padding-top: 1rem; border-top: 1px dashed #d1d5db; }
          .week-summary h4 { margin-top: 1rem; margin-bottom: 0.5rem; font-size: 1em; font-weight: 600; color: #4b5563; }
        `;

        const content = weekData.map(week => `
            <div class="week">
                <div class="week-header">
                    <h2>Settimana ${week.weekNumber}: ${escapeHtml(week.theme)}</h2>
                    <p>${escapeHtml(week.dates)}</p>
                </div>
                ${week.blocks.filter(block => block.status !== 'annullato').map((block, index) => {
                    const isSaltato = block.status === 'saltato';
                    const isDaDefinire = block.status === 'da definire';
                    const blockClass = isSaltato ? 'block block-saltato' : isDaDefinire ? 'block block-da-definire' : 'block';

                    // Badges (FSL, ESP, FUORI, da-definire)
                    const badges: string[] = [];
                    if (isDaDefinire) badges.push('<span class="badge badge-da-definire">Da definire</span>');
                    if (isWeekInFslPeriod(week.weekNumber, fslPeriods)) badges.push('<span class="badge badge-fsl">FSL</span>');
                    if (block.hasExternalExpert) {
                        const expertLabel = block.externalExpertName ? ` (${escapeHtml(block.externalExpertName)})` : '';
                        badges.push(`<span class="badge badge-esp">ESP${expertLabel}</span>`);
                    }
                    if (block.isFuoriAula) {
                        const luogoLabel = block.luogo ? ` (${escapeHtml(block.luogo)})` : '';
                        badges.push(`<span class="badge badge-fuori">FUORI${luogoLabel}</span>`);
                    }

                    // Meta pills (tipologia + metodologia)
                    const metaPills: string[] = [];
                    if (block.tipologia) metaPills.push(`<span class="meta-pill">${escapeHtml(LESSON_TYPE_LABELS[block.tipologia])}</span>`);
                    if (block.metodologia) metaPills.push(`<span class="meta-pill">${escapeHtml(TEACHING_METHODOLOGY_LABELS[block.metodologia])}</span>`);

                    const titleLine = escapeHtml(block.blockTitle || block.objective) || (isSaltato ? 'Blocco saltato' : 'Blocco non definito');

                    return `
                    <div class="${blockClass}">
                        <div class="block-header">
                            <h3>Blocco ${index + 1}: ${titleLine}</h3>
                            ${badges.length > 0 ? badges.join('') : ''}
                        </div>
                        <div class="block-details">
                            ${block.lessonSubject ? `<p class="block-subject">${escapeHtml(block.lessonSubject)}</p>` : ''}
                            ${metaPills.length > 0 ? `<div class="meta-row">${metaPills.join('')}</div>` : ''}
                            ${isSaltato
                                ? `<p class="motivo">${block.reason ? `Motivo: ${escapeHtml(block.reason)}` : 'Lezione saltata'}</p>`
                                : `
                            <h4>Obiettivo Didattico</h4>
                            <p>${nl2br(block.objective) || '<em>Non definito</em>'}</p>
                            <h4>Unità Didattica</h4>
                            <p>${escapeHtml(block.module) || '<em>Non specificata</em>'}</p>
                            `}
                        </div>
                    </div>`;
                }).join('')}
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
    const pendingItems = useMemo(() => {
        const items: { convoId: string; item: import('../types').DetachedLesson }[] = [];
        for (const c of conversations) {
            for (const d of c.pendingContent || []) {
                if (!d.archiviata) items.push({ convoId: c.id, item: d });
            }
        }
        return items.sort((a, b) => new Date(b.item.detachedAt).getTime() - new Date(a.item.detachedAt).getTime());
    }, [conversations]);
    const pendingContentCount = pendingItems.length;
    const [isQueueOpen, setIsQueueOpen] = useState(false);

    // ── Progresso globale del corso ────────────────────────────────────────────
    const progressStats = useMemo(() => {
        let completate = 0, inCorso = 0, daFare = 0, saltate = 0;
        weekData.forEach(week => {
            const states = week.blocks.map(b => getBlockProgressState(b));
            const allSpeciale = states.every(s => s === 'speciale');
            const allDone = states.every(s => s === 'completato' || s === 'speciale');
            const anyInCorso = states.some(s => s === 'in_corso');
            if (allSpeciale) saltate++;
            else if (allDone) completate++;
            else if (anyInCorso) inCorso++;
            else daFare++;
        });
        return { completate, inCorso, daFare, saltate, total: weekData.length };
    }, [weekData]);

    const allActivities = allActivitiesProp ?? [];

    // Mappa blockId → indice assoluto nel corso (per calcolare blocchi rimanenti attività)
    const blockAbsoluteIndex = useMemo(() => {
        const map = new Map<string, number>();
        let abs = 0;
        weekData.forEach(w => { w.blocks.forEach(b => { map.set(b.id, abs++); }); });
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
                            <button onClick={onClose} className="flex-shrink-0 p-1.5 text-gray-500 hover:text-purple-400 rounded-lg hover:bg-purple-500/10 transition-colors" title="Torna alla home">
                                <HomeIcon className="h-4 w-4" />
                            </button>
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
                                {progressStats.saltate > 0 && (
                                    <span className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500/70 whitespace-nowrap">
                                        <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-500" />
                                        saltata{progressStats.saltate !== 1 ? 'e' : ''}
                                    </span>
                                )}
                                <span className="text-[10px] text-gray-600 font-mono">{progressStats.completate + progressStats.inCorso + progressStats.daFare + progressStats.saltate} / {progressStats.total}</span>
                            </div>
                        )}
                        {pendingContentCount > 0 && (
                            <>
                                <span className="w-px h-3 bg-gray-800/70 flex-shrink-0" />
                                <button
                                    onClick={() => setIsQueueOpen(p => !p)}
                                    className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[10px] font-mono text-amber-400/90 whitespace-nowrap hover:bg-amber-500/20 hover:border-amber-400/40 transition-colors"
                                    title="Contenuti distaccati da blocchi saltati, in attesa di collocazione — click per gestire la coda"
                                >
                                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                                    {pendingContentCount} {pendingContentCount === 1 ? 'contenuto in sospeso' : 'contenuti in sospeso'}
                                    <ChevronDownIcon className={`h-3 w-3 transition-transform duration-200 ${isQueueOpen ? 'rotate-180' : ''}`} />
                                </button>
                            </>
                        )}
                    </div>

                    {/* ── Coda dei contenuti (pannello inline) ─────────────────── */}
                    {isQueueOpen && pendingContentCount > 0 && (
                        <div className="px-6 pb-3">
                            <div className="rounded-xl border border-amber-500/25 bg-gray-800/55 p-3.5 space-y-2">
                                <p className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-400/80">Coda dei contenuti</p>
                                {pendingItems.map(({ convoId, item }) => (
                                    <div key={item.id} className="flex items-start gap-3 bg-gray-900/50 rounded-lg border border-gray-600/40 px-3 py-2.5">
                                        <div className="flex-1 min-w-0">
                                            <span className="text-[9px] font-mono uppercase tracking-wider text-gray-500">
                                                da Settimana {item.sourceWeekNumber} · {item.sourceDay} · staccato il {new Date(item.detachedAt).toLocaleDateString('it-IT')}
                                                {item.distribuita && <span className="text-sky-400/80 ml-1.5">distribuito su Classroom</span>}
                                            </span>
                                            <p className="text-sm text-gray-200 mt-0.5 truncate" title={item.objective || item.lessonTitle}>
                                                {item.lessonTitle || item.objective || 'Contenuto senza titolo'}
                                            </p>
                                            {item.objective && item.lessonTitle && (
                                                <p className="text-xs text-gray-500 truncate" title={item.objective}>{item.objective}</p>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            {onRelocateDetached && (
                                                <button
                                                    onClick={() => onRelocateDetached(convoId, item.id)}
                                                    className="px-2.5 py-1 text-[11px] font-medium text-white bg-blue-600/80 rounded-lg hover:bg-blue-500 shadow-sm shadow-blue-900/40 transition-colors"
                                                    title="Ricolloca sul primo blocco libero disponibile"
                                                >
                                                    Rimanda
                                                </button>
                                            )}
                                            {onArchiveDetached && (
                                                <button
                                                    onClick={() => onArchiveDetached(convoId, item.id)}
                                                    className="px-2.5 py-1 text-[11px] text-gray-300 hover:text-white rounded-md hover:bg-gray-800/60 transition-colors"
                                                    title="Archivia: resta nella storia del corso, esce dalla coda"
                                                >
                                                    Archivia
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
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
                                        // Attività legate a questo blocco
                                        const blockActivities = isSpecialStatus ? [] : allActivities.filter(a => a.blockId === block.id);

                                        const ctxKey = `${week.weekNumber}-${index}`;
                                        const isCtxOpen = openContextMenu === ctxKey;
                                        const activeFlags = [
                                            isWeekInFslPeriod(week.weekNumber, fslPeriods) && 'Periodo FSL',
                                            block.hasExternalExpert && 'Esperto esterno',
                                            block.isFuoriAula && 'Fuori aula',
                                        ].filter(Boolean) as string[];

                                        return (
                                        <details key={block.id} className="group/inner bg-gray-900/50 rounded-lg border border-gray-600/40">
                                            <summary className="list-none [&::-webkit-details-marker]:hidden px-4 py-3 flex items-start gap-3 cursor-pointer hover:bg-gray-800/50 transition-colors select-none">
                                                <div className="flex-grow flex flex-col gap-2 min-w-0">
                                                    {/* Riga 1: label blocco · data · badge · Salta la lezione · chevron */}
                                                    <div className="flex items-center gap-2.5">
                                                        <span className="font-mono text-[11px] font-medium text-gray-500 flex-shrink-0 uppercase tracking-widest">Bl.{index + 1}{dateString}</span>
                                                        <BlockStateBadge state={blockState} />
                                                        <div className="flex items-center gap-1 ml-auto flex-shrink-0 no-print">
                                                            {(block.status === 'da definire' || block.status === 'normale') ? (
                                                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpdateBlockStatus(week.weekNumber, index, 'saltato'); }} className="px-2 py-1 text-xs font-medium text-red-400/70 border border-red-500/20 rounded-md hover:bg-red-500/15 hover:text-red-300 hover:border-red-400/35 transition-all" title="Imposta blocco come saltato">Salta la lezione</button>
                                                            ) : (
                                                                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpdateBlockStatus(week.weekNumber, index, 'normale'); }} className="px-2 py-1 text-xs font-medium text-gray-400 border border-gray-600/40 rounded-md hover:bg-gray-700/50 hover:text-gray-200 transition-all">Ripristina</button>
                                                            )}
                                                            <ChevronDownIcon className="h-5 w-5 text-gray-500 transition-transform duration-300 group-open/inner:rotate-180 ml-1" />
                                                        </div>
                                                    </div>
                                                    {/* Riga 2: TITOLO label + testo display + matitina sempre visibile */}
                                                    {block.status === 'saltato' ? (
                                                        <EditableField value={block.reason || ''} onSave={(newReason) => onUpdateBlockStatus(week.weekNumber, index, 'saltato', newReason)} placeholder="Motivo per cui il blocco è saltato..." className="!text-red-400 placeholder:!text-red-400/50" />
                                                    ) : (
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <span className="text-[9px] font-mono font-medium tracking-[0.12em] uppercase text-gray-500/80 flex-shrink-0">Titolo</span>
                                                            {editingTitleKeys.has(ctxKey) ? (
                                                                <div className="flex items-center gap-1.5 flex-grow min-w-0">
                                                                    <EditableField
                                                                        value={block.blockTitle || ''}
                                                                        onSave={(val) => {
                                                                            onUpdateBlockTitle(week.weekNumber, index, val);
                                                                            setEditingTitleKeys(prev => { const s = new Set(prev); s.delete(ctxKey); return s; });
                                                                        }}
                                                                        placeholder="Titolo accattivante per gli studenti…"
                                                                    />
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingTitleKeys(prev => { const s = new Set(prev); s.delete(ctxKey); return s; }); }}
                                                                        className="flex-shrink-0 text-blue-400 hover:text-blue-300 transition-colors p-0.5 no-print"
                                                                        title="Chiudi modifica"
                                                                    >
                                                                        <PencilIcon className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1.5 flex-grow min-w-0">
                                                                    <span className={`flex-grow min-w-0 text-base font-display truncate leading-snug ${block.blockTitle ? 'text-gray-500' : 'text-gray-700 italic'}`}>
                                                                        {block.blockTitle || '— titolo da generare —'}
                                                                    </span>
                                                                    <button
                                                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingTitleKeys(prev => new Set([...prev, ctxKey])); }}
                                                                        className="flex-shrink-0 text-gray-600 hover:text-gray-400 transition-colors p-0.5 no-print"
                                                                        title="Modifica il titolo"
                                                                    >
                                                                        <PencilIcon className="h-3 w-3" />
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </summary>
                                            {/* ── Sezione espansa ── */}
                                            <div className="border-t border-gray-700/30 px-4 py-3 space-y-3 bg-gray-900/20">
                                                {/* COSA / COME / APPROCCIO / CONTESTO */}
                                                <div className={`space-y-1.5 ${isSpecialStatus ? 'opacity-40 pointer-events-none' : ''}`}>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        <span className="text-[9px] font-mono font-medium tracking-[0.12em] uppercase text-gray-500/80">Cosa</span>
                                                        <span className="text-[9px] font-mono font-medium tracking-[0.12em] uppercase text-gray-500/80">Come</span>
                                                        <span className="text-[9px] font-mono font-medium tracking-[0.12em] uppercase text-gray-500/80">Approccio</span>
                                                        <span className="text-[9px] font-mono font-medium tracking-[0.12em] uppercase text-gray-500/80">Contesto</span>
                                                    </div>
                                                    <div className="grid grid-cols-4 gap-2">
                                                        {/* COSA */}
                                                        <select
                                                            value={block.module || ''}
                                                            onChange={(e) => handleModuleChange(week.weekNumber, index, e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={selectKeyDownHandler}
                                                            disabled={isSpecialStatus || block.isLocked}
                                                            className="w-full bg-gray-800 border border-gray-600/70 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="" disabled>— unità didattica —</option>
                                                            {contentUnits.length > 0
                                                                ? (['modulo', 'uda', 'educazione_civica', 'fsl'] as const).flatMap(type => {
                                                                    const units = contentUnits.filter(u => u.type === type);
                                                                    if (units.length === 0) return [];
                                                                    return [
                                                                        <optgroup key={type} label={COURSE_CONTENT_TYPE_LABELS[type]}>
                                                                            {units.map(u => (
                                                                                <option key={u.id} value={u.title}>{COURSE_CONTENT_TYPE_LABELS[u.type]} {u.order}: {u.title}</option>
                                                                            ))}
                                                                        </optgroup>
                                                                    ];
                                                                })
                                                                : modules.map(m => <option key={m.name} value={m.name}>{m.name}</option>)
                                                            }
                                                        </select>
                                                        {/* COME */}
                                                        <select
                                                            value={block.tipologia || ''}
                                                            onChange={(e) => onUpdateBlockTipologia(week.weekNumber, index, e.target.value as LessonType | '')}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={selectKeyDownHandler}
                                                            disabled={isSpecialStatus}
                                                            className="w-full bg-gray-800 border border-gray-600/70 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="" disabled>— tipologia di lezione —</option>
                                                            {(Object.entries(LESSON_TYPE_LABELS) as [LessonType, string][]).map(([key, label]) => (
                                                                <option key={key} value={key}>{label}</option>
                                                            ))}
                                                        </select>
                                                        {/* APPROCCIO */}
                                                        <select
                                                            value={block.metodologia || (parsedMethodologies.length === 0 ? 'tradizionale' : '')}
                                                            onChange={(e) => onUpdateBlockMetodologia(week.weekNumber, index, e.target.value as TeachingMethodology | '')}
                                                            onClick={(e) => e.stopPropagation()}
                                                            onKeyDown={selectKeyDownHandler}
                                                            disabled={isSpecialStatus}
                                                            className="w-full bg-gray-800 border border-gray-600/70 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
                                                        >
                                                            <option value="" disabled>— approccio —</option>
                                                            {parsedMethodologies.length > 0 && (
                                                                <optgroup label="· nel corso">
                                                                    {parsedMethodologies.map(m => (
                                                                        <option key={m} value={m}>{TEACHING_METHODOLOGY_LABELS[m]}</option>
                                                                    ))}
                                                                </optgroup>
                                                            )}
                                                            <optgroup label={parsedMethodologies.length > 0 ? '· altre' : ''}>
                                                                {(Object.entries(TEACHING_METHODOLOGY_LABELS) as [TeachingMethodology, string][])
                                                                    .filter(([key]) => !parsedMethodologies.includes(key))
                                                                    .map(([key, label]) => (
                                                                        <option key={key} value={key}>{label}</option>
                                                                    ))
                                                                }
                                                            </optgroup>
                                                        </select>
                                                        {/* CONTESTO — dropdown custom multi-flag */}
                                                        <div className="relative" ref={(el) => { if (el) contextMenuRefs.current.set(ctxKey, el); else contextMenuRefs.current.delete(ctxKey); }}>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenContextMenu(isCtxOpen ? null : ctxKey); }}
                                                                disabled={isSpecialStatus}
                                                                className={`w-full flex items-center justify-between gap-1 bg-gray-800 border rounded-md px-2 py-1.5 text-xs text-left focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed transition-colors ${isCtxOpen ? 'border-blue-500/50' : 'border-gray-600/70'}`}
                                                            >
                                                                <span className={`truncate ${activeFlags.length > 0 ? 'text-white' : 'text-gray-500'}`}>
                                                                    {activeFlags.length > 0 ? activeFlags.join(' · ') : '— nessuno —'}
                                                                </span>
                                                                <ChevronDownIcon className={`h-3 w-3 text-gray-500 flex-shrink-0 transition-transform ${isCtxOpen ? 'rotate-180' : ''}`} />
                                                            </button>
                                                            {isCtxOpen && (
                                                                <div className="absolute z-50 top-full left-0 mt-1 w-full min-w-[185px] border border-gray-600/80 rounded-lg shadow-xl shadow-black/50 overflow-hidden" style={{backgroundColor: '#1c2333'}}>
                                                                    {/* FSL: derivato automaticamente dai periodi globali — read-only */}
                                                                    {isWeekInFslPeriod(week.weekNumber, fslPeriods) && (
                                                                        <div className="flex items-center gap-2.5 px-3 py-2 text-xs border-b border-gray-700/50">
                                                                            <span className="w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center bg-sky-500/20 border-sky-500/40">
                                                                                <span className="text-sky-400 font-bold leading-none" style={{fontSize:'8px'}}>✓</span>
                                                                            </span>
                                                                            <span className="text-sky-400">Periodo FSL</span>
                                                                            <span className="ml-auto text-[9px] font-mono text-gray-600">auto</span>
                                                                        </div>
                                                                    )}
                                                                    {[
                                                                        { key: 'esp', label: 'Esperto esterno', activeColor: 'text-amber-400', active: !!block.hasExternalExpert, onToggle: () => { onToggleExternalExpert(week.weekNumber, index, !block.hasExternalExpert); } },
                                                                        { key: 'fuori', label: 'Fuori aula', activeColor: 'text-teal-400', active: !!block.isFuoriAula, onToggle: () => { onToggleFuoriAula(week.weekNumber, index, !block.isFuoriAula); } },
                                                                    ].map(item => (
                                                                        <button
                                                                            key={item.key}
                                                                            type="button"
                                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); item.onToggle(); }}
                                                                            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-gray-700/60 transition-colors text-left"
                                                                        >
                                                                            <span className={`w-3.5 h-3.5 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${item.active ? 'bg-blue-500 border-blue-500' : 'border-gray-600'}`}>
                                                                                {item.active && <span className="text-white font-bold leading-none" style={{fontSize:'8px'}}>✓</span>}
                                                                            </span>
                                                                            <span className={item.active ? item.activeColor : 'text-gray-400'}>{item.label}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                                {/* ARGOMENTO */}
                                                <div>
                                                    <label className="text-[9px] font-mono font-medium tracking-[0.14em] uppercase text-gray-500/80 block mb-1">Argomento</label>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-grow min-w-0">
                                                            <EditableField value={block.lessonSubject || ''} onSave={(val) => onUpdateBlockSubject(week.weekNumber, index, val)} placeholder="Argomento specifico della lezione (es. Vetrate gotiche)…" disabled={isSpecialStatus} />
                                                        </div>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleGenerateTitle(week.weekNumber, index); }}
                                                            disabled={isSpecialStatus}
                                                            className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-purple-400 border border-purple-500/25 rounded-md hover:bg-purple-500/10 hover:border-purple-400/40 hover:text-purple-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed no-print"
                                                            title="Genera il titolo accattivante per gli studenti (richiede argomento compilato)"
                                                        >
                                                            <SparklesIcon className="h-3 w-3" />
                                                            Genera titolo
                                                        </button>
                                                    </div>
                                                </div>
                                                {/* OBIETTIVO DIDATTICO */}
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <label className="text-[9px] font-mono font-medium tracking-[0.14em] uppercase text-gray-500/80">Obiettivo Didattico</label>
                                                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleGenerateObjective(week.weekNumber, index); }} disabled={isSpecialStatus} className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-purple-400 border border-purple-500/25 rounded-md hover:bg-purple-500/10 hover:border-purple-400/40 hover:text-purple-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed no-print" title="Suggerisci obiettivo didattico con Ada">
                                                            <SparklesIcon className="h-3 w-3" />
                                                            Suggerisci obiettivo
                                                        </button>
                                                    </div>
                                                    <EditableTextarea value={block.objective || ''} onSave={(val) => onUpdateBlockObjective(week.weekNumber, index, val)} placeholder="Obiettivo pedagogico formale: cosa sapranno fare gli studenti al termine del blocco..." rows={2} disabled={isSpecialStatus} />
                                                </div>
                                                {/* ESPERTO ESTERNO — solo se attivo */}
                                                {block.hasExternalExpert && (
                                                    <div>
                                                        <label className="text-[9px] font-mono font-medium tracking-[0.14em] uppercase text-amber-500/60 mb-1 block">Esperto esterno</label>
                                                        <EditableField value={block.externalExpertName || ''} onSave={(val) => onUpdateExternalExpertName(week.weekNumber, index, val)} placeholder="Nome e ruolo dell'esperto (es. Arch. Bianchi — Studio XY)…" />
                                                    </div>
                                                )}
                                                {/* LUOGO — solo se fuori aula */}
                                                {block.isFuoriAula && (
                                                    <div>
                                                        <label className="text-[9px] font-mono font-medium tracking-[0.14em] uppercase text-teal-500/60 mb-1 block">Luogo</label>
                                                        <EditableField value={block.luogo || ''} onSave={(val) => onUpdateLuogo(week.weekNumber, index, val)} placeholder="Destinazione o luogo (es. Museo del Design, Milano)…" />
                                                    </div>
                                                )}
                                                {/* ATTIVITÀ — lista read-only, rosso scuro, blocchi rimanenti */}
                                                {!isSpecialStatus && blockActivities.length > 0 && (() => {
                                                    const STATUS_DOT: Record<string, string> = { progettata: 'bg-rose-900/80', lanciata: 'bg-rose-700', in_corso: 'bg-rose-700', consegnata: 'bg-emerald-500', scaduta: 'bg-gray-500', annullata: 'bg-gray-500' };
                                                    const CONTESTO_LABELS: Record<string, string> = { in_aula: 'In aula', misto: 'Misto', autonoma: 'Autonoma' };
                                                    return (
                                                        <div className="rounded-lg border border-rose-900/30 bg-rose-950/20 p-3 space-y-1.5">
                                                            <label className="text-[9px] font-mono font-medium tracking-[0.14em] uppercase text-rose-700/70 block mb-2">Attività</label>
                                                            {blockActivities.map(a => {
                                                                const launchAbs = blockAbsoluteIndex.get(a.blockId) ?? -1;
                                                                const currentAbs = blockAbsoluteIndex.get(block.id) ?? -1;
                                                                const elapsed = launchAbs >= 0 && currentAbs >= 0 ? currentAbs - launchAbs : 0;
                                                                const remaining = a.durationInBlocks != null ? Math.max(0, a.durationInBlocks - elapsed) : null;
                                                                return (
                                                                    <div key={a.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-rose-900/30 bg-rose-950/30 text-[10px] font-mono">
                                                                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[a.status] ?? 'bg-gray-500'}`} />
                                                                        <span className="flex-grow truncate text-rose-300/80">{a.title}</span>
                                                                        {a.contesto && (
                                                                            <span className="flex-shrink-0 text-[9px] font-mono text-rose-700/70">{CONTESTO_LABELS[a.contesto] ?? a.contesto}</span>
                                                                        )}
                                                                        {remaining !== null && (
                                                                            <span className="flex-shrink-0 text-[9px] font-mono text-rose-600/60">
                                                                                {remaining === 0 ? '· conclusa' : `· ${remaining} bl. al termine`}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    );
                                                })()}
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
                        lessonSubject={block.lessonSubject || ''}
                    />
                );
            })()}
        </>
    );
};

export default StrategicDashboardView;
