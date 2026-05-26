import React from 'react';
import type { LessonType } from '../types';
import { LESSON_TYPE_LABELS } from '../constants';

export type RadarDataPoint = { tipologia: LessonType; count: number };

/** Fixed ordering -- tutti e 5 i tipi lezione, sempre presenti come assi. */
const ALL_TYPES: LessonType[] = [
    'frontale_teorica', 'frontale_operativa', 'laboratorio', 'verifica', 'discussione',
];

/** Abbreviazioni brevi per gli assi del radar (leggibili anche su SVG scalato). */
const AXIS_LABELS: Record<LessonType, string> = {
    frontale_teorica:   'Fr.T.',
    frontale_operativa: 'Fr.O.',
    laboratorio:        'Lab.',
    verifica:           'Verif.',
    discussione:        'Disc.',
};
const N = ALL_TYPES.length;

/**
 * Balance score via Total Variation Distance.
 * Usato solo quando idealData e' esplicitamente fornito (es. Andamento Aula).
 */
function computeBalanceScore(planned: number[], ideal: number[]): number {
    const pt = planned.reduce((a, b) => a + b, 0);
    const it = ideal.reduce((a, b) => a + b, 0);
    if (pt === 0 || it === 0) return 0;
    let tvd = 0;
    for (let i = 0; i < N; i++) tvd += Math.abs(planned[i] / pt - ideal[i] / it);
    return Math.max(0, 1 - tvd / 2);
}

interface Props {
    data: RadarDataPoint[];
    /** Serie confronto opzionale (Andamento Aula). Assente = solo Progettato. */
    idealData?: RadarDataPoint[];
}

const DidacticRadarChart: React.FC<Props> = ({ data, idealData }) => {
    const total = data.reduce((s, d) => s + d.count, 0);
    if (total === 0) return null;

    const plannedMap = new Map<LessonType, number>(data.map(d => [d.tipologia, d.count]));
    const plannedCounts = ALL_TYPES.map(t => plannedMap.get(t) ?? 0);

    const hasIdeal = (idealData?.length ?? 0) > 0;
    const idealMap = hasIdeal
        ? new Map<LessonType, number>(idealData!.map(d => [d.tipologia, d.count]))
        : null;
    const idealCounts = hasIdeal ? ALL_TYPES.map(t => idealMap!.get(t) ?? 0) : [];

    const maxCount = hasIdeal
        ? Math.max(...plannedCounts, ...idealCounts, 1)
        : Math.max(...plannedCounts, 1);

    const size    = 130;
    const cx      = size / 2;
    const cy      = size / 2;
    const maxR    = 46;
    const pad     = 28;   // più spazio per le label degli assi
    const vbPad   = 42;   // margine esterno più ampio per non tagliare le label
    const vbW     = size + vbPad * 2;
    const legendH = hasIdeal ? 20 : 12;
    const vbH     = vbW + legendH;

    const angles = ALL_TYPES.map((_, i) => (2 * Math.PI * i) / N - Math.PI / 2);
    const axisEnds = angles.map(a => ({ x: cx + maxR * Math.cos(a), y: cy + maxR * Math.sin(a) }));

    const toVertices = (counts: number[]) =>
        counts.map((c, i) => {
            const r = (c / maxCount) * maxR;
            return { x: cx + r * Math.cos(angles[i]), y: cy + r * Math.sin(angles[i]) };
        });
    const toPoints = (verts: { x: number; y: number }[]) =>
        verts.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');

    const plannedVertices = toVertices(plannedCounts);
    const idealVertices   = hasIdeal ? toVertices(idealCounts) : null;
    const labelPositions  = angles.map(a => ({
        x: cx + (maxR + pad) * Math.cos(a),
        y: cy + (maxR + pad) * Math.sin(a),
    }));
    const refCircles = [maxR * 0.33, maxR * 0.67, maxR];

    const score        = hasIdeal ? computeBalanceScore(plannedCounts, idealCounts) : null;
    const scorePercent = score !== null ? Math.round(score * 100) : null;
    const badgeStyle   = score === null
        ? 'text-gray-500 bg-gray-800/50 border-gray-700/50'
        : score >= 0.8  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        : score >= 0.55 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        :                 'text-rose-400 bg-rose-500/10 border-rose-500/20';

    const legendY1 = size + 7;
    const legendY2 = size + 15;
    const lineTo   = 12;
    const textX    = lineTo + 2;

    return (
        <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">
                    Equilibrio Didattico
                </span>
                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${badgeStyle}`}>
                    {scorePercent !== null ? `${scorePercent}%` : `${total} bl.`}
                </span>
            </div>

            <svg
                width="100%"
                viewBox={`${-vbPad} ${-vbPad} ${vbW} ${vbH}`}
                aria-label="Radar equilibrio didattico"
            >
                {refCircles.map((r, i) => (
                    <circle key={i} cx={cx} cy={cy} r={r}
                        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
                ))}
                {axisEnds.map((end, i) => (
                    <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y}
                        stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />
                ))}
                {hasIdeal && idealVertices && (
                    <polygon
                        points={toPoints(idealVertices)}
                        fill="#38bdf8" fillOpacity="0.08"
                        stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.6"
                        strokeDasharray="4,2"
                    />
                )}
                <polygon
                    points={toPoints(plannedVertices)}
                    fill="#818cf8" fillOpacity="0.25"
                    stroke="#818cf8" strokeWidth="1.5" strokeOpacity="0.9"
                />
                {plannedVertices.map((v, i) =>
                    plannedCounts[i] > 0 ? (
                        <circle key={i} cx={v.x} cy={v.y} r={3}
                            fill="#818cf8" fillOpacity="0.9" />
                    ) : null
                )}
                {ALL_TYPES.map((t, i) => {
                    const pos    = labelPositions[i];
                    const count  = plannedCounts[i];
                    const active = count > 0;
                    const fillLabel = active ? 'rgba(165,180,252,0.80)' : 'rgba(107,114,128,0.38)';
                    const fillCount = active ? 'rgba(165,180,252,1)'    : 'rgba(107,114,128,0.30)';
                    return (
                        <text key={i} textAnchor="middle" fontFamily="monospace" style={{ cursor: 'default' }}>
                            <title>{LESSON_TYPE_LABELS[t]}: {count > 0 ? count : 0} blocchi</title>
                            {/* abbreviazione tipo — riga superiore */}
                            <tspan
                                x={pos.x.toFixed(1)}
                                y={(pos.y - 5.5).toFixed(1)}
                                fontSize="6"
                                fill={fillLabel}
                            >
                                {AXIS_LABELS[t]}
                            </tspan>
                            {/* contatore — riga inferiore, più grande */}
                            <tspan
                                x={pos.x.toFixed(1)}
                                y={(pos.y + 5.5).toFixed(1)}
                                fontSize="8.5"
                                fontWeight={active ? '600' : '400'}
                                fill={fillCount}
                            >
                                {count > 0 ? count : '–'}
                            </tspan>
                        </text>
                    );
                })}
                {hasIdeal ? (
                    <g>
                        <line x1={0} y1={legendY1} x2={lineTo} y2={legendY1}
                            stroke="#38bdf8" strokeWidth="1.3" strokeOpacity="0.7" strokeDasharray="4,2" />
                        <text x={textX} y={legendY1} dominantBaseline="middle"
                            fill="rgba(125,211,252,0.6)" fontSize="5" fontFamily="monospace">Realizzato</text>
                        <line x1={0} y1={legendY2} x2={lineTo} y2={legendY2}
                            stroke="#818cf8" strokeWidth="1.3" strokeOpacity="0.7" />
                        <text x={textX} y={legendY2} dominantBaseline="middle"
                            fill="rgba(165,180,252,0.6)" fontSize="5" fontFamily="monospace">Progettato</text>
                    </g>
                ) : (
                    <g>
                        <line x1={0} y1={legendY1} x2={lineTo} y2={legendY1}
                            stroke="#818cf8" strokeWidth="1.3" strokeOpacity="0.7" />
                        <text x={textX} y={legendY1} dominantBaseline="middle"
                            fill="rgba(165,180,252,0.6)" fontSize="5" fontFamily="monospace">Progettato</text>
                    </g>
                )}
            </svg>

            <div className="flex flex-col gap-1.5 w-full">
                {ALL_TYPES.map(t => {
                    const count  = plannedMap.get(t) ?? 0;
                    const pct    = total > 0 ? Math.round((count / total) * 100) : 0;
                    const active = count > 0;
                    const lblCls = active ? 'text-gray-400' : 'text-gray-600';
                    const numCls = active ? 'text-indigo-400/80' : 'text-gray-700';

                    if (hasIdeal && idealMap) {
                        const idealC   = idealMap.get(t) ?? 0;
                        const idealT   = idealCounts.reduce((a, b) => a + b, 0);
                        const idealPct = idealT > 0 ? Math.round((idealC / idealT) * 100) : 0;
                        return (
                            <div key={t} className="flex items-center gap-2">
                                <span className={`text-[9px] font-mono w-[76px] flex-shrink-0 truncate ${lblCls}`} title={LESSON_TYPE_LABELS[t]}>
                                    {LESSON_TYPE_LABELS[t]}
                                </span>
                                <div className="relative flex-1 h-1.5 bg-gray-800/70 rounded-full overflow-hidden">
                                    <div className="absolute top-0 left-0 h-full bg-sky-400/30 rounded-full"
                                        style={{ width: idealPct + '%' }} />
                                    <div className="absolute top-0 left-0 h-full bg-indigo-400/75 rounded-full transition-all duration-300"
                                        style={{ width: pct + '%' }} />
                                </div>
                                <span className={`text-[9px] font-mono w-6 text-right flex-shrink-0 tabular-nums ${numCls}`}>
                                    {active ? pct + '%' : '-'}
                                </span>
                            </div>
                        );
                    }

                    return (
                        <div key={t} className="flex items-center gap-2">
                            <span className={`text-[9px] font-mono w-[76px] flex-shrink-0 truncate ${lblCls}`}>
                                {LESSON_TYPE_LABELS[t]}
                            </span>
                            <div className="relative flex-1 h-1.5 bg-gray-800/70 rounded-full overflow-hidden">
                                <div className="absolute top-0 left-0 h-full bg-indigo-400/75 rounded-full transition-all duration-300"
                                    style={{ width: pct + '%' }} />
                            </div>
                            <span className={`text-[9px] font-mono w-6 text-right flex-shrink-0 tabular-nums ${numCls}`}>
                                {active ? pct + '%' : '-'}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default DidacticRadarChart;
