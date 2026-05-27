import React, { useState, useMemo, memo } from 'react';
import type { Conversation, WeekPlan, BlockDetails, Student, GroupDefinition, AdaAnalysis, BlockStatus, Notebook, LessonMaterial, LessonEvaluation } from '../types';
import LessonPreparationTab from './LessonPreparationTab';
import LessonInCorsoTab from './LessonInCorsoTab';
import { XIcon, BriefcaseIcon, SearchIcon, BookOpenIcon, UsersIcon, ChatBubbleOvalLeftEllipsisIcon, DocumentTextIcon, PlusCircleIcon, TrashIcon, PresentationChartBarIcon, PencilIcon, SparklesIcon, ChevronDownIcon, XCircleIcon, RefreshIcon, LinkIcon, FolderOpenIcon, FolderIcon } from './Icons';
import AttendanceModal from './AttendanceModal';
import GroupCreationModal from './GroupCreationModal';
import Modal from './Modal';
import LessonNotesModal from './LessonNotesModal';
import AttendanceSummary from './AttendanceSummary';
import MarkdownRenderer from './MarkdownRenderer';
import GroupWorkSummary from './GroupWorkSummary';
import type { useMasterContext } from '../hooks/useMasterContext';
import { getExactDateForBlock } from '../utils';
// FIX: Import ConfirmationModal to resolve 'Cannot find name' error.
import ConfirmationModal from './ConfirmationModal';
import ManageNotebookLinksModal from './ManageNotebookLinksModal';

// --- Link Modal ---
const LinkModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, url: string) => void;
}> = ({ isOpen, onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            setTitle('');
            setUrl('');
            setError('');
        }
    }, [isOpen]);
    
    const validateUrl = (inputUrl: string): boolean => {
        try {
            new URL(inputUrl);
            return true;
        } catch (_) {
            return false;
        }
    };

    const handleSave = () => {
        if (!title.trim()) {
            setError('Il titolo è obbligatorio.');
            return;
        }
        if (!url.trim() || !validateUrl(url)) {
            setError('URL non valido. Assicurati di inserire un link completo (es. https://...).');
            return;
        }

        onSave(title, url);
        onClose();
    };

    const footer = (
         <>
            <div></div>
            <div className="space-x-3">
                 <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    Aggiungi Link
                </button>
            </div>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Aggiungi Link Utile" footer={footer}>
            <div className="space-y-4">
                 <div>
                    <label htmlFor="link-title" className="block text-sm font-medium text-gray-300 mb-1">Titolo</label>
                    <input
                        id="link-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Es: Articolo di approfondimento"
                    />
                </div>
                 <div>
                    <label htmlFor="link-url" className="block text-sm font-medium text-gray-300 mb-1">URL</label>
                    <input
                        id="link-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="https://..."
                    />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
        </Modal>
    );
};

// --- CloudLink Modal ---
const CloudLinkModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (url: string) => void;
    initialUrl: string;
}> = ({ isOpen, onClose, onSave, initialUrl }) => {
    const [url, setUrl] = useState('');
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            setUrl(initialUrl || '');
            setError('');
        }
    }, [isOpen, initialUrl]);
    
    const validateUrl = (inputUrl: string): boolean => {
        if (!inputUrl) return true; // Allow clearing
        try {
            new URL(inputUrl);
            return true;
        } catch (_) {
            return false;
        }
    };

    const handleSave = () => {
        if (!validateUrl(url)) {
            setError('URL non valido. Assicurati di inserire un link completo (es. https://...).');
            return;
        }
        onSave(url);
        onClose();
    };

    const footer = (
         <>
            <div></div>
            <div className="space-x-3">
                 <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    Salva Collegamento
                </button>
            </div>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Collega Cartella Materiali" footer={footer}>
            <div className="space-y-4">
                 <p className="text-gray-400 text-sm">
                    Incolla qui l'URL della tua cartella cloud (es. Google Drive, Dropbox) contenente i materiali per questa lezione.
                 </p>
                 <div>
                    <label htmlFor="cloud-url" className="block text-sm font-medium text-gray-300 mb-1">URL Cartella Cloud</label>
                    <input
                        id="cloud-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="https://drive.google.com/..."
                    />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
        </Modal>
    );
};

// --- Artifact Modal ---
const ArtifactModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (artifactText: string) => void;
}> = ({ isOpen, onClose, onSave }) => {
    const [text, setText] = useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (isOpen) {
            setText('');
            const timer = setTimeout(() => inputRef.current?.focus(), 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    const handleSave = () => {
        if (text.trim()) {
            onSave(text.trim());
        }
    };

    const footer = (
        <>
            <div></div>
            <div className="space-x-3">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Salva Artefatto</button>
            </div>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Aggiungi Artefatto" footer={footer}>
            <p className="text-gray-400 text-sm mb-4">Inserisci una breve descrizione dell'artefatto da creare o utilizzare durante la lezione.</p>
            <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                placeholder="Es. Slide di presentazione, Script video..."
                className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500"
            />
        </Modal>
    );
};


// --- IN AULA BLOCK ITEM ---
interface InAulaBlockItemProps {
    block: BlockDetails & { uniqueId: string; convoId: string; blockIndex: number; weekPlan: WeekPlan };
    isSelected: boolean;
    isGeneratingAnalysis: boolean;
    onToggleSelection: () => void;
    onNavigate: () => void;
    onOpenAttendance: () => void;
    onOpenGroups: () => void;
    onOpenArtifactModal: () => void;
    onDeleteArtifact: (artifactIndex: number) => void;
    onOpenLessonNotesModal: () => void;
    onDeleteLessonNotes: () => void;
    onGenerateAnalysis: () => void;
    onUpdateGroups: (groups: GroupDefinition[]) => void;
    onUpdateGroupNotes: (groupIndex: number, notes: string) => void;
    onOpenLinkModal: () => void;
    onDeleteLink: (linkId: string) => void;
    onOpenCloudLinkModal: () => void;
    onScollegaCloudLink: () => void;
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
    masterContext: ReturnType<typeof useMasterContext>;
    onUpdateBlockStatus: (weekNumber: number, blockIndex: number, status: BlockStatus, reason?: string) => void;
    onOpenNotebookModal: () => void;
    notebooks: Notebook[];
    onUnlinkNotebook: (notebookId: string) => void;
}
const InAulaBlockItem: React.FC<InAulaBlockItemProps> = memo(({ block, isSelected, isGeneratingAnalysis, onToggleSelection, onNavigate, onOpenAttendance, onOpenGroups, onOpenArtifactModal, onDeleteArtifact, onOpenLessonNotesModal, onDeleteLessonNotes, onGenerateAnalysis, onUpdateGroups, onUpdateGroupNotes, onOpenLinkModal, onDeleteLink, onOpenCloudLinkModal, onScollegaCloudLink, showToast, masterContext, onUpdateBlockStatus, onOpenNotebookModal, notebooks, onUnlinkNotebook }) => {
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const [isLessonOpen, setIsLessonOpen] = useState(false);
    const [isLessonLocallyCancelled, setIsLessonLocallyCancelled] = useState(false);
    
    const isToday = useMemo(() => {
        const exactDate = getExactDateForBlock(block.weekPlan.dates, block.day, masterContext.teacherProfile);
        if (!exactDate) return false;
        const today = new Date();
        return exactDate.getFullYear() === today.getFullYear() &&
               exactDate.getMonth() === today.getMonth() &&
               exactDate.getDate() === today.getDate();
    }, [block.weekPlan.dates, block.day, masterContext.teacherProfile]);

    const { title, subtitle, isCancelled } = useMemo(() => {
        let title = '';
        let subtitle = '';
        const isCancelled = block.status === 'annullato';

        const exactDate = getExactDateForBlock(block.weekPlan.dates, block.day, masterContext.teacherProfile);
        let dayWithDate = block.day;
        if (exactDate) {
            const dayNum = exactDate.getDate();
            const month = exactDate.toLocaleString('it-IT', { month: 'short' });
            const year = exactDate.getFullYear();
            let fMonth = month.charAt(0).toUpperCase() + month.slice(1);
            if (!fMonth.endsWith('.')) {
                fMonth += '.';
            }
            dayWithDate = `${block.day} ${dayNum} ${fMonth} ${year}`;
        }

        switch (block.status) {
            case 'annullato':
                title = `Blocco ${block.blockIndex + 1}: ${block.objective}`;
                subtitle = dayWithDate;
                break;
            default:
                title = `Blocco ${block.blockIndex + 1}: ${block.objective || 'Obiettivo non definito'}`;
                subtitle = `${dayWithDate} | ${block.module || 'Modulo N/D'}`;
                break;
        }

        return { title, subtitle, isCancelled };
    }, [block, masterContext.teacherProfile]);

    const handleCancelLesson = () => {
        onUpdateBlockStatus(block.weekPlan.weekNumber, block.blockIndex, 'annullato');
        showToast(`Lezione del blocco ${block.blockIndex + 1} annullata.`, 'info');
    };

    const handleRestoreLesson = () => {
        onUpdateBlockStatus(block.weekPlan.weekNumber, block.blockIndex, 'normale');
        showToast(`Lezione del blocco ${block.blockIndex + 1} ripristinata.`, 'success');
    };
    
    const showAsCancelled = isCancelled || isLessonLocallyCancelled;

    return (
        <details className={`group/block bg-gray-800/60 rounded-lg border ${isSelected ? 'border-blue-500 ring-2 ring-blue-500/50' : isCancelled ? 'border-red-500/30' : 'border-gray-700/50'} overflow-hidden`}>
            <summary className="list-none [&::-webkit-details-marker]:hidden p-4 flex items-start gap-4 cursor-pointer hover:bg-gray-700/30 transition-colors">
                <div className="flex-shrink-0 pt-1">
                    <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggleSelection}
                        onClick={(e) => e.stopPropagation()}
                        className="h-5 w-5 rounded border-gray-500 text-blue-500 focus:ring-blue-600 bg-gray-700"
                        aria-label={`Seleziona blocco ${block.blockIndex + 1}`}
                    />
                </div>
                <div className="flex-grow">
                     <div className="flex items-center gap-3">
                        <p className={`font-semibold ${isCancelled ? 'text-gray-500 line-through' : 'text-white'}`} title={title}>{title}</p>
                        {isCancelled && <span className="px-2 py-0.5 text-xs font-semibold text-red-300 bg-red-500/20 rounded-full">ANNULLATO</span>}
                    </div>
                    <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
                </div>
                <ChevronDownIcon className="h-6 w-6 text-gray-400 transition-transform duration-300 group-open/block:rotate-180 flex-shrink-0" />
            </summary>
            <div className="px-4 pb-4 border-t border-gray-700/50">
                 {isToday && block.status === 'normale' && !isLessonLocallyCancelled && (
                    <div className="my-4">
                        <button onClick={handleCancelLesson} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-300 bg-red-900/50 rounded-md hover:bg-red-900/80 transition-colors border border-red-500/50">
                            <XCircleIcon className="h-4 w-4"/>
                            Annulla Lezione (Permanente)
                        </button>
                    </div>
                )}
                {block.status === 'annullato' && (
                    <div className="my-4">
                        <button onClick={handleRestoreLesson} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-green-300 bg-green-900/50 rounded-md hover:bg-green-900/80 transition-colors border border-green-500/50">
                            <RefreshIcon className="h-4 w-4"/>
                            Ripristina Lezione
                        </button>
                    </div>
                )}
                <div className="space-y-6 flex-grow pt-4">

                    {/* --- SEZIONE PREPARAZIONE --- */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Preparazione e Risorse</h4>
                        
                        <div className="flex flex-wrap items-center gap-2 p-2 bg-gray-700/30 rounded-md">
                            <button onClick={onNavigate} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"><BookOpenIcon className="h-4 w-4"/>Visualizza Contenuto</button>
                            <button onClick={onOpenArtifactModal} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors"><PlusCircleIcon className="h-4 w-4"/>Aggiungi Artefatto</button>
                            <button onClick={onOpenLinkModal} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors"><LinkIcon className="h-4 w-4"/>Aggiungi Link</button>
                            <button onClick={onOpenCloudLinkModal} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors"><FolderIcon className="h-4 w-4"/>Collega Risorse</button>
                            <button onClick={onOpenNotebookModal} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors"><BookOpenIcon className="h-4 w-4"/>Gestisci Notebook</button>
                        </div>
                        
                        <div className="pt-3 space-y-4">
                            {(block.artifacts && block.artifacts.length > 0) && (
                                <div>
                                    <h5 className="text-sm font-semibold text-gray-300 mb-2">Artefatti da Creare</h5>
                                    <ul className="space-y-1.5">
                                        {block.artifacts.map((artifact, index) => (
                                            <li key={`artifact-${artifact}-${index}`} className="group flex items-center justify-between text-sm text-gray-300 bg-gray-700/50 px-2 py-1 rounded-md">
                                                <span className="flex items-center gap-2"><DocumentTextIcon className="h-4 w-4 text-gray-400"/>{artifact}</span>
                                                <button onClick={() => onDeleteArtifact(index)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300"><TrashIcon className="h-4 w-4"/></button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {(block.usefulLinks && block.usefulLinks.length > 0) && (
                                <div>
                                    <h5 className="text-sm font-semibold text-gray-300 mb-2">Link Utili</h5>
                                    <ul className="space-y-1.5">
                                        {block.usefulLinks.map(link => (
                                            <li key={link.id} className="group flex items-center justify-between text-sm text-gray-300 bg-gray-700/50 px-2 py-1 rounded-md">
                                                <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:underline flex-grow overflow-hidden">
                                                    <LinkIcon className="h-4 w-4 text-gray-400 flex-shrink-0"/>
                                                    <span className="truncate" title={link.url}>{link.title}</span>
                                                </a>
                                                <button onClick={() => onDeleteLink(link.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 ml-2"><TrashIcon className="h-4 w-4"/></button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                             {block.linkedNotebookIds && block.linkedNotebookIds.length > 0 && (
                                <div>
                                    <h5 className="text-sm font-semibold text-gray-300 mb-2">Notebook Collegati</h5>
                                    <ul className="space-y-1.5">
                                        {block.linkedNotebookIds.map(notebookId => {
                                            const notebook = notebooks.find(n => n.id === notebookId);
                                            if (!notebook) return null;
                                            return (
                                                <li key={notebook.id} className="group flex items-center justify-between text-sm text-gray-300 bg-gray-700/50 px-2 py-1 rounded-md">
                                                    <a href={notebook.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-400 hover:underline flex-grow overflow-hidden">
                                                        <BookOpenIcon className="h-4 w-4 text-gray-400 flex-shrink-0"/>
                                                        <span className="truncate" title={notebook.url}>{notebook.title}</span>
                                                    </a>
                                                    <button onClick={() => onUnlinkNotebook(notebook.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 ml-2"><TrashIcon className="h-4 w-4"/></button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </div>
                            )}

                            {block.materialsCloudLink && (
                                <div>
                                    <h5 className="text-sm font-semibold text-gray-300 mb-2">Cartella Materiali</h5>
                                    <div className="p-3 bg-gray-700/30 rounded-lg flex items-center justify-between text-sm">
                                        <a href={block.materialsCloudLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 min-w-0 text-amber-400 hover:underline">
                                            <FolderIcon className="h-5 w-5 flex-shrink-0" />
                                            <span className="font-semibold truncate" title={block.materialsCloudLink}>{block.materialsCloudLink}</span>
                                        </a>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <a href={block.materialsCloudLink} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-full text-gray-300 hover:bg-gray-600" title="Apri cartella"><FolderOpenIcon className="h-4 w-4" /></a>
                                            <button onClick={onScollegaCloudLink} className="p-1.5 rounded-full text-gray-300 hover:bg-red-500/50 hover:text-red-300" title="Scollega cartella"><TrashIcon className="h-4 w-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* --- SEZIONE DURANTE E DOPO --- */}
                    <div className="space-y-4 pt-4 border-t border-gray-700/50">
                        <div className="flex items-center justify-between text-left px-3 py-2 rounded-md bg-gray-700/50">
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                {showAsCancelled ? 'LEZIONE ANNULLATA' : 'Durante e Dopo la Lezione'}
                            </h4>
                            <div className="flex items-center gap-3">
                                {!isCancelled && (
                                     <button onClick={() => setIsLessonLocallyCancelled(p => !p)} className="text-xs text-gray-400 hover:text-white">
                                        {isLessonLocallyCancelled ? 'Ripristina Lezione' : 'Lezione annullata'}
                                    </button>
                                )}
                                <button
                                    onClick={() => setIsLessonOpen(p => !p)}
                                    className="disabled:cursor-not-allowed"
                                    disabled={showAsCancelled}
                                >
                                    {!showAsCancelled && (
                                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ${isLessonOpen ? 'bg-red-500 text-white' : 'bg-emerald-600 text-white'}`}>
                                            {isLessonOpen ? 'Chiudi Lezione' : 'Apri Lezione'}
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>

                        <div className={`space-y-4 ${!isLessonOpen || showAsCancelled ? 'hidden' : 'block'}`}>
                            <div className="flex flex-wrap items-center gap-2">
                                <button 
                                    onClick={onOpenAttendance} 
                                    disabled={!isLessonOpen}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <UsersIcon className="h-4 w-4"/>Registra Presenze
                                </button>
                                <button 
                                    onClick={onOpenGroups} 
                                    disabled={!isLessonOpen || !block.presentStudentIds || block.presentStudentIds.length === 0}
                                    title={!block.presentStudentIds || block.presentStudentIds.length === 0 ? "Registra le presenze per abilitare la creazione dei gruppi" : "Crea Gruppi di lavoro"}
                                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <UsersIcon className="h-4 w-4"/>Crea Gruppi
                                </button>
                            </div>
                            {block.presentStudentIds && (
                                <AttendanceSummary
                                    presentStudentIds={block.presentStudentIds}
                                    allStudents={block.weekPlan.students}
                                />
                            )}

                            {block.allocations?.data.groups && block.allocations.data.groups.length > 0 && (
                                <GroupWorkSummary 
                                    groups={block.allocations.data.groups}
                                    allStudents={block.weekPlan.students}
                                    isEditable={isLessonOpen}
                                    onUpdateGroups={onUpdateGroups}
                                    onUpdateGroupNotes={onUpdateGroupNotes}
                                />
                            )}

                            <div>
                                {!block.lessonNotes ? (
                                    <button 
                                        onClick={onOpenLessonNotesModal} 
                                        disabled={!isLessonOpen}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-200 bg-gray-600 rounded-md hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <PencilIcon className="h-4 w-4"/>+ Aggiungi Note sulla Lezione
                                    </button>
                                ) : (
                                    <div>
                                        <button
                                            onClick={() => setIsNotesOpen(!isNotesOpen)}
                                            className="w-full flex items-center justify-between text-left"
                                            aria-expanded={isNotesOpen}
                                        >
                                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                                <PencilIcon className="h-4 w-4 text-gray-400" />
                                                Note e Osservazioni sulla Lezione
                                            </h4>
                                            <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isNotesOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {isNotesOpen && (
                                            <div className="mt-3 pl-6 animate-fade-in-down">
                                                <div className="space-y-3">
                                                    <div className="prose prose-sm max-w-none text-gray-300 bg-gray-700/50 p-3 rounded-md whitespace-pre-wrap">{block.lessonNotes}</div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={onOpenLessonNotesModal} disabled={!isLessonOpen} className="text-xs text-blue-400 hover:underline disabled:text-gray-500 disabled:cursor-not-allowed disabled:no-underline">Modifica Note</button>
                                                        <button onClick={onDeleteLessonNotes} disabled={!isLessonOpen} className="text-xs text-red-400 hover:underline disabled:text-gray-500 disabled:cursor-not-allowed disabled:no-underline">Cancella Note</button>
                                                    </div>
                                                    
                                                    <div className="pt-2">
                                                        <button 
                                                            onClick={onGenerateAnalysis} 
                                                            disabled={isGeneratingAnalysis || !isLessonOpen} 
                                                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-60"
                                                        >
                                                            <SparklesIcon className="h-4 w-4"/>
                                                            {isGeneratingAnalysis ? 'Analisi in corso...' : "Genera Analisi dell'Aula"}
                                                        </button>
                                                        {block.adaAnalysis && (
                                                            <div className="mt-3 bg-gray-900/50 p-3 rounded-lg border border-gray-700 animate-fade-in-down">
                                                                <h5 className="font-semibold text-purple-300 mb-2">Sintesi Analitica di Ada</h5>
                                                                <ul className="space-y-1.5 text-sm">
                                                                    <li><strong>Performance Generale Stimata:</strong> {block.adaAnalysis.performance}</li>
                                                                    <li><strong>Studentesse Evidenziate (Positivo):</strong> {block.adaAnalysis.highlightedStudents.join(', ') || 'N/D'}</li>
                                                                    <li><strong>Aree di Difficoltà Rilevate:</strong> {block.adaAnalysis.difficulties.join(', ') || 'Nessuna'}</li>
                                                                    <li className="pt-1"><strong>Suggerimento Strategico:</strong> <span className="text-gray-300 italic">{block.adaAnalysis.suggestion}</span></li>
                                                                </ul>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </details>
    );
});


export type InAulaTab = 'preparazione' | 'in_corso' | 'archivio';

// --- IN AULA VIEW (MAIN COMPONENT) ---
interface InAulaViewProps {
    conversations: Conversation[];
    onClose: () => void;
    students: Student[];
    onNavigateToBlock: (convoId: string, blockIndex: number) => void;
    onFormatMultipleBlocks: (blockUniqueIds: Set<string>) => void;
    onRecordAttendance: (convoId: string, blockIndex: number, presentStudentIds: string[]) => void;
    onSaveGroups: (convoId: string, blockIndex: number, groups: GroupDefinition[]) => void;
    onAddArtifact: (convoId: string, blockIndex: number, artifactText: string) => void;
    onDeleteArtifact: (convoId: string, blockIndex: number, artifactIndex: number) => void;
    onOpenLessonNotesModal: (info: { convoId: string; blockIndex: number; initialNotes: string; }) => void;
    onDeleteLessonNotes: (convoId: string, blockIndex: number) => void;
    onGenerateAnalysis: (convoId: string, blockIndex: number) => void;
    analysisLoadingBlockId: string | null;
    onUpdateGroups: (convoId: string, blockIndex: number, groups: GroupDefinition[]) => void;
    onUpdateGroupNotes: (convoId: string, blockIndex: number, groupIndex: number, notes: string) => void;
    onAddLink: (convoId: string, blockIndex: number, title: string, url: string) => void;
    onDeleteLink: (convoId: string, blockIndex: number, linkId: string) => void;
    onUpdateCloudLink: (convoId: string, blockIndex: number, url: string) => void;
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
    masterContext: ReturnType<typeof useMasterContext>;
    onUpdateBlockStatus: (weekNumber: number, blockIndex: number, status: BlockStatus, reason?: string) => void;
    notebooks: Notebook[];
    onAddNotebook: (title: string, url: string, notes: string) => Promise<Notebook | undefined>;
    onUpdateLinkedNotebooks: (convoId: string, blockIndex: number, notebookIds: string[]) => void;
    onAvviaLezione?: (convoId: string, blockIndex: number) => void;
    onChiudiLezione?: (convoId: string, blockIndex: number) => void;
    onAddMaterial: (convoId: string, blockIndex: number, material: Omit<LessonMaterial, 'id' | 'addedAt'>) => void;
    onRemoveMaterial: (convoId: string, blockIndex: number, materialId: string) => void;
    onSetAttendance: (convoId: string, blockIndex: number, presentIds: string[], lateIds: string[]) => void;
    onAddEvaluation: (convoId: string, blockIndex: number, evaluation: Omit<LessonEvaluation, 'id' | 'date'>) => void;
    onRemoveEvaluation: (convoId: string, blockIndex: number, evaluationId: string) => void;
    onAutoSaveNotes: (convoId: string, blockIndex: number, notes: string) => void;
    onGenerateLessonNoteAnalysis: (convoId: string, blockIndex: number) => Promise<void>;
    onSaveClassroomUrl: (convoId: string, blockIndex: number, url: string) => void;
}

const InAulaView: React.FC<InAulaViewProps> = ({ conversations, onClose, students, onNavigateToBlock, onFormatMultipleBlocks, onRecordAttendance, onSaveGroups, onAddArtifact, onDeleteArtifact, onOpenLessonNotesModal, onDeleteLessonNotes, onGenerateAnalysis, analysisLoadingBlockId, onUpdateGroups, onUpdateGroupNotes, onAddLink, onDeleteLink, onUpdateCloudLink, showToast, masterContext, onUpdateBlockStatus, notebooks, onAddNotebook, onUpdateLinkedNotebooks, onAvviaLezione, onChiudiLezione, onAddMaterial, onRemoveMaterial, onSetAttendance, onAddEvaluation, onRemoveEvaluation, onAutoSaveNotes, onGenerateLessonNoteAnalysis, onSaveClassroomUrl }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedWeek, setSelectedWeek] = useState('all');
    const [selectedModule, setSelectedModule] = useState('all');
    const [selectedBlockIds, setSelectedBlockIds] = useState(new Set<string>());
    
    // Modal states
    const [attendanceModalBlock, setAttendanceModalBlock] = useState<(BlockDetails & { convoId: string; blockIndex: number; weekPlan: WeekPlan }) | null>(null);
    const [groupModalBlock, setGroupModalBlock] = useState<(BlockDetails & { convoId: string; blockIndex: number; weekPlan: WeekPlan }) | null>(null);
    const [artifactModalInfo, setArtifactModalInfo] = useState<{ convoId: string, blockIndex: number } | null>(null);
    const [linkModalInfo, setLinkModalInfo] = useState<{ convoId: string; blockIndex: number } | null>(null);
    const [cloudLinkModalInfo, setCloudLinkModalInfo] = useState<{ convoId: string; blockIndex: number; initialUrl: string } | null>(null);
    const [unlinkConfirmInfo, setUnlinkConfirmInfo] = useState<{ convoId: string; blockIndex: number } | null>(null);
    const [notebookModalInfo, setNotebookModalInfo] = useState<{ convoId: string; blockIndex: number } | null>(null);

    const hasActiveLessons = useMemo(
        () => conversations.some(c => c.weekPlan?.blocks.some(b => b.lessonState === 'in_corso')),
        [conversations]
    );

    const [activeTab, setActiveTab] = useState<InAulaTab>(() => {
        const hasInCorso = conversations.some(c => c.weekPlan?.blocks.some(b => b.lessonState === 'in_corso'));
        return hasInCorso ? 'in_corso' : 'archivio';
    });

    const { archivedWeeks, availableWeeks, availableModules } = useMemo(() => {
        const planningConvos = conversations.filter(c => c.weekPlan);
        
        const allBlocks = planningConvos.flatMap(convo => {
            // Defensive guard against corrupted localStorage data
            if (!convo.weekPlan || !Array.isArray(convo.weekPlan.blocks)) {
                return []; // Return empty array to prevent crash
            }
            return convo.weekPlan.blocks
                .map((block, index) => ({ 
                    ...block, 
                    uniqueId: `${convo.id}-${index}`,
                    weekPlan: convo.weekPlan!, 
                    convoId: convo.id, 
                    blockIndex: index 
                }))
                .filter(block => (block.contentBlocks && block.contentBlocks.length > 0) || block.status === 'saltato' || block.status === 'annullato')
        }).filter(block => block.status !== 'saltato');

        const filteredBlocks = allBlocks.filter(block => {
            const query = searchQuery.toLowerCase();
            const fullContent = block.contentBlocks?.map(cb => cb.content).join(' ') || '';

            const searchMatch = !query || 
                (block.objective || '').toLowerCase().includes(query) ||
                fullContent.toLowerCase().includes(query) ||
                (block.module || '').toLowerCase().includes(query) ||
                `blocco ${block.blockIndex + 1}`.includes(query);

            const weekMatch = selectedWeek === 'all' || block.weekPlan.weekNumber === parseInt(selectedWeek);
            const moduleMatch = selectedModule === 'all' || block.module === selectedModule;
            
            return searchMatch && weekMatch && moduleMatch;
        });

        const groupedByWeek = filteredBlocks.reduce((acc: Record<number, { weekPlan: WeekPlan; blocks: (typeof allBlocks)[number][] }>, block) => {
            const weekNum = block.weekPlan.weekNumber;
            if (!acc[weekNum]) {
                acc[weekNum] = {
                    weekPlan: block.weekPlan,
                    blocks: []
                };
            }
            acc[weekNum].blocks.push(block);
            return acc;
        }, {});
        
        const sortedWeeks = Object.values(groupedByWeek).sort((a: { weekPlan: WeekPlan }, b: { weekPlan: WeekPlan }) => b.weekPlan.weekNumber - a.weekPlan.weekNumber);

        const uniqueWeeks = [...new Set(allBlocks.map(b => b.weekPlan.weekNumber))].sort((a: number, b: number) => a - b);
        const uniqueModules = [...new Set(allBlocks.map(b => b.module).filter(Boolean))] as string[];

        return { archivedWeeks: sortedWeeks, availableWeeks: uniqueWeeks, availableModules: uniqueModules };
    }, [conversations, searchQuery, selectedWeek, selectedModule]);

    const handleToggleSelection = (id: string) => {
        setSelectedBlockIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) {
                newSet.delete(id);
            } else {
                newSet.add(id);
            }
            return newSet;
        });
    };
    
    const handleSelectAll = () => {
        if (selectedBlockIds.size === archivedWeeks.flatMap(w => w.blocks).length) {
            setSelectedBlockIds(new Set());
        } else {
            setSelectedBlockIds(new Set(archivedWeeks.flatMap(w => w.blocks.map(b => b.uniqueId))));
        }
    };

    const activeBlockForNotebookModal = useMemo(() => {
        if (!notebookModalInfo) return null;
        for (const week of archivedWeeks) {
            const block = week.blocks.find(b => b.convoId === notebookModalInfo.convoId && b.blockIndex === notebookModalInfo.blockIndex);
            if (block) return block;
        }
        return null;
    }, [notebookModalInfo, archivedWeeks]);
    

    return (
        <>
            <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
                {/* Header */}
                <div className="flex-shrink-0 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm">
                    <div className="flex items-center justify-between p-3.5 pl-6">
                        <div className="flex items-center gap-3">
                            <BriefcaseIcon className={`h-6 w-6 ${activeTab === 'in_corso' ? 'text-emerald-400' : 'text-purple-400'}`} />
                            <h2 className="text-lg font-semibold">In Aula</h2>
                            {hasActiveLessons && activeTab !== 'in_corso' && (
                                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
                            )}
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" aria-label="Chiudi">
                            <XIcon className="h-5 w-5" />
                        </button>
                    </div>
                    <div className="flex items-center gap-1 px-6 pb-2">
                        {(['preparazione', 'in_corso', 'archivio'] as InAulaTab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                    activeTab === tab
                                        ? 'bg-gray-700/70 text-white'
                                        : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
                                }`}
                            >
                                {tab === 'preparazione' ? 'Preparazione' : tab === 'in_corso' ? 'In Corso' : 'Archivio'}
                                {tab === 'in_corso' && hasActiveLessons && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── PREPARAZIONE ──────────────────────────────────────────── */}
                {activeTab === 'preparazione' && (
                    <LessonPreparationTab
                        conversations={conversations}
                        students={students}
                        onAddMaterial={onAddMaterial}
                        onRemoveMaterial={onRemoveMaterial}
                        onSaveGroups={onSaveGroups}
                        onSaveClassroomUrl={onSaveClassroomUrl}
                        masterContext={masterContext}
                        showToast={showToast}
                    />
                )}

                {/* ── IN CORSO: lezione attiva ───────────────────────────────── */}
                {activeTab === 'in_corso' && (
                  <LessonInCorsoTab
                    conversations={conversations}
                    students={students}
                    onSetAttendance={onSetAttendance}
                    onAddEvaluation={onAddEvaluation}
                    onRemoveEvaluation={onRemoveEvaluation}
                    onAutoSaveNotes={onAutoSaveNotes}
                    onGenerateLessonNoteAnalysis={onGenerateLessonNoteAnalysis}
                    analysisLoadingBlockId={analysisLoadingBlockId}
                    onAddMaterial={onAddMaterial}
                    onChiudiLezione={onChiudiLezione}
                    showToast={showToast}
                  />
                )}

                {/* ── ARCHIVIO: vista completa ──────────────────────────────── */}
                {activeTab === 'archivio' && <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="max-w-6xl mx-auto space-y-6">
                        {/* Filters and Actions */}
                        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700/50 flex flex-col md:flex-row items-center gap-4">
                            <div className="relative flex-grow w-full md:w-auto">
                                <SearchIcon className="h-5 w-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
                                <input 
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Cerca per obiettivo, modulo, contenuto..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="w-full md:w-auto bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="all">Tutte le settimane</option>
                                {availableWeeks.map(weekNum => <option key={weekNum} value={weekNum}>Settimana {weekNum}</option>)}
                            </select>
                             <select value={selectedModule} onChange={(e) => setSelectedModule(e.target.value)} className="w-full md:w-auto bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="all">Tutti i moduli</option>
                                {availableModules.map(modName => <option key={modName} value={modName}>{modName}</option>)}
                            </select>
                            <div className="h-px md:h-6 w-full md:w-px bg-gray-700"></div>
                            <button onClick={() => onFormatMultipleBlocks(selectedBlockIds)} disabled={selectedBlockIds.size === 0} className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 disabled:opacity-50 transition-colors">
                                <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5" />
                                Atelier Creativo ({selectedBlockIds.size})
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="select-all-in-aula"
                                checked={selectedBlockIds.size > 0 && selectedBlockIds.size === archivedWeeks.flatMap(w => w.blocks).length}
                                onChange={handleSelectAll}
                                className="h-4 w-4 rounded border-gray-500 text-blue-500 focus:ring-blue-600 bg-gray-700"
                            />
                             <label htmlFor="select-all-in-aula" className="text-sm text-gray-300">Seleziona tutto</label>
                        </div>

                        {archivedWeeks.length > 0 ? (
                            archivedWeeks.map((week, index) => (
                                <details key={week.weekPlan.weekNumber} className="group/week bg-gray-800 rounded-lg overflow-hidden border border-gray-700/50" open={index === 0}>
                                    <summary className="list-none [&::-webkit-details-marker]:hidden p-4 flex items-center justify-between cursor-pointer hover:bg-gray-700/50 bg-gray-900/50">
                                        <div>
                                            <h3 className="font-bold text-xl text-white">Settimana {week.weekPlan.weekNumber} <span className="text-lg font-normal text-gray-400">({week.weekPlan.dates})</span></h3>
                                            <p className="text-sm text-gray-400 mt-1">{week.weekPlan.theme}</p>
                                        </div>
                                        <ChevronDownIcon className="h-6 w-6 text-gray-400 transition-transform duration-300 group-open/week:rotate-180" />
                                    </summary>
                                    <div className="p-4 space-y-4">
                                        {week.blocks.map(block => (
                                            <div key={block.uniqueId} className="relative">
                                              {/* Pulsante Avvia — visibile solo se il blocco non è archiviato */}
                                              {onAvviaLezione && block.lessonState !== 'archiviata' && (
                                                <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
                                                  {block.lessonState === 'in_corso' ? (
                                                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-700/40 text-emerald-400 text-xs font-medium">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                                      In Corso
                                                    </span>
                                                  ) : (
                                                    <button
                                                      onClick={() => onAvviaLezione(block.convoId, block.blockIndex)}
                                                      className="px-3 py-1.5 rounded-lg bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors shadow-lg"
                                                    >
                                                      ▶ Avvia Lezione
                                                    </button>
                                                  )}
                                                </div>
                                              )}
                                            <InAulaBlockItem
                                                block={block}
                                                isSelected={selectedBlockIds.has(block.uniqueId)}
                                                isGeneratingAnalysis={analysisLoadingBlockId === `${block.convoId}-${block.blockIndex}`}
                                                onToggleSelection={() => handleToggleSelection(block.uniqueId)}
                                                onNavigate={() => onNavigateToBlock(block.convoId, block.blockIndex)}
                                                onOpenAttendance={() => setAttendanceModalBlock(block)}
                                                onOpenGroups={() => setGroupModalBlock(block)}
                                                onOpenArtifactModal={() => setArtifactModalInfo({ convoId: block.convoId, blockIndex: block.blockIndex })}
                                                onDeleteArtifact={(artifactIndex) => onDeleteArtifact(block.convoId, block.blockIndex, artifactIndex)}
                                                onOpenLessonNotesModal={() => onOpenLessonNotesModal({ convoId: block.convoId, blockIndex: block.blockIndex, initialNotes: block.lessonNotes || '' })}
                                                onDeleteLessonNotes={() => onDeleteLessonNotes(block.convoId, block.blockIndex)}
                                                onGenerateAnalysis={() => onGenerateAnalysis(block.convoId, block.blockIndex)}
                                                onUpdateGroups={(groups) => onUpdateGroups(block.convoId, block.blockIndex, groups)}
                                                onUpdateGroupNotes={(groupIndex, notes) => onUpdateGroupNotes(block.convoId, block.blockIndex, groupIndex, notes)}
                                                onOpenLinkModal={() => setLinkModalInfo({ convoId: block.convoId, blockIndex: block.blockIndex })}
                                                onDeleteLink={(linkId) => onDeleteLink(block.convoId, block.blockIndex, linkId)}
                                                onOpenCloudLinkModal={() => setCloudLinkModalInfo({ convoId: block.convoId, blockIndex: block.blockIndex, initialUrl: block.materialsCloudLink || '' })}
                                                onScollegaCloudLink={() => setUnlinkConfirmInfo({ convoId: block.convoId, blockIndex: block.blockIndex })}
                                                showToast={showToast}
                                                masterContext={masterContext}
                                                onUpdateBlockStatus={onUpdateBlockStatus}
                                                onOpenNotebookModal={() => setNotebookModalInfo({ convoId: block.convoId, blockIndex: block.blockIndex })}
                                                notebooks={notebooks}
                                                onUnlinkNotebook={(notebookId) => {
                                                    const currentLinks = block.linkedNotebookIds || [];
                                                    const newLinks = currentLinks.filter(id => id !== notebookId);
                                                    onUpdateLinkedNotebooks(block.convoId, block.blockIndex, newLinks);
                                                }}
                                            />
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            ))
                        ) : (
                            <div className="text-center py-20 px-4 bg-gray-800 rounded-lg border border-gray-700/50">
                                <BriefcaseIcon className="h-16 w-16 mx-auto text-gray-600" />
                                <p className="mt-4 text-gray-300 font-semibold">Nessun blocco trovato</p>
                                <p className="text-gray-400 text-sm mt-1">
                                    {searchQuery ? "Prova a modificare i filtri di ricerca." : "Completa la progettazione di alcuni blocchi per vederli apparire qui."}
                                </p>
                            </div>
                        )}
                    </div>
                </div>}
            </main>

            {/* --- MODALS --- */}
            {attendanceModalBlock && (
                <AttendanceModal
                    isOpen={!!attendanceModalBlock}
                    onClose={() => setAttendanceModalBlock(null)}
                    students={attendanceModalBlock.weekPlan.students}
                    onSubmit={(presentStudentIds) => {
                        onRecordAttendance(attendanceModalBlock.convoId, attendanceModalBlock.blockIndex, presentStudentIds);
                        setAttendanceModalBlock(null);
                    }}
                    blockTitle={`Blocco ${attendanceModalBlock.blockIndex + 1}`}
                />
            )}
            
            {groupModalBlock && (
                <GroupCreationModal
                    isOpen={!!groupModalBlock}
                    onClose={() => setGroupModalBlock(null)}
                    block={groupModalBlock}
                    studentsInWeek={students.filter(s => (groupModalBlock.presentStudentIds || []).includes(s.id))}
                    onSaveGroups={(groups) => {
                        onSaveGroups(groupModalBlock.convoId, groupModalBlock.blockIndex, groups);
                        setGroupModalBlock(null);
                    }}
                />
            )}

            {artifactModalInfo && (
                 <ArtifactModal
                    isOpen={!!artifactModalInfo}
                    onClose={() => setArtifactModalInfo(null)}
                    onSave={(text) => {
                        onAddArtifact(artifactModalInfo.convoId, artifactModalInfo.blockIndex, text);
                        setArtifactModalInfo(null);
                    }}
                />
            )}

            {linkModalInfo && (
                <LinkModal
                    isOpen={!!linkModalInfo}
                    onClose={() => setLinkModalInfo(null)}
                    onSave={(title, url) => {
                        onAddLink(linkModalInfo.convoId, linkModalInfo.blockIndex, title, url);
                        setLinkModalInfo(null);
                    }}
                />
            )}

            {cloudLinkModalInfo && (
                <CloudLinkModal
                    isOpen={!!cloudLinkModalInfo}
                    onClose={() => setCloudLinkModalInfo(null)}
                    initialUrl={cloudLinkModalInfo.initialUrl}
                    onSave={(url) => {
                        onUpdateCloudLink(cloudLinkModalInfo.convoId, cloudLinkModalInfo.blockIndex, url);
                        setCloudLinkModalInfo(null);
                    }}
                />
            )}

            {unlinkConfirmInfo && (
                <ConfirmationModal
                    isOpen={!!unlinkConfirmInfo}
                    onClose={() => setUnlinkConfirmInfo(null)}
                    onConfirm={() => {
                        onUpdateCloudLink(unlinkConfirmInfo.convoId, unlinkConfirmInfo.blockIndex, '');
                        setUnlinkConfirmInfo(null);
                    }}
                    title="Conferma Scollegamento"
                >
                    Sei sicuro di voler rimuovere il collegamento alla cartella dei materiali per questo blocco?
                </ConfirmationModal>
            )}

            {activeBlockForNotebookModal && (
                <ManageNotebookLinksModal
                    isOpen={!!notebookModalInfo}
                    onClose={() => setNotebookModalInfo(null)}
                    allNotebooks={notebooks}
                    initiallyLinkedIds={activeBlockForNotebookModal.linkedNotebookIds || []}
                    onSaveLinks={(notebookIds) => onUpdateLinkedNotebooks(activeBlockForNotebookModal.convoId, activeBlockForNotebookModal.blockIndex, notebookIds)}
                    onAddNotebook={onAddNotebook}
                />
            )}
        </>
    );
};

export default InAulaView;
