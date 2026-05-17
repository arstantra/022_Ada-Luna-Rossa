import React from 'react';
import type { InferredClassEnergy, EnergyLevel } from '../types';

interface EnergySeismographProps {
    data: InferredClassEnergy[];
}

const energyLevels: EnergyLevel[] = ['Bassa Frequenza', 'Ritmo di Crociera', 'Scintilla Creativa'];
const levelToValue = (level: EnergyLevel): number => energyLevels.indexOf(level);

const EnergySeismograph: React.FC<EnergySeismographProps> = ({ data }) => {
    if (data.length < 2) {
        return (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                Dati insufficienti per tracciare l'andamento dell'energia.
            </div>
        );
    }

    const sortedData = [...data].sort((a, b) => a.weekNumber - b.weekNumber);

    const width = 500;
    const height = 250;
    const margin = { top: 20, right: 20, bottom: 40, left: 100 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const xScale = (index: number) => (index / (sortedData.length - 1 || 1)) * chartWidth;
    const yScale = (levelValue: number) => chartHeight - (levelValue / (energyLevels.length - 1)) * chartHeight;

    const pathData = sortedData.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(levelToValue(d.energyLevel))}`).join(' ');
    const areaPathData = `${pathData} L ${xScale(sortedData.length - 1)} ${chartHeight} L ${xScale(0)} ${chartHeight} Z`;
    
    return (
        <div className="w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                 <defs>
                    <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(192, 132, 252, 0.4)" />
                        <stop offset="100%" stopColor="rgba(192, 132, 252, 0)" />
                    </linearGradient>
                </defs>
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {/* Y-axis labels */}
                    {energyLevels.map((level, i) => (
                         <g key={level}>
                            <text x={-10} y={yScale(i) + 4} textAnchor="end" fill="currentColor" fontSize="10" className="text-gray-400">{level}</text>
                             <line x1={0} y1={yScale(i)} x2={chartWidth} y2={yScale(i)} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,3" className="text-gray-600" />
                        </g>
                    ))}
                    {/* X-axis labels */}
                    {sortedData.map((d, i) => (
                         <text key={d.weekNumber} x={xScale(i)} y={chartHeight + 20} textAnchor="middle" fill="currentColor" fontSize="10" className="text-gray-400">S{d.weekNumber}</text>
                    ))}
                    {/* Area and Line */}
                    <path d={areaPathData} fill="url(#energyGradient)" />
                    <path d={pathData} fill="none" stroke="#C084FC" strokeWidth="2" />
                    {/* Points */}
                    {sortedData.map((d, i) => (
                        <circle key={d.weekNumber} cx={xScale(i)} cy={yScale(levelToValue(d.energyLevel))} r="3" fill="#C084FC" stroke="#1F2937" strokeWidth="1.5" />
                    ))}
                </g>
            </svg>
        </div>
    );
};

export default React.memo(EnergySeismograph);