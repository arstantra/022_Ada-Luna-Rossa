import React from 'react';

interface DonutChartProps {
    data: { name: string; value: number; color: string }[];
    size?: number;
    strokeWidth?: number;
}

const DonutChart: React.FC<DonutChartProps> = ({ data, size = 150, strokeWidth = 20 }) => {
    if (data.length === 0) {
        return (
            <div style={{ width: size, height: size }} className="flex items-center justify-center text-xs text-gray-400">
                No data
            </div>
        );
    }
    
    const halfSize = size / 2;
    const radius = halfSize - strokeWidth / 2;
    const circumference = 2 * Math.PI * radius;
    const total = data.reduce((acc, item) => acc + item.value, 0);

    let accumulatedOffset = 0;

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <g transform={`rotate(-90 ${halfSize} ${halfSize})`}>
                {data.map((item, index) => {
                    if (item.value <= 0) return null;
                    const dashArray = (item.value / total) * circumference;
                    const strokeDashoffset = accumulatedOffset;
                    accumulatedOffset += dashArray;

                    return (
                        <circle
                            key={index}
                            cx={halfSize}
                            cy={halfSize}
                            r={radius}
                            fill="transparent"
                            stroke={item.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                            strokeDashoffset={-strokeDashoffset}
                            strokeLinecap="round"
                        />
                    );
                })}
            </g>
        </svg>
    );
};

export default DonutChart;
