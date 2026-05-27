import React, { useState, useCallback, useMemo } from 'react';
import type { useMasterContext } from '../hooks/useMasterContext';
import type { WeekEntry } from '../types';
import { CalendarDaysIcon, XIcon, PlusCircleIcon, TrashIcon } from './Icons';

interface RouteViewProps {
    masterContext: ReturnType<typeof useMasterContext>;
    onClose: () => void;
}

const DAYS_OF_WEEK = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

/** Calcola la data della domenica dato il lunedì (ISO string). */
function getSunday(mondayIso: string): string {
    if (!mondayIso) return '';
    const d = new Date(mondayIso);
    if (isNaN(d.getTime())) return '';
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
}

/** Formatta una data ISO in "d mmm yyyy" in italiano. */
function formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00'); // evita problemi di timezone
    if (isNaN(d.getTime())) return '';
    return d.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Restituisce il numero di blocchi attivi in blockDayDefaults (quelli con un giorno assegnato). */
function getConfiguredBlockCount(defaults: Record<string, string>): number {
    const keys = Object.keys(defaults).filter(k => defaults[k]);
    if (keys.length === 0) return 3; // default
    return Math.max(...keys.map(Number)) + 1;
}

const RouteView: React.FC<RouteViewProps> = ({ masterContext, onClose }) => {
    const { blockDayDefaults, routeCalendar, handleSaveBlockDayDefaults, handleSaveRouteCalendar } = masterContext;

    // ── Stato locale giorni predefiniti ──────────────────────────────────────
    const [localDefaults, setLocalDefaults] = useState<Record<string, string>>(() => ({ ...blockDayDefaults }));

    const handleDayChange = useCallback((blockIndex: number, day: string) => {
        setLocalDefaults(prev => {
            const next = { ...prev };
            if (day) next[String(blockIndex)] = day;
            else delete next[String(blockIndex)];
            return next;
        });
        // Salva subito
        const next = { ...blockDayDefaults };
        if (day) next[String(blockIndex)] = day;
        else delete next[String(blockIndex)];
        handleSaveBlockDayDefaults(next);
    }, [blockDayDefaults, handleSaveBlockDayDefaults]);

    // ── Calendario settimane ──────────────────────────────────────────────────
    const [weeks, setWeeks] = useState<WeekEntry[]>(() =>
        routeCalendar.length > 0 ? routeCalendar : []
    );

    const totalBlocks = useMemo(() => getConfiguredBlockCount(localDefaults), [localDefaults]);

    const saveWeeks = useCallback((updated: WeekEntry[]) => {
        setWeeks(updated);
        handleSaveRouteCalendar(updated);
    }, [handleSaveRouteCalendar]);

    const addWeek = useCallback(() => {
        const lastWeek = weeks[weeks.length - 1];
        let nextMonday = '';
        if (lastWeek?.mondayDate) {
            const d = new Date(lastWeek.mondayDate + 'T12:00:00');
            d.setDate(d.getDate() + 7);
            nextMonday = d.toISOString().slice(0, 10);
        }
        const newEntry: WeekEntry = {
            weekNumber: weeks.length + 1,
            mondayDate: nextMonday,
            activeBlocks: Array.from({ length: totalBlocks }, (_, i) => i + 1),
        };
        saveWeeks([...weeks, newEntry]);
    }, [weeks, totalBlocks, saveWeeks]);

    const removeWeek = useCallback((idx: number) => {
        const updated = weeks.filter((_, i) => i !== idx).map((w, i) => ({ ...w, weekNumber: i + 1 }));
        saveWeeks(updated);
    }, [weeks, saveWeeks]);

    const updateWeekDate = useCallback((idx: number, mondayDate: string) => {
        const updated = weeks.map((w, i) => i === idx ? { ...w, mondayDate } : w);
        saveWeeks(updated);
    }, [weeks, saveWeeks]);

    const toggleBlock = useCallback((weekIdx: number, blockNum: number) => {
        const updated = weeks.map((w, i) => {
            if (i !== weekIdx) return w;
            const has = w.activeBlocks.includes(blockNum);
            const activeBlocks = has
                ? w.activeBlocks.filter(b => b !== blockNum)
                : [...w.activeBlocks, blockNum].sort((a, b) => a - b);
            return { ...w, activeBlocks };
        });
        saveWeeks(updated);
    }, [weeks, saveWeeks]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 pt-3.5 pb-2 border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
                    <div>
                        <h2 className="text-base font-display font-semibold text-white">La Rotta</h2>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">Calendario del corso · {weeks.length} settimane</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Chiudi">
                    <XIcon className="h-5 w-5" />
                </button>
            </div>

            {/* Body scrollabile */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-5xl mx-auto px-6 py-6 space-y-8">

                    {/* ── Sezione 1: Giorni predefiniti ── */}
                    <section>
                        <h3 className="text-sm font-semibold text-gray-200 mb-1">Giorni predefiniti dei blocchi</h3>
                        <p className="text-xs text-gray-500 mb-4">
                            Associa un giorno della settimana a ciascun blocco. ADA usa questi giorni per inferire la data esatta di ogni blocco all'interno di una settimana.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {Array.from({ length: 6 }, (_, i) => (
                                <div key={i} className="flex items-center justify-between p-3 bg-gray-800/60 border border-gray-700/40 rounded-lg">
                                    <span className="text-sm font-mono text-gray-300">BL{i + 1}</span>
                                    <select
                                        value={localDefaults[String(i)] || ''}
                                        onChange={e => handleDayChange(i, e.target.value)}
                                        className="ml-3 flex-1 bg-gray-900 border border-gray-600 rounded-md px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="">—</option>
                                        {DAYS_OF_WEEK.map(d => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── Sezione 2: Calendario settimane ── */}
                    <section>
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-sm font-semibold text-gray-200">Calendario delle settimane</h3>
                            <button
                                onClick={addWeek}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/10 hover:border-blue-400/50 transition-colors"
                            >
                                <PlusCircleIcon className="h-3.5 w-3.5" />
                                Aggiungi settimana
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-4">
                            Inserisci la data del lunedì — la domenica viene calcolata automaticamente. Deseleziona i blocchi che cadono in festività o sospensioni.
                        </p>

                        {weeks.length === 0 ? (
                            <div className="text-center py-12 text-gray-600 text-sm border border-dashed border-gray-700/50 rounded-xl">
                                Nessuna settimana configurata. Clicca "Aggiungi settimana" per iniziare.
                            </div>
                        ) : (
                            <div className="space-y-1">
                                {/* Intestazione tabella */}
                                <div className="grid gap-2 px-3 pb-2 border-b border-gray-700/40" style={{ gridTemplateColumns: '3rem 1fr 1fr auto auto' }}>
                                    <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Sett.</span>
                                    <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Lunedì</span>
                                    <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Domenica</span>
                                    <span className="text-[10px] font-mono text-gray-600 uppercase tracking-wider">Blocchi</span>
                                    <span></span>
                                </div>

                                {weeks.map((week, idx) => {
                                    const sunday = getSunday(week.mondayDate);
                                    return (
                                        <div
                                            key={idx}
                                            className="grid gap-2 items-center px-3 py-2 rounded-lg hover:bg-gray-800/40 transition-colors"
                                            style={{ gridTemplateColumns: '3rem 1fr 1fr auto auto' }}
                                        >
                                            {/* Numero settimana */}
                                            <span className="text-sm font-mono text-gray-400">{week.weekNumber}</span>

                                            {/* Data lunedì */}
                                            <input
                                                type="date"
                                                value={week.mondayDate}
                                                onChange={e => updateWeekDate(idx, e.target.value)}
                                                className="bg-gray-800 border border-gray-600/60 rounded-md px-2 py-1 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                                            />

                                            {/* Domenica (calcolata) */}
                                            <span className="text-sm text-gray-500 font-mono">
                                                {sunday ? formatDate(sunday) : '—'}
                                            </span>

                                            {/* Toggle blocchi */}
                                            <div className="flex items-center gap-1">
                                                {Array.from({ length: totalBlocks }, (_, i) => {
                                                    const blockNum = i + 1;
                                                    const active = week.activeBlocks.includes(blockNum);
                                                    return (
                                                        <button
                                                            key={blockNum}
                                                            onClick={() => toggleBlock(idx, blockNum)}
                                                            title={active ? `Rimuovi BL${blockNum}` : `Aggiungi BL${blockNum}`}
                                                            className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                                                                active
                                                                    ? 'bg-blue-600/80 text-white'
                                                                    : 'bg-gray-700/40 text-gray-600 line-through'
                                                            }`}
                                                        >
                                                            BL{blockNum}
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            {/* Elimina */}
                                            <button
                                                onClick={() => removeWeek(idx)}
                                                className="p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                                title="Rimuovi settimana"
                                            >
                                                <TrashIcon className="h-4 w-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </main>
    );
};

export default RouteView;
