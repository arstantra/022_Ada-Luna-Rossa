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

const BAR_CLASS: Record<BlockProgressState, string> = {
  da_fare:    'bg-slate-700/40',
  in_corso:   'bg-amber-950/50',
  completato: 'bg-emerald-950/50',
  speciale:   'bg-gray-800/60',
};

const LEGEND: { cls: string; label: string }[] = [
  { cls: 'bg-emerald-500', label: 'completato' },
  { cls: 'bg-amber-400',   label: 'in corso'   },
  { cls: 'bg-slate-500',   label: 'da fare'     },
  { cls: 'bg-gray-500',    label: 'speciale'    },
];

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

const GanttHeader: React.FC<{
  onClose: () => void;
  count: number;
  weeks: number;
  activityCount: number;
  splitPreset: 0 | 1 | 2;
  onSetSplit: (p: 0 | 1 | 2) => void;
}> = ({ onClose, count, weeks, activityCount, splitPreset, onSetSplit }) => (
  <header className="flex-shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
    <div className="flex items-center gap-2.5">
      <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
      <h1 className="text-base font-display font-semibold text-white">Analisi del Corso</h1>
      {(count > 0 || activityCount > 0) && (
        <span className="text-xs font-mono text-gray-600">
          {count > 0 && `${count} moduli`}
          {count > 0 && activityCount > 0 && ' · '}
          {activityCount > 0 && <span className="text-rose-500/70">{activityCount} attività</span>}
          {weeks > 0 && ` · ${weeks} settimane`}
        </span>
      )}
    </div>

    <div className="flex items-center gap-3">
      {/* Legenda colori */}
      <div className="flex items-center gap-3">
        {LEGEND.map(({ cls, label }) => (
          <span key={label} className="flex items-center gap-1.5 text-[10px] font-mono text-gray-600">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 opacity-80 ${cls}`} />
            {label}
          </span>
        ))}
      </div>

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
      <div className="flex flex-col h-full bg-[#0D1117]">
        <GanttHeader onClose={onClose} count={0} weeks={0} activityCount={0} splitPreset={splitPreset} onSetSplit={setSplitPreset} />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-mono text-gray-600">
            Nessun dato da visualizzare. Pianifica alcune settimane per vedere il Gantt.
          </p>
        </div>
      </div>
    );
  }

  // ── Render principale ─────────────────────────────────────────────────────────

  const radarWidthClass = ['lg:w-[35%]', 'lg:w-[50%]', 'lg:w-[65%]'][splitPreset];

  return (
    <div className="flex flex-col h-full bg-[#0D1117]">
      <GanttHeader onClose={onClose} count={modules.length} weeks={maxWeek} activityCount={activities.length} splitPreset={splitPreset} onSetSplit={setSplitPreset} />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-4 p-4">
        {/* ── Card Gantt (sinistra) ─────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 rounded-xl border border-gray-600/40 bg-gray-800/30 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
        <div className="p-6 pb-10" style={{ minWidth: LEFT + maxWeek * MIN_COL_W }}>

          {/* ── Asse X: numeri settimana ─────────────────────────────────────── */}
          <div className="flex sticky top-0 z-10 bg-[#0D1117]" style={{ height: HEAD }}>
            <div style={{ width: LEFT, flexShrink: 0 }} />
            <div className="flex-1 relative">
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

            // Un dot per settimana (aggrega più blocchi della stessa settimana)
            const byWeek = new Map<number, GanttBlock[]>();
            for (const b of mod.blocks) {
              if (!byWeek.has(b.weekNumber)) byWeek.set(b.weekNumber, []);
              byWeek.get(b.weekNumber)!.push(b);
            }

            return (
              <div key={mod.name} className="flex group" style={{ height: ROW }}>

                {/* Nome modulo */}
                <div style={{ width: LEFT, flexShrink: 0 }} className="flex items-center pr-6">
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
                <div className="flex-1 relative">
                  {/* Divisore riga */}
                  <div className="absolute bottom-0 left-0 right-0 border-b border-gray-800/25 pointer-events-none" />

                  {/* Highlight settimana corrente */}
                  {currentWeek && currentWeek <= maxWeek && (
                    <div
                      className="absolute inset-y-0 bg-purple-500/5 pointer-events-none"
                      style={{ left: colL(currentWeek), width: colW() }}
                    />
                  )}

                  {/* Barra del modulo */}
                  <div
                    className={`absolute rounded-sm pointer-events-none ${BAR_CLASS[dominant]}`}
                    style={{
                      left:      barL(mod.firstWeek),
                      width:     barW(mod.firstWeek, mod.lastWeek),
                      height:    4,
                      top:       '50%',
                      transform: 'translateY(-50%)',
                    }}
                  />

                  {/* Dot per settimana */}
                  {[...byWeek.entries()].map(([weekNum, weekBlocks]) => {
                    const state      = bestState(weekBlocks);
                    const allSaltato = weekBlocks.every(b => b.status === 'saltato' || b.status === 'annullato');
                    const count      = weekBlocks.length;
                    const tip        = `Sett. ${weekNum}${count > 1 ? ` (${count} blocchi)` : ''}: ${
                      weekBlocks.map(b => b.lessonTitle || b.objective || b.day).filter(Boolean).join(' · ') || '—'
                    }`;

                    return (
                      <button
                        key={weekNum}
                        className={`absolute rounded-full ring-1 ring-gray-900 transition-all hover:scale-125 hover:z-10 ${DOT_CLASS[state]} ${
                          allSaltato ? 'opacity-25' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{
                          left:      dotL(weekNum),
                          top:       '50%',
                          transform: 'translate(-50%, -50%)',
                          width:     count > 1 ? 12 : 10,
                          height:    count > 1 ? 12 : 10,
                        }}
                        title={tip}
                        onClick={() => onNavigateToWeek(weekNum)}
                      />
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
                <div style={{ width: LEFT, flexShrink: 0 }} className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500/70 flex-shrink-0" />
                  <span className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-500/80">Attività</span>
                  <span className="text-[9px] font-mono text-gray-700">{activities.length}</span>
                </div>
                <div className="flex-1 self-center border-t border-gray-800/30" />
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
                    <div className="flex-1 relative">
                      <div className="absolute bottom-0 left-0 right-0 border-b border-gray-800/25 pointer-events-none" />
                      {currentWeek && currentWeek <= maxWeek && (
                        <div className="absolute inset-y-0 bg-purple-500/5 pointer-events-none" style={{ left: colL(currentWeek), width: colW() }} />
                      )}
                      {/* Bar */}
                      <button
                        className={`absolute rounded-sm transition-opacity hover:opacity-80 ${ACTIVITY_BAR[effectiveStatus]}`}
                        style={{ left: barL(activity.launchWeekNumber), width: barW(activity.launchWeekNumber, clampedDueWeek), height: 4, top: '50%', transform: 'translateY(-50%)' }}
                        onClick={() => setSelectedActivity(isSelected ? null : activity)}
                        title={`${activity.title} — scadenza sett. ${dueWeek}`}
                      />
                      {/* Launch dot */}
                      <div
                        className={`absolute rounded-full ring-1 ring-gray-900 pointer-events-none ${ACTIVITY_DOT_CLS[effectiveStatus]}`}
                        style={{ left: dotL(activity.launchWeekNumber), top: '50%', transform: 'translate(-50%, -50%)', width: 8, height: 8 }}
                      />
                      {/* Due dot (if different week and in bounds) */}
                      {dueWeek !== activity.launchWeekNumber && dueWeek <= maxWeek && (
                        <div
                          className={`absolute rounded-sm ring-1 ring-gray-900 pointer-events-none ${
                            effectiveStatus === 'consegnata' ? 'bg-emerald-500' :
                            effectiveStatus === 'scaduta'    ? 'bg-gray-500' : 'bg-amber-400'
                          }`}
                          style={{ left: dotL(dueWeek), top: '50%', transform: 'translate(-50%, -50%)', width: 6, height: 6 }}
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
        <div className={`flex-shrink-0 w-full ${radarWidthClass} rounded-xl border border-gray-600/40 bg-gray-800/30 overflow-y-auto p-5`}>
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
