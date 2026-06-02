import React, { useMemo, useState } from 'react';
import type { Conversation, Activity, ActivityStatus, LessonType, TeachingMethodology, CourseContentUnit } from '../types';
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

// ── Donut distribuzione moduli (doppio anello: Moduli + UDA) ─────────────────

function buildDonutSlices(
  items: GanttModule[],
  cx: number, cy: number,
  R: number, r: number,
  startAngle: number,
): Array<{ mod: GanttModule; large: number; x1: number; y1: number; x2: number; y2: number; xi1: number; yi1: number; xi2: number; yi2: number; c: ModuleColor; idx: number }> {
  const total = items.reduce((s, m) => s + m.blockCount, 0);
  let angle = startAngle;
  return items.map((mod, idx) => {
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
    return { mod, large, x1, y1, x2, y2, xi1, yi1, xi2, yi2, c, idx };
  });
}

const DistribuzioneDonut: React.FC<{ modules: GanttModule[]; uda: GanttModule[] }> = ({ modules, uda }) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const hasUda = uda.length > 0;

  if (modules.length === 0) return (
    <div className="flex items-center justify-center py-6">
      <p className="text-[10px] font-mono text-gray-600 text-center">
        Assegna moduli ai blocchi per vedere la distribuzione
      </p>
    </div>
  );

  const cx = 60; const cy = 60;
  const START = -Math.PI / 2;

  // Anello esterno: Moduli
  const outerR = hasUda ? 52 : 48;
  const outerr = hasUda ? 38 : 28;
  const outerSlices = buildDonutSlices(modules, cx, cy, outerR, outerr, START);

  // Anello interno: UDA (solo se presenti)
  const innerR = 33;
  const innerr = 20;
  const innerSlices = hasUda ? buildDonutSlices(uda, cx, cy, innerR, innerr, START) : [];

  const totalModuli = modules.reduce((s, m) => s + m.blockCount, 0);
  const totalUda    = uda.reduce((s, m) => s + m.blockCount, 0);
  const totalBl     = totalModuli + totalUda;

  const hoveredMod = hovered
    ? [...modules, ...uda].find(m => m.name === hovered)
    : null;

  return (
    <div className="flex items-start gap-3">
      {/* SVG doppio anello */}
      <svg width="120" height="120" viewBox="0 0 120 120" className="flex-shrink-0">
        {/* Anello esterno — Moduli */}
        {outerSlices.map(({ mod, large, x1, y1, x2, y2, xi1, yi1, xi2, yi2, c }) => (
          <path
            key={`m-${mod.name}`}
            d={`M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${outerr} ${outerr} 0 ${large} 0 ${xi2} ${yi2} Z`}
            fill={c.bg}
            stroke={c.border}
            strokeWidth="0.8"
            opacity={hovered && hovered !== mod.name ? 0.3 : 1}
            onMouseEnter={() => setHovered(mod.name)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'default', transition: 'opacity 0.15s' }}
          />
        ))}
        {/* Separatore tra anelli (solo se doppio) */}
        {hasUda && (
          <circle cx={cx} cy={cy} r={innerR + 1} fill="none" stroke="rgba(13,17,23,0.8)" strokeWidth="2" />
        )}
        {/* Anello interno — UDA */}
        {innerSlices.map(({ mod, large, x1, y1, x2, y2, xi1, yi1, xi2, yi2 }, sliceIdx) => {
          // UDA usano una palette sfumata diversa (shift di 4 indici)
          const c = moduleColor(sliceIdx + 4);
          return (
            <path
              key={`u-${mod.name}`}
              d={`M ${x1} ${y1} A ${innerR} ${innerR} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerr} ${innerr} 0 ${large} 0 ${xi2} ${yi2} Z`}
              fill={c.bg}
              stroke={c.border}
              strokeWidth="0.8"
              opacity={hovered && hovered !== mod.name ? 0.3 : 1}
              onMouseEnter={() => setHovered(mod.name)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: 'default', transition: 'opacity 0.15s' }}
            />
          );
        })}
        {/* Label centrale */}
        <text x={cx} y={cy - 5} textAnchor="middle" fill="rgba(156,163,175,0.7)" fontSize="7" fontFamily="monospace">
          {hoveredMod ? `${hoveredMod.blockCount}` : `${totalBl}`}
        </text>
        <text x={cx} y={cy + 5} textAnchor="middle" fill="rgba(107,114,128,0.6)" fontSize="6" fontFamily="monospace">
          {hoveredMod ? 'bl.' : 'tot.'}
        </text>
      </svg>

      {/* Legenda */}
      <div className="flex flex-col gap-0.5 min-w-0 flex-1 pt-1">
        {/* Sezione Moduli */}
        {modules.length > 0 && (
          <>
            <span className="text-[8px] font-mono text-gray-700 uppercase tracking-wide mb-0.5">Moduli</span>
            {modules.map((mod, idx) => {
              const c = moduleColor(idx);
              const pct = Math.round((mod.blockCount / totalModuli) * 100);
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
                  <span className="text-[9px] font-mono text-gray-500 truncate flex-1 min-w-0" style={isHov ? { color: c.text } : {}} title={mod.name}>
                    {mod.name}
                  </span>
                  <span className="text-[9px] font-mono text-gray-700 flex-shrink-0 tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </>
        )}
        {/* Sezione UDA */}
        {hasUda && (
          <>
            <span className="text-[8px] font-mono text-gray-700 uppercase tracking-wide mt-1.5 mb-0.5">UDA</span>
            {uda.map((mod, idx) => {
              const c = moduleColor(idx + 4);
              const pct = Math.round((mod.blockCount / totalUda) * 100);
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
                  <span className="text-[9px] font-mono text-gray-500 truncate flex-1 min-w-0" style={isHov ? { color: c.text } : {}} title={mod.name}>
                    {mod.name}
                  </span>
                  <span className="text-[9px] font-mono text-gray-700 flex-shrink-0 tabular-nums">{pct}%</span>
                </div>
              );
            })}
          </>
        )}
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

// ── Heatmap Settimana × Modulo ────────────────────────────────────────────────

interface ModuleWeekCell { count: number }
interface ModuleWeekRow { module: string; cells: Map<number, number>; total: number; colorIdx: number }

const SettimanaModuloHeatmap: React.FC<{
  rows: ModuleWeekRow[];
  weeks: number[];
  currentWeek: number | null;
}> = ({ rows, weeks, currentWeek }) => {
  if (rows.length === 0) return (
    <div className="flex items-center justify-center py-6">
      <p className="text-[10px] font-mono text-gray-600 text-center leading-relaxed">
        Assegna moduli ai blocchi per vedere la distribuzione temporale
      </p>
    </div>
  );

  const globalMax = Math.max(
    ...rows.flatMap(r => [...r.cells.values()]),
    1,
  );

  return (
    <div className="overflow-x-auto custom-scrollbar">
      <table className="border-collapse" style={{ minWidth: Math.max(260, 90 + weeks.length * 22) }}>
        <thead>
          <tr>
            <th className="text-left pr-2 pb-1.5" style={{ width: 90 }} />
            {weeks.map(w => {
              const isCur = w === currentWeek;
              return (
                <th key={w} className="text-center pb-1.5 px-px" style={{ width: 22 }}>
                  <span
                    className="text-[8px] font-mono tabular-nums"
                    style={{ color: isCur ? '#a78bfa' : '#374151' }}
                  >
                    {w}
                  </span>
                </th>
              );
            })}
            <th className="text-center pb-1.5 pl-2">
              <span className="text-[8px] font-mono text-gray-700">tot</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            const c = moduleColor(row.colorIdx);
            return (
              <tr key={row.module} className="group">
                <td className="pr-2 py-0.5">
                  <span
                    className="text-[9px] font-mono text-gray-500 group-hover:text-gray-300 truncate block transition-colors"
                    style={{ maxWidth: 86 }}
                    title={row.module}
                  >
                    {row.module}
                  </span>
                </td>
                {weeks.map(w => {
                  const v = row.cells.get(w) ?? 0;
                  const isCur = w === currentWeek;
                  const intensity = v / globalMax;
                  const bg = v > 0
                    ? `rgba(${hexToRgb(c.border)},${0.15 + intensity * 0.65})`
                    : isCur
                      ? 'rgba(124,58,237,0.08)'
                      : 'rgba(17,24,39,0.4)';
                  return (
                    <td key={w} className="text-center py-0.5 px-px">
                      <div
                        className="mx-auto rounded-sm flex items-center justify-center transition-all"
                        style={{ width: 20, height: 16, background: bg,
                          outline: isCur ? '1px solid rgba(124,58,237,0.25)' : undefined }}
                        title={v > 0 ? `${row.module} · sett. ${w}: ${v} bl.` : undefined}
                      >
                        {v > 0 && (
                          <span className="text-[7px] font-mono tabular-nums" style={{ color: c.text, opacity: 0.9 }}>{v}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
                <td className="text-center py-0.5 pl-2">
                  <span className="text-[8px] font-mono text-gray-600 tabular-nums">{row.total}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Utility: estrae r,g,b da una stringa rgba(...) o #hex
function hexToRgb(colorStr: string): string {
  // Se è già rgba(...) prende solo i primi 3 valori
  const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (rgbaMatch) return `${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]}`;
  // fallback
  return '148,163,184'; // slate-400
}

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

// Sentinel per i blocchi senza metodologia compilata
const UNSET_METHOD = '__non_compilato__' as const;
type MethodKey = TeachingMethodology | typeof UNSET_METHOD;

interface MatrixRow { module: string; counts: Partial<Record<MethodKey, number>>; total: number; unset: number }

const ModuloMetodologiaMatrix: React.FC<{
  rows: MatrixRow[];
  usedMethods: TeachingMethodology[];
  hasUnset: boolean;
}> = ({ rows, usedMethods, hasUnset }) => {
  if (rows.length === 0 || (usedMethods.length === 0 && !hasUnset)) return (
    <div className="flex items-center justify-center py-6">
      <p className="text-[10px] font-mono text-gray-600 text-center leading-relaxed">
        Imposta modulo e approccio nei blocchi per vedere la matrice
      </p>
    </div>
  );

  const globalMax = Math.max(
    ...rows.flatMap(r => [...usedMethods.map(m => r.counts[m] ?? 0), r.unset]),
    1,
  );

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
            {/* Colonna non compilato */}
            {hasUnset && (
              <th className="text-center pb-1.5 px-0.5 pl-1" title="Blocchi senza metodologia compilata">
                <span className="text-[8px] font-mono text-gray-700">—</span>
              </th>
            )}
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
                const isTradi = m === 'tradizionale';
                const bg = v > 0
                  ? isTradi
                    ? `rgba(75,85,99,${0.15 + intensity * 0.55})`
                    : `rgba(20,184,166,${0.10 + intensity * 0.60})`
                  : 'rgba(17,24,39,0.4)';
                return (
                  <td key={m} className="text-center py-0.5 px-0.5">
                    <div
                      className="mx-auto rounded-sm flex items-center justify-center transition-all group/cell"
                      style={{ width: 22, height: 18, background: bg }}
                      title={v > 0 ? `${row.module} · ${TEACHING_METHODOLOGY_LABELS[m]}: ${v} bl.` : undefined}
                    >
                      {v > 0 && (
                        <span className={`text-[8px] font-mono tabular-nums opacity-0 group-hover/cell:opacity-100 transition-opacity ${isTradi ? 'text-gray-300' : 'text-teal-200'}`}>{v}</span>
                      )}
                    </div>
                  </td>
                );
              })}
              {/* Cella non compilato */}
              {hasUnset && (() => {
                const v = row.unset;
                const intensity = v / globalMax;
                const bg = v > 0
                  ? `rgba(107,114,128,${0.12 + intensity * 0.45})`
                  : 'rgba(17,24,39,0.4)';
                return (
                  <td className="text-center py-0.5 px-0.5 pl-1">
                    <div
                      className="mx-auto rounded-sm flex items-center justify-center transition-all group/cell"
                      style={{ width: 22, height: 18, background: bg, border: v > 0 ? '1px dashed rgba(107,114,128,0.3)' : undefined }}
                      title={v > 0 ? `${row.module} · non compilato: ${v} bl.` : undefined}
                    >
                      {v > 0 && (
                        <span className="text-[8px] font-mono text-gray-500 tabular-nums opacity-0 group-hover/cell:opacity-100 transition-opacity">{v}</span>
                      )}
                    </div>
                  </td>
                );
              })()}
              <td className="text-center py-0.5 pl-1.5">
                <span className="text-[8px] font-mono text-gray-600 tabular-nums">{row.total}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Legenda colonna — */}
      {hasUnset && (
        <div className="mt-2 flex items-center gap-1.5">
          <div className="w-3.5 h-3 rounded-sm border border-dashed border-gray-600/50 bg-gray-500/15 flex-shrink-0" />
          <span className="text-[8px] font-mono text-gray-700">metodologia non compilata</span>
        </div>
      )}
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
  contentUnits?: CourseContentUnit[];
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

// ── Contesto Fisico: barre stacked in aula / fuori aula per modulo ────────────

interface ContestoRow { module: string; inAula: number; fuoriAula: number; total: number }

const ContestoFisicoChart: React.FC<{ rows: ContestoRow[] }> = ({ rows }) => {
  if (rows.length === 0) return (
    <div className="flex items-center justify-center py-6">
      <p className="text-[10px] font-mono text-gray-600 text-center leading-relaxed">
        Attiva "FUORI" su almeno un blocco per vedere il contesto fisico
      </p>
    </div>
  );

  return (
    <div className="space-y-1.5">
      {rows.map(row => {
        const fuoriPct = row.total > 0 ? (row.fuoriAula / row.total) * 100 : 0;
        const inAulaPct = 100 - fuoriPct;
        return (
          <div key={row.module} className="flex items-center gap-2">
            <span
              className="text-[9px] font-mono text-gray-500 flex-shrink-0 truncate"
              style={{ width: 100 }}
              title={row.module}
            >
              {row.module}
            </span>
            <div className="flex-1 flex h-3.5 rounded-sm overflow-hidden bg-gray-900/60">
              {row.inAula > 0 && (
                <div
                  className="h-full bg-indigo-500/40 flex items-center justify-center transition-all"
                  style={{ width: `${inAulaPct}%` }}
                  title={`In aula: ${row.inAula} bl.`}
                >
                  {inAulaPct > 20 && (
                    <span className="text-[7px] font-mono text-indigo-300/80 tabular-nums">{row.inAula}</span>
                  )}
                </div>
              )}
              {row.fuoriAula > 0 && (
                <div
                  className="h-full bg-teal-500/50 flex items-center justify-center transition-all"
                  style={{ width: `${fuoriPct}%` }}
                  title={`Fuori aula: ${row.fuoriAula} bl.`}
                >
                  {fuoriPct > 15 && (
                    <span className="text-[7px] font-mono text-teal-300/80 tabular-nums">{row.fuoriAula}</span>
                  )}
                </div>
              )}
            </div>
            <span className="text-[8px] font-mono text-gray-700 flex-shrink-0 tabular-nums w-6 text-right">{row.total}</span>
          </div>
        );
      })}
      {/* Legenda */}
      <div className="flex items-center gap-3 pt-1">
        <span className="flex items-center gap-1 text-[8px] font-mono text-gray-600">
          <span className="w-2 h-2 rounded-sm bg-indigo-500/40 inline-block" />in aula
        </span>
        <span className="flex items-center gap-1 text-[8px] font-mono text-gray-600">
          <span className="w-2 h-2 rounded-sm bg-teal-500/50 inline-block" />fuori aula
        </span>
      </div>
    </div>
  );
};

// ── Componente principale ─────────────────────────────────────────────────────

const GanttView: React.FC<GanttViewProps> = ({
  conversations, contentUnits = [], onClose, onNavigateToWeek, onMarkActivityDelivered,
}) => {

  // Hook prima di qualsiasi return condizionale (regola React)
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [splitPreset, setSplitPreset] = useState<0 | 1 | 2>(1);

  // ── Mappa titolo → tipo contentUnit per lookup O(1) ──────────────────────
  // Mappa sia il titolo breve ("Verso il Moderno") sia il formato header completo
  // legacy ("MODULO 5: Verso il Moderno" / "UDA 3: L'Alto Rinascimento")
  // perché i dati storici potrebbero avere block.module nel formato esteso.
  const unitTypeByTitle = useMemo(() => {
    const m = new Map<string, CourseContentUnit['type']>();
    const PREFIX: Record<CourseContentUnit['type'], string> = {
      modulo: 'MODULO', uda: 'UDA', educazione_civica: 'EDUCAZIONE CIVICA', fsl: 'FSL',
    };
    for (const u of contentUnits) {
      m.set(u.title.trim(), u.type);
      // formato legacy: "MODULO 5: Titolo" / "UDA 3: Titolo"
      m.set(`${PREFIX[u.type]} ${u.order}: ${u.title}`.trim(), u.type);
      // formato senza numero (edge case): "MODULO: Titolo"
      m.set(`${PREFIX[u.type]}: ${u.title}`.trim(), u.type);
    }
    return m;
  }, [contentUnits]);

  // ── Deriva moduli e UDA separati (per doppio anello) ─────────────────────
  const { modulesData, udaData } = useMemo(() => {
    const modMap = new Map<string, number>();
    const udaMap = new Map<string, number>();

    for (const conv of conversations) {
      if (!conv.weekPlan) continue;
      for (const block of conv.weekPlan.blocks) {
        const name = block.module?.trim();
        if (!name) continue;
        // Prima prova la mappa da contentUnits; poi fallback sul prefisso nel nome stesso
        // (compatibile con dati salvati nel formato "UDA 3: Titolo" o "MODULO 2: Titolo")
        const typeFromMap = unitTypeByTitle.get(name);
        const typeFromPrefix: CourseContentUnit['type'] =
          /^UDA\s/i.test(name)               ? 'uda' :
          /^EDUCAZIONE CIVICA/i.test(name)   ? 'educazione_civica' :
          /^FSL\s/i.test(name)               ? 'fsl' :
                                               'modulo';
        const type = typeFromMap ?? typeFromPrefix;
        if (type === 'uda') {
          udaMap.set(name, (udaMap.get(name) ?? 0) + 1);
        } else {
          // modulo, educazione_civica, fsl → anello esterno
          modMap.set(name, (modMap.get(name) ?? 0) + 1);
        }
      }
    }

    return {
      modulesData: [...modMap.entries()].map(([name, blockCount]) => ({ name, blockCount })).sort((a, b) => b.blockCount - a.blockCount),
      udaData:     [...udaMap.entries()].map(([name, blockCount]) => ({ name, blockCount })).sort((a, b) => b.blockCount - a.blockCount),
    };
  }, [conversations, unitTypeByTitle]);

  // Tutti i moduli (per conteggio header) = moduli + uda
  const modules = useMemo(() => [...modulesData, ...udaData], [modulesData, udaData]);

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
  // La chiave di raggruppamento è normalizzata (lowercase+trim) per evitare
  // duplicati da refusi di maiuscole ("La cattedrale gotica" = "la cattedrale gotica").
  // Il nome visualizzato è la prima occorrenza trovata (preserva la capitalizzazione originale).
  const heatmapRows = useMemo((): HeatmapRow[] => {
    const map = new Map<string, Record<LessonType, number>>();
    const displayNames = new Map<string, string>(); // key normalizzata → nome display
    conversations.forEach(conv => {
      if (!conv.weekPlan) return;
      conv.weekPlan.blocks.forEach(block => {
        const subject = block.lessonSubject?.trim();
        if (!subject) return;
        if (block.status === 'saltato' || block.status === 'annullato') return;
        const key = subject.toLowerCase();
        if (!map.has(key)) {
          map.set(key, {
            frontale_teorica: 0, frontale_operativa: 0,
            laboratorio: 0, verifica: 0, discussione: 0,
          });
          displayNames.set(key, subject); // prima occorrenza come nome display
        }
        if (block.tipologia) {
          map.get(key)![block.tipologia]++;
        }
      });
    });
    return [...map.entries()]
      .map(([key, counts]) => ({
        subject: displayNames.get(key)!,
        counts,
        total: Object.values(counts).reduce((a, b) => a + b, 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [conversations]);

  // ── Matrice modulo × metodologia ─────────────────────────────────────────
  // I blocchi senza metodologia compilata vengono contati nella colonna "—" (unset)
  // separata, NON aggregati in "tradizionale". Tradizionale compare solo se scelto
  // esplicitamente dal docente.
  // Inclusi solo blocchi con modulo assegnato (la matrice è "Modulo × Metodologia").
  const { matrixRows, usedMethods, hasUnset } = useMemo(() => {
    const map = new Map<string, { counts: Partial<Record<TeachingMethodology, number>>; unset: number }>();
    const methodSet = new Set<TeachingMethodology>();
    let anyUnset = false;
    conversations.forEach(conv => {
      if (!conv.weekPlan) return;
      conv.weekPlan.blocks.forEach(block => {
        if (!block.module?.trim()) return;
        if (block.status === 'saltato' || block.status === 'annullato') return;
        const mod = block.module.trim();
        if (!map.has(mod)) map.set(mod, { counts: {}, unset: 0 });
        const entry = map.get(mod)!;
        if (block.metodologia) {
          entry.counts[block.metodologia] = (entry.counts[block.metodologia] ?? 0) + 1;
          methodSet.add(block.metodologia);
        } else {
          entry.unset++;
          anyUnset = true;
        }
      });
    });
    const methodOrder = (Object.keys(TEACHING_METHODOLOGY_LABELS) as TeachingMethodology[])
      .filter(m => methodSet.has(m));
    const rows: MatrixRow[] = [...map.entries()]
      .map(([module, { counts, unset }]) => ({
        module,
        counts,
        unset,
        total: (Object.values(counts).reduce((a, b) => (a as number) + (b as number), 0) as number) + unset,
      }))
      .sort((a, b) => b.total - a.total);
    return { matrixRows: rows, usedMethods: methodOrder, hasUnset: anyUnset };
  }, [conversations]);

  // ── Blocchi FSL per il Gantt ──────────────────────────────────────────────
  // Raccoglie i blocchi con isFslPeriod=true per mostrarli nel Gantt con barre sky.
  const fslBlocks = useMemo(() => {
    const result: Array<{ weekNumber: number; blockLabel: string; module: string }> = [];
    conversations.forEach(conv => {
      if (!conv.weekPlan) return;
      conv.weekPlan.blocks.forEach((block, idx) => {
        if (!block.isFslPeriod) return;
        if (block.status === 'saltato' || block.status === 'annullato') return;
        result.push({
          weekNumber: conv.weekPlan!.weekNumber,
          blockLabel: `Bl.${idx + 1}${block.blockTitle ? ` · ${block.blockTitle}` : block.module ? ` · ${block.module}` : ''}`,
          module: block.module || '',
        });
      });
    });
    return result.sort((a, b) => a.weekNumber - b.weekNumber);
  }, [conversations]);

  // ── Heatmap settimana × modulo ────────────────────────────────────────────
  const moduleWeekRows = useMemo((): ModuleWeekRow[] => {
    // Raccoglie tutti i moduli distinti con il loro indice colore (stesso ordine del donut)
    const modIndexMap = new Map<string, number>();
    [...modulesData, ...udaData].forEach((m, i) => modIndexMap.set(m.name, i));

    const rowMap = new Map<string, Map<number, number>>();
    conversations.forEach(conv => {
      if (!conv.weekPlan) return;
      const wn = conv.weekPlan.weekNumber;
      conv.weekPlan.blocks.forEach(block => {
        const mod = block.module?.trim();
        if (!mod) return;
        if (block.status === 'saltato' || block.status === 'annullato') return;
        if (!rowMap.has(mod)) rowMap.set(mod, new Map());
        const cells = rowMap.get(mod)!;
        cells.set(wn, (cells.get(wn) ?? 0) + 1);
      });
    });
    return [...rowMap.entries()]
      .map(([module, cells]) => ({
        module,
        cells,
        total: [...cells.values()].reduce((a, b) => a + b, 0),
        colorIdx: modIndexMap.get(module) ?? 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [conversations, modulesData, udaData]);

  // ── Contesto fisico per modulo ────────────────────────────────────────────
  const contestoRows = useMemo((): ContestoRow[] => {
    const map = new Map<string, { inAula: number; fuoriAula: number }>();
    conversations.forEach(conv => {
      if (!conv.weekPlan) return;
      conv.weekPlan.blocks.forEach(block => {
        if (block.status === 'saltato' || block.status === 'annullato') return;
        const mod = block.module?.trim() || 'Senza modulo';
        if (!map.has(mod)) map.set(mod, { inAula: 0, fuoriAula: 0 });
        const entry = map.get(mod)!;
        if (block.isFuoriAula) entry.fuoriAula++;
        else entry.inAula++;
      });
    });
    return [...map.entries()]
      .map(([module, { inAula, fuoriAula }]) => ({ module, inAula, fuoriAula, total: inAula + fuoriAula }))
      .filter(r => r.fuoriAula > 0) // mostra solo moduli con almeno 1 blocco fuori aula
      .sort((a, b) => b.fuoriAula - a.fuoriAula);
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
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto custom-scrollbar">

        {/* Card Gantt Attività */}
        <div className="rounded-xl border border-gray-600/40 bg-gray-800/30 overflow-hidden flex flex-col" style={{ minHeight: 0, flex: '0 0 auto', maxHeight: 340 }}>

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

            {/* ── Separatore + righe FSL ───────────────────────────────── */}
            {fslBlocks.length > 0 && (
              <div>
                {/* Riga separatore FSL */}
                <div className="flex" style={{ height: 20 }}>
                  <div style={{ width: LEFT, flexShrink: 0, borderRight: '1px solid rgba(31,41,55,0.5)', borderBottom: '1px solid rgba(31,41,55,0.4)', background: '#0D1117' }}
                    className="flex items-center px-5">
                    <span className="text-[8px] font-mono tracking-[0.12em] uppercase text-sky-600/70">Periodi FSL</span>
                  </div>
                  <div className="flex-1 relative" style={{ borderBottom: '1px solid rgba(31,41,55,0.4)', background: '#0D1117' }}>
                    {weeks.map(w => (
                      <div key={w} className="absolute inset-y-0"
                        style={{ left: colL(w), width: colW(),
                          background: w === currentWeek ? 'rgba(26,16,64,0.3)' : 'transparent',
                          borderLeft: '1px solid rgba(22,29,43,0.9)' }} />
                    ))}
                  </div>
                </div>
                {/* Una riga per ogni blocco FSL */}
                {fslBlocks.map((fsl, fi) => (
                  <div key={fi} className="flex" style={{ height: ROW }}>
                    <div style={{ width: LEFT, flexShrink: 0, borderRight: '1px solid rgba(31,41,55,0.5)', borderBottom: '1px solid rgba(17,24,39,0.8)' }}
                      className="flex items-center px-5">
                      <span className="text-xs font-display text-sky-400/70 truncate" title={fsl.blockLabel}>{fsl.blockLabel}</span>
                    </div>
                    <div className="flex-1 relative" style={{ borderBottom: '1px solid rgba(17,24,39,0.8)' }}>
                      {weeks.map(w => (
                        <div key={w} className="absolute inset-y-0"
                          style={{ left: colL(w), width: colW(),
                            background: w === currentWeek ? STRIPE_CUR : w % 2 !== 0 ? STRIPE_ODD : STRIPE_EVEN,
                            borderLeft: '1px solid rgba(22,29,43,0.9)', pointerEvents: 'none' }} />
                      ))}
                      {/* Linea settimana corrente */}
                      {currentWeek && currentWeek <= maxWeek && (
                        <div className="absolute inset-y-0 pointer-events-none"
                          style={{ left: curL(currentWeek), width: 1, background: 'rgba(124,58,237,0.45)', zIndex: 3 }} />
                      )}
                      {/* Barra FSL — occupa solo la settimana del blocco */}
                      <div
                        className="absolute rounded border border-sky-500/25"
                        style={{
                          left: `calc(${barL(fsl.weekNumber)} + 4px)`,
                          width: `calc(${barW(fsl.weekNumber, fsl.weekNumber)} - 8px)`,
                          height: '48%', top: '26%', zIndex: 2,
                          background: 'rgba(14,116,144,0.45)',
                        }}
                        title={`FSL · sett. ${fsl.weekNumber}${fsl.module ? ` · ${fsl.module}` : ''}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

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
          <ModuloMetodologiaMatrix rows={matrixRows} usedMethods={usedMethods} hasUnset={hasUnset} />
        </div>

        {/* Heatmap settimana × modulo */}
        <div className="rounded-xl border border-gray-600/40 bg-gray-800/30 p-4 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">Distribuzione Temporale Moduli</span>
            {moduleWeekRows.length > 0 && (
              <span className="text-[9px] font-mono text-gray-700">{moduleWeekRows.length} moduli · {maxWeek} sett.</span>
            )}
          </div>
          <SettimanaModuloHeatmap rows={moduleWeekRows} weeks={weeks} currentWeek={currentWeek} />
        </div>

        {/* Contesto fisico: in aula vs fuori aula per modulo */}
        {contestoRows.length > 0 && (
          <div className="rounded-xl border border-teal-600/25 bg-gray-800/30 p-4 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">Contesto Fisico</span>
              <span className="text-[9px] font-mono text-teal-600/60">{contestoRows.reduce((s, r) => s + r.fuoriAula, 0)} fuori aula</span>
            </div>
            <ContestoFisicoChart rows={contestoRows} />
          </div>
        )}

        </div>{/* fine colonna sinistra */}

        {/* ── Colonna destra: donut moduli + radar ─────────────────────── */}
        <div className={`flex-shrink-0 w-full ${radarWidthClass} flex flex-col gap-4 overflow-y-auto custom-scrollbar`}>

          {/* Donut distribuzione moduli + UDA */}
          <div className="rounded-xl border border-gray-600/40 bg-gray-800/30 p-4 flex-shrink-0">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">Distribuzione Moduli</span>
              {modules.length > 0 && (
                <span className="text-[9px] font-mono text-gray-700">{modules.reduce((s, m) => s + m.blockCount, 0)} bl.</span>
              )}
              {udaData.length > 0 && (
                <span className="text-[9px] font-mono text-gray-700 ml-1">· {udaData.length} UDA</span>
              )}
            </div>
            <DistribuzioneDonut modules={modulesData} uda={udaData} />
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
