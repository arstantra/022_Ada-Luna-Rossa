import React from 'react';
import { SparklesIcon } from './Icons';
import { parseTeacherName } from '../utils';

interface LobbyViewProps {
  teacherProfile: string;
}

const LobbyView: React.FC<LobbyViewProps> = ({ teacherProfile }) => {
    const teacherName = parseTeacherName(teacherProfile);

    const welcomeMessage = teacherName
        ? `Bentornato nel tuo laboratorio, ${teacherName.split(' ')[0]}`
        : "Ti diamo il benvenuto nel laboratorio";

    return (
        <main className="flex-1 flex flex-col items-center justify-center bg-gray-900 text-white p-8">
            <div className="relative w-48 h-48 flex items-center justify-center">
                <div className="absolute inset-0 bg-purple-500 rounded-full opacity-10 blur-2xl"></div>
                <SparklesIcon className="w-24 h-24 text-purple-400 animate-pulse" />
            </div>
            <h1 className="mt-8 text-3xl font-bold">{welcomeMessage}</h1>
            <p className="mt-2 text-lg text-gray-400">Seleziona un'attività dalla barra laterale per iniziare.</p>
        </main>
    );
};

export default React.memo(LobbyView);