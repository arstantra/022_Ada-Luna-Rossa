import React from 'react';
import Modal from './Modal';

export type SaltaChoice = 'rimanda' | 'accorpa' | 'distribuisci' | 'archivia';

interface SaltaLezioneModalProps {
    isOpen: boolean;
    onClose: () => void;
    blockSummary: string;
    onChoice: (choice: SaltaChoice) => void;
}

const CHOICES: { id: SaltaChoice; label: string; description: string; cls: string }[] = [
    {
        id: 'rimanda',
        label: 'Rimanda',
        description: 'Il contenuto va in coda e attende un blocco disponibile.',
        cls: 'border-blue-500/30 hover:border-blue-400/50 hover:bg-blue-500/10 text-blue-300',
    },
    {
        id: 'accorpa',
        label: 'Accorpa',
        description: 'Il contenuto si unisce al blocco successivo.',
        cls: 'border-amber-500/30 hover:border-amber-400/50 hover:bg-amber-500/10 text-amber-300',
    },
    {
        id: 'distribuisci',
        label: 'Distribuisci su Classroom',
        description: 'Il contenuto va in coda come attività asincrona da inviare.',
        cls: 'border-purple-500/30 hover:border-purple-400/50 hover:bg-purple-500/10 text-purple-300',
    },
    {
        id: 'archivia',
        label: 'Archivia',
        description: 'Il contenuto resta accessibile nella storia del blocco, senza ricollocarlo.',
        cls: 'border-gray-600/40 hover:border-gray-500/50 hover:bg-gray-700/40 text-gray-300',
    },
];

const SaltaLezioneModal: React.FC<SaltaLezioneModalProps> = ({ isOpen, onClose, blockSummary, onChoice }) => {
    const footer = (
        <>
            <div />
            <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
            >
                Annulla
            </button>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Salta lezione — cosa fai con il contenuto?" footer={footer}>
            <div className="space-y-4">
                {blockSummary && (
                    <div className="px-3 py-2 bg-gray-900/60 border border-gray-700/40 rounded-lg">
                        <p className="text-[11px] font-mono text-gray-500 uppercase tracking-widest mb-1">Contenuto pianificato</p>
                        <p className="text-sm text-gray-300 leading-snug">{blockSummary}</p>
                    </div>
                )}
                <div className="grid grid-cols-1 gap-2">
                    {CHOICES.map(choice => (
                        <button
                            key={choice.id}
                            onClick={() => { onChoice(choice.id); onClose(); }}
                            className={`w-full text-left px-4 py-3 rounded-lg border transition-all ${choice.cls}`}
                        >
                            <span className="block text-sm font-semibold">{choice.label}</span>
                            <span className="block text-xs text-gray-400 mt-0.5">{choice.description}</span>
                        </button>
                    ))}
                </div>
            </div>
        </Modal>
    );
};

export default SaltaLezioneModal;
