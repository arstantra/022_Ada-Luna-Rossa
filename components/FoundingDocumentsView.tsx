import React, { useState, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import type { useMasterContext } from '../hooks/useMasterContext';
import {
    XIcon, DocumentTextIcon, PencilIcon, SparklesIcon, RefreshIcon, ChevronDownIcon
} from './Icons';
import DocumentEditor from './DocumentEditor';
import { generateDocumentContent, type DocumentContentType } from '../services/gemini';

interface FoundingDocumentsViewProps {
    masterContext: ReturnType<typeof useMasterContext>;
    onClose: () => void;
    isInitialSetup?: boolean;
}

interface DocCardState {
    isOpen: boolean;
    isEditing: boolean;
    isGenerating: boolean;
    generatedContent: string | null;
}

const FoundingDocumentsView: React.FC<FoundingDocumentsViewProps> = ({ masterContext, onClose, isInitialSetup }) => {
    const [localConstitution, setLocalConstitution] = useState(masterContext.constitution);
    const [localRoute, setLocalRoute] = useState(masterContext.routeContext);
    const [localCrew, setLocalCrew] = useState(masterContext.crewContext);
    const [localRules, setLocalRules] = useState(masterContext.rulesContext);
    const [setupError, setSetupError] = useState('');

    const [cardStates, setCardStates] = useState<Record<string, DocCardState>>(() => ({
        profilo:      { isOpen: false, isEditing: !!isInitialSetup, isGenerating: false, generatedContent: null },
        costituzione: { isOpen: false, isEditing: !!isInitialSetup, isGenerating: false, generatedContent: null },
        regole:       { isOpen: false, isEditing: !!isInitialSetup, isGenerating: false, generatedContent: null },
        equipaggio:   { isOpen: false, isEditing: !!isInitialSetup, isGenerating: false, generatedContent: null },
    }));

    const documents = useMemo(() => [
        {
            id: 'profilo',
            title: 'Profilo del Corso',
            content: cardStates['profilo'].generatedContent
                ?? (isInitialSetup ? localRoute : masterContext.teacherProfile),
            onSave: isInitialSetup ? setLocalRoute : masterContext.handleSaveTeacherProfile,
            description: 'Chi sei, dove insegni, la tua disciplina, il tuo curriculum. Compila questo primo — Ada usa queste informazioni per generare gli altri documenti e personalizzare ogni interazione.',
            canGenerate: false,
        },
        {
            id: 'costituzione',
            title: 'Progetto Didattico',
            content: cardStates['costituzione'].generatedContent
                ?? (isInitialSetup ? localConstitution : masterContext.constitution),
            onSave: isInitialSetup ? setLocalConstitution : masterContext.handleSaveConstitution,
            description: 'Il progetto di disciplina: moduli, obiettivi, attività chiave. Il DNA del tuo percorso formativo. Scrivi liberamente o incolla da Word — Ada lo legge come contesto fisso.',
            canGenerate: true,
        },
        {
            id: 'regole',
            title: 'Patto Formativo',
            content: cardStates['regole'].generatedContent
                ?? (isInitialSetup ? localRules : masterContext.rulesContext),
            onSave: isInitialSetup ? setLocalRules : masterContext.handleSaveRules,
            description: 'Il sistema di valutazione e le regole del laboratorio. Scrivi liberamente — Ada parsa e struttura per te.',
            canGenerate: true,
        },
        {
            id: 'equipaggio',
            title: "L'Equipaggio",
            content: cardStates['equipaggio'].generatedContent
                ?? (isInitialSetup ? localCrew : masterContext.crewContext),
            onSave: isInitialSetup ? setLocalCrew : masterContext.handleSaveCrew,
            description: 'Le studentesse e gli studenti del corso. Incolla da un foglio di testo, uno per riga o separati da virgola — Ada costruisce il suo registro da qui.',
            canGenerate: false,
        },
    ], [isInitialSetup, localConstitution, localRoute, localCrew, localRules, masterContext, cardStates]);

    const profiloFilled = !!(isInitialSetup ? localRoute : masterContext.teacherProfile)?.trim();

    const toggleOpen = (docId: string) => {
        setCardStates(prev => ({
            ...prev,
            [docId]: { ...prev[docId], isOpen: !prev[docId].isOpen },
        }));
    };

    const toggleEditing = (docId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setCardStates(prev => ({
            ...prev,
            [docId]: { ...prev[docId], isEditing: !prev[docId].isEditing, isOpen: true },
        }));
    };

    const handleGenerate = useCallback(async (docId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const profiloContent = isInitialSetup ? localRoute : masterContext.teacherProfile;
        if (!profiloContent?.trim()) return;

        const docTypeMap: Record<string, DocumentContentType> = {
            costituzione: 'costituzione',
            regole: 'regole',
        };
        const docType = docTypeMap[docId];
        if (!docType) return;

        setCardStates(prev => ({
            ...prev,
            [docId]: { ...prev[docId], isGenerating: true, isOpen: true },
        }));

        try {
            const markdown = await generateDocumentContent(docType, profiloContent);
            const html = String(marked.parse(markdown));

            if (isInitialSetup) {
                if (docId === 'costituzione') setLocalConstitution(html);
                else if (docId === 'regole') setLocalRules(html);
            }

            setCardStates(prev => ({
                ...prev,
                [docId]: {
                    ...prev[docId],
                    isGenerating: false,
                    generatedContent: html,
                    isEditing: !isInitialSetup,
                },
            }));
        } catch (err) {
            console.error('[FoundingDocumentsView] Errore generazione ADA:', err);
            setCardStates(prev => ({
                ...prev,
                [docId]: { ...prev[docId], isGenerating: false },
            }));
        }
    }, [isInitialSetup, localRoute, masterContext.teacherProfile]);

    const handleFinishSetup = async () => {
        if (!localConstitution.trim() || !localCrew.trim() || !localRules.trim()) {
            setSetupError('Per favore, compila almeno Progetto Didattico, Equipaggio e Patto Formativo prima di continuare.');
            return;
        }
        setSetupError('');
        await Promise.all([
            masterContext.handleSaveConstitution(localConstitution),
            masterContext.handleSaveCrew(localCrew),
            masterContext.handleSaveRules(localRules),
            ...(localRoute.trim() ? [masterContext.handleSaveTeacherProfile(localRoute)] : []),
        ]);
    };

    return (
        <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            {/* ── Header ── */}
            <div className="flex-shrink-0 flex items-center justify-between p-3.5 pl-6 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <DocumentTextIcon className="h-6 w-6 text-gray-300" />
                    <h2 className="text-lg font-semibold truncate">
                        {isInitialSetup ? 'Configurazione Iniziale' : 'Documenti Fondanti'}
                    </h2>
                </div>
                {!isInitialSetup && (
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        aria-label="Chiudi"
                    >
                        <XIcon className="h-5 w-5" />
                    </button>
                )}
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-4xl mx-auto space-y-3">

                    {isInitialSetup && (
                        <div className="p-4 mb-6 bg-blue-900/50 border border-blue-500/50 rounded-lg text-blue-200 animate-fade-in-down">
                            <h2 className="font-bold">Benvenuta in Ada!</h2>
                            <p className="text-sm mt-1">
                                Prima configurazione. Compila i Documenti Fondanti per dare ad Ada il contesto del tuo corso
                                — puoi incollare direttamente da Word. I campi obbligatori sono Progetto Didattico,
                                Equipaggio e Patto Formativo. Il Profilo del Corso puoi completarlo dopo.
                            </p>
                        </div>
                    )}

                    {documents.map(doc => {
                        const state = cardStates[doc.id];
                        const hasContent = !!doc.content?.trim();

                        return (
                            <div
                                key={doc.id}
                                className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden transition-colors"
                            >
                                {/* Card header — cliccabile per aprire/chiudere */}
                                <button
                                    onClick={() => toggleOpen(doc.id)}
                                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-700/25 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="text-sm font-semibold text-white truncate">{doc.title}</span>
                                        {/* Badge stato contenuto */}
                                        {!state.isOpen && (
                                            hasContent
                                                ? <span className="text-[10px] font-mono text-emerald-400/70 shrink-0">● compilato</span>
                                                : <span className="text-[10px] font-mono text-gray-500 shrink-0">○ vuoto</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                        {/* Genera con ADA — solo per Progetto Didattico e Patto Formativo */}
                                        {doc.canGenerate && (
                                            <span
                                                role="button"
                                                onClick={(e) => handleGenerate(doc.id, e)}
                                                title={
                                                    !profiloFilled
                                                        ? 'Prima compila il Profilo del Corso'
                                                        : hasContent
                                                            ? 'Rigenera con ADA (sovrascrive il testo nell\'editor, non ancora salvato)'
                                                            : 'Genera una bozza partendo dal Profilo del Corso'
                                                }
                                                className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md border transition-colors
                                                    ${!profiloFilled || state.isGenerating
                                                        ? 'text-purple-400/40 border-purple-500/15 cursor-not-allowed'
                                                        : 'text-purple-300 border-purple-500/25 hover:bg-purple-500/10 hover:border-purple-400/40 cursor-pointer'
                                                    }`}
                                                aria-disabled={!profiloFilled || state.isGenerating}
                                            >
                                                {state.isGenerating
                                                    ? <RefreshIcon className="h-3 w-3 animate-spin" />
                                                    : <SparklesIcon className="h-3 w-3" />
                                                }
                                                <span className="hidden sm:inline">
                                                    {state.isGenerating ? 'Generando…' : 'Genera con ADA'}
                                                </span>
                                            </span>
                                        )}

                                        {/* Pulsante matita — solo fuori dalla configurazione iniziale */}
                                        {!isInitialSetup && (
                                            <span
                                                role="button"
                                                onClick={(e) => toggleEditing(doc.id, e)}
                                                title={state.isEditing ? 'Termina modifica' : 'Modifica'}
                                                className={`p-1.5 rounded-md transition-colors cursor-pointer
                                                    ${state.isEditing
                                                        ? 'text-blue-400 bg-blue-500/15'
                                                        : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                                                    }`}
                                            >
                                                <PencilIcon className="h-3.5 w-3.5" />
                                            </span>
                                        )}

                                        {/* Chevron apertura/chiusura */}
                                        <ChevronDownIcon
                                            className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${state.isOpen ? 'rotate-180' : ''}`}
                                        />
                                    </div>
                                </button>

                                {/* Card body — visibile solo se aperto */}
                                {state.isOpen && (
                                    <div className="border-t border-gray-700/40 px-5 pb-5 pt-4">
                                        <p className="text-gray-400 text-xs mb-4 leading-relaxed">
                                            {doc.description}
                                        </p>
                                        <DocumentEditor
                                            initialContent={doc.content}
                                            onSave={doc.onSave}
                                            mode="html"
                                            isEditable={state.isEditing}
                                            includeAlignmentInToolbar={false}
                                            className="min-h-[30vh]"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── Footer (solo configurazione iniziale) ── */}
            {isInitialSetup && (
                <div className="flex-shrink-0 p-4 border-t border-gray-700/50 bg-gray-800 flex flex-col items-center">
                    {setupError && (
                        <p className="text-red-400 text-sm mb-2 animate-fade-in-down">{setupError}</p>
                    )}
                    <button
                        onClick={handleFinishSetup}
                        className="px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Salva e Inizia a Lavorare con Ada
                    </button>
                </div>
            )}
        </main>
    );
};

export default FoundingDocumentsView;
