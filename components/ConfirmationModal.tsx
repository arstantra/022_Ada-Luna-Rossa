import React from 'react';
import Modal from './Modal';

export interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    children: React.ReactNode;
    confirmText?: string;
    confirmButtonClass?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, children, confirmText, confirmButtonClass }) => {
    
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
                onClick={() => { onConfirm(); onClose(); }}
                className={confirmButtonClass || "px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-colors"}
            >
                {confirmText || "Conferma"}
            </button>
        </div>
      </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
            <p className="text-gray-300 text-sm">
                {children}
            </p>
        </Modal>
    );
};

export default React.memo(ConfirmationModal);
