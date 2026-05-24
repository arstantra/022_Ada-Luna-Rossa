import React from 'react';
import type { LessonType } from '../types';
import { LESSON_TYPE_LABELS } from '../constants';

export type RadarDataPoint = { tipologia: LessonType; count: number };

/**
 * Balance score via Total Variation Distance.
 * Returns a value in [0, 1]: 1 = perfect match, 0 = completely different.
 * score = 1 - TVD = 1 - Σ|p_i - q_i| / 2
 */
function computeBalanceScore(
    plannedCounts: number[],
    idealCounts: number[],
    n: number
): number {
    const plannedTotal = plannedCounts.reduce((a, b) => a + b, 0);
    const idealTotal   = idealCounts.reduce((a, b) => a + b, 0);
    if (plannedTotal === 0 || idealTotal === 0) return 0;
    let tvd = 0;
    for (let i = 0; i < n; i++) {
        tvd += Math.abs(plannedCounts[i] / plannedTotal - idealCounts[i] / idealTotal);
    }
    return Math.max(0, 1 - tvd / 2);
}

interface Props {
    data: RadarDataPoint[];
    idealData?: RadarDataPoint[];
}

const DidacticRadarChart: React.FC<Props> = ({ data, idealData }) => {
    if (data.length === 0) return null;

    if (data.length < 3) {
        return (
            <span className="text-[10px] font-mono text-gray-500 flex-shrink-0 whitespace-nowrap">
                Aggiungi tipologie per vedere il radar
            </span>
        );
    }

    const hasIdeal = idealData !== undefined && idealData.length > 0;

    // Union of all tipologie: planned first, then any extra from ideal
    const allTipologie: LessonType[] = [
        ...data.map(d => d.tipologia),
        ...(idealData ?? []).map(d => d.tipologia).filter(t => !data.some(pd => pd.tipologia === t)),
    ];
    const n = allTipologie.length;

    const plannedMap = new Map(data.map(d => [d.tipologia, d.count]));
    const idealMap   = new Map((idealData ?? []).map(d => [d.tipologia, d.count]));

    const plannedCounts = allTipologie.map(t => plannedMap.get(t) ?? 0);
    const idealCounts   = allTipologie.map(t => idealMap.get(t) ?? 0);

    // Both polygons normalized against the same maximum
    const maxCount = Math.max(...plannedCounts, ...(hasIdeal ? idealCounts : []), 1);

    // ── SVG geometry ─────────────────────────────────────────────────────────
    const size  = 48;
    const cx    = size / 2;   // 24
    const cy    = size / 2;   // 24
    const maxR  = 15;
    const pad   = 7;          // extra space for count labels beyond maxR
    const vbPad = pad + 3;    // 10 — viewBox padding on all sides
    const vbW   = size + vbPad * 2;    // 68
    const legendH = hasIdeal ? 14 : 0;
    const vbH   = vbW + legendH;       // 68 (single) or 82 (dual)

    // Axes: start at top (−π/2), clockwise
    const angles = allTipologie.map((_, i) => (2 * Math.PI * i) / n - Math.PI / 2);

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
    const idealVertices   = hasIdeal ? toVertices(idealCounts) : [];

    // Count labels at axis tips (planned values only)
    const labelPositions = angles.map(a => ({
        x: cx + (maxR + pad) * Math.cos(a),
        y: cy + (maxR + pad) * Math.sin(a),
    }));

    const refCircles = [maxR * 0.33, maxR * 0.67, maxR];

    // ── Tooltip ───────────────────────────────────────────────────────────────
    const plannedTooltip = allTipologie
        .map((t, i) => `${LESSON_TYPE_LABELS[t]}: ${plannedCounts[i]}`)
        .join(' · ');
    const idealTooltip = hasIdeal
        ? ' | Ideale: ' + allTipologie.map((t, i) => `${LESSON_TYPE_LABELS[t]}: ${idealCounts[i]}`).join(' · ')
        : '';

    // ── Balance score (dual mode only) ────────────────────────────────────────
    const score        = hasIdeal ? computeBalanceScore(plannedCounts, idealCounts, n) : null;
    const scorePercent = score !== null ? Math.round(score * 100) : null;
    const scoreBadgeStyle =
        score === null ? '' :
        score >= 0.8   ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
        score >= 0.55  ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                         'text-rose-400 bg-rose-500/10 border-rose-500/20';

    // ── Legend positions (two rows below chart, left-aligned at x=0) ──────────
    const legendY1 = size + 5;   // 53 — ideal row
    const legendY2 = size + 11;  // 59 — planned row
    const lineTo   = 8;          // line width (SVG units)
    const textX    = lineTo + 1.5;

    return (
        <div
            className="flex items-start gap-1 flex-shrink-0 cursor-default"
            title={`Equilibrio didattico — ${plannedTooltip}${idealTooltip}`}
        >
            <svg
                width={vbW}
                height={vbH}
                viewBox={`${-vbPad} ${-vbPad} ${vbW} ${vbH}`}
                aria-hidden="true"
            >
                {/* Reference circles */}
                {refCircles.map((r, i) => (
                    <circle
                        key={i}
                        cx={cx} cy={cy} r={r}
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="0.5"
                    />
                ))}

                {/* Axis lines */}
                {axisEnds.map((end, i) => (
                    <line
                        key={i}
                        x1={cx} y1={cy} x2={end.x} y2={end.y}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="0.5"
                    />
                ))}

                {/* Ideal polygon — dashed sky */}
                {hasIdeal && (
                    <polygon
                        points={toPoints(idealVertices)}
                        fill="#38bdf8"
                        fillOpacity="0.08"
                        stroke="#38bdf8"
                        strokeWidth="1"
                        strokeOpacity="0.65"
                        strokeDasharray="3,1.5"
                    />
                )}

                {/* Planned polygon — solid indigo */}
                <polygon
                    points={toPoints(plannedVertices)}
                    fill="#818cf8"
                    fillOpacity="0.2"
                    stroke="#818cf8"
                    strokeWidth="1"
                    strokeOpacity="0.8"
                />

                {/* Planned count at each axis tip */}
                {allTipologie.map((_, i) => (
                    <text
                        key={i}
                        x={labelPositions[i].x.toFixed(1)}
                        y={labelPositions[i].y.toFixed(1)}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="rgba(165,180,252,0.9)"
                        fontSize="5"
                        fontFamily="monospace"
                    >
                        {plannedCounts[i]}
                    </text>
                ))}

                {/* Legend (dual mode only) */}
                {hasIdeal && (
                    <g>
                        {/* Row 1 — Ideal (dashed sky) */}
                        <line
                            x1={0} y1={legendY1} x2={lineTo} y2={legendY1}
                            stroke="#38bdf8" strokeWidth="1.2" strokeOpacity="0.7"
                            strokeDasharray="3,1.5"
                        />
                        <text
                            x={textX} y={legendY1}
                            dominantBaseline="middle"
                            fill="rgba(125,211,252,0.6)"
                            fontSize="4"
                            fontFamily="monospace"
                        >
                            Ideale
                        </text>

                        {/* Row 2 — Planned (solid indigo) */}
                        <line
                            x1={0} y1={legendY2} x2={lineTo} y2={legendY2}
                            stroke="#818cf8" strokeWidth="1.2" strokeOpacity="0.7"
                        />
                        <text
                            x={textX} y={legendY2}
                            dominantBaseline="middle"
                            fill="rgba(165,180,252,0.6)"
                            fontSize="4"
                            fontFamily="monospace"
                        >
                            Attuale
                        </text>
                    </g>
                )}
            </svg>

            {/* Balance score badge (dual mode only) */}
            {score !== null && scorePercent !== null && (
                <span className={`flex-shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-mono leading-none mt-0.5 ${scoreBadgeStyle}`}>
                    {scorePercent}%
                </span>
            )}
        </div>
    );
};

export default DidacticRadarChart;
