import React, { useMemo, useState } from 'react';
import type { Conversation, Activity, ActivityStatus, LessonType, TeachingMethodology } from '../types';
import { LESSON_TYPE_LABELS, TEACHING_METHODOLOGY_LABELS } from '../constants';
import { XIcon, CalendarDaysIcon } from './Icons';
import DidacticRadarChart from './DidacticRadarChart';

// ── Tipi interni ──────────────────────────────────────────────────────────────

interface GanttModule {
  name: string;
  blockCount: number;
}

// ── Palette categoriale moduli (colore per indice, non per stato) ─────────────

interface ModuleColor {
  bg: string;
  border: string;
  text: string;
}

const MODULE_PALETTE: ModuleColor[] = [
  { bg: 'rgba(30,58,95,0.75)',  border: 'rgba(59,130,246,0.55)',  text: '#93c5fd' },  // blue
  { bg: 'rgba(59,31,94,0.75)',  border: 'rgba(168,85,247,0.55)',  text: '#d8b4fe' },  // purple
  { bg: 'rgba(26,61,46,0.75)',  border: 'rgba(34,197,94,0.55)',   text: '#86efac' },  // green
  { bg: 'rgba(61,42,26,0.75)',  border: 'rgba(249,115,22,0.55)',  text: '#fdba74' },  // orange
  { bg: 'rgba(30,58,95,0.75)',  border: 'rgba(56,189,248,0.55)',  text: '#7dd3fc' },  // sky
  { bg: 'rgba(59,31,58,0.75)',  border: 'rgba(232,121,249,0.55)', text: '#f0abfc' },  // fuchsia
  { bg: 'rgba(26,61,46,0.75)',  border: 'rgba(20,184,166,0.55)',  text: '#5eead4' },  // teal
  { bg: 'rgba(61,42,26,0.75)',  border: 'rgba(234,179,8,0.55)',   text: '#fde047' },  // yellow
  { bg: 'rgba(42,42,42,0.75)',  border: 'rgba(107,114,128,0.55)', text: '#9ca3af' },  // gray
];

function moduleColor(idx: number): ModuleColor {
  return MODULE_PALETTE[idx % MODULE_PALETTE.length];
}

// ── Donut distribuzione moduli ────────────────────────────────────────────────

const ModuleDonut: React.FC<{ modules: GanttModule[] }> = ({ modules }) => {
  const [hovered, setHovered] = useState<string | null>(null);
  if (modules.length === 0) return (
    <div className="flex items-center justify-center py-6">
      <p className="text-[10px] font-mono text-gray-600 text-center">
        Assegna moduli ai blocchi per vedere la distribuzione
      </p>
    </div>
  );

  const total = modules.reduce((s, m) => s + m.blockCount, 0);
  const R = 48; const r = 28; const cx = 60; const cy = 60;
  let angle = -Math.PI / 2;
  const slices = modules.map((mod, idx) => {
    const pct  = mod.blockCount / total;
    const span = pct * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle);
    const y1 = cy + R * Math.sin(angle);
    angle += span;
    const x2 = cx + R * Math.cos(angle);
    const y2 = cy + R * Math.sin(angle);
    const xi1 = cx + r * Math.cos(angle);
    const yi1 = cy + r * Math.sin(angle);
    const xi2 = cx + r * Math.cos(angle - span);
    const yi2 = cy + r * Math.sin(angle - span);
    const large = span > Math.PI ? 1 : 0;
    const c = moduleColor(idx);
    return { mod, pct, large, x1, y1, x2, y2, xi1, yi1, xi2, yi2, c, idx };
  });

  const hoveredMod = hovered ? modules.find(m => m.name === hovered) : null;

  return (
    <div className="flex items-start gap-3">
      {/* Donut SVG */}
      <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
        {slices.map(({ mod, large, x1, y1, x2, y2, xi1, yi1, xi2, yi2, c }) => (
          <path
            key={mod.name}
            d={`M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${r} ${r} 0 ${large} 0 ${xi2} ${yi2} Z`}
            fill={c.bg}
            stroke={c.border}
            strokeWidth="0.8"
            opacity={hovered && hovered !== mod.name ? 0.35 : 1}
            onMouseEnter={() => setHovered(mod.name)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'default', transition: 'opacity 0.15s' }}
          />
        ))}
        {/* Label centrale */}
        <text x={cx} y={cy - 5} textAnchor="middle" fill="rgba(156,163,175,0.7)" fontSize="7" fontFamily="monospace">
          {hoveredMod ? `${hoveredMod.blockCount}` : `${total}`}
        </text>
        <text x={cx} y={cy + 5} textAnchor="middle" fill="rgba(107,114,128,0.6)" fontSize="6" fontFamily="monospace">
          {hoveredMod ? 'bl.' : 'tot.'}
        </text>
      </svg>
      {/* Legenda */}
      <div className="flex flex-col gap-1 min-w-0 flex-1 pt-1">
        {modules.map((mod, idx) => {
          const c = moduleColor(idx);
          const pct = Math.round((mod.blockCount / total) * 100);
          const isHov = hovered === mod.name;
          return (
            <div
              key={mod.name}
              className="flex items-center gap-1.5 cursor-default"
              onMouseEnter={() => setHovered(mod.name)}
              onMouseLeave={() => setHovered(null)}
              style={{ opacity: hovered && !isHov ? 0.4 : 1, transition: 'opacity 0.15s' }}
            >
              <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: c.border }} />
              <span
                className="text-[9px] font-mono text-gray-500 truncate flex-1 min-w-0"
                style={isHov ? { color: c.text } : {}}
                title={mod.name}
              >
                {mod.name}
              </span>
              <span className="text-[9px] font-mono text-gray-700 flex-shrink-0 tabular-nums">{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Heatmap argomento × tipologia ─────────────────────────────────────────────

const ALL_LESSON_TYPES: LessonType[] = [
  'frontale_teorica', 'frontale_operativa', 'laboratorio', 'verifica', 'discussione',
];
const TYPE_SHORT: Record<LessonType, string> = {
  frontale_teorica:   'Fr.T.',
  frontale_operativa: 'Fr.O.',
  laboratorio:        'Lab.',
  verifica:           'Ver.',
  discussione:        'Disc.',
};

interface HeatmapRow { subject: string; counts: Record<LessonType, number>; total: number }

const SubjectHeatmap: React.FC<{ rows: HeatmapRow[] }> = ({ rows }) => {
  if (rows.length === 0) return (
    <div className="flex items-center justify-center py-6">
      <p className="text-[10px] font-mono text-gray-600 text-center leading-relaxed">
        Compila "Argomento" nei blocchi per vedere la heatmap
      </p>
    </div>
  );

  const globalMax = Math.max(...rows.flatMap(r => Object.values(r.counts)), 1);

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full border-collapse" style={{ minWidth: 260 }}>
        <thead>
          <tr>
            <th className="text-left pr-2 pb-1.5" style={{ width: '40%' }} />
            {ALL_LESSON_TYPES.map(t => (
              <th key={t} className="text-center pb-1.5" style={{ width: '12%' }}>
                <span className="text-[8px] font-mono text-gray-600">{TYPE_SHORT[t]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.subject} className="group">
              <td className="pr-2 py-0.5">
                <span
                  className="text-[9px] font-mono text-gray-500 group-hover:text-gray-300 truncate block transition-colors"
                  style={{ maxWidth: 110 }}
                  title={row.subject}
                >
                  {row.subject}
                </span>
              </td>
              {ALL_LESSON_TYPES.map(t => {
                const v = row.counts[t] ?? 0;
                const intensity = v / globalMax;
                const bg = v > 0
                  ? `rgba(129,140,248,${0.12 + intensity * 0.65})`
                  : 'rgba(17,24,39,0.4)';
                return (
                  <td key={t} className="text-center py-0.5 px-0.5">
                    <div
                      className="mx-auto rounded-sm flex items-center justify-center transition-all"
                      style={{ width: 22, height: 18, background: bg }}
                      title={v > 0 ? `${row.subject} · ${LESSON_TYPE_LABELS[t]}: ${v} bl.` : undefined}
                    >
                      {v > 0 && (
                        <span className="text-[8px] font-mono text-indigo-300/80 tabular-nums">{v}</span>
                      )}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ── Matrice Modulo × Metodologia ──────────────────────────────────────────────

// Abbreviazioni compatte per le intestazioni di colonna
const METHOD_SHORT: Partial<Record<TeachingMethodology, string>> = {
  tradizionale:         'Trad.',
  flipped_classroom:    'Flip.',
  project_based:        'PBL',
  problem_based:        'PrBL',
  cooperative_learning: 'CL',
  peer_teaching:        'Peer',
  debate:               'Deb.',
  design_thinking:      'DT',
  gamification:         'Game',
  studio_di_caso:       'Case',
  inquiry_based:        'IBL',
  role_playing:         'RP',
  jigsaw:               'Jig.',
};

interface MatrixRow { module: string; counts: Partial<Record<TeachingMethodology, number>>; total: number }

const ModuloMetodologiaMatrix: React.FC<{ rows: MatrixRow[]; usedMethods: TeachingMethodology[] }> = ({ rows, usedMethods }) => {
  if (rows.length === 0 || usedMethods.length === 0) return (
    <div className="flex items-center justify-center py-6">
      <p className="text-[10px] font-mono text-gray-600 text-center leading-relaxed">
        Imposta modulo e approccio nei blocchi per vedere la matrice
      </p>
    </div>
  );

  const globalMax = Math.max(...rows.flatMap(r => Object.values(r.counts) as number[]), 1);

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="w-full border-collapse" style={{ minWidth: 200 }}>
        <thead>
          <tr>
            <th className="text-left pr-2 pb-1.5" style={{ width: '38%' }} />
            {usedMethods.map(m => (
              <th key={m} className="text-center pb-1.5 px-0.5" title={TEACHING_METHODOLOGY_LABELS[m]}>
                <span className="text-[8px] font-mono text-gray-600">{METHOD_SHORT[m] ?? m.slice(0, 4)}</span>
              </th>
            ))}
            <th className="text-center pb-1.5 pl-1.5">
              <span className="text-[8px] font-mono text-gray-700">tot</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.module} className="group">
              <td className="pr-2 py-0.5">
                <span
                  className="text-[9px] font-mono text-gray-500 group-hover:text-gray-300 truncate block transition-colors"
                  style={{ maxWidth: 100 }}
                  title={row.module}
                >
                  {row.module}
                </span>
              </td>
              {usedMethods.map(m => {
                const v = row.counts[m] ?? 0;
                const intensity = v / globalMax;
                // verde-teal per metodologie innovative, grigio per tradizionale
                const isTradi = m === 'tradizionale';
                const bg = v > 0
                  ? isTradi
                    ? `rgba(75,85,99,${0.15 + intensity * 0.55})`
                    : `rgba(20,184,166,${0.10 + intensity * 0.60})`
                  : 'rgba(17,24,39,0.4)';
                return (
                  <td key={m} className="text-center py-0.5 px-0.5">
                    <div
                      className="mx-auto rounded-sm flex items-center justify-center transition-all"
                      style={{ width: 22, height: 18, background: bg }}
                      title={v > 0 ? `${row.module} · ${TEACHING_METHODOLOGY_LABELS[m]}: ${v} bl.` : undefined}
                    >
                      {v > 0 && (
                        <span className={`text-[8px] font-mono tabular-nums ${isTradi ? 'text-gray-400' : 'text-teal-300/80'}`}>{v}</span>
                      )}
                    </div>
                  </td>
                );
              })}
              <td className="text-center py-0.5 pl-1.5">
                <span className="text-[8px] font-mono text-gray-600 tabular-nums">{row.total}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

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
  ricerca: 'Ricerca', audiovisivo: 'Audiovisivo', produzione_scritta: 'Produzione scritta',
  progetto: 'Progetto', altro: 'Altro',
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

const LEFT      = 160;  // px – larghezza colonna nomi attività
const ROW       = 28;   // px – altezza riga
const HEAD      = 28;   // px – altezza header settimane
const MIN_COL_W = 34;   // px – larghezza minima colonna settimana

// Colori colonne alternate (inline per evitare purge Tailwind su valori arbitrari)
const STRIPE_ODD  = 'rgba(15,22,36,0.6)';   // pari — più chiaro
const STRIPE_EVEN = 'rgba(8,12,21,0.8)';    // dispari — più scuro
const STRIPE_CUR  = 'rgba(26,16,64,0.55)';  // settimana corrente — viola

// ── Props ─────────────────────────────────────────────────────────────────────

interface GanttViewProps {
  conversations: Conversation[];
  onClose: () => void;
  onNavigateToWeek: (weekNumber: number) => void;
  onMarkActivityDelivered?: (activityId: string) => void;
}

// ── Header ────────────────────────────────────────────────────────────────────

const SPLIT_LABELS = ['Gantt', '50/50', 'Radar'] as const;

interface GanttHeaderProps {
  onClose: () => void;
  count: number;
  weeks: number;
  activityCount: number;
  splitPreset: 0 | 1 | 2;
  onSetSplit: (p: 0 | 1 | 2) => void;
}

const GanttHeader: React.FC<GanttHeaderProps> = ({
  onClose, count, weeks, activityCount, splitPreset, onSetSplit,
}) => (
  <header className="flex-shrink-0 flex flex-col border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
    <div className="flex items-center justify-between px-6 pt-3.5 pb-2.5">
      <div className="flex items-center gap-2.5">
        <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
        <h1 className="text-base font-display font-semibold text-white">Analisi del Corso</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Toggle split */}
        <div className="hidden lg:flex items-center gap-0.5 bg-gray-800/50 rounded-md p-0.5">
          {SPLIT_LABELS.map((label, i) => (
            <button
              key={label}
              onClick={() => onSetSplit(i as 0 | 1 | 2)}
              className={`text-[9px] font-mono px-2 py-0.5 rounded transition-colors ${
                splitPreset === i ? 'text-gray-200 bg-gray-700/80' : 'text-gray-600 hover:text-gray-400'
              }`}
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

    {/* Sottotitolo info */}
    {(weeks > 0) && (
      <div className="px-6 pb-2.5">
        <span className="text-[10px] font-mono text-gray-600">
          {weeks > 0 && `${weeks} settimane`}
          {count > 0 && ` · ${count} moduli`}
          {activityCount > 0 && (
            <> · <span className="text-rose-500/70">{activityCount} attività</span></>
          )}
        </span>
      </div>
    )}
  </header>
);

// ── Componente principale ─────────────────────────────────────────────────────

const GanttView: React.FC<GanttViewProps> = ({
  conversations, onClose, onNavigateToWeek, onMarkActivityDelivered,
}) => {

  // Hook prima di qualsiasi return condizionale (regola React)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [splitPreset, setSplitPreset] = useState<0 | 1 | 2>(1);

  // ── Deriva moduli (per bar chart) ─────────────────────────────────────────
  const modules = useMemo((): GanttModule[] => {
    const map = new Map<string, number>();

    for (const conv of conversations) {
      if (!conv.weekPlan) continue;
      for (const block of conv.weekPlan.blocks) {
        const name = block.module?.trim() || 'Senza modulo';
        map.set(name, (map.get(name) ?? 0) + 1);
      }
    }

    return [...map.entries()]
      .map(([name, blockCount]) => ({ name, blockCount }))
      .sort((a, b) => b.blockCount - a.blockCount);
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
    const weekNums = [...weekBlockCounts.keys()];
    const calMax = weekNums.length > 0 ? Math.max(...weekNums) : 0;
    const actDueWeeks = activities.map(a => getActivityDueWeek(a, weekBlockCounts));
    const actMax = actDueWeeks.length > 0 ? Math.max(...actDueWeeks) : 0;
    return Math.max(calMax, actMax);
  }, [activities, weekBlockCounts]);

  const currentWeek = useMemo(() => detectCurrentWeek(conversations), [conversations]);
  const weeks = useMemo(() => Array.from({ length: maxWeek }, (_, i) => i + 1), [maxWeek]);

  // ── Radar equilibrio didattico ────────────────────────────────────────────
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

  // ── Heatmap argomento × tipologia ─────────────────────────────────────────
  const heatmapRows = useMemo((): HeatmapRow[] => {
    const map = new Map<string, Record<LessonType, number>>();
    conversations.forEach(conv => {
      if (!conv.weekPlan) return;
      conv.weekPlan.blocks.forEach(block => {
        const subject = block.lessonSubject?.trim();
        if (!subject) return;
        if (block.status === 'saltato' || block.status === 'annullato') return;
        if (!map.has(subject)) {
          map.set(subject, {
            frontale_teorica: 0, frontale_operativa: 0,
            laboratorio: 0, verifica: 0, discussione: 0,
          });
        }
        if (block.tipologia) {
          map.get(subject)![block.tipologia]++;
        }
      });
    });
    return [...map.entries()]
      .map(([subject, counts]) => ({
        subject,
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [conversations]);

  // ── Matrice modulo × metodologia ─────────────────────────────────────────
  const { matrixRows, usedMethods } = useMemo(() => {
    const map = new Map<string, Partial<Record<TeachingMethodology, number>>>();
    const methodSet = new Set<TeachingMethodology>();
    conversations.forEach(conv => {
      if (!conv.weekPlan) return;
      conv.weekPlan.blocks.forEach(block => {
        if (!block.metodologia) return;
        if (block.status === 'saltato' || block.status === 'annullato') return;
        const mod = block.module?.trim() || 'Senza modulo';
        if (!map.has(mod)) map.set(mod, {});
        const entry = map.get(mod)!;
        entry[block.metodologia] = (entry[block.metodologia] ?? 0) + 1;
        methodSet.add(block.metodologia);
      });
    });
    // Ordine stabile: tradizionale prima, poi gli altri in ordine di TEACHING_METHODOLOGY_LABELS
    const methodOrder = (Object.keys(TEACHING_METHODOLOGY_LABELS) as TeachingMethodology[])
      .filter(m => methodSet.has(m));
    const rows: MatrixRow[] = [...map.entries()]
      .map(([module, counts]) => ({
        module,
        counts,
        total: Object.values(counts).reduce((a, b) => (a as number) + (b as number), 0) as number,
      }))
      .sort((a, b) => b.total - a.total);
    return { matrixRows: rows, usedMethods: methodOrder };
  }, [conversations]);

  // ── Helpers posizionamento (%) ────────────────────────────────────────────
  const colL  = (w: number) => `${((w - 1) / maxWeek) * 100}%`;
  const colW  = ()           => `${(1 / maxWeek) * 100}%`;
  const barL  = (f: number) => `${((f - 1) / maxWeek) * 100}%`;
  const barW  = (f: number, l: number) => `${((l - f + 1) / maxWeek) * 100}%`;
  const curL  = (w: number) => `${((w - 0.5) / maxWeek) * 100}%`;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (maxWeek === 0) {
    return (
      <div className="flex-1 flex flex-col min-w-0 bg-[#0D1117]">
        <GanttHeader
          onClose={onClose} count={0} weeks={0} activityCount={0}
          splitPreset={splitPreset} onSetSplit={setSplitPreset}
        />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-mono text-gray-600">
            Nessun dato da visualizzare. Pianifica alcune settimane per vedere il Gantt.
          </p>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const radarWidthClass = ['lg:w-[26%]', 'lg:w-[36%]', 'lg:w-[50%]'][splitPreset];

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#0D1117]">
      <GanttHeader
        onClose={onClose} count={modules.length} weeks={maxWeek}
        activityCount={activities.length} splitPreset={splitPreset} onSetSplit={setSplitPreset}
      />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-4 p-4">

        {/* ── Colonna sinistra: Gantt + heatmap ─────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-hidden">

        {/* Card Gantt Attività */}
        <div className="rounded-xl border border-gray-600/40 bg-gray-800/30 overflow-hidden flex flex-col" style={{ minHeight: 0, flex: '0 0 auto', maxHeight: '55%' }}>

          <div className="flex items-center px-5 pt-4 pb-3 flex-shrink-0">
            <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">
              Attività in corso
            </span>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            {activities.length === 0 ? (
              <div className="flex items-center justify-center h-full py-16">
                <p className="text-[10px] font-mono text-gray-600 text-center leading-relaxed">
                  Nessuna attività lanciata.<br />
                  Apri un blocco nel Laboratorio per lanciarne una.
                </p>
              </div>
            ) : (
            <div className="pb-10" style={{ minWidth: LEFT + maxWeek * MIN_COL_W }}>

              {/* ── Header settimane ──────────────────────────────────────── */}
              <div className="flex sticky top-0 z-10" style={{ height: HEAD, background: '#0D1117' }}>
                <div
                  style={{ width: LEFT, flexShrink: 0, borderBottom: '1px solid rgba(31,41,55,0.8)', borderRight: '1px solid rgba(31,41,55,0.5)' }}
                />
                <div className="flex-1 relative" style={{ borderBottom: '1px solid rgba(31,41,55,0.8)' }}>
                  {weeks.map(w => {
                    const isCur = w === currentWeek;
                    const isOdd = w % 2 !== 0;
                    return (
                      <div
                        key={w}
                        className="absolute inset-y-0 flex items-center justify-center"
                        style={{
                          left: colL(w),
                          width: colW(),
                          background: isCur ? STRIPE_CUR : isOdd ? STRIPE_ODD : STRIPE_EVEN,
                          borderLeft: '1px solid rgba(22,29,43,0.9)',
                        }}
                      >
                        <span
                          className="text-[10px] font-mono leading-none select-none"
                          style={{ color: isCur ? '#a78bfa' : '#374151', fontWeight: isCur ? 600 : 400 }}
                        >
                          {w}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── Righe attività ───────────────────────────────────────── */}
              {activities.map(activity => {
                    const dueWeek = getActivityDueWeek(activity, weekBlockCounts);
                    const effectiveStatus = getEffectiveActivityStatus(activity, dueWeek, currentWeek);
                    const isSelected = selectedActivity?.id === activity.id;
                    const clampedDueWeek = Math.min(dueWeek, maxWeek);

                    return (
                      <div key={activity.id} className="flex group" style={{ height: ROW }}>
                        <div
                          style={{ width: LEFT, flexShrink: 0, borderRight: '1px solid rgba(31,41,55,0.5)', borderBottom: '1px solid rgba(17,24,39,0.8)' }}
                          className="flex items-center px-5"
                        >
                          <button
                            className="w-full text-left truncate"
                            title={activity.title}
                            onClick={() => setSelectedActivity(isSelected ? null : activity)}
                          >
                            <span className={`text-xs font-display transition-colors ${
                              isSelected ? 'text-rose-300' : 'text-gray-500 group-hover:text-gray-300'
                            }`}>
                              {activity.title}
                            </span>
                          </button>
                        </div>

                        <div
                          className="flex-1 relative"
                          style={{ borderBottom: '1px solid rgba(17,24,39,0.8)' }}
                        >
                          {/* Strisce */}
                          {weeks.map(w => (
                            <div
                              key={w}
                              className="absolute inset-y-0"
                              style={{
                                left: colL(w), width: colW(),
                                background: w === currentWeek ? STRIPE_CUR : w % 2 !== 0 ? STRIPE_ODD : STRIPE_EVEN,
                                borderLeft: '1px solid rgba(22,29,43,0.9)',
                                pointerEvents: 'none',
                              }}
                            />
                          ))}

                          {/* Linea settimana corrente */}
                          {currentWeek && currentWeek <= maxWeek && (
                            <div
                              className="absolute inset-y-0 pointer-events-none"
                              style={{ left: curL(currentWeek), width: 1, background: 'rgba(124,58,237,0.45)', zIndex: 3 }}
                            />
                          )}

                          {/* Barra attività */}
                          <button
                            className={`absolute rounded transition-opacity hover:opacity-80 border border-rose-500/20 ${ACTIVITY_BAR[effectiveStatus]}`}
                            style={{
                              left: `calc(${barL(activity.launchWeekNumber)} + 4px)`,
                              width: `calc(${barW(activity.launchWeekNumber, clampedDueWeek)} - 8px)`,
                              height: '48%', top: '26%', zIndex: 2,
                            }}
                            onClick={() => setSelectedActivity(isSelected ? null : activity)}
                            title={`${activity.title} — scadenza sett. ${dueWeek}`}
                          />

                          {/* Marker lancio */}
                          <div
                            className={`absolute pointer-events-none w-0.5 rounded-full ${ACTIVITY_DOT_CLS[effectiveStatus]}`}
                            style={{ left: colL(activity.launchWeekNumber), top: '18%', height: '64%', zIndex: 3 }}
                          />

                          {/* Marker scadenza */}
                          {dueWeek !== activity.launchWeekNumber && dueWeek <= maxWeek && (
                            <div
                              className={`absolute pointer-events-none w-0.5 rounded-full opacity-60 ${
                                effectiveStatus === 'consegnata' ? 'bg-emerald-500' :
                                effectiveStatus === 'scaduta'    ? 'bg-gray-500' : 'bg-amber-400'
                              }`}
                              style={{
                                left: `calc(${colL(dueWeek)} + ${colW()} - 2px)`,
                                top: '18%', height: '64%', zIndex: 3,
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
              })}

            </div>
            )}
          </div>
        </div>{/* fine card Gantt */}

        {/* Heatmap argomento × tipologia — sotto il Gantt */}
        <div className="rounded-xl border border-gray-600/40 bg-gray-800/30 p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">Argomento × Tipologia</span>
            {heatmapRows.length > 0 && (
              <span className="text-[9px] font-mono text-gray-700">{heatmapRows.length} arg.</span>
            )}
          </div>
          <SubjectHeatmap rows={heatmapRows} />
        </div>

        {/* Matrice modulo × metodologia */}
        <div className="rounded-xl border border-gray-600/40 bg-gray-800/30 p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">Modulo × Metodologia</span>
            {usedMethods.length > 0 && (
              <span className="text-[9px] font-mono text-gray-700">{usedMethods.length} met.</span>
            )}
          </div>
          <ModuloMetodologiaMatrix rows={matrixRows} usedMethods={usedMethods} />
        </div>

        </div>{/* fine colonna sinistra */}

        {/* ── Colonna destra: donut moduli + radar ─────────────────────── */}
        <div className={`flex-shrink-0 w-full ${radarWidthClass} flex flex-col gap-4 overflow-y-auto custom-scrollbar`}>

          {/* Donut distribuzione moduli */}
          <div className="rounded-xl border border-gray-600/40 bg-gray-800/30 p-4 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">Distribuzione Moduli</span>
              {modules.length > 0 && (
                <span className="text-[9px] font-mono text-gray-700">{modules.reduce((s, m) => s + m.blockCount, 0)} bl.</span>
              )}
            </div>
            <ModuleDonut modules={modules} />
          </div>

          {/* Radar equilibrio didattico */}
          <div className="rounded-xl border border-gray-600/40 bg-gray-800/30 p-4 flex-shrink-0">
            {radarData.length > 0 ? (
              <DidacticRadarChart data={radarData} />
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-[10px] font-mono text-gray-600 text-center leading-relaxed">
                  Imposta una tipologia di lezione per vedere l'equilibrio didattico
                </p>
              </div>
            )}
          </div>

        </div>

      </div>{/* fine layout */}

      {/* ── Pannello dettaglio attività ───────────────────────────────────── */}
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
                  {effectiveStatus === 'consegnata'  && <span className="text-emerald-400">● Consegnata</span>}
                  {effectiveStatus === 'scaduta'     && <span className="text-gray-500">● Scaduta</span>}
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
