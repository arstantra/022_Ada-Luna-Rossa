import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import type { Notebook } from '../types';

interface AddNotebookModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (title: string, url: string, notes: string) => void;
    onUpdate: (id: string, updates: Partial<Notebook>) => void;
    notebookToEdit?: Partial<Notebook> | null;
}

const AddNotebookModal: React.FC<AddNotebookModalProps> = ({ isOpen, onClose, onSave, onUpdate, notebookToEdit }) => {
    const [title, setTitle] = useState('');
    const [url, setUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const isEditMode = !!notebookToEdit?.id;

    useEffect(() => {
        if (isOpen) {
            setTitle(notebookToEdit?.title || '');
            setUrl(notebookToEdit?.url || '');
            setNotes(notebookToEdit?.notes || '');
            setError('');
        }
    }, [isOpen, notebookToEdit]);
    
    const validateUrl = (inputUrl: string): boolean => {
        try {
            const parsedUrl = new URL(inputUrl);
            return parsedUrl.hostname === 'notebooklm.google.com';
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
            setError('URL non valido. Assicurati di incollare un link diretto da Google NotebookLM.');
            return;
        }

        if (isEditMode) {
             onUpdate(notebookToEdit!.id!, { title, url, notes });
        } else {
            onSave(title, url, notes);
        }
        onClose();
    };

    const footer = (
         <>
            <div></div>
            <div className="space-x-3">
                 <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    {isEditMode ? 'Salva Modifiche' : 'Salva Notebook'}
                </button>
            </div>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Modifica Notebook" : "Aggiungi NotebookLM"} footer={footer}>
            <div className="space-y-4">
                 <div>
                    <label htmlFor="notebook-url" className="block text-sm font-medium text-gray-300 mb-1">URL NotebookLM</label>
                    <input
                        id="notebook-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="https://notebooklm.google.com/notebook/..."
                    />
                </div>
                 <div>
                    <label htmlFor="notebook-title" className="block text-sm font-medium text-gray-300 mb-1">Titolo Notebook</label>
                    <input
                        id="notebook-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Es: Settimana 5 - Autopsia Oggetto"
                    />
                </div>
                <div>
                    <label htmlFor="notebook-notes" className="block text-sm font-medium text-gray-300 mb-1">Note (Opzionale)</label>
                    <textarea
                        id="notebook-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                        className="w-full h-24 p-2 bg-gray-900 border border-gray-600 rounded-md resize-y focus:ring-2 focus:ring-blue-500"
                        placeholder="Appunti, collegamenti, obiettivi di questo notebook..."
                    />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
        </Modal>
    );
};

export default AddNotebookModal;
