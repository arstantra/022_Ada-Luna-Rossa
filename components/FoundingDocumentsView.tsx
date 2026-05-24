import React, { useState, useMemo, useCallback } from 'react';
import { marked } from 'marked';
import type { useMasterContext } from '../hooks/useMasterContext';
import {
    XIcon, DocumentTextIcon, PencilIcon, SparklesIcon, RefreshIcon, ChevronDownIcon, LinkIcon, CopyIcon, CheckIcon
} from './Icons';
import DocumentEditor from './DocumentEditor';
import CrewRosterCard, { buildCrewContext } from './CrewRosterCard';
import { generateDocumentContent, type DocumentContentType } from '../services/gemini';
import type { Student } from '../types';

interface FoundingDocumentsViewProps {
    masterContext: ReturnType<typeof useMasterContext>;
    onClose: () => void;
    isInitialSetup?: boolean;
    // Studenti — per la card Equipaggio strutturata
    students: Student[];
    onAddStudent: (data: Omit<Student, 'id' | 'evaluations' | 'adaSummary'>) => Promise<Student>;
    onUpdateStudent: (id: string, data: Partial<Omit<Student, 'id' | 'evaluations' | 'adaSummary'>>) => Promise<void>;
    onDeleteStudent: (id: string) => Promise<void>;
}

interface DocCardState {
    isOpen: boolean;
    isEditing: boolean;
    isGenerating: boolean;
    generatedContent: string | null;
}

/**
 * Pre-processa il testo generato per la costituzione aggiungendo heading markdown
 * davanti ai prefissi speciali del sistema (MODULO N:, UDA N:, FSL:, EDUCAZIONE CIVICA:).
 * Questo permette a marked.parse() di generare <h2>/<h3> con gerarchia visiva.
 * I prefissi vengono preservati esattamente così come sono (il constitutionParser
 * li riconosce e fa lo strip dell'HTML prima di parsare).
 */
const addHeadingsToConstitution = (text: string): string => {
    return text
        .split('\n')
        .map(line => {
            const trimmed = line.trim();
            // MODULO N: Titolo → ## MODULO N: Titolo
            if (/^MODULO\s*\d+\s*:/i.test(trimmed)) return `## ${trimmed}`;
            // UDA N: Titolo → ### UDA N: Titolo
            if (/^UDA\s*\d*\s*:/i.test(trimmed)) return `### ${trimmed}`;
            // EDUCAZIONE CIVICA: Titolo → ### EDUCAZIONE CIVICA: Titolo
            if (/^EDUCAZIONE CIVICA\s*\d*\s*:/i.test(trimmed)) return `### ${trimmed}`;
            // FSL N: Titolo → ### FSL N: Titolo
            if (/^FSL\s*\d*\s*:/i.test(trimmed)) return `### ${trimmed}`;
            // Ruolo: / Significato: → grassetto inline
            if (/^(Ruolo|Significato):/i.test(trimmed)) return `**${trimmed}**`;
            return line;
        })
        .join('\n');
};

const KIT_PROMPTS = [
    {
        label: 'Mission e valori',
        text: 'Analizza questo documento e sintetizza in 150-200 parole la mission della scuola, i valori fondanti e la visione educativa dichiarata. Usa un linguaggio conciso e cita le sezioni rilevanti.',
    },
    {
        label: 'Profilo studente in uscita',
        text: 'Descrivi in modo strutturato il profilo delle competenze e dei valori che la scuola si propone di sviluppare negli studenti al termine del percorso. Elenca le competenze chiave trasversali esplicitamente dichiarate nel documento.',
    },
    {
        label: 'Priorità didattiche del triennio',
        text: "Identifica le 3-5 priorità strategiche o didattiche del triennio (es. inclusione, innovazione metodologica, internazionalizzazione, PCTO, digitale). Per ciascuna scrivi una frase sintetica che ne descriva l'obiettivo.",
    },
    {
        label: 'Contesto territoriale',
        text: "Descrivi brevemente il contesto territoriale, le caratteristiche socioeconomiche dell'utenza scolastica e gli eventuali bisogni formativi specifici menzionati nel documento.",
    },
    {
        label: 'Aree di miglioramento (RAV)',
        text: 'Se presenti, identifica le aree di miglioramento del RAV integrate nel PTOF: obiettivi di processo, traguardi attesi, azioni prioritarie. Se il documento non contiene questa sezione, indicalo esplicitamente.',
    },
];

const FoundingDocumentsView: React.FC<FoundingDocumentsViewProps> = ({
    masterContext, onClose, isInitialSetup,
    students, onAddStudent, onUpdateStudent, onDeleteStudent,
}) => {
    const [localConstitution, setLocalConstitution] = useState(masterContext.constitution);
    const [localRoute, setLocalRoute] = useState(masterContext.routeContext);
    const [localCrew, setLocalCrew] = useState(masterContext.crewContext);
    const [localRules, setLocalRules] = useState(masterContext.rulesContext);
    const [setupError, setSetupError] = useState('');

    const [cardStates, setCardStates] = useState<Record<string, DocCardState>>(() => ({
        profilo:      { isOpen: false, isEditing: !!isInitialSetup, isGenerating: false, generatedContent: null },
        costituzione: { isOpen: false, isEditing: !!isInitialSetup, isGenerating: false, generatedContent: null },
        regole:       { isOpen: false, isEditing: !!isInitialSetup, isGenerating: false, generatedContent: null },
        equipaggio:   { isOpen: false, isEditing: false, isGenerating: false, generatedContent: null },
        ptof:         { isOpen: false, isEditing: false, isGenerating: false, generatedContent: null },
    }));

    // Stato locale PTOF — URL notebook e pannello kit prompt
    const [localPtofNotebookUrl, setLocalPtofNotebookUrl] = useState(masterContext.ptofNotebookUrl ?? '');
    const [isKitOpen, setIsKitOpen] = useState(false);
    const [copiedPromptIndex, setCopiedPromptIndex] = useState<number | null>(null);

    const handleCopyPrompt = useCallback((text: string, index: number) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopiedPromptIndex(index);
            setTimeout(() => setCopiedPromptIndex(null), 2000);
        });
    }, []);

    const handleSaveNotebookUrl = useCallback(async (url: string) => {
        setLocalPtofNotebookUrl(url);
        await masterContext.handleSavePtofNotebookUrl(url);
    }, [masterContext]);

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
    ], [isInitialSetup, localConstitution, localRoute, localRules, masterContext, cardStates]);

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
            // Per la costituzione, aggiungi heading markdown ai prefissi speciali
            // prima di convertire in HTML, così h2/h3 vengono renderizzati con gerarchia visiva.
            const preparedMarkdown = docId === 'costituzione'
                ? addHeadingsToConstitution(markdown)
                : markdown;
            const html = String(marked.parse(preparedMarkdown));

            if (isInitialSetup) {
                if (docId === 'costituzione') setLocalConstitution(html);
                else if (docId === 'regole') setLocalRules(html);
            } else {
                // Salva subito nel DB — non aspettare che l'utente digiti qualcosa.
                // Altrimenti al refresh il contenuto generato va perso.
                if (docId === 'costituzione') await masterContext.handleSaveConstitution(html);
                else if (docId === 'regole') await masterContext.handleSaveRules(html);
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
        // Nel nuovo flusso gli studenti sono già nel DB tramite CrewRosterCard.
        // Usiamo il crewContext generato dalla lista strutturata se ci sono studenti,
        // altrimenti il fallback localCrew (per retro-compatibilità).
        const crewToSave = students.length > 0 ? buildCrewContext(students) : localCrew;
        if (!localConstitution.trim() || !crewToSave.trim() || !localRules.trim()) {
            setSetupError('Per favore, compila almeno Progetto Didattico, Equipaggio e Patto Formativo prima di continuare.');
            return;
        }
        setSetupError('');
        await Promise.all([
            masterContext.handleSaveConstitution(localConstitution),
            masterContext.handleSaveCrew(crewToSave),
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

                    {/* ── Separatore sezione istituzionale ── */}
                    {!isInitialSetup && (
                        <div className="pt-3 pb-1">
                            <p className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-500/70 px-1">
                                Contesto istituzionale
                            </p>
                        </div>
                    )}

                    {/* ── Card Contesto Istituzionale (PTOF) ── */}
                    {!isInitialSetup && (() => {
                        const ptofState = cardStates['ptof'];
                        const ptofContent = masterContext.ptofExtract ?? '';
                        const hasContent = !!ptofContent.trim();

                        return (
                            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden transition-colors">
                                {/* Card header */}
                                <button
                                    onClick={() => setCardStates(prev => ({ ...prev, ptof: { ...prev['ptof'], isOpen: !prev['ptof'].isOpen } }))}
                                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-700/25 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="text-sm font-semibold text-white truncate">Contesto Istituzionale</span>
                                        {!ptofState.isOpen && (
                                            hasContent
                                                ? <span className="text-[10px] font-mono text-emerald-400/70 shrink-0">● compilato</span>
                                                : <span className="text-[10px] font-mono text-gray-500 shrink-0">○ vuoto</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0 ml-3">
                                        <span
                                            role="button"
                                            onClick={(e) => { e.stopPropagation(); setCardStates(prev => ({ ...prev, ptof: { ...prev['ptof'], isEditing: !prev['ptof'].isEditing, isOpen: true } })); }}
                                            title={ptofState.isEditing ? 'Termina modifica' : 'Modifica'}
                                            className={`p-1.5 rounded-md transition-colors cursor-pointer
                                                ${ptofState.isEditing
                                                    ? 'text-blue-400 bg-blue-500/15'
                                                    : 'text-gray-500 hover:text-gray-300 hover:bg-gray-700/50'
                                                }`}
                                        >
                                            <PencilIcon className="h-3.5 w-3.5" />
                                        </span>
                                        <ChevronDownIcon
                                            className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${ptofState.isOpen ? 'rotate-180' : ''}`}
                                        />
                                    </div>
                                </button>

                                {/* Card body */}
                                {ptofState.isOpen && (
                                    <div className="border-t border-gray-700/40 px-5 pb-5 pt-4 space-y-4">
                                        <p className="text-gray-400 text-xs leading-relaxed">
                                            Estratto del PTOF (Piano Triennale dell'Offerta Formativa) e di altri documenti istituzionali
                                            come il NIV o il RAV. Usa NotebookLM per estrarre le informazioni rilevanti e incollale qui —
                                            Ada userà questo contesto per rendere ogni scelta didattica coerente con la mission della tua scuola.
                                        </p>

                                        {/* Campo URL notebook */}
                                        <div className="flex items-center gap-2">
                                            <LinkIcon className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                                            <input
                                                type="url"
                                                value={localPtofNotebookUrl}
                                                onChange={(e) => setLocalPtofNotebookUrl(e.target.value)}
                                                onBlur={(e) => handleSaveNotebookUrl(e.target.value.trim())}
                                                placeholder="Incolla qui il link al notebook NotebookLM…"
                                                className="flex-1 bg-gray-900/60 border border-gray-700/50 rounded-md px-3 py-1.5 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-gray-500/80 transition-colors"
                                            />
                                            {localPtofNotebookUrl && (
                                                <a
                                                    href={localPtofNotebookUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="shrink-0 px-2.5 py-1.5 text-xs text-sky-400/80 border border-sky-500/20 rounded-md hover:bg-sky-500/10 hover:border-sky-400/35 transition-colors"
                                                >
                                                    Apri notebook
                                                </a>
                                            )}
                                        </div>

                                        {/* Kit prompt NotebookLM — collassabile */}
                                        <div className="rounded-lg border border-gray-700/40 bg-gray-900/40 overflow-hidden">
                                            <button
                                                onClick={() => setIsKitOpen(v => !v)}
                                                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-gray-700/20 transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono tracking-[0.12em] uppercase text-gray-400/80">
                                                        Kit di estrazione NotebookLM
                                                    </span>
                                                    <span className="text-[9px] font-mono text-gray-600 bg-gray-800/60 border border-gray-700/40 rounded px-1.5 py-0.5">
                                                        5 prompt pronti
                                                    </span>
                                                </div>
                                                <ChevronDownIcon className={`h-3.5 w-3.5 text-gray-500 transition-transform duration-200 ${isKitOpen ? 'rotate-180' : ''}`} />
                                            </button>

                                            {isKitOpen && (
                                                <div className="border-t border-gray-700/40 px-4 py-3 space-y-2">
                                                    <p className="text-[11px] text-gray-500 leading-relaxed mb-3">
                                                        Carica il PTOF (e il RAV, se ce l'hai) in NotebookLM. Poi copia questi prompt uno alla volta nella chat del notebook e incolla le risposte nell'editor qui sotto.
                                                    </p>
                                                    {KIT_PROMPTS.map((prompt, i) => (
                                                        <div
                                                            key={i}
                                                            className="group flex items-start gap-3 bg-gray-800/50 border border-gray-700/30 rounded-lg px-3.5 py-2.5"
                                                        >
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-[10px] font-mono text-gray-500 mb-1">{prompt.label}</p>
                                                                <p className="text-xs text-gray-300 leading-relaxed">{prompt.text}</p>
                                                            </div>
                                                            <button
                                                                onClick={() => handleCopyPrompt(prompt.text, i)}
                                                                title="Copia prompt"
                                                                className="shrink-0 mt-0.5 p-1.5 rounded-md text-gray-600 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
                                                            >
                                                                {copiedPromptIndex === i
                                                                    ? <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
                                                                    : <CopyIcon className="h-3.5 w-3.5" />
                                                                }
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Editor estratto */}
                                        <DocumentEditor
                                            initialContent={ptofContent}
                                            onSave={masterContext.handleSavePtofExtract}
                                            mode="html"
                                            isEditable={ptofState.isEditing}
                                            includeAlignmentInToolbar={false}
                                            className="min-h-[30vh]"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* ── Separatore documenti principali ── */}
                    {!isInitialSetup && (
                        <div className="pt-3 pb-1 border-t border-gray-700/25 mt-1">
                            <p className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-500/70 px-1 pt-3">
                                Documenti del corso
                            </p>
                        </div>
                    )}

                    {/* ── Card Equipaggio (lista strutturata, NON DocumentEditor) ── */}
                    {(() => {
                        const equipState = cardStates['equipaggio'];
                        const hasStudents = students.length > 0;
                        return (
                            <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden transition-colors">
                                <button
                                    onClick={() => toggleOpen('equipaggio')}
                                    className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-700/25 transition-colors"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <span className="text-sm font-semibold text-white truncate">L'Equipaggio</span>
                                        {!equipState.isOpen && (
                                            hasStudents
                                                ? <span className="text-[10px] font-mono text-emerald-400/70 shrink-0">● {students.length} student{students.length === 1 ? 'e' : 'sse/i'}</span>
                                                : <span className="text-[10px] font-mono text-gray-500 shrink-0">○ vuoto</span>
                                        )}
                                    </div>
                                    <ChevronDownIcon className={`h-4 w-4 text-gray-500 transition-transform duration-200 ${equipState.isOpen ? 'rotate-180' : ''}`} />
                                </button>
                                {equipState.isOpen && (
                                    <div className="border-t border-gray-700/40 px-5 pb-5 pt-4">
                                        <p className="text-gray-400 text-xs mb-4 leading-relaxed">
                                            Le studentesse e gli studenti del corso. Aggiungi ognuno con nome, cognome e — se necessario — segnalazioni BES/DSA. Ada usa questi profili per adattare suggerimenti e attività.
                                        </p>
                                        <CrewRosterCard
                                            students={students}
                                            onAddStudent={onAddStudent}
                                            onUpdateStudent={onUpdateStudent}
                                            onDeleteStudent={onDeleteStudent}
                                            onCrewContextChange={masterContext.handleSaveCrew}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })()}

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
