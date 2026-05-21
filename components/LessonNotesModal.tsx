import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';

interface LessonNotesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: string) => void;
    blockTitle: string;
    initialNotes: string;
}

const LessonNotesModal: React.FC<LessonNotesModalProps> = ({ isOpen, onClose, onSave, blockTitle, initialNotes }) => {
    const [notes, setNotes] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setNotes(initialNotes);
            const timer = setTimeout(() => textareaRef.current?.focus(), 100);
            return () => clearTimeout(timer);
        }
    }, [isOpen, initialNotes]);

    const handleSave = () => {
        onSave(notes);
        onClose();
    };

    const footer = (
        <>
            <div></div>
            <div className="space-x-3">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
                <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Salva Note</button>
            </div>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Note e Osservazioni sul ${blockTitle}`} footer={footer}>
            <p className="text-gray-400 text-sm mb-4">Inserisci qui i tuoi giudizi qualitativi e le osservazioni sulla lezione. Ada potrà usare queste note per generare un'analisi strategica.</p>
            <textarea
                ref={textareaRef}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Es: Lezione molto positiva. Viola e Martina brillanti sull'analisi dell'oggetto. Qualche difficoltà generale sul concetto di 'ciclo di vita'..."
                className="w-full h-64 p-3 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-200 resize-y"
            />
        </Modal>
    );
};

export default LessonNotesModal;