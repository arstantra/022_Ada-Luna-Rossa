import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import type { Notebook } from '../types';

interface ManageNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: string, notes: string) => void;
    notebook: Notebook | null;
}

const ManageNotesModal: React.FC<ManageNotesModalProps> = ({ isOpen, onClose, onSave, notebook }) => {
    const [notes, setNotes] = useState('');
    const autosaveTimeoutRef = useRef<number | null>(null);
    
    useEffect(() => {
        if (isOpen && notebook) {
            setNotes(notebook.notes);
        }
    }, [isOpen, notebook]);

    useEffect(() => {
        if (!isOpen || !notebook) return;
        
        if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
        
        autosaveTimeoutRef.current = window.setTimeout(() => {
             if (notes !== notebook.notes) {
                onSave(notebook.id, notes);
            }
        }, 1500); // Autosave after 1.5s
        
        return () => {
            if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
        }
    }, [notes, notebook, isOpen, onSave]);

    const handleClose = () => {
        if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
        if (notebook && notes !== notebook.notes) {
            onSave(notebook.id, notes);
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={`Note per "${notebook?.title}"`}>
            <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full h-80 p-3 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 resize-y"
                placeholder="Inserisci qui le tue note..."
            />
            <div className="text-right text-xs text-gray-400 mt-2">
                {notes.length} caratteri - Salvataggio automatico
            </div>
        </Modal>
    );
};

export default ManageNotesModal;
