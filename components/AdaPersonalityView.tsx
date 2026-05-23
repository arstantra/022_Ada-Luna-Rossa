import React, { useState, useCallback } from 'react';
import { marked } from 'marked';
import type { useMasterContext } from '../hooks/useMasterContext';
import { SparklesIcon, XIcon, RefreshIcon } from './Icons';
import DocumentEditor from './DocumentEditor';
import { generateDocumentContent } from '../services/gemini';

interface AdaPersonalityViewProps {
    masterContext: ReturnType<typeof useMasterContext>;
    onClose: () => void;
}

const AdaPersonalityView: React.FC<AdaPersonalityViewProps> = ({ masterContext, onClose }) => {
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<string | null>(null);

    const handleGenerateWithAda = useCallback(async () => {
        const profiloContent = masterContext.teacherProfile?.trim();
        if (!profiloContent || isGenerating) return;

        setIsGenerating(true);
        try {
            const markdown = await generateDocumentContent('personalita', profiloContent);
            const html = String(marked.parse(markdown));
            setGeneratedContent(html);
        } catch (e) {
            console.error('[AdaPersonalityView] Errore generazione ADA:', e);
        } finally {
            setIsGenerating(false);
        }
    }, [masterContext.teacherProfile, isGenerating]);

    const profiloFilled = !!masterContext.teacherProfile?.trim();

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
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleGenerateWithAda}
                        disabled={isGenerating || !profiloFilled}
                        title={!profiloFilled ? 'Prima compila il Profilo del Corso nei Documenti Fondanti' : 'Genera una proposta di personalità partendo dal Profilo del Corso'}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-300 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {isGenerating
                            ? <RefreshIcon className="h-3.5 w-3.5 animate-spin" />
                            : <SparklesIcon className="h-3.5 w-3.5" />
                        }
                        {isGenerating ? 'Generando…' : 'Genera con ADA'}
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        aria-label="Chiudi"
                    >
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    <p className="text-gray-400 text-sm mb-5 leading-relaxed">
                        Definisci qui il carattere, il tono e il ruolo di Ada. Queste istruzioni vengono lette da Ada ad ogni conversazione e determinano come si comporta, come risponde e con quale stile lavora insieme a te. Scrivi liberamente — non serve una struttura precisa.
                    </p>
                    <DocumentEditor
                        initialContent={generatedContent ?? masterContext.systemInstruction}
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
