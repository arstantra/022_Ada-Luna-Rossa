import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import type { ToolkitShortcut } from '../types';

interface ShortcutModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string | null, name: string, url: string, notes: string) => void;
    shortcutToEdit?: ToolkitShortcut | null;
}

const ShortcutModal: React.FC<ShortcutModalProps> = ({ isOpen, onClose, onSave, shortcutToEdit }) => {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');

    const isEditMode = !!shortcutToEdit;

    useEffect(() => {
        if (isOpen) {
            setName(shortcutToEdit?.name || '');
            setUrl(shortcutToEdit?.url || '');
            setNotes(shortcutToEdit?.notes || '');
            setError('');
        }
    }, [isOpen, shortcutToEdit]);
    
    const validateUrl = (inputUrl: string): boolean => {
        try {
            new URL(inputUrl);
            return true;
        } catch (_) {
            return false;
        }
    };

    const handleSave = () => {
        if (!name.trim()) {
            setError('Il nome è obbligatorio.');
            return;
        }
        if (!url.trim() || !validateUrl(url)) {
            setError('URL non valido. Assicurati di inserire un link completo (es. https://www.canva.com).');
            return;
        }

        onSave(shortcutToEdit?.id || null, name, url, notes);
        onClose();
    };

    const footer = (
         <>
            <div></div>
            <div className="space-x-3">
                 <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                    {isEditMode ? 'Salva Modifiche' : 'Aggiungi Scorciatoia'}
                </button>
            </div>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? "Modifica Scorciatoia" : "Aggiungi Scorciatoia"} footer={footer}>
            <div className="space-y-4">
                 <div>
                    <label htmlFor="shortcut-name" className="block text-sm font-medium text-gray-300 mb-1">Nome</label>
                    <input
                        id="shortcut-name" type="text" value={name} onChange={(e) => setName(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="Es: Canva, Miro, Figma..."
                    />
                </div>
                 <div>
                    <label htmlFor="shortcut-url" className="block text-sm font-medium text-gray-300 mb-1">URL</label>
                    <input
                        id="shortcut-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)}
                        className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                        placeholder="https://www.canva.com"
                    />
                </div>
                <div>
                    <label htmlFor="shortcut-notes" className="block text-sm font-medium text-gray-300 mb-1">Note</label>
                    <textarea
                        id="shortcut-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
                        className="w-full h-24 p-2 bg-gray-900 border border-gray-600 rounded-md resize-y focus:ring-2 focus:ring-blue-500"
                        placeholder="A cosa serve questo strumento? Quali sono i casi d'uso principali?"
                    />
                </div>
                {error && <p className="text-sm text-red-400">{error}</p>}
            </div>
        </Modal>
    );
};

export default ShortcutModal;
