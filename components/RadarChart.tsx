import React from 'react';
import type { InferredStudentGrowth, GrowthLevel } from '../types';

interface RadarChartProps {
    data?: InferredStudentGrowth;
}

const criteria: (keyof InferredStudentGrowth['criteria'])[] = ['QualitàElaborati', 'Partecipazione', 'Collaborazione', 'ResilienzaCreativa'];
const labels: Record<keyof InferredStudentGrowth['criteria'], string> = {
    QualitàElaborati: 'Qualità Elaborati',
    Partecipazione: 'Partecipazione',
    Collaborazione: 'Collaborazione',
    ResilienzaCreativa: 'Resilienza Creativa'
};
const levels: GrowthLevel[] = ['Da Potenziare', 'Stabile', 'Punto di Forza'];
const levelToValue = (level: GrowthLevel): number => levels.indexOf(level) + 1;

const RadarChart: React.FC<RadarChartProps> = ({ data }) => {
    const size = 250;
    const center = size / 2;
    const numLevels = 3;
    const radius = center * 0.8;

    if (!data) {
        return (
            <div style={{ height: `${size}px` }} className="flex items-center justify-center text-sm text-gray-400">
                Seleziona una studentessa per visualizzare il suo profilo.
            </div>
        );
    }
    
    const points = criteria.map((criterion, i) => {
        const angle = (i / criteria.length) * 2 * Math.PI - Math.PI / 2;
        const value = data.criteria[criterion] ? levelToValue(data.criteria[criterion]) : 1;
        const r = (value / numLevels) * radius;
        const x = center + r * Math.cos(angle);
        const y = center + r * Math.sin(angle);
        return { x, y };
    });

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`).join(' ') + ' Z';
    
    return (
        <div className="flex justify-center items-center" style={{ height: `${size}px` }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                {/* Background grid */}
                <g className="text-gray-600">
                    {[...Array(numLevels)].map((_, levelIndex) => {
                        const r = ((levelIndex + 1) / numLevels) * radius;
                        const gridPath = criteria.map((_, i) => {
                            const angle = (i / criteria.length) * 2 * Math.PI - Math.PI / 2;
                            const x = center + r * Math.cos(angle);
                            const y = center + r * Math.sin(angle);
                            return `${i === 0 ? 'M' : 'L'} ${x},${y}`;
                        }).join(' ') + ' Z';
                        return <path key={levelIndex} d={gridPath} fill="none" stroke="currentColor" strokeWidth="0.5" />;
                    })}
                    {criteria.map((_, i) => {
                         const angle = (i / criteria.length) * 2 * Math.PI - Math.PI / 2;
                         const x1 = center;
                         const y1 = center;
                         const x2 = center + radius * Math.cos(angle);
                         const y2 = center + radius * Math.sin(angle);
                         return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="0.5" />
                    })}
                </g>
                
                {/* Labels */}
                <g className="text-gray-400" fontSize="10">
                     {criteria.map((criterion, i) => {
                        const angle = (i / criteria.length) * 2 * Math.PI - Math.PI / 2;
                        const r = radius * 1.15;
                        const x = center + r * Math.cos(angle);
                        const y = center + r * Math.sin(angle);
                        return <text key={criterion} x={x} y={y + 4} textAnchor="middle">{labels[criterion]}</text>;
                    })}
                </g>

                {/* Data path */}
                <path d={pathData} fill="rgba(139, 92, 246, 0.4)" stroke="#8B5CF6" strokeWidth="2" />

                {/* Data points */}
                {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="3" fill="#8B5CF6" />
                ))}
            </svg>
        </div>
    );
};

export default React.memo(RadarChart);