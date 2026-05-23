import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import type { BlockDetails, BlockStatus } from '../types';
import ConfirmationModal from './ConfirmationModal';

interface BlockEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    block: BlockDetails;
    blockIndex: number;
    onUpdateStatus: (status: BlockStatus, reason?: string) => void;
    onUpdateDay: (day: string) => void;
    onReset: () => void;
}

const BlockEditModal: React.FC<BlockEditModalProps> = ({ isOpen, onClose, block, blockIndex, onUpdateStatus, onUpdateDay, onReset }) => {
    const [status, setStatus] = useState<BlockStatus>('da definire');
    const [day, setDay] = useState('');
    const [reason, setReason] = useState('');
    const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

    useEffect(() => {
        if (isOpen && block) {
            setStatus(block.status);
            setDay(block.day);
            setReason(block.reason || '');
        }
    }, [isOpen, block]);

    const handleSave = () => {
        if (status !== block.status || (status === 'saltato' && reason !== block.reason)) {
            onUpdateStatus(status, reason);
        }
        if (day !== block.day) {
            onUpdateDay(day);
        }
        onClose();
    };

    const handleConfirmReset = () => {
        onReset();
        setIsResetConfirmOpen(false);
        onClose();
    }

    const daysOfWeek = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

    const footer = (
      <>
        <button onClick={() => setIsResetConfirmOpen(true)} className="px-4 py-2 text-sm font-medium text-red-400 rounded-md hover:bg-red-500/10">Resetta Progettazione</button>
        <div className="space-x-3">
             <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Salva Modifiche</button>
        </div>
      </>
    );

    return (
        <>
            <Modal isOpen={isOpen} onClose={onClose} title={`Modifica Blocco ${blockIndex + 1}`} footer={footer}>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="block-status" className="block text-sm font-medium text-gray-300 mb-1">Stato Blocco</label>
                        <select id="block-status" value={status} onChange={e => setStatus(e.target.value as BlockStatus)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md">
                            <option value="da definire">Da Definire</option>
                            <option value="normale">Normale (In Progettazione)</option>
                            <option value="saltato">Saltato</option>
                            <option value="annullato">Annullato</option>
                        </select>
                    </div>
                    {status === 'saltato' && (
                         <div>
                            <label htmlFor="block-reason" className="block text-sm font-medium text-gray-300 mb-1">Motivo (se saltato)</label>
                            <input id="block-reason" type="text" value={reason} onChange={e => setReason(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md" placeholder="Es. Festività, Assemblea..." />
                        </div>
                    )}
                     <div>
                        <label htmlFor="block-day" className="block text-sm font-medium text-gray-300 mb-1">Giorno Lezione</label>
                        <select id="block-day" value={day} onChange={e => setDay(e.target.value)} className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md">
                            {daysOfWeek.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
            </Modal>
             <ConfirmationModal
                isOpen={isResetConfirmOpen}
                onClose={() => setIsResetConfirmOpen(false)}
                onConfirm={handleConfirmReset}
                title="Conferma Reset Progettazione"
                confirmText="Sì, resetta"
            >
                {`Stai per cancellare tutto il contenuto del laboratorio e del master per questo blocco, ripartendo da zero. L'obiettivo e il contesto del modulo verranno mantenuti. Sei sicuro?`}
            </ConfirmationModal>
        </>
    );
};

export default BlockEditModal;