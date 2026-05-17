import React, { useState, useEffect, useMemo } from 'react';
import Modal from './Modal';
import type { Notebook } from '../types';
import { BookOpenIcon } from './Icons';

interface ManageNotebookLinksModalProps {
    isOpen: boolean;
    onClose: () => void;
    allNotebooks: Notebook[];
    initiallyLinkedIds: string[];
    onSaveLinks: (notebookIds: string[]) => void;
    onAddNotebook: (title: string, url: string, notes: string) => Promise<Notebook | undefined>;
}

const ManageNotebookLinksModal: React.FC<ManageNotebookLinksModalProps> = ({ isOpen, onClose, allNotebooks, initiallyLinkedIds, onSaveLinks, onAddNotebook }) => {
    const [activeView, setActiveView] = useState<'link' | 'create'>('link');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // State for the 'create' form
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedIds(new Set(initiallyLinkedIds));
            setActiveView('link'); // Reset to default view on open
            // Reset create form
            setTitle('');
            setUrl('');
            setNotes('');
            setError('');
        }
    }, [isOpen, initiallyLinkedIds]);

    const handleToggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            return newSet;
        });
    };

    const handleSaveLinks = () => {
        onSaveLinks(Array.from(selectedIds));
        onClose();
    };

    const validateUrl = (inputUrl: string): boolean => {
        try {
            const parsedUrl = new URL(inputUrl);
            return parsedUrl.hostname === 'notebooklm.google.com';
        } catch (_) { return false; }
    };

    const handleCreateAndLink = async () => {
        if (!title.trim()) { setError('Il titolo è obbligatorio.'); return; }
        if (!url.trim() || !validateUrl(url)) { setError('URL non valido. Assicurati di incollare un link da Google NotebookLM.'); return; }

        setIsCreating(true);
        setError('');
        const newNotebook = await onAddNotebook(title, url, notes);
        setIsCreating(false);

        if (newNotebook) {
            // Automatically link the new notebook and switch back to the linking view
            setSelectedIds(prev => new Set(prev).add(newNotebook.id));
            setActiveView('link');
            // Reset form
            setTitle(''); setUrl(''); setNotes('');
        } else {
            setError("Errore durante la creazione del notebook. Riprova.");
        }
    };

    const footer = (
         <>
            <div></div>
            <div className="space-x-3">
                 <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
                <button 
                    onClick={activeView === 'link' ? handleSaveLinks : handleCreateAndLink} 
                    disabled={isCreating}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {isCreating ? 'Creazione...' : (activeView === 'link' ? 'Salva Collegamenti' : 'Crea e Collega')}
                </button>
            </div>
        </>
    );

    const sortedNotebooks = useMemo(() => {
        return [...allNotebooks].sort((a,b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());
    }, [allNotebooks]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gestisci Notebook" footer={footer}>
            <div className="flex border-b border-gray-700 mb-4">
                <button onClick={() => setActiveView('link')} className={`flex-1 text-center p-3 text-sm font-medium ${activeView === 'link' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-700/50'}`}>Collega Esistente</button>
                <button onClick={() => setActiveView('create')} className={`flex-1 text-center p-3 text-sm font-medium ${activeView === 'create' ? 'text-white border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-700/50'}`}>Crea e Collega Nuovo</button>
            </div>

            {activeView === 'link' && (
                <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                    {sortedNotebooks.length > 0 ? sortedNotebooks.map(notebook => (
                        <label key={notebook.id} htmlFor={`nb-check-${notebook.id}`} className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors border ${selectedIds.has(notebook.id) ? 'bg-blue-500/10 border-blue-500/50' : 'border-transparent hover:bg-gray-700/50'}`}>
                            <input id={`nb-check-${notebook.id}`} type="checkbox" checked={selectedIds.has(notebook.id)} onChange={() => handleToggleSelection(notebook.id)} className="h-4 w-4 rounded border-gray-500 text-blue-500 focus:ring-blue-600 bg-gray-700" />
                            <BookOpenIcon className="h-5 w-5 mx-3 text-gray-400" />
                            <span className="font-medium text-white">{notebook.title}</span>
                        </label>
                    )) : <p className="text-gray-400 text-center p-4">Nessun notebook trovato nella libreria.</p>}
                </div>
            )}

            {activeView === 'create' && (
                <div className="space-y-4 p-2">
                    {/* Reusing AddNotebookModal form fields */}
                    <div>
                        <label htmlFor="nb-create-url" className="block text-sm font-medium text-gray-300 mb-1">URL NotebookLM</label>
                        <input id="nb-create-url" type="url" value={url} onChange={e => setUrl(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500" placeholder="https://notebooklm.google.com/notebook/..." />
                    </div>
                    <div>
                        <label htmlFor="nb-create-title" className="block text-sm font-medium text-gray-300 mb-1">Titolo Notebook</label>
                        <input id="nb-create-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500" placeholder="Es: Settimana 5 - Autopsia Oggetto" />
                    </div>
                    <div>
                        <label htmlFor="nb-create-notes" className="block text-sm font-medium text-gray-300 mb-1">Note (Opzionale)</label>
                        <textarea id="nb-create-notes" value={notes} onChange={e => setNotes(e.target.value)} className="w-full h-24 p-2 bg-gray-900 border border-gray-600 rounded-md resize-y focus:ring-2 focus:ring-blue-500" placeholder="Appunti, collegamenti..." />
                    </div>
                    {error && <p className="text-sm text-red-400">{error}</p>}
                </div>
            )}
        </Modal>
    );
};

export default ManageNotebookLinksModal;