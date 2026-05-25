import React from 'react';
import type { LessonType } from '../types';
import { LESSON_TYPE_LABELS } from '../constants';

export type RadarDataPoint = { tipologia: LessonType; count: number };

/** Fixed ordering — tutti e 5 i tipi lezione, sempre presenti come assi. */
const ALL_TYPES: LessonType[] = [
    'frontale_teorica', 'frontale_operativa', 'laboratorio', 'verifica', 'discussione',
];
const N = ALL_TYPES.length;

/**
 * Balance score via Total Variation Distance.
 * Restituisce un valore in [0, 1]: 1 = distribuzione identica all'ideale.
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
    idealData?: RadarDataPoint[];
}

const DidacticRadarChart: React.FC<Props> = ({ data, idealData }) => {
    const totalPlanned = data.reduce((s, d) => s + d.count, 0);
    if (totalPlanned === 0) return null;

    const plannedMap = new Map<LessonType, number>(data.map(d => [d.tipologia, d.count]));
    const plannedCounts = ALL_TYPES.map(t => plannedMap.get(t) ?? 0);

    // Ideale: usa idealData se disponibile, altrimenti distribuzione uniforme (20% per tipo)
    const hasIdealData = (idealData?.length ?? 0) > 0;
    const idealMap = hasIdealData
        ? new Map<LessonType, number>(idealData!.map(d => [d.tipologia, d.count]))
        : null;
    const idealCounts = ALL_TYPES.map(t => idealMap ? (idealMap.get(t) ?? 0) : 1);

    const maxCount = Math.max(...plannedCounts, ...idealCounts, 1);

    // ── SVG geometry ─────────────────────────────────────────────────────────
    const size  = 130;
    const cx    = size / 2;   // 65
    const cy    = size / 2;   // 65
    const maxR  = 50;
    const pad   = 16;         // offset label oltre maxR
    const vbPad = 22;
    const vbW   = size + vbPad * 2;   // 174
    const legendH = 20;
    const vbH   = vbW + legendH;      // 194

    // Assi: partono dall'alto (−π/2), in senso orario
    const angles = ALL_TYPES.map((_, i) => (2 * Math.PI * i) / N - Math.PI / 2);

    const axisEnds = angles.map(a => ({
        x: cx + maxR * Math.cos(a),
        y: cy + maxR * Math.sin(a),
    }));

    const toVertices = (counts: number[]) =>
        counts.map((c, i) => {
            const r = (c / maxCount) * maxR;
            return { x: cx + r * Math.cos(angles[i]), y: cy + r * Math.sin(angles[i]) };
        });

    const toPoints = (verts: { x: number; y: number }[]) =>
        verts.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');

    const plannedVertices = toVertices(plannedCounts);
    const idealVertices   = toVertices(idealCounts);

    // Count label in cima a ciascun asse
    const labelPositions = angles.map(a => ({
        x: cx + (maxR + pad) * Math.cos(a),
        y: cy + (maxR + pad) * Math.sin(a),
    }));

    const refCircles = [maxR * 0.33, maxR * 0.67, maxR];

    // ── Balance score ─────────────────────────────────────────────────────────
    const score        = computeBalanceScore(plannedCounts, idealCounts);
    const scorePercent = Math.round(score * 100);
    const scoreBadgeStyle =
        score >= 0.8  ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
        score >= 0.55 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                        'text-rose-400 bg-rose-500/10 border-rose-500/20';

    // ── Legenda ───────────────────────────────────────────────────────────────
    const legendY1 = size + 7;    // riga ideale
    const legendY2 = size + 15;   // riga attuale
    const lineTo   = 12;
    const textX    = lineTo + 2;

    return (
        <div className="flex flex-col gap-3 w-full">
            {/* Header: titolo + score badge */}
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">
                    Equilibrio Didattico
                </span>
                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${scoreBadgeStyle}`}>
                    {scorePercent}%
                </span>
            </div>

            {/* SVG radar — pentagono fisso a 5 assi */}
            <svg
                width="100%"
                viewBox={`${-vbPad} ${-vbPad} ${vbW} ${vbH}`}
                style={{ maxWidth: vbW }}
                aria-label="Radar equilibrio didattico"
            >
                {/* Cerchi di riferimento */}
                {refCircles.map((r, i) => (
                    <circle key={i} cx={cx} cy={cy} r={r}
                        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
                ))}

                {/* Assi */}
                {axisEnds.map((end, i) => (
                    <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y}
                        stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />
                ))}

                {/* Poligono ideale — tratteggio sky */}
                <polygon
                    points={toPoints(idealVertices)}
                    fill="#38bdf8" fillOpacity="0.08"
                    stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.6"
                    strokeDasharray="4,2"
                />

                {/* Poligono attuale — pieno indigo */}
                <polygon
                    points={toPoints(plannedVertices)}
                    fill="#818cf8" fillOpacity="0.25"
                    stroke="#818cf8" strokeWidth="1.5" strokeOpacity="0.9"
                />

                {/* Dot sui vertici attivi */}
                {plannedVertices.map((v, i) =>
                    plannedCounts[i] > 0 ? (
                        <circle key={i} cx={v.x} cy={v.y} r={3}
                            fill="#818cf8" fillOpacity="0.9" />
                    ) : null
                )}

                {/* Conteggio in cima a ciascun asse */}
                {ALL_TYPES.map((_, i) => (
                    <text
                        key={i}
                        x={labelPositions[i].x.toFixed(1)}
                        y={labelPositions[i].y.toFixed(1)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={plannedCounts[i] > 0 ? 'rgba(165,180,252,0.85)' : 'rgba(107,114,128,0.4)'}
                        fontSize="6.5"
                        fontFamily="monospace"
                    >
                        {plannedCounts[i]}
                    </text>
                ))}

                {/* Legenda */}
                <g>
                    <line x1={0} y1={legendY1} x2={lineTo} y2={legendY1}
                        stroke="#38bdf8" strokeWidth="1.3" strokeOpacity="0.7" strokeDasharray="4,2" />
                    <text x={textX} y={legendY1} dominantBaseline="middle"
                        fill="rgba(125,211,252,0.6)" fontSize="5" fontFamily="monospace">
                        {hasIdealData ? 'Ideale' : 'Ideale (uniforme)'}
                    </text>
                    <line x1={0} y1={legendY2} x2={lineTo} y2={legendY2}
                        stroke="#818cf8" strokeWidth="1.3" strokeOpacity="0.7" />
                    <text x={textX} y={legendY2} dominantBaseline="middle"
                        fill="rgba(165,180,252,0.6)" fontSize="5" fontFamily="monospace">
                        Attuale
                    </text>
                </g>
            </svg>

            {/* Bar chart per tipo — confronto attuale vs ideale */}
            <div className="flex flex-col gap-1.5 w-full">
                {ALL_TYPES.map(t => {
                    const count    = plannedMap.get(t) ?? 0;
                    const pct      = totalPlanned > 0 ? Math.round((count / totalPlanned) * 100) : 0;
                    const idealC   = idealMap ? (idealMap.get(t) ?? 0) : 1;
                    const idealT   = idealCounts.reduce((a, b) => a + b, 0);
                    const idealPct = idealT > 0 ? Math.round((idealC / idealT) * 100) : 20;
                    const active   = count > 0;
                    return (
                        <div key={t} className="flex items-center gap-2">
                            <span className={`text-[9px] font-mono w-[62px] flex-shrink-0 truncate ${active ? 'text-gray-400' : 'text-gray-600'}`}>
                                {LESSON_TYPE_LABELS[t]}
                            </span>
                            <div className="relative flex-1 h-1.5 bg-gray-800/70 rounded-full overflow-hidden">
                                {/* Target ideale (sky) */}
                                <div className="absolute top-0 left-0 h-full bg-sky-400/20 rounded-full"
                                    style={{ width: `${idealPct}%` }} />
                                {/* Attuale (indigo) */}
                                <div className="absolute top-0 left-0 h-full bg-indigo-400/75 rounded-full transition-all duration-300"
                                    style={{ width: `${pct}%` }} />
                            </div>
                            <span className={`text-[9px] font-mono w-6 text-right flex-shrink-0 tabular-nums ${active ? 'text-indigo-400/80' : 'text-gray-700'}`}>
                                {active ? `${pct}%` : '—'}
                            </span>
                        </div>
                    );
                })}
            </div>

            {!hasIdealData && (
                <p className="text-[8px] font-mono text-gray-600 leading-tight mt-0.5">
                    Ideale calcolato su distribuzione uniforme (20% per tipo)
                </p>
            )}
        </div>
    );
};

export default DidacticRadarChart;
