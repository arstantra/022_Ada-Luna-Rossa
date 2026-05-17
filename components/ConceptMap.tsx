import React from 'react';
import type { InferredConceptMastery } from '../types';

interface ConceptMapProps {
    data: InferredConceptMastery[];
    allPillars: { name: string; type: string }[];
}

const ConceptMap: React.FC<ConceptMapProps> = ({ data, allPillars }) => {
    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                Nessun concetto analizzato nelle note.
            </div>
        );
    }

    const sintonizzazionePillars: string[] = Array.from(new Set(allPillars.filter(p => p.type === 'Sintonizzazione').map(p => p.name)));
    const operativiPillars: string[] = Array.from(new Set(allPillars.filter(p => p.type === 'Operativo').map(p => p.name)));

    const width = 500;
    const height = 250;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const getPosition = (concept: string, pillars: string[], range: number) => {
        const index = pillars.indexOf(concept);
        if (index === -1) return -1;
        return (index + 0.5) / pillars.length * range;
    };
    
    return (
        <div className="w-full relative">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                 <g transform={`translate(${margin.left}, ${margin.top})`}>
                     {/* Axes lines */}
                    <line x1={0} y1={0} x2={0} y2={chartHeight} stroke="#4B5563" strokeWidth="1" />
                    <line x1={0} y1={chartHeight} x2={chartWidth} y2={chartHeight} stroke="#4B5563" strokeWidth="1" />
                    
                    {/* Points */}
                    {data.map((item, index) => {
                        let x = -1, y = -1;
                        if (item.pillarType === 'Sintonizzazione') {
                            x = getPosition(item.concept, sintonizzazionePillars, chartWidth);
                            y = chartHeight - 5; // Align to bottom
                        } else if (item.pillarType === 'Operativo') {
                             x = 5; // Align to left
                             y = getPosition(item.concept, operativiPillars, chartHeight);
                        }
                        
                        if (x < 0 || y < 0) return null;

                        const color = item.mastery === 'Compreso' ? '#22C55E' : '#EF4444';
                        
                        return (
                            <g key={`${item.concept}-${index}`} className="group">
                                <circle cx={x} cy={y} r="5" fill={color} />
                                <text x={x + 8} y={y + 4} fill="#D1D5DB" fontSize="10" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    {item.concept}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            <div className="absolute top-0 left-0 -translate-x-full pr-2 text-right text-xs text-gray-400" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg) translateX(100%)' }}>Pilastri Operativi</div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 pt-2 text-xs text-gray-400">Pilastri di Sintonizzazione</div>
             <div className="absolute top-0 right-0 flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-green-500"></div><span className="text-gray-400">Compreso</span></div>
                <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><span className="text-gray-400">In Difficoltà</span></div>
            </div>
        </div>
    );
};

export default ConceptMap;