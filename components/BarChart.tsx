import React from 'react';

interface ChartData {
    name: string;
    averageGrade: number;
}

const BarChart: React.FC<{ data: ChartData[] }> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="bg-gray-700/50 rounded-lg p-4 text-center text-gray-400 h-64 flex items-center justify-center">
                Nessun dato di valutazione disponibile.
            </div>
        );
    }
    const width = 500;
    const height = 250;
    const margin = { top: 20, right: 20, bottom: 70, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const maxGrade = 10;
    const barWidth = chartWidth / data.length;

    return (
        <div className="bg-gray-700/50 rounded-lg p-4 w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                <g transform={`translate(${margin.left}, ${margin.top})`}>
                    {/* Y-axis grid lines and labels */}
                    {[0, 2, 4, 6, 8, 10].map(grade => (
                         <g key={grade} className="text-gray-500">
                            <line x1={0} y1={chartHeight - (grade / maxGrade) * chartHeight} x2={chartWidth} y2={chartHeight - (grade / maxGrade) * chartHeight} stroke="currentColor" strokeWidth="0.5" strokeDasharray="2,3" />
                            <text x={-10} y={chartHeight - (grade / maxGrade) * chartHeight + 3} textAnchor="end" fill="currentColor" fontSize="10">{grade}</text>
                        </g>
                    ))}

                    {/* Bars */}
                    {data.map((d, i) => {
                        const barHeight = (d.averageGrade / maxGrade) * chartHeight;
                        const x = i * barWidth;
                        const y = chartHeight - barHeight;
                        const fill = d.averageGrade >= 6 ? 'rgba(52, 211, 153, 0.7)' : 'rgba(251, 113, 133, 0.7)';

                        return (
                            <g key={d.name}>
                                <rect x={x + barWidth * 0.1} y={y} width={barWidth * 0.8} height={barHeight} fill={fill} />
                                <text
                                    x={x + barWidth / 2}
                                    y={chartHeight + 15}
                                    transform={`rotate(-45, ${x + barWidth / 2}, ${chartHeight + 15})`}
                                    textAnchor="end"
                                    fill="currentColor"
                                    fontSize="10"
                                >
                                    {d.name}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
        </div>
    );
};

export default BarChart;
