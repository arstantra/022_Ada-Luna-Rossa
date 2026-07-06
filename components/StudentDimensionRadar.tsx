import React from 'react';

/**
 * Radar delle dimensioni operative dello studente (agenda CLAUDE_PROTOCOL:
 * "Dimensioni radar per studente — mappatura EQF vs dimensioni operative").
 *
 * Componente SEPARATO da DidacticRadarChart (che è vincolato ai 5 LessonType):
 * qui gli assi sono dimensioni operative osservabili, tutte normalizzate 0–100.
 * value === null → dimensione senza dati (asse mostrato ma spento, "n.d.").
 */

export interface StudentDimension {
    key: string;
    label: string;       // label estesa (breakdown)
    axisLabel: string;   // abbreviazione per l'asse SVG
    value: number | null; // 0–100, null = nessun dato
    detail?: string;     // tooltip, es. "12/15 lezioni"
}

interface Props {
    dimensions: StudentDimension[]; // attese 5 voci, ordine fisso
}

const StudentDimensionRadar: React.FC<Props> = ({ dimensions }) => {
    const N = dimensions.length;
    if (N === 0) return null;
    const hasAnyData = dimensions.some(d => d.value !== null);
    if (!hasAnyData) {
        return (
            <p className="text-xs text-gray-500">
                Nessun dato operativo. Le dimensioni si popolano con presenze, lavori di gruppo, valutazioni e segnali Ada.
            </p>
        );
    }

    const size  = 130;
    const cx    = size / 2;
    const cy    = size / 2;
    const maxR  = 46;
    const pad   = 28;
    const vbPad = 42;
    const vbW   = size + vbPad * 2;
    const vbH   = vbW + 12;

    const angles = dimensions.map((_, i) => (2 * Math.PI * i) / N - Math.PI / 2);
    const axisEnds = angles.map(a => ({ x: cx + maxR * Math.cos(a), y: cy + maxR * Math.sin(a) }));

    const vertices = dimensions.map((d, i) => {
        const r = ((d.value ?? 0) / 100) * maxR;
        return { x: cx + r * Math.cos(angles[i]), y: cy + r * Math.sin(angles[i]) };
    });
    const points = vertices.map(v => `${v.x.toFixed(1)},${v.y.toFixed(1)}`).join(' ');

    const labelPositions = angles.map(a => ({
        x: cx + (maxR + pad) * Math.cos(a),
        y: cy + (maxR + pad) * Math.sin(a),
    }));
    const refCircles = [maxR * 0.33, maxR * 0.67, maxR];

    // Indice sintetico: media delle dimensioni con dati
    const withData = dimensions.filter(d => d.value !== null);
    const avg = Math.round(withData.reduce((s, d) => s + (d.value as number), 0) / withData.length);
    const badgeStyle =
        avg >= 75 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
        : avg >= 50 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
        : 'text-rose-400 bg-rose-500/10 border-rose-500/20';

    const barColor = (v: number) =>
        v >= 75 ? 'bg-emerald-400/75' : v >= 50 ? 'bg-amber-400/75' : 'bg-rose-400/75';

    return (
        <div className="flex flex-col gap-3 w-full">
            <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500">
                    Dimensioni Operative
                </span>
                <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${badgeStyle}`} title={`Indice medio su ${withData.length} dimensioni con dati`}>
                    {avg}/100
                </span>
            </div>

            <svg width="100%" viewBox={`${-vbPad} ${-vbPad} ${vbW} ${vbH}`} aria-label="Radar dimensioni operative studente">
                {refCircles.map((r, i) => (
                    <circle key={i} cx={cx} cy={cy} r={r}
                        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.8" />
                ))}
                {axisEnds.map((end, i) => (
                    <line key={i} x1={cx} y1={cy} x2={end.x} y2={end.y}
                        stroke="rgba(255,255,255,0.12)" strokeWidth="0.7" />
                ))}
                <polygon
                    points={points}
                    fill="#a78bfa" fillOpacity="0.22"
                    stroke="#a78bfa" strokeWidth="1.5" strokeOpacity="0.9"
                />
                {vertices.map((v, i) =>
                    dimensions[i].value !== null ? (
                        <circle key={i} cx={v.x} cy={v.y} r={3} fill="#a78bfa" fillOpacity="0.9" />
                    ) : null
                )}
                {dimensions.map((d, i) => {
                    const pos = labelPositions[i];
                    const active = d.value !== null;
                    const fillLabel = active ? 'rgba(196,181,253,0.80)' : 'rgba(107,114,128,0.38)';
                    const fillValue = active ? 'rgba(196,181,253,1)' : 'rgba(107,114,128,0.30)';
                    return (
                        <text key={d.key} textAnchor="middle" fontFamily="monospace" style={{ cursor: 'default' }}>
                            <title>{d.label}: {active ? `${d.value}/100` : 'nessun dato'}{d.detail ? ` — ${d.detail}` : ''}</title>
                            <tspan x={pos.x.toFixed(1)} y={(pos.y - 5.5).toFixed(1)} fontSize="6" fill={fillLabel}>
                                {d.axisLabel}
                            </tspan>
                            <tspan x={pos.x.toFixed(1)} y={(pos.y + 5.5).toFixed(1)} fontSize="8.5"
                                fontWeight={active ? '600' : '400'} fill={fillValue}>
                                {active ? d.value : 'n.d.'}
                            </tspan>
                        </text>
                    );
                })}
            </svg>

            {/* Breakdown a barre */}
            <div className="flex flex-col gap-1.5 w-full">
                {dimensions.map(d => {
                    const active = d.value !== null;
                    return (
                        <div key={d.key} className="flex items-center gap-2" title={d.detail}>
                            <span className={`text-[9px] font-mono w-[86px] flex-shrink-0 truncate ${active ? 'text-gray-400' : 'text-gray-600'}`}>
                                {d.label}
                            </span>
                            <div className="relative flex-1 h-1.5 bg-gray-800/70 rounded-full overflow-hidden">
                                {active && (
                                    <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-300 ${barColor(d.value as number)}`}
                                        style={{ width: `${d.value}%` }} />
                                )}
                            </div>
                            <span className={`text-[9px] font-mono w-8 text-right flex-shrink-0 tabular-nums ${active ? 'text-purple-300/80' : 'text-gray-700'}`}>
                                {active ? d.value : 'n.d.'}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default StudentDimensionRadar;
