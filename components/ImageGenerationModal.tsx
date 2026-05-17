import React, { useState } from 'react';
import Modal from './Modal';

interface ImageGenerationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: (prompt: string, aspectRatio: string, numberOfImages: number, adaStyle: boolean) => void;
    isLoading: boolean;
}

const aspectRatios = [
    { value: '1:1', label: 'Quadrato (1:1)' },
    { value: '4:3', label: 'Paesaggio (4:3)' },
    { value: '3:4', label: 'Ritratto (3:4)' },
    { value: '16:9', label: 'Widescreen (16:9)' },
    { value: '9:16', label: 'Verticale (9:16)' },
];

const ImageGenerationModal: React.FC<ImageGenerationModalProps> = ({ isOpen, onClose, onGenerate, isLoading }) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState('1:1');
    const [numberOfImages, setNumberOfImages] = useState(1);
    const [adaStyle, setAdaStyle] = useState(true);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (prompt.trim()) {
            onGenerate(prompt, aspectRatio, numberOfImages, adaStyle);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Atelier Visivo">
             <form onSubmit={handleSubmit}>
                <div className="space-y-5">
                    <div>
                        <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">Prompt Visivo</label>
                        <textarea
                            id="prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-28 p-3 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-200 resize-none"
                            placeholder="Descrivi l'immagine che vuoi creare..."
                            aria-label="Descrizione dell'immagine da generare"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-300 mb-2">Formato Immagine</label>
                            <select
                                id="aspectRatio"
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value)}
                                className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            >
                                {aspectRatios.map(ratio => (
                                    <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="numberOfImages" className="block text-sm font-medium text-gray-300 mb-2">Numero Variazioni ({numberOfImages})</label>
                            <input
                                id="numberOfImages"
                                type="range"
                                min="1"
                                max="4"
                                step="1"
                                value={numberOfImages}
                                onChange={(e) => setNumberOfImages(parseInt(e.target.value, 10))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                            />
                        </div>
                    </div>
                     <div className="flex items-center">
                        <input
                            id="adaStyle"
                            type="checkbox"
                            checked={adaStyle}
                            onChange={(e) => setAdaStyle(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 bg-gray-700"
                        />
                        <label htmlFor="adaStyle" className="ml-3 block text-sm text-gray-300">
                            Applica "Stile Ada" (palette neutre, luce morbida)
                        </label>
                    </div>
                </div>
                <div className="flex items-center justify-end pt-6">
                    <button
                        type="submit"
                        disabled={!prompt.trim() || isLoading}
                        className="px-5 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors disabled:bg-blue-800/50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? 'Generazione in corso...' : 'Genera Immagine'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ImageGenerationModal;