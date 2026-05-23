import React, { useState, useMemo } from 'react';
import type { useMasterContext } from '../hooks/useMasterContext';
import { 
    XIcon, DocumentTextIcon, PencilIcon
} from './Icons';
import ConfirmationModal from './ConfirmationModal';
import DocumentEditor from './DocumentEditor';

interface FoundingDocumentsViewProps {
    masterContext: ReturnType<typeof useMasterContext>;
    onClose: () => void;
    isInitialSetup?: boolean;
}

const FoundingDocumentsView: React.FC<FoundingDocumentsViewProps> = ({ masterContext, onClose, isInitialSetup }) => {
    const [localConstitution, setLocalConstitution] = useState(masterContext.constitution);
    const [localRoute, setLocalRoute] = useState(masterContext.routeContext);
    const [localCrew, setLocalCrew] = useState(masterContext.crewContext);
    const [localRules, setLocalRules] = useState(masterContext.rulesContext);
    
    const [setupError, setSetupError] = useState('');
    const [isEditing, setIsEditing] = useState(isInitialSetup || false);
    const [isConfirmingEdit, setIsConfirmingEdit] = useState(false);

    const documents = useMemo(() => [
        { id: 'costituzione', title: 'Progetto Didattico', content: isInitialSetup ? localConstitution : masterContext.constitution, onSave: isInitialSetup ? setLocalConstitution : masterContext.handleSaveConstitution, description: 'Il progetto di disciplina: moduli, obiettivi, attività chiave. Il DNA del tuo percorso formativo. Scrivi liberamente o incolla da Word — Ada lo legge come contesto fisso.' },
        { id: 'equipaggio', title: "L'Equipaggio", content: isInitialSetup ? localCrew : masterContext.crewContext, onSave: isInitialSetup ? setLocalCrew : masterContext.handleSaveCrew, description: 'Le studentesse e gli studenti del corso. Incolla da un foglio di testo, uno per riga o separati da virgola — Ada costruisce il suo registro da qui.' },
        { id: 'regole', title: 'Patto Formativo', content: isInitialSetup ? localRules : masterContext.rulesContext, onSave: isInitialSetup ? setLocalRules : masterContext.handleSaveRules, description: 'Il sistema di valutazione e le regole del laboratorio. Scrivi in modo libero — Ada parsa e struttura per te.' },
        { id: 'profilo', title: 'Profilo del Corso', content: isInitialSetup ? localRoute : masterContext.teacherProfile, onSave: isInitialSetup ? setLocalRoute : masterContext.handleSaveTeacherProfile, description: 'Chi sei, dove insegni, in quale scuola e città, la tua disciplina, il tuo curriculum. Ada usa questo profilo per personalizzare ogni interazione.' },
    ], [isInitialSetup, localConstitution, localRoute, localCrew, localRules, masterContext]);

    const [activeTabId, setActiveTabId] = useState(documents[0].id);
    const activeDocument = useMemo(() => documents.find(d => d.id === activeTabId), [documents, activeTabId]);
    
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
        // L'app passerà alla vista principale grazie all'aggiornamento dello stato nel master context.
    };

    const handleStartEditing = () => {
        setIsConfirmingEdit(true);
    };

    const handleConfirmEdit = () => {
        setIsEditing(true);
        setIsConfirmingEdit(false);
    };

    return (
        <>
            <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
                <div className="flex-shrink-0 flex items-center justify-between p-3.5 pl-6 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <DocumentTextIcon className="h-6 w-6 text-gray-300" />
                        <h2 className="text-lg font-semibold truncate">{isInitialSetup ? "Configurazione Iniziale" : "Documenti Fondanti"}</h2>
                    </div>
                    {!isInitialSetup && (
                        <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" aria-label="Chiudi">
                            <XIcon className="h-5 w-5" />
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-4xl mx-auto">
                        {isInitialSetup && (
                            <div className="p-4 mb-8 bg-blue-900/50 border border-blue-500/50 rounded-lg text-blue-200 animate-fade-in-down">
                                <h2 className="font-bold">Benvenuta in Ada!</h2>
                                <p className="text-sm mt-1">Prima configurazione. Compila i Documenti Fondanti per dare ad Ada il contesto del tuo corso — puoi incollare direttamente da Word. I campi obbligatori sono Progetto Didattico, Equipaggio e Patto Formativo. Il Profilo del Corso puoi completarlo dopo.</p>
                            </div>
                        )}
                        
                        <div className="flex justify-between items-center border-b border-gray-700 mb-6">
                            <div className="flex">
                                {documents.map(doc => (
                                    <button
                                        key={doc.id}
                                        onClick={() => setActiveTabId(doc.id)}
                                        className={`px-4 py-3 text-sm font-medium transition-colors ${activeTabId === doc.id ? 'border-b-2 border-blue-500 text-white' : 'text-gray-400 hover:text-white'}`}
                                    >
                                        {doc.title}
                                    </button>
                                ))}
                            </div>
                            {!isInitialSetup && (
                                <div>
                                    {isEditing ? (
                                        <button 
                                            onClick={() => setIsEditing(false)}
                                            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
                                        >
                                            Termina Modifica
                                        </button>
                                    ) : (
                                        <button 
                                            onClick={handleStartEditing}
                                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                                        >
                                            <PencilIcon className="h-4 w-4" />
                                            Modifica Documenti
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                        
                        {activeDocument && (
                            <div key={activeDocument.id} className="animate-fade-in-up">
                                <p className="text-gray-400 text-sm mb-3">{activeDocument.description}</p>
                                <DocumentEditor
                                    initialContent={activeDocument.content}
                                    onSave={activeDocument.onSave}
                                    mode="html"
                                    isEditable={isEditing}
                                    includeAlignmentInToolbar={false}
                                    className="min-h-[50vh]"
                                />
                            </div>
                        )}
                    </div>
                </div>
                {isInitialSetup && (
                    <div className="flex-shrink-0 p-4 border-t border-gray-700/50 bg-gray-800 flex flex-col items-center">
                        {setupError && <p className="text-red-400 text-sm mb-2 animate-fade-in-down">{setupError}</p>}
                        <button
                            onClick={handleFinishSetup}
                            className="px-6 py-3 font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Salva e Inizia a Lavorare con Ada
                        </button>
                    </div>
                )}
            </main>
            <ConfirmationModal
                isOpen={isConfirmingEdit}
                onClose={() => setIsConfirmingEdit(false)}
                onConfirm={handleConfirmEdit}
                title="Conferma Modifica"
                confirmText="Sì, abilita modifica"
                confirmButtonClass="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
            >
                Stai per modificare i Documenti Fondanti. Questi documenti sono il nucleo del contesto di Ada. Modifiche improprie potrebbero alterarne il comportamento. Sei sicuro di voler procedere?
            </ConfirmationModal>
        </>
    );
};

export default FoundingDocumentsView;