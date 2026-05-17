import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import type { Conversation, Label } from '../types';
import { LABEL_COLORS } from '../constants';

interface AssignLabelsModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversation: Conversation;
    allLabels: Label[];
    onSave: (conversationId: string, labelIds: string[]) => void;
}

const AssignLabelsModal: React.FC<AssignLabelsModalProps> = ({ isOpen, onClose, conversation, allLabels, onSave }) => {
    const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            setSelectedLabelIds(new Set(conversation.labelIds || []));
        }
    }, [isOpen, conversation]);

    const handleToggleLabel = (labelId: string) => {
        setSelectedLabelIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(labelId)) {
                newSet.delete(labelId);
            } else {
                newSet.add(labelId);
            }
            return newSet;
        });
    };

    const handleSave = () => {
        onSave(conversation.id, Array.from(selectedLabelIds));
        onClose();
    };

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
                    Salva Etichette
                </button>
            </div>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Etichette per "${conversation.title}"`} footer={footer}>
            <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                {allLabels.length > 0 ? allLabels.map(label => {
                    const color = LABEL_COLORS.find(c => c.key === label.color) || LABEL_COLORS[0];
                    const isSelected = selectedLabelIds.has(label.id);
                    return (
                        <label key={label.id} htmlFor={`label-checkbox-${label.id}`} className="flex items-center p-2 rounded-md hover:bg-gray-700/50 cursor-pointer transition-colors">
                            <input
                                id={`label-checkbox-${label.id}`}
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleLabel(label.id)}
                                className="h-4 w-4 rounded border-gray-500 text-blue-500 focus:ring-blue-600 bg-gray-700"
                            />
                            <span className={`ml-3 px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                                {label.name}
                            </span>
                        </label>
                    );
                }) : (
                    <p className="text-gray-400 text-sm">Nessuna etichetta creata. Vai su "Gestisci Etichette" per aggiungerne.</p>
                )}
            </div>
        </Modal>
    );
};

export default AssignLabelsModal;
