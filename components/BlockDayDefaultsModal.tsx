import React, { useState, useEffect } from 'react';
import Modal from './Modal';

interface BlockDayDefaultsModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaults: Record<string, string>;
    onSave: (defaults: Record<string, string>) => void;
}

const BlockDayDefaultsModal: React.FC<BlockDayDefaultsModalProps> = ({ isOpen, onClose, defaults, onSave }) => {
    const [localDefaults, setLocalDefaults] = useState<Record<string, string>>({});

    useEffect(() => {
        if (isOpen) {
            setLocalDefaults(defaults);
        }
    }, [isOpen, defaults]);

    const handleDayChange = (blockIndex: number, day: string) => {
        setLocalDefaults(prev => {
            const newDefaults = { ...prev };
            if (day) {
                newDefaults[blockIndex] = day;
            } else {
                delete newDefaults[blockIndex];
            }
            return newDefaults;
        });
    };

    const handleSave = () => {
        onSave(localDefaults);
        onClose();
    };

    const daysOfWeek = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
    const maxBlocks = 6; // Assume a reasonable maximum number of blocks per week

    const footer = (
      <>
        <div></div>
        <div className="space-x-3">
             <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-colors"
            >
                Annulla
            </button>
            <button
                onClick={handleSave}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
            >
                Salva Impostazioni
            </button>
        </div>
      </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Imposta Giorni Predefiniti per i Blocchi" footer={footer}>
            <p className="text-gray-400 text-sm mb-4">
                Associa un giorno della settimana a ciascun blocco didattico. Questa impostazione verrà usata come predefinita ogni volta che avvii la progettazione di una nuova settimana. Potrai sempre modificarla per una settimana specifica.
            </p>
            <div className="space-y-3">
                {Array.from({ length: maxBlocks }, (_, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg">
                        <label htmlFor={`block-default-${index}`} className="font-medium text-white">
                            Blocco {index + 1}
                        </label>
                        <select
                            id={`block-default-${index}`}
                            value={localDefaults[index] || ''}
                            onChange={(e) => handleDayChange(index, e.target.value)}
                            className="w-48 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Nessun Predefinito</option>
                            {daysOfWeek.map(day => (
                                <option key={day} value={day}>{day}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>
        </Modal>
    );
};

export default BlockDayDefaultsModal;