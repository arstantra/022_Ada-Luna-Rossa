import React from 'react';

const TrendIndicator: React.FC<{ value: number; direction: 'up' | 'down' | 'flat' }> = ({ value, direction }) => {
    if (direction === 'flat') {
        return <span className="text-sm font-medium text-gray-400">--</span>;
    }
    const color = direction === 'up' ? 'text-green-400' : 'text-red-400';
    const arrow = direction === 'up' ? '▲' : '▼';
    return (
        <span className={`text-sm font-medium ${color}`}>
            {arrow} {Math.abs(value)}%
        </span>
    );
};

const KpiCard: React.FC<{ 
    title: string; 
    value: string | number;
    trend?: { value: number; direction: 'up' | 'down' | 'flat' };
    subtitle?: string;
}> = ({ title, value, trend, subtitle }) => (
    <div className="bg-gray-700/50 rounded-lg p-4">
        <p className="text-sm text-gray-400">{title}</p>
        <div className="flex items-baseline gap-2 mt-1">
            <p className="text-3xl font-bold text-white">{value}</p>
            {trend && <TrendIndicator {...trend} />}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
    </div>
);

export default React.memo(KpiCard);