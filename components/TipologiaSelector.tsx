import React from 'react';
import type { LessonType } from '../types';
import { LESSON_TYPE_LABELS } from '../constants';

const TIPOLOGIA_COLORS: Record<LessonType, string> = {
    frontale_teorica:   'bg-sky-500/15 text-sky-300 ring-1 ring-inset ring-sky-500/25',
    frontale_operativa: 'bg-teal-500/15 text-teal-300 ring-1 ring-inset ring-teal-500/25',
    laboratorio:        'bg-amber-500/15 text-amber-300 ring-1 ring-inset ring-amber-500/25',
    verifica:           'bg-red-500/15 text-red-300 ring-1 ring-inset ring-red-500/25',
    discussione:        'bg-purple-500/15 text-purple-300 ring-1 ring-inset ring-purple-500/25',
};

const LESSON_TYPES = Object.keys(LESSON_TYPE_LABELS) as LessonType[];

interface TipologiaSelectorProps {
    current?: LessonType;
    onSelect: (tipologia: LessonType | undefined) => void;
}

const TipologiaSelector: React.FC<TipologiaSelectorProps> = ({ current, onSelect }) => (
    <div className="flex items-center gap-1 flex-wrap">
        {LESSON_TYPES.map(tipo => {
            const isActive = current === tipo;
            return (
                <button
                    key={tipo}
                    onClick={() => onSelect(isActive ? undefined : tipo)}
                    title={isActive ? 'Rimuovi tipologia' : LESSON_TYPE_LABELS[tipo]}
                    className={`text-[10px] font-mono rounded-full px-2 py-0.5 transition-colors ${
                        isActive
                            ? TIPOLOGIA_COLORS[tipo]
                            : 'text-gray-600 hover:text-gray-400'
                    }`}
                >
                    {LESSON_TYPE_LABELS[tipo]}
                </button>
            );
        })}
    </div>
);

export default TipologiaSelector;
