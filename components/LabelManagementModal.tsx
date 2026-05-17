import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import type { Label, Conversation } from '../types';
import { LABEL_COLORS } from '../constants';
import { CheckIcon, XIcon } from './Icons';

interface LabelManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    labels: Label[];
    conversations: Conversation[];
    onAddLabel: (name: string, color: string) => void;
    onUpdateLabel: (id: string, name: string, color: string) => void;
    onDeleteLabel: (id: string) => void;
}

const LabelManagementModal: React.FC<LabelManagementModalProps> = ({ isOpen, onClose, labels, conversations, onAddLabel, onUpdateLabel, onDeleteLabel }) => {
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0].key);
    const [editingLabel, setEditingLabel] = useState<Label | null>(null);
    const [deletingLabel, setDeletingLabel] = useState<Label | null>(null);
    
    const usageCount = (labelId: string) => conversations.filter(c => c.labelIds?.includes(labelId)).length;

    useEffect(() => {
        if (!isOpen) {
            setEditingLabel(null);
            setNewLabelName('');
            setNewLabelColor(LABEL_COLORS[0].key);
            setDeletingLabel(null);
        }
    }, [isOpen]);

    const handleAddOrUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        const targetName = editingLabel ? editingLabel.name : newLabelName;
        const targetColor = editingLabel ? editingLabel.color : newLabelColor;

        if (!targetName.trim()) return;

        if (editingLabel) {
            onUpdateLabel(editingLabel.id, targetName, targetColor);
            setEditingLabel(null);
        } else {
            onAddLabel(targetName, targetColor);
            setNewLabelName('');
        }
    };
    
    const startEdit = (label: Label) => {
        setEditingLabel({ ...label });
    };
    
    const cancelEdit = () => {
        setEditingLabel(null);
    };
    
    const handleDeleteConfirm = () => {
        if (deletingLabel) {
            onDeleteLabel(deletingLabel.id);
        }
        setDeletingLabel(null);
    };

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title="Gestisci Etichette">
                <div className="space-y-4">
                    <form onSubmit={handleAddOrUpdate} className="flex items-end gap-3 p-3 bg-gray-900/50 rounded-lg">
                        <div className="flex-grow">
                            <label className="text-xs text-gray-400">Nome Etichetta</label>
                            <input
                                type="text"
                                value={editingLabel ? editingLabel.name : newLabelName}
                                onChange={(e) => editingLabel ? setEditingLabel({...editingLabel, name: e.target.value}) : setNewLabelName(e.target.value)}
                                className="w-full mt-1 p-2 bg-gray-700 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Nuova etichetta..."
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-400">Colore</label>
                            <div className="mt-1 flex items-center gap-1 p-1 bg-gray-700 border border-gray-600 rounded-md">
                                {LABEL_COLORS.map(color => (
                                    <button
                                        key={color.key}
                                        type="button"
                                        onClick={() => editingLabel ? setEditingLabel({...editingLabel, color: color.key}) : setNewLabelColor(color.key)}
                                        className={`w-6 h-6 rounded-md ${color.bg} transition-transform hover:scale-110 relative`}
                                    >
                                        {((editingLabel && editingLabel.color === color.key) || (!editingLabel && newLabelColor === color.key)) && <CheckIcon className="w-4 h-4 text-white absolute inset-0 m-auto" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 h-10">{editingLabel ? 'Salva' : 'Aggiungi'}</button>
                        {editingLabel && <button type="button" onClick={cancelEdit} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-600 rounded-md hover:bg-gray-500 h-10">Annulla</button>}
                    </form>

                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                        {labels.map(label => {
                            const color = LABEL_COLORS.find(c => c.key === label.color) || LABEL_COLORS[0];
                            const count = usageCount(label.id);
                            return (
                                <div key={label.id} className="flex items-center justify-between p-2 bg-gray-700/40 rounded-md">
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text}`}>
                                            {label.name}
                                        </span>
                                        <span className="text-xs text-gray-400">Usata in {count} conversazioni</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => startEdit(label)} className="text-xs text-blue-400 hover:underline">Modifica</button>
                                        <button onClick={() => setDeletingLabel(label)} className="text-xs text-red-400 hover:underline">Elimina</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </Modal>
            <ConfirmationModal
                isOpen={!!deletingLabel}
                onClose={() => setDeletingLabel(null)}
                onConfirm={handleDeleteConfirm}
                title="Conferma Eliminazione Etichetta"
            >
                {deletingLabel && `Vuoi davvero eliminare l'etichetta "${deletingLabel.name}"? Sarà rimossa da ${usageCount(deletingLabel.id)} conversazioni. L'azione non è reversibile.`}
            </ConfirmationModal>
        </>
    );
};

export default LabelManagementModal;
