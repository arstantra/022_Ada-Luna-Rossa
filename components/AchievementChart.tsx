import React from 'react';

interface AchievementData {
    name: string;
    percentage: number;
}

interface AchievementChartProps {
    title: string;
    data: AchievementData[];
}

const AchievementChart: React.FC<AchievementChartProps> = ({ title, data }) => {
    if (data.length === 0) {
        return <p className="text-sm text-gray-500 italic">Dati non disponibili.</p>;
    }

    return (
        <div>
            <h4 className="text-sm font-semibold text-gray-300 mb-3">{title}</h4>
            <div className="space-y-3">
                {data.map(item => (
                    <div key={item.name}>
                        <div className="flex justify-between items-baseline text-xs mb-1">
                            <span className="text-gray-300 truncate font-medium" title={item.name}>{item.name}</span>
                            <span className="font-semibold text-white">{item.percentage.toFixed(0)}%</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-2.5">
                            <div
                                className="bg-blue-500 h-2.5 rounded-full transition-all duration-500"
                                style={{ width: `${item.percentage}%` }}
                            ></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default React.memo(AchievementChart);