import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { SparklesIcon } from './Icons';
import * as GeminiService from '../services/gemini';

interface Suggestion {
    type: 'Diretto' | 'Narrativo' | 'Evocativo';
    text: string;
}

interface TitleSuggestionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectTitle: (title: string) => void;
    weekNumber: number;
    blockIndex: number;
    theme: string;
    objective: string;
    moduleTitle: string;
    tipologia: string;
    lessonSubject?: string;
}

const SuggestionCard: React.FC<{ title: string; content: string; onSelect: () => void }> = ({ title, content, onSelect }) => (
    <div className="bg-gray-700/50 rounded-lg p-4 flex flex-col justify-between border border-gray-600/50 h-full">
        <div>
            <h4 className="font-bold text-lg text-white mb-2">{title}</h4>
            <p className="text-gray-300 text-sm">{content}</p>
        </div>
        <button
            onClick={onSelect}
            className="mt-4 self-end px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
            Scegli questo
        </button>
    </div>
);

const TitleSuggestionModal: React.FC<TitleSuggestionModalProps> = ({
    isOpen,
    onClose,
    onSelectTitle,
    theme,
    objective,
    moduleTitle,
    tipologia,
    lessonSubject,
}) => {
    const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            setError(null);
            setSuggestions(null);

            GeminiService.generateBlockTitleSuggestions(objective, moduleTitle, tipologia, theme, lessonSubject)
                .then(result => {
                    setSuggestions([
                        { type: 'Diretto',   text: result.direct },
                        { type: 'Narrativo', text: result.narrative },
                        { type: 'Evocativo', text: result.evocative },
                    ]);
                })
                .catch(err => {
                    console.error("Error generating title suggestions:", err);
                    setError(err instanceof Error ? err.message : "Errore durante la generazione dei titoli.");
                })
                .finally(() => {
                    setIsLoading(false);
                });
        }
    }, [isOpen, objective, moduleTitle, tipologia, theme, lessonSubject]);

    const handleSelect = (text: string) => {
        onSelectTitle(text);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Suggerisci Titolo del Blocco">
            {isLoading && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <SparklesIcon className="h-10 w-10 text-purple-400 animate-pulse mb-4" />
                    <p className="font-semibold text-white">Generazione in corso...</p>
                    <p className="text-sm text-gray-400">{lessonSubject ? `Sto costruendo tre titoli a partire da "${lessonSubject}"…` : 'Sto inventando tre titoli per accendere la curiosità.'}</p>
                </div>
            )}
            {error && <div className="text-center text-red-400 p-8">{error}</div>}
            {suggestions && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {suggestions.map(s => (
                        <SuggestionCard
                            key={s.type}
                            title={s.type}
                            content={s.text}
                            onSelect={() => handleSelect(s.text)}
                        />
                    ))}
                </div>
            )}
        </Modal>
    );
};

export default TitleSuggestionModal;
