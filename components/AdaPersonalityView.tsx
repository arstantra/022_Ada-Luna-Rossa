import React from 'react';
import type { useMasterContext } from '../hooks/useMasterContext';
import { SparklesIcon, XIcon } from './Icons';
import DocumentEditor from './DocumentEditor';

interface AdaPersonalityViewProps {
    masterContext: ReturnType<typeof useMasterContext>;
    onClose: () => void;
}

const AdaPersonalityView: React.FC<AdaPersonalityViewProps> = ({ masterContext, onClose }) => {
    return (
        <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between p-3.5 pl-6 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <SparklesIcon className="h-5 w-5 text-purple-400" />
                    <div>
                        <h2 className="text-base font-semibold text-white">Personalità di Ada</h2>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">Istruzioni di sistema · sempre attive</p>
                    </div>
                </div>
                <button
                    onClick={onClose}
                    className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                    aria-label="Chiudi"
                >
                    <XIcon className="h-5 w-5" />
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    <p className="text-gray-400 text-sm mb-5 leading-relaxed">
                        Definisci qui il carattere, il tono e il ruolo di Ada. Queste istruzioni vengono lette da Ada ad ogni conversazione e determinano come si comporta, come risponde e con quale stile lavora insieme a te. Scrivi liberamente — non serve una struttura precisa.
                    </p>
                    <DocumentEditor
                        initialContent={masterContext.systemInstruction}
                        onSave={masterContext.handleSaveInstructions}
                        mode="html"
                        isEditable={true}
                        className="min-h-[60vh]"
                    />
                </div>
            </div>
        </main>
    );
};

export default AdaPersonalityView;
