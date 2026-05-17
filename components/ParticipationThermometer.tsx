import React from 'react';

interface ParticipationData {
    module: string;
    presence: number;
}

interface ParticipationThermometerProps {
    data: ParticipationData[];
}

const ParticipationThermometer: React.FC<ParticipationThermometerProps> = ({ data }) => {
    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-sm text-gray-400">
                Nessun dato di presenza registrato.
            </div>
        );
    }

    const maxPresence = 100;
    const barWidth = 40;
    const chartHeight = 200;

    return (
        <div className="flex justify-around items-end h-64 gap-4 px-4">
            {data.map(({ module, presence }) => {
                const barHeight = (presence / maxPresence) * chartHeight;
                const color = presence > 80 ? 'bg-green-500' : presence > 60 ? 'bg-yellow-500' : 'bg-red-500';

                return (
                    <div key={module} className="flex flex-col items-center flex-grow text-center">
                        <div className="text-sm font-bold text-white">{presence.toFixed(0)}%</div>
                        <div
                            className={`w-full max-w-[${barWidth}px] ${color} rounded-t-md transition-all duration-500 hover:opacity-80`}
                            style={{ height: `${barHeight}px` }}
                            title={`${module}: ${presence.toFixed(1)}%`}
                        ></div>
                        <div className="text-xs text-gray-400 mt-2 truncate">{module.replace('MODULO ', 'M')}</div>
                    </div>
                );
            })}
        </div>
    );
};

export default React.memo(ParticipationThermometer);