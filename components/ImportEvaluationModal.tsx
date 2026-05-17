import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';

interface ImportEvaluationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (text: string) => void;
    isLoading: boolean;
    studentName: string;
}

const ImportEvaluationModal: React.FC<ImportEvaluationModalProps> = ({ isOpen, onClose, onConfirm, isLoading, studentName }) => {
    const [text, setText] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (isOpen) {
            setText('');
            setTimeout(() => textareaRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleConfirm = () => {
        if (text.trim()) {
            onConfirm(text.trim());
        }
    };

    const footer = (
        <>
            <div></div>
            <div className="space-x-3">
                <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
                <button onClick={handleConfirm} disabled={!text.trim() || isLoading} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                    {isLoading ? 'Analisi in corso...' : 'Importa e Analizza'}
                </button>
            </div>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Importa Valutazione per ${studentName}`} footer={footer}>
            <p className="text-gray-400 text-sm mb-4">Incolla qui il resoconto della valutazione da Google Classroom. Ada lo analizzerà e lo aggiungerà in modo strutturato al diario della studentessa.</p>
            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Es: Ottimo lavoro, Viola! Hai centrato tutti i punti della rubrica tranne la parte sulla formattazione... Voto: 85/100"
                className="w-full h-48 p-3 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-200 resize-y"
            />
        </Modal>
    );
};

export default ImportEvaluationModal;
