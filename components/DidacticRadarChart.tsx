import React from 'react';
import type { LessonType } from '../types';
import { LESSON_TYPE_LABELS } from '../constants';

export type RadarDataPoint = { tipologia: LessonType; count: number };

interface Props {
    data: RadarDataPoint[];
}

const DidacticRadarChart: React.FC<Props> = ({ data }) => {
    if (data.length === 0) return null;

    if (data.length < 3) {
        return (
            <span className="text-[10px] font-mono text-gray-500 flex-shrink-0 whitespace-nowrap">
                Aggiungi tipologie per vedere il radar
            </span>
        );
    }

    const size = 48;
    const cx = size / 2;
    const cy = size / 2;
    const maxR = 15;
    const pad = 7; // spazio per i count label oltre maxR
    const n = data.length;
    const maxCount = Math.max(...data.map(d => d.count));

    // Assi: parte dall'alto (−π/2), senso orario
    const angles = data.map((_, i) => (2 * Math.PI * i) / n - Math.PI / 2);

    const axisEnds = angles.map(a => ({
        x: cx + maxR * Math.cos(a),
        y: cy + maxR * Math.sin(a),
    }));

    const vertices = data.map((d, i) => {
        const r = maxCount > 0 ? (d.count / maxCount) * maxR : 0;
        return {
            x: cx + r * Math.cos(angles[i]),
            y: cy + r * Math.sin(angles[i]),
        };
    });

    const polygonPoints = vertices.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');

    // Count label: appena fuori dalla punta dell'asse
    const labelPositions = angles.map(a => ({
        x: cx + (maxR + pad) * Math.cos(a),
        y: cy + (maxR + pad) * Math.sin(a),
    }));

    const refCircles = [maxR * 0.33, maxR * 0.67, maxR];

    const tooltipText = data
        .map(d => `${LESSON_TYPE_LABELS[d.tipologia]}: ${d.count}`)
        .join(' · ');

    const vbPad = pad + 3;
    const vbSize = size + vbPad * 2;

    return (
        <div
            className="flex-shrink-0 cursor-default"
            title={`Equilibrio didattico — ${tooltipText}`}
        >
            <svg
                width={vbSize}
                height={vbSize}
                viewBox={`${-vbPad} ${-vbPad} ${vbSize} ${vbSize}`}
                aria-hidden="true"
            >
                {/* Cerchi di riferimento concentrici */}
                {refCircles.map((r, i) => (
                    <circle
                        key={i}
                        cx={cx} cy={cy} r={r}
                        fill="none"
                        stroke="rgba(255,255,255,0.05)"
                        strokeWidth="0.5"
                    />
                ))}
                {/* Linee degli assi */}
                {axisEnds.map((end, i) => (
                    <line
                        key={i}
                        x1={cx} y1={cy}
                        x2={end.x} y2={end.y}
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="0.5"
                    />
                ))}
                {/* Poligono dati */}
                <polygon
                    points={polygonPoints}
                    fill="#818cf8"
                    fillOpacity="0.2"
                    stroke="#818cf8"
                    strokeWidth="1"
                    strokeOpacity="0.8"
                />
                {/* Count numerico sulla punta di ogni asse */}
                {data.map((d, i) => (
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
                        {d.count}
                    </text>
                ))}
            </svg>
        </div>
    );
};

export default DidacticRadarChart;
