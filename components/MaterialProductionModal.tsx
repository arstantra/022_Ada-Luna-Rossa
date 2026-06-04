import React, { useState, useEffect } from 'react';
import type { LessonMaterial } from '../types';
import { SparklesIcon } from './Icons';
import * as GeminiService from '../services/gemini';

const OUTPUT_TOOL_OPTIONS: { value: NonNullable<LessonMaterial['outputTool']>; label: string }[] = [
    { value: 'canva',          label: 'Canva' },
    { value: 'powerpoint',     label: 'PowerPoint' },
    { value: 'ada_diretta',    label: 'Ada diretta' },
    { value: 'gemini_immagini',label: 'Gemini img' },
    { value: 'firefly',        label: 'Firefly' },
    { value: 'altro',          label: 'Altro' },
];

const MATERIAL_TYPE_LABELS: Record<LessonMaterial['type'], string> = {
    slide: 'Slide', video: 'Video', pdf: 'PDF', paper: 'Articolo',
    ricerca: 'Ricerca', stampa: 'Stampa', altro: 'Altro',
};

const OUTPUT_TOOL_LABELS: Record<NonNullable<LessonMaterial['outputTool']>, string> = {
    canva: 'Canva', powerpoint: 'PowerPoint', ada_diretta: 'Ada diretta',
    gemini_immagini: 'Gemini img', firefly: 'Firefly', altro: 'Altro',
};

export interface MaterialProductionModalProps {
    isOpen: boolean;
    onClose: () => void;
    sourceName: string;
    sourceContent: string;
    sourceMaterialType: LessonMaterial['type'];
    systemInstruction: string;
    onSaveBrief: (brief: string, outputTool: NonNullable<LessonMaterial['outputTool']>) => void;
}

const MaterialProductionModal: React.FC<MaterialProductionModalProps> = ({
    isOpen, onClose, sourceName, sourceContent, sourceMaterialType, systemInstruction, onSaveBrief,
}) => {
    const [outputTool, setOutputTool] = useState<NonNullable<LessonMaterial['outputTool']>>('canva');
    const [targetAudience, setTargetAudience] = useState('Classe intera');
    const [teacherInstruction, setTeacherInstruction] = useState('');
    const [brief, setBrief] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setOutputTool('canva');
            setTargetAudience('Classe intera');
            setTeacherInstruction('');
            setBrief(null);
            setIsLoading(false);
            setCopied(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleGenerate = async () => {
        if (!sourceContent.trim()) return;
        setIsLoading(true);
        setBrief(null);
        try {
            const toolLabel = OUTPUT_TOOL_LABELS[outputTool];
            const typeLabel = MATERIAL_TYPE_LABELS[sourceMaterialType];
            const result = await GeminiService.generateMaterialBrief(
                sourceContent, typeLabel, toolLabel, targetAudience, teacherInstruction, systemInstruction
            );
            setBrief(result);
        } catch {
            setBrief('Errore durante la generazione. Riprova.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleCopy = () => {
        if (!brief) return;
        navigator.clipboard.writeText(brief).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleSave = () => {
        if (!brief) return;
        onSaveBrief(brief, outputTool);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700/50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <SparklesIcon className="h-4 w-4 text-purple-400" />
                        <span className="text-sm font-semibold text-white">Produci materiale da questa fonte</span>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors text-lg leading-none">×</button>
                </div>

                <div className="overflow-y-auto custom-scrollbar flex-1 px-5 py-4 space-y-4">
                    {/* Source */}
                    <div>
                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1">Fonte selezionata</p>
                        <p className="text-xs text-gray-300 bg-gray-800/60 rounded-lg px-3 py-2 border border-gray-700/40 truncate">{sourceName}</p>
                    </div>

                    {/* Output tool */}
                    <div>
                        <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-2">Tool di produzione</p>
                        <div className="flex flex-wrap gap-1.5">
                            {OUTPUT_TOOL_OPTIONS.map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setOutputTool(opt.value)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                                        outputTool === opt.value
                                            ? 'bg-purple-600/60 border-purple-500/60 text-purple-100'
                                            : 'border-gray-600/60 text-gray-400 hover:border-gray-500 hover:text-white'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Target audience */}
                    <div>
                        <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Per</label>
                        <select
                            value={targetAudience}
                            onChange={e => setTargetAudience(e.target.value)}
                            className="w-full p-2 bg-gray-800 border border-gray-700/60 rounded-lg text-sm text-gray-200 focus:ring-1 focus:ring-purple-500/50"
                        >
                            <option>Classe intera</option>
                            <option>Gruppo avanzato</option>
                            <option>Gruppo base</option>
                            <option>Studente con BES</option>
                        </select>
                    </div>

                    {/* Teacher instruction */}
                    <div>
                        <label className="block text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">
                            Istruzione aggiuntiva <span className="text-gray-600 normal-case">(opzionale)</span>
                        </label>
                        <textarea
                            value={teacherInstruction}
                            onChange={e => setTeacherInstruction(e.target.value)}
                            rows={2}
                            className="w-full p-2.5 bg-gray-800/60 border border-gray-700/50 rounded-lg text-sm text-gray-200 placeholder-gray-600 resize-none focus:ring-1 focus:ring-purple-500/50 focus:border-purple-500/50"
                            placeholder="Es. max 6 slide, stile semplice, focus sul concetto chiave…"
                        />
                    </div>

                    {/* Brief result */}
                    {brief && (
                        <div>
                            <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mb-1.5">Output generato</p>
                            <pre className="whitespace-pre-wrap text-xs text-gray-300 bg-gray-800/60 rounded-lg p-3 border border-purple-800/20 max-h-64 overflow-y-auto custom-scrollbar font-sans leading-relaxed">
                                {brief}
                            </pre>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-5 py-4 border-t border-gray-700/50 flex-shrink-0 gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        Annulla
                    </button>
                    <div className="flex items-center gap-2">
                        {brief && (
                            <>
                                <button
                                    onClick={handleCopy}
                                    className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                                        copied
                                            ? 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10'
                                            : 'text-gray-300 border-gray-600/60 hover:border-gray-500 hover:text-white'
                                    }`}
                                >
                                    {copied ? '✓ Copiato' : 'Copia'}
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600/80 rounded-lg hover:bg-blue-500 shadow-sm shadow-blue-900/40 transition-colors"
                                >
                                    Salva sul materiale
                                </button>
                            </>
                        )}
                        {!brief && (
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading || !sourceContent.trim()}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading
                                    ? <><span className="h-3.5 w-3.5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generazione...</>
                                    : <><SparklesIcon className="h-3.5 w-3.5" />Genera brief</>
                                }
                            </button>
                        )}
                        {brief && !isLoading && (
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-50"
                            >
                                <SparklesIcon className="h-3 w-3" />Rigenera
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaterialProductionModal;
