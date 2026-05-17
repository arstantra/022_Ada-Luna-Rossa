import React from 'react';

interface ChartData {
    week: string;
    averageGrade: number;
}

const LineChart: React.FC<{ data: ChartData[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="bg-gray-700/50 rounded-lg p-4 text-center text-gray-400 h-64 flex items-center justify-center">
                Nessun dato sufficiente per visualizzare il grafico.
            </div>
        );
    }

    const width = 500;
    const height = 250;
    const margin = { top: 20, right: 20, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxGrade = 10;
    const minGrade = Math.max(0, Math.min(...data.map(d => d.averageGrade)) - 1);

    const xScale = (index: number) => (index / (data.length - 1 || 1)) * chartWidth;
    const yScale = (grade: number) => chartHeight - ((grade - minGrade) / (maxGrade - minGrade)) * chartHeight;

    const pathData = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.averageGrade)}`).join(' ');
    
    const areaPathData = `${pathData} L ${xScale(data.length - 1)} ${chartHeight} L ${xScale(0)} ${chartHeight} Z`;
    
    const yAxisLabels = Array.from({ length: 5 }, (_, i) => {
        const grade = minGrade + (i / 4) * (maxGrade - minGrade);
        return { grade: Math.round(grade * 10) / 10, y: yScale(grade) };
    });

    return (
        <div className="bg-gray-700/50 rounded-lg p-4 w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(59, 130, 246, 0.4)" />
                        <stop offset="100%" stopColor="rgba(59, 130, 246, 0)" />
                    </linearGradient>
                </defs>
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {/* Y-axis grid lines and labels */}
                    {yAxisLabels.map(({ grade, y }) => (
                        <g key={grade} className="text-gray-500">
                            <line x1={0} y1={y} x2={chartWidth} y2={y} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,3" />
                            <text x={-10} y={y + 3} textAnchor="end" fill="currentColor" fontSize="10">{grade}</text>
                        </g>
                    ))}
                    {/* X-axis labels */}
                    {data.map((d, i) => (
                         <text key={d.week} x={xScale(i)} y={chartHeight + 20} textAnchor="middle" fill="currentColor" fontSize="10">{d.week}</text>
                    ))}
                    {/* Area and Line */}
                    <path d={areaPathData} fill="url(#areaGradient)" />
                    <path d={pathData} fill="none" stroke="#3B82F6" strokeWidth="2" />
                    {/* Points */}
                    {data.map((d, i) => (
                        <circle key={d.week} cx={xScale(i)} cy={yScale(d.averageGrade)} r="3" fill="#3B82F6" stroke="#fff" strokeWidth="1.5" />
                    ))}
                </g>
            </svg>
        </div>
    );
};

export default LineChart;
