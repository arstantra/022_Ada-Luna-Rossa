import React, { useState, useMemo, memo } from 'react';
import type { Notebook } from '../types';
import { XIcon, PlusCircleIcon, DotsVerticalIcon, BookOpenIcon } from './Icons';
import ConfirmationModal from './ConfirmationModal';

interface NotebookCardProps {
    notebook: Notebook;
    onAccess: (notebook: Notebook) => void;
    onEdit: (notebook: Notebook) => void;
    onManageNotes: (notebook: Notebook) => void;
    onRemove: (notebook: Notebook) => void;
}

const NotebookCard: React.FC<NotebookCardProps> = memo(({ notebook, onAccess, onEdit, onManageNotes, onRemove }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuRef]);
    
    const handleAccess = () => {
        onAccess(notebook);
        window.open(notebook.url, '_blank', 'noopener,noreferrer');
    };

    const notesExcerpt = notebook.notes ? notebook.notes.substring(0, 100) + (notebook.notes.length > 100 ? '...' : '') : '';
    const dateToShow = notebook.lastAccessed 
        ? `Ultimo accesso: ${new Date(notebook.lastAccessed).toLocaleDateString('it-IT')}`
        : `Aggiunto il: ${new Date(notebook.dateAdded).toLocaleDateString('it-IT')}`;

    return (
        <div className="group relative flex flex-col bg-gray-700/60 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
            <div onClick={handleAccess} className="flex-grow p-4 cursor-pointer">
                <div className="flex items-start justify-between">
                     <BookOpenIcon className="h-6 w-6 text-blue-400 flex-shrink-0" />
                </div>
                <h3 className="mt-3 font-bold text-white truncate">{notebook.title}</h3>
                <p className="text-xs text-gray-400 mt-1">{dateToShow}</p>
                {notesExcerpt && <p className="text-sm text-gray-300 mt-2 h-12 overflow-hidden">{notesExcerpt}</p>}
            </div>
             <div ref={menuRef} className="absolute top-2 right-2">
                <button onClick={() => setIsMenuOpen(o => !o)} className="p-1.5 rounded-full text-gray-400 hover:bg-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DotsVerticalIcon className="h-5 w-5" />
                </button>
                {isMenuOpen && (
                    <div className="absolute right-0 mt-1 w-48 bg-gray-800 border border-gray-700/50 rounded-lg shadow-2xl z-20 p-1.5 animate-fade-in-down">
                        <button onClick={() => { onEdit(notebook); setIsMenuOpen(false); }} className="w-full text-left p-2 rounded-md text-sm text-gray-200 hover:bg-gray-700">✏️ Modifica</button>
                        <button onClick={() => { onManageNotes(notebook); setIsMenuOpen(false); }} className="w-full text-left p-2 rounded-md text-sm text-gray-200 hover:bg-gray-700">📝 Gestisci Note</button>
                        <button onClick={() => { onRemove(notebook); setIsMenuOpen(false); }} className="w-full text-left p-2 rounded-md text-sm text-red-400 hover:bg-red-500/10">🗑️ Rimuovi</button>
                    </div>
                )}
            </div>
        </div>
    );
});


interface NotebookLMViewProps {
    notebooks: Notebook[];
    onClose: () => void;
    onAddNotebook: () => void;
    onEditNotebook: (notebook: Notebook) => void;
    onRemoveNotebook: (id: string) => void;
    onAccessNotebook: (id: string) => void;
    onManageNotes: (notebook: Notebook) => void;
}

const NotebookLMView: React.FC<NotebookLMViewProps> = ({ notebooks, onClose, onAddNotebook, onEditNotebook, onRemoveNotebook, onAccessNotebook, onManageNotes }) => {
    const [notebookToRemove, setNotebookToRemove] = useState<Notebook | null>(null);

    const sortedNotebooks = useMemo(() => {
        return [...notebooks].sort((a, b) => {
            if (a.lastAccessed && b.lastAccessed) return new Date(b.lastAccessed).getTime() - new Date(a.lastAccessed).getTime();
            if (a.lastAccessed) return -1;
            if (b.lastAccessed) return 1;
            return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        });
    }, [notebooks]);

    const handleConfirmRemove = () => {
        if (notebookToRemove) {
            onRemoveNotebook(notebookToRemove.id);
            setNotebookToRemove(null);
        }
    };
    
    return (
        <main className="flex-1 flex flex-col bg-[#0D1117] overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-6 pt-3.5 pb-2 border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <BookOpenIcon className="h-5 w-5 text-gray-400" />
                    <div>
                        <h2 className="text-base font-display font-semibold text-white">I Tuoi NotebookLM</h2>
                        <p className="text-xs text-gray-500">Gestisci i collegamenti ai tuoi notebook didattici</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                     <button onClick={onAddNotebook} className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                        + Aggiungi da Link
                    </button>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Chiudi">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {/* Create New Card */}
                    <a href="https://notebooklm.google.com" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-4 bg-gray-700/30 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:bg-gray-700/50 hover:border-blue-500 hover:text-white transition-colors">
                        <PlusCircleIcon className="h-12 w-12 mb-2" />
                        <span className="font-semibold text-center">Crea Nuovo NotebookLM</span>
                    </a>
                    
                    {sortedNotebooks.map(nb => (
                        <NotebookCard 
                            key={nb.id} 
                            notebook={nb}
                            onAccess={(notebook) => onAccessNotebook(notebook.id)}
                            onEdit={onEditNotebook}
                            onManageNotes={onManageNotes}
                            onRemove={setNotebookToRemove}
                        />
                    ))}
                </div>
                
                {notebooks.length === 0 && (
                     <div className="text-center py-20 px-4">
                        <BookOpenIcon className="h-16 w-16 mx-auto text-gray-600" />
                        <p className="mt-4 text-gray-300 font-semibold">Nessun notebook salvato ancora</p>
                        <p className="text-gray-400 text-sm mt-1">
                            Clicca su 'Aggiungi da Link' per iniziare o crea un nuovo NotebookLM.
                        </p>
                    </div>
                )}
            </div>
            
             <ConfirmationModal
                isOpen={!!notebookToRemove}
                onClose={() => setNotebookToRemove(null)}
                onConfirm={handleConfirmRemove}
                title="Rimuovi collegamento"
            >
                {`Sei sicuro di voler rimuovere '${notebookToRemove?.title}'? Questa azione rimuoverà solo il collegamento, non il notebook originale su Google.`}
            </ConfirmationModal>
        </main>
    );
};

export default React.memo(NotebookLMView);
