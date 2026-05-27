import React, { useState, useCallback } from 'react';
import { marked } from 'marked';
import type { useMasterContext } from '../hooks/useMasterContext';
import { SparklesIcon, XIcon, RefreshIcon, PencilIcon } from './Icons';
import DocumentEditor from './DocumentEditor';
import { generateDocumentContent } from '../services/gemini';

interface AdaPersonalityViewProps {
    masterContext: ReturnType<typeof useMasterContext>;
    onClose: () => void;
}

const AdaPersonalityView: React.FC<AdaPersonalityViewProps> = ({ masterContext, onClose }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedContent, setGeneratedContent] = useState<string | null>(null);

    const profiloFilled = !!masterContext.teacherProfile?.trim();
    const hasContent = !!(generatedContent ?? masterContext.systemInstruction)?.trim();

    const handleGenerateWithAda = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        const profiloContent = masterContext.teacherProfile?.trim();
        if (!profiloContent || isGenerating) return;

        setIsGenerating(true);
        try {
            const markdown = await generateDocumentContent('personalita', profiloContent);
            const html = String(marked.parse(markdown));
            setGeneratedContent(html);
            // Abilita la modifica automaticamente dopo la generazione
            // così il docente può rivedere prima che l'autosave scatti
            setIsEditing(true);
        } catch (err) {
            console.error('[AdaPersonalityView] Errore generazione ADA:', err);
        } finally {
            setIsGenerating(false);
        }
    }, [masterContext.teacherProfile, isGenerating]);

    return (
        <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* ── Header pagina ── */}
            <div className="flex-shrink-0 flex items-center justify-between px-6 pt-3.5 pb-2 border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <SparklesIcon className="h-5 w-5 text-gray-400" />
                    <div>
                        <h2 className="text-base font-display font-semibold text-white">Personalità di Ada</h2>
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

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto">
                    <p className="text-gray-400 text-sm mb-5 leading-relaxed">
                        Definisci qui il carattere, il tono e il ruolo di Ada. Queste istruzioni vengono lette da Ada
                        ad ogni conversazione e determinano come si comporta, come risponde e con quale stile lavora
                        insieme a te. Scrivi liberamente — non serve una struttura precisa.
                    </p>

                    {/* Card documento */}
                    <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">

                        {/* Header documento: titolo + Genera + matita */}
                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-700/40">
                            <div className="flex items-center gap-2.5">
                                <span className="text-sm font-semibold text-white">Istruzioni di Sistema</span>
                                {hasContent
                                    ? <span className="text-[10px] font-mono text-emerald-400/70">● compilato</span>
                                    : <span className="text-[10px] font-mono text-gray-500">○ vuoto</span>
                                }
                            </div>

                            <div className="flex items-center gap-1.5">
                                {/* Genera con ADA */}
                                <button
                                    onClick={handleGenerateWithAda}
                                    disabled={isGenerating || !profiloFilled}
                                    title={
                                        !profiloFilled
                                            ? 'Prima compila il Profilo del Corso nei Documenti Fondanti'
                                            : hasContent
                                                ? 'Rigenera con ADA (sovrascrive il testo nell\'editor, non ancora salvato)'
                                                : 'Genera una proposta di personalità partendo dal Profilo del Corso'
                                    }
                                    className="flex items-center gap-1 px-2.5 py-1 text-xs text-purple-300 border border-purple-500/25 rounded-md hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isGenerating
                                        ? <RefreshIcon className="h-3 w-3 animate-spin" />
                                        : <SparklesIcon className="h-3 w-3" />
                                    }
                                    <span>{isGenerating ? 'Generando…' : 'Genera con ADA'}</span>
                                </button>

                                {/* Pulsante matita */}
                                <button
                                    onClick={() => setIsEditing(prev => !prev)}
                                    title={isEditing ? 'Termina modifica' : 'Modifica'}
                                    className={`p-1.5 rounded-md transition-colors ${
                                        isEditing
                                            ? 'text-blue-400 bg-blue-500/15'
                                            : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                                    }`}
                                >
                                    <PencilIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>

                        {/* Editor */}
                        <div className="px-5 pb-5 pt-4">
                            <DocumentEditor
                                initialContent={generatedContent ?? masterContext.systemInstruction}
                                onSave={masterContext.handleSaveInstructions}
                                mode="html"
                                isEditable={isEditing}
                                className="min-h-[55vh]"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default AdaPersonalityView;
