import React, { useMemo, useState } from 'react';
import type { Conversation, BlockStatus, Activity, ActivityStatus, LessonType } from '../types';
import { XIcon, CalendarDaysIcon } from './Icons';
import DidacticRadarChart from './DidacticRadarChart';

// ── Tipi interni ──────────────────────────────────────────────────────────────

interface GanttBlock {
  weekNumber: number;
  day: string;
  status: BlockStatus;
  objective?: string;
  lessonTitle?: string;
  messagesCount: number;
  contentBlocksCount: number;
}

interface GanttModule {
  name: string;
  blocks: GanttBlock[];
  firstWeek: number;
  lastWeek: number;
}

type BlockProgressState = 'da_fare' | 'in_corso' | 'completato' | 'speciale';

// ── Colori canonici (stessi di StrategicDashboardView) ───────────────────────

const DOT_CLASS: Record<BlockProgressState, string> = {
  da_fare:    'bg-slate-500',
  in_corso:   'bg-amber-400',
  completato: 'bg-emerald-500',
  speciale:   'bg-gray-500',
};

// Barre per-settimana (vivaci, colore pieno)
const WEEK_BAR_BG: Record<BlockProgressState, string> = {
  da_fare:    'bg-slate-600/30',
  in_corso:   'bg-amber-500/35',
  completato: 'bg-emerald-600/40',
  speciale:   'bg-gray-600/25',
};
const WEEK_BAR_BORDER: Record<BlockProgressState, string> = {
  da_fare:    'border-slate-600/40',
  in_corso:   'border-amber-500/50',
  completato: 'border-emerald-500/55',
  speciale:   'border-gray-600/35',
};

// Barra span sottile di sfondo (connettore)
const SPAN_BAR_CLASS: Record<BlockProgressState, string> = {
  da_fare:    'bg-slate-700/20',
  in_corso:   'bg-amber-900/25',
  completato: 'bg-emerald-900/25',
  speciale:   'bg-gray-800/30',
};


// ── Logica stato ──────────────────────────────────────────────────────────────

function getBlockState(b: GanttBlock): BlockProgressState {
  if (b.status === 'saltato' || b.status === 'annullato') return 'speciale';
  if (b.contentBlocksCount > 0) return 'completato';
  if (b.objective?.trim() || b.messagesCount > 0) return 'in_corso';
  return 'da_fare';
}

function bestState(blocks: GanttBlock[]): BlockProgressState {
  if (blocks.some(b => getBlockState(b) === 'completato')) return 'completato';
  if (blocks.some(b => getBlockState(b) === 'in_corso'))   return 'in_corso';
  if (blocks.some(b => getBlockState(b) === 'da_fare'))    return 'da_fare';
  return 'speciale';
}

// ── Rilevamento settimana corrente ────────────────────────────────────────────

const IT_MONTHS: Record<string, number> = {
  gen: 0, feb: 1, mar: 2, apr: 3, mag: 4, giu: 5,
  lug: 6, ago: 7, set: 8, ott: 9, nov: 10, dic: 11,
};

function detectCurrentWeek(conversations: Conversation[]): number | null {
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  for (const conv of conversations) {
    if (!conv.weekPlan) continue;
    const { weekNumber, dates } = conv.weekPlan;
    const m = dates.match(/(\d+)(?:-(\d+))?\s+(\w+)/i);
    if (!m) continue;

    const startDay = parseInt(m[1], 10);
    const endDay   = m[2] ? parseInt(m[2], 10) : startDay + 4;
    const monthKey = m[3].toLowerCase().substring(0, 3);
    const monthIdx = IT_MONTHS[monthKey];
    if (monthIdx === undefined) continue;

    const yr    = today.getFullYear();
    const start = new Date(yr, monthIdx, startDay, 0, 0, 0);
    const end   = new Date(yr, monthIdx, endDay, 23, 59, 59);
    if (today >= start && today <= end) return weekNumber;
  }
  return null;
}

// ── Colori attività ───────────────────────────────────────────────────────────

const ACTIVITY_BAR: Record<ActivityStatus, string> = {
  in_corso:    'bg-rose-800/60',
  in_scadenza: 'bg-amber-900/60',
  consegnata:  'bg-emerald-900/50',
  scaduta:     'bg-gray-800/60',
};
const ACTIVITY_DOT_CLS: Record<ActivityStatus, string> = {
  in_corso:    'bg-rose-500',
  in_scadenza: 'bg-amber-400',
  consegnata:  'bg-emerald-500',
  scaduta:     'bg-gray-500',
};
const ACTIVITY_TYPE_LABEL: Record<string, string> = {
  ricerca: 'Ricerca', audiovisivo: 'Audiovisivo', produzione_scritta: 'Produzione scritta', progetto: 'Progetto', altro: 'Altro',
};

// ── Helper attività ───────────────────────────────────────────────────────────

function getActivityDueWeek(activity: Activity, weekBlockCounts: Map<number, number>): number {
  const weekNums = [...weekBlockCounts.keys()].sort((a, b) => a - b);
  let remaining = activity.dueInBlocks;
  for (const w of weekNums) {
    if (w < activity.launchWeekNumber) continue;
    const total = weekBlockCounts.get(w) ?? 0;
    const countFromHere = w === activity.launchWeekNumber ? total - activity.launchBlockIndex : total;
    if (remaining <= countFromHere) return w;
    remaining -= countFromHere;
  }
  return weekNums[weekNums.length - 1] ?? activity.launchWeekNumber;
}

function getEffectiveActivityStatus(activity: Activity, dueWeek: number, currentWeek: number | null): ActivityStatus {
  if (activity.status === 'consegnata') return 'consegnata';
  if (currentWeek === null) return 'in_corso';
  if (currentWeek > dueWeek) return 'scaduta';
  if (currentWeek === dueWeek) return 'in_scadenza';
  return 'in_corso';
}

// ── Layout constants ──────────────────────────────────────────────────────────

const LEFT      = 192;  // px – larghezza colonna nomi modulo
const ROW       = 44;   // px – altezza riga modulo
const HEAD      = 32;   // px – altezza header settimane
const MIN_COL_W = 40;   // px – larghezza minima per colonna settimana

// ── Props ─────────────────────────────────────────────────────────────────────

interface GanttViewProps {
  conversations: Conversation[];
  onClose: () => void;
  onNavigateToWeek: (weekNumber: number) => void;
  onMarkActivityDelivered?: (activityId: string) => void;
}

// ── Header (definito prima di GanttView per evitare forward reference) ────────

const SPLIT_LABELS = ['Gantt', '50/50', 'Radar'] as const;

interface GanttHeaderProps {
  onClose: () => void;
  count: number;
  weeks: number;
  activityCount: number;
  splitPreset: 0 | 1 | 2;
  onSetSplit: (p: 0 | 1 | 2) => void;
  blockStats: { completato: number; inCorso: number; daFare: number; speciale: number; total: number };
}

const GanttHeader: React.FC<GanttHeaderProps> = ({ onClose, count, weeks, activityCount, splitPreset, onSetSplit, blockStats }) => (
  <header className="flex-shrink-0 flex flex-col border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
    {/* Riga 1 — titolo + controlli */}
    <div className="flex items-center justify-between px-6 pt-3.5 pb-2">
      <div className="flex items-center gap-2.5">
        <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
        <h1 className="text-base font-display font-semibold text-white">Analisi del Corso</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Toggle split — visibile solo su schermi lg+ */}
        <div className="hidden lg:flex items-center gap-0.5 bg-gray-800/50 rounded-md p-0.5">
          {SPLIT_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => onSetSplit(i as 0 | 1 | 2)}
              className={`text-[9px] font-mono px-2 py-0.5 rounded transition-colors ${
                splitPreset === i
                  ? 'text-gray-200 bg-gray-700/80'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
              title={`Layout: ${label}`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-md text-gray-600 hover:text-white hover:bg-gray-800/60 transition-colors"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>

    {/* Riga 2 — info + KPI dinamici blocchi */}
    <div className="flex items-center gap-3 px-6 pb-2.5 flex-wrap">
      {(count > 0 || activityCount > 0 || weeks > 0) && (
        <span className="text-[10px] font-mono text-gray-600">
          {count > 0 && `${count} moduli`}
          {weeks > 0 && ` · ${weeks} settimane`}
          {activityCount > 0 && (
            <> · <span className="text-rose-500/70">{activityCount} attività</span></>
          )}
        </span>
      )}
      {blockStats.total > 0 && (
        <>
          <span className="w-px h-3 bg-gray-800/70 flex-shrink-0" />
          <div className="flex items-center gap-2.5 flex-wrap" title="Stato blocchi: completati · in corso · da fare · speciali">
            {blockStats.completato > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400/80 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-emerald-500" />
                completat{blockStats.completato !== 1 ? 'i' : 'o'}
              </span>
            )}
            {blockStats.inCorso > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400/80 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-amber-400" />
                in corso
              </span>
            )}
            {blockStats.daFare > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-400/80 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-slate-500" />
                da fare
              </span>
            )}
            {blockStats.speciale > 0 && (
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-gray-500/80 whitespace-nowrap">
                <span className="w-2 h-2 rounded-full flex-shrink-0 bg-gray-500" />
                speciale
              </span>
            )}
            <span className="text-[10px] text-gray-600 font-mono">
              {blockStats.completato + blockStats.inCorso + blockStats.daFare + blockStats.speciale} / {blockStats.total}
            </span>
          </div>
        </>
      )}
    </div>
  </header>
);

// ── Componente principale ─────────────────────────────────────────────────────

const GanttView: React.FC<GanttViewProps> = ({ conversations, onClose, onNavigateToWeek, onMarkActivityDelivered }) => {

  // Tutti gli hook prima di qualsiasi return condizionale (regola React)

  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [splitPreset, setSplitPreset] = useState<0 | 1 | 2>(0);

  const modules = useMemo((): GanttModule[] => {
    const map = new Map<string, GanttModule>();

    for (const conv of conversations) {
      if (!conv.weekPlan) continue;
      const { weekNumber, blocks } = conv.weekPlan;

      for (const block of blocks) {
        const name = block.module?.trim() || 'Senza modulo';
        if (!map.has(name)) {
          map.set(name, { name, blocks: [], firstWeek: weekNumber, lastWeek: weekNumber });
        }
        const mod = map.get(name)!;
        mod.blocks.push({
          weekNumber,
          day:                block.day,
          status:             block.status,
          objective:          block.objective,
          lessonTitle:        block.lessonTitle,
          messagesCount:      block.messages?.length ?? 0,
          contentBlocksCount: block.contentBlocks?.length ?? 0,
        });
        mod.firstWeek = Math.min(mod.firstWeek, weekNumber);
        mod.lastWeek  = Math.max(mod.lastWeek, weekNumber);
      }
    }

    return [...map.values()].sort((a, b) => a.firstWeek - b.firstWeek);
  }, [conversations]);

  const weekBlockCounts = useMemo(() => {
    const map = new Map<number, number>();
    for (const conv of conversations) {
      if (!conv.weekPlan) continue;
      map.set(conv.weekPlan.weekNumber, conv.weekPlan.blocks.length);
    }
    return map;
  }, [conversations]);

  const activities = useMemo(
    () => conversations.flatMap(c => c.activities ?? []) as Activity[],
    [conversations]
  );

  const maxWeek = useMemo(() => {
    const moduleMax = modules.length === 0 ? 0 : Math.max(...modules.map(m => m.lastWeek));
    const actDueWeeks = activities.map(a => getActivityDueWeek(a, weekBlockCounts));
    const actMax = actDueWeeks.length > 0 ? Math.max(...actDueWeeks) : 0;
    return Math.max(moduleMax, actMax);
  }, [modules, activities, weekBlockCounts]);

  const currentWeek = useMemo(() => detectCurrentWeek(conversations), [conversations]);

  const weeks = useMemo(() => Array.from({ length: maxWeek }, (_, i) => i + 1), [maxWeek]);

  // ── KPI dinamici blocchi (per header) ────────────────────────────────────────
  const blockStats = useMemo(() => {
    let completato = 0, inCorso = 0, daFare = 0, speciale = 0, total = 0;
    for (const mod of modules) {
      for (const b of mod.blocks) {
        total++;
        const s = getBlockState(b);
        if (s === 'completato') completato++;
        else if (s === 'in_corso') inCorso++;
        else if (s === 'da_fare') daFare++;
        else speciale++;
      }
    }
    return { completato, inCorso, daFare, speciale, total };
  }, [modules]);

  // ── Radar equilibrio didattico ────────────────────────────────────────────────
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

  // ── Helpers di posizionamento (% relativi all'area timeline) ─────────────────
  // maxWeek è noto qui — questi non sono hook, sono semplici funzioni derivate

  const colL = (w: number) => `${((w - 1) / maxWeek) * 100}%`;
  const colW = ()           => `${(1 / maxWeek) * 100}%`;
  const dotL = (w: number) => `${((w - 0.5) / maxWeek) * 100}%`;
  const barL = (f: number) => `${((f - 1) / maxWeek) * 100}%`;
  const barW = (f: number, l: number) => `${((l - f + 1) / maxWeek) * 100}%`;

  // ── Empty state ───────────────────────────────────────────────────────────────

  if (maxWeek === 0) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#0D1117]">
        <GanttHeader onClose={onClose} count={0} weeks={0} activityCount={0} splitPreset={splitPreset} onSetSplit={setSplitPreset} blockStats={{ completato: 0, inCorso: 0, daFare: 0, speciale: 0, total: 0 }} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-mono text-gray-600">
            Nessun dato da visualizzare. Pianifica alcune settimane per vedere il Gantt.
          </p>
        </div>
      </div>
    );
  }

  // ── Render principale ─────────────────────────────────────────────────────────

  const radarWidthClass = ['lg:w-[22%]', 'lg:w-[38%]', 'lg:w-[54%]'][splitPreset];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0D1117]">
      <GanttHeader onClose={onClose} count={modules.length} weeks={maxWeek} activityCount={activities.length} splitPreset={splitPreset} onSetSplit={setSplitPreset} blockStats={blockStats} />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-4 p-4">
        {/* ── Card Gantt (sinistra) ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 rounded-xl border border-gray-600/40 bg-gray-800/30 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 pt-4 pb-3 flex-shrink-0">
          <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">Moduli del Corso</span>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar">
        <div className="px-6 pb-10" style={{ minWidth: LEFT + maxWeek * MIN_COL_W }}>

          {/* ── Asse X: numeri settimana ─────────────────────────────────────── */}
          <div className="flex sticky top-0 z-10 bg-[#0D1117]" style={{ height: HEAD }}>
            <div style={{ width: LEFT, flexShrink: 0 }} className="border-b border-gray-700/40" />
            <div className="flex-1 relative border-b border-gray-700/40">
              {/* Linee verticali header */}
              {weeks.map(w => (
                <div
                  key={w}
                  className="absolute inset-y-0 border-l border-gray-800/50 pointer-events-none"
                  style={{ left: colL(w) }}
                />
              ))}
              {weeks.map(w => (
                <div
                  key={w}
                  className="absolute flex items-center justify-center"
                  style={{ left: colL(w), width: colW(), height: '100%' }}
                >
                  <span className={`text-[10px] font-mono leading-none select-none ${
                    w === currentWeek ? 'text-purple-400 font-semibold' : 'text-gray-700'
                  }`}>
                    {w}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Righe modulo ─────────────────────────────────────────────────── */}
          {modules.map((mod) => {
            const dominant = bestState(mod.blocks);

            // Aggrega blocchi per settimana
            const byWeek = new Map<number, GanttBlock[]>();
            for (const b of mod.blocks) {
              if (!byWeek.has(b.weekNumber)) byWeek.set(b.weekNumber, []);
              byWeek.get(b.weekNumber)!.push(b);
            }

            return (
              <div key={mod.name} className="flex group" style={{ height: ROW }}>

                {/* Nome modulo */}
                <div
                  style={{ width: LEFT, flexShrink: 0 }}
                  className="flex items-center pr-6 border-b border-gray-800/40 border-r border-r-gray-700/30"
                >
                  <button
                    className="w-full text-left truncate"
                    title={mod.name}
                    onClick={() => onNavigateToWeek(mod.firstWeek)}
                  >
                    <span className="text-xs font-display text-gray-500 group-hover:text-gray-300 transition-colors">
                      {mod.name}
                    </span>
                  </button>
                </div>

                {/* Area timeline */}
                <div className="flex-1 relative border-b border-gray-800/40">

                  {/* Linee verticali colonna */}
                  {weeks.map(w => (
                    <div
                      key={w}
                      className="absolute inset-y-0 border-l border-gray-800/40 pointer-events-none"
                      style={{ left: colL(w) }}
                    />
                  ))}

                  {/* Highlight settimana corrente */}
                  {currentWeek && currentWeek <= maxWeek && (
                    <div
                      className="absolute inset-y-0 bg-purple-500/6 pointer-events-none"
                      style={{ left: colL(currentWeek), width: colW() }}
                    />
                  )}

                  {/* Barra span sottile (connettore di sfondo) */}
                  <div
                    className={`absolute rounded-full pointer-events-none ${SPAN_BAR_CLASS[dominant]}`}
                    style={{
                      left:      barL(mod.firstWeek),
                      width:     barW(mod.firstWeek, mod.lastWeek),
                      height:    2,
                      top:       '50%',
                      transform: 'translateY(-50%)',
                    }}
                  />

                  {/* Barra per settimana */}
                  {[...byWeek.entries()].map(([weekNum, weekBlocks]) => {
                    const state      = bestState(weekBlocks);
                    const allSaltato = weekBlocks.every(b => b.status === 'saltato' || b.status === 'annullato');
                    const count      = weekBlocks.length;
                    const tip        = `Sett. ${weekNum}${count > 1 ? ` (${count} blocchi)` : ''}: ${
                      weekBlocks.map(b => b.lessonTitle || b.objective || b.day).filter(Boolean).join(' · ') || '—'
                    }`;
                    const GAP = 3; // px gap laterale dentro la colonna

                    return (
                      <button
                        key={weekNum}
                        className={`absolute rounded border transition-all hover:brightness-125 hover:z-10 ${
                          WEEK_BAR_BG[state]
                        } ${WEEK_BAR_BORDER[state]} ${allSaltato ? 'opacity-20' : 'opacity-90 hover:opacity-100'}`}
                        style={{
                          left:      `calc(${colL(weekNum)} + ${GAP}px)`,
                          width:     `calc(${colW()} - ${GAP * 2}px)`,
                          height:    '58%',
                          top:       '21%',
                        }}
                        title={tip}
                        onClick={() => onNavigateToWeek(weekNum)}
                      >
                        {/* Dot colorato in alto a sinistra per i blocchi multipli */}
                        {count > 1 && (
                          <span
                            className={`absolute top-0.5 right-1 text-[8px] font-mono leading-none ${
                              state === 'completato' ? 'text-emerald-300/80' :
                              state === 'in_corso'   ? 'text-amber-300/80' :
                              state === 'speciale'   ? 'text-gray-400/60' : 'text-slate-400/60'
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {/* ── Sezione Attività ─────────────────────────────────────────── */}
          {activities.length > 0 && (
            <>
              <div className="flex mt-8" style={{ height: 28 }}>
                <div style={{ width: LEFT, flexShrink: 0 }} className="flex items-center gap-2 border-r border-r-gray-700/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70 flex-shrink-0" />
                  <span className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-500/80">Attività</span>
                  <span className="text-[9px] font-mono text-gray-700">{activities.length}</span>
                </div>
                <div className="flex-1 self-center border-t border-gray-700/30" />
              </div>
              {activities.map(activity => {
                const dueWeek = getActivityDueWeek(activity, weekBlockCounts);
                const effectiveStatus = getEffectiveActivityStatus(activity, dueWeek, currentWeek);
                const isSelected = selectedActivity?.id === activity.id;
                const clampedDueWeek = Math.min(dueWeek, maxWeek);
                return (
                  <div key={activity.id} className="flex group" style={{ height: ROW }}>
                    <div style={{ width: LEFT, flexShrink: 0 }} className="flex items-center pr-6">
                      <button
                        className="w-full text-left truncate"
                        title={activity.title}
                        onClick={() => setSelectedActivity(isSelected ? null : activity)}
                      >
                        <span className={`text-xs font-display transition-colors ${isSelected ? 'text-rose-300' : 'text-gray-500 group-hover:text-gray-300'}`}>
                          {activity.title}
                        </span>
                      </button>
                    </div>
                    <div className="flex-1 relative border-b border-gray-800/40">
                      {/* Linee verticali */}
                      {weeks.map(w => (
                        <div key={w} className="absolute inset-y-0 border-l border-gray-800/40 pointer-events-none" style={{ left: colL(w) }} />
                      ))}
                      {currentWeek && currentWeek <= maxWeek && (
                        <div className="absolute inset-y-0 bg-purple-500/6 pointer-events-none" style={{ left: colL(currentWeek), width: colW() }} />
                      )}
                      {/* Barra span attività */}
                      <button
                        className={`absolute rounded transition-opacity hover:opacity-80 border border-rose-500/20 ${ACTIVITY_BAR[effectiveStatus]}`}
                        style={{ left: barL(activity.launchWeekNumber), width: barW(activity.launchWeekNumber, clampedDueWeek), height: '50%', top: '25%' }}
                        onClick={() => setSelectedActivity(isSelected ? null : activity)}
                        title={`${activity.title} — scadenza sett. ${dueWeek}`}
                      />
                      {/* Marker lancio */}
                      <div
                        className={`absolute pointer-events-none w-0.5 rounded-full ${ACTIVITY_DOT_CLS[effectiveStatus]}`}
                        style={{ left: colL(activity.launchWeekNumber), top: '15%', height: '70%' }}
                      />
                      {/* Marker scadenza */}
                      {dueWeek !== activity.launchWeekNumber && dueWeek <= maxWeek && (
                        <div
                          className={`absolute pointer-events-none w-0.5 rounded-full opacity-60 ${
                            effectiveStatus === 'consegnata' ? 'bg-emerald-500' :
                            effectiveStatus === 'scaduta'    ? 'bg-gray-500' : 'bg-amber-400'
                          }`}
                          style={{ left: `calc(${colL(dueWeek)} + ${colW()} - 2px)`, top: '15%', height: '70%' }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </>
          )}

        </div>
        </div>
        </div>{/* fine card Gantt */}

        {/* ── Card Radar (destra) ──────────────────────────────────────────── */}
        <div className={`flex-shrink-0 w-full ${radarWidthClass} rounded-xl border border-gray-600/40 bg-gray-800/30 overflow-y-auto custom-scrollbar p-5`}>
          {radarData.length > 0 ? (
            <DidacticRadarChart
              data={radarData}
            />
          ) : (
            <div className="flex items-center justify-center h-full py-10">
              <p className="text-[10px] font-mono text-gray-600 text-center leading-relaxed">
                Imposta una tipologia di lezione per vedere l'equilibrio didattico
              </p>
            </div>
          )}
        </div>
      </div>{/* fine layout a due colonne */}

      {/* ── Pannello dettaglio attività ──────────────────────────────────────── */}
      {selectedActivity && (() => {
        const dueWeek = getActivityDueWeek(selectedActivity, weekBlockCounts);
        const effectiveStatus = getEffectiveActivityStatus(selectedActivity, dueWeek, currentWeek);
        return (
          <div className="flex-shrink-0 border-t border-gray-800/50 bg-gray-900/80 backdrop-blur-sm px-6 py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ACTIVITY_DOT_CLS[effectiveStatus]}`} />
                  <span className="text-sm font-display font-semibold text-white truncate">{selectedActivity.title}</span>
                  <span className="text-[10px] font-mono text-gray-500 flex-shrink-0">
                    {ACTIVITY_TYPE_LABEL[selectedActivity.type] || selectedActivity.type}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-gray-500 flex-wrap">
                  <span>Lanciata: sett. {selectedActivity.launchWeekNumber}</span>
                  <span>Scadenza: sett. {dueWeek} ({selectedActivity.dueInBlocks} blocchi)</span>
                  {effectiveStatus === 'consegnata' && <span className="text-emerald-400">● Consegnata</span>}
                  {effectiveStatus === 'scaduta'    && <span className="text-gray-500">● Scaduta</span>}
                  {effectiveStatus === 'in_scadenza' && <span className="text-amber-400">● In scadenza</span>}
                </div>
                {selectedActivity.description && (
                  <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{selectedActivity.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {effectiveStatus !== 'consegnata' && onMarkActivityDelivered && (
                  <button
                    onClick={() => {
                      onMarkActivityDelivered(selectedActivity.id);
                      setSelectedActivity(null);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-300 border border-emerald-500/25 rounded-lg hover:bg-emerald-500/10 hover:border-emerald-400/35 transition-all"
                  >
                    Segna consegnata
                  </button>
                )}
                <button
                  onClick={() => setSelectedActivity(null)}
                  className="p-1.5 rounded-md text-gray-600 hover:text-white hover:bg-gray-800/60 transition-colors"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default GanttView;
