import React, { useState, useEffect, useRef } from 'react';
import Modal from './Modal';
import ConfirmationModal from './ConfirmationModal';
import { WandIcon, ArrowDownTrayIcon, ArrowUpTrayIcon } from './Icons';

interface ContextModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (context: string) => void;
    onDistill: (text: string) => Promise<string>;
    currentContext: string;
    defaultContext: string;
    title: string;
    description: string;
    placeholder: string;
}

const ContextModal: React.FC<ContextModalProps> = ({
    isOpen,
    onClose,
    onSave,
    onDistill,
    currentContext,
    defaultContext,
    title,
    description,
    placeholder
}) => {
    const [editedContext, setEditedContext] = useState(currentContext);
    const [isDistilling, setIsDistilling] = useState(false);
    const autosaveTimeoutRef = useRef<number | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setEditedContext(currentContext);
        }
    }, [isOpen, currentContext]);

    // Autosave on inactivity
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }

        autosaveTimeoutRef.current = window.setTimeout(() => {
            if (editedContext.trim() !== currentContext.trim()) {
                onSave(editedContext);
            }
        }, 2000); // Autosave after 2 seconds of inactivity

        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
        };
    }, [editedContext, currentContext, onSave, isOpen]);

    const handleSaveAndClose = () => {
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }
        onSave(editedContext);
        onClose();
    };

    const handleCloseAndMaybeSave = () => {
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }
        if (editedContext.trim() !== currentContext.trim()) {
            onSave(editedContext);
        }
        onClose();
    };

    const handleRestoreDefaults = () => {
        setIsRestoreConfirmOpen(true);
    };

    const handleConfirmRestore = () => {
        setEditedContext(defaultContext);
        setIsRestoreConfirmOpen(false);
    };

    const handleDistill = async () => {
        if (!editedContext.trim()) return;
        setIsDistilling(true);
        try {
            const distilledText = await onDistill(editedContext);
            setEditedContext(distilledText);
        } catch (error) {
            console.error("Failed to distill context:", error);
            // Optionally, show a toast notification for the error
        } finally {
            setIsDistilling(false);
        }
    };

    const handleExport = () => {
        const blob = new Blob([editedContext], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const safeTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_{2,}/g, '_').replace(/_$/, '');
        link.download = `ada_contesto_${safeTitle}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const text = e.target?.result as string;
            setEditedContext(text);
        };
        reader.onerror = (e) => console.error("Error reading file:", e);
        reader.readAsText(file);
        
        event.target.value = ''; // Reset so user can select the same file again
    };

    const footer = (
        <>
            <div className="flex items-center gap-x-3">
                <button
                    onClick={handleDistill}
                    disabled={isDistilling || !editedContext.trim()}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-purple-300 rounded-md bg-purple-500/10 hover:bg-purple-500/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <WandIcon className="h-4 w-4" />
                    {isDistilling ? 'Distillazione...' : 'Distilla con AI'}
                </button>
                <button
                    onClick={handleRestoreDefaults}
                    className="px-4 py-2 text-sm font-medium text-gray-300 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-yellow-500 transition-colors"
                >
                    Ripristina
                </button>
            </div>
            <div className="space-x-3">
                 <button
                    onClick={handleCloseAndMaybeSave}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-gray-500 transition-colors"
                >
                    Annulla
                </button>
                <button
                    onClick={handleSaveAndClose}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors"
                >
                    Salva Modifiche
                </button>
            </div>
        </>
    );

    return (
        <>
            <Modal isOpen={isOpen} onClose={handleCloseAndMaybeSave} title={title} footer={footer}>
                 <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelected}
                    accept=".txt,.md"
                    className="hidden"
                />
                <div className="space-y-4">
                     <div className="flex items-start justify-between gap-4">
                        <p className="text-gray-400 text-sm mt-1">
                            {description}
                        </p>
                        <div className="flex items-center gap-x-2 flex-shrink-0">
                            <button
                                onClick={handleImportClick}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 rounded-md bg-gray-700/50 hover:bg-gray-700 transition-colors"
                                title="Importa contesto da un file di testo"
                            >
                                <ArrowUpTrayIcon className="h-4 w-4" />
                                <span>Importa</span>
                            </button>
                            <button
                                onClick={handleExport}
                                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 rounded-md bg-gray-700/50 hover:bg-gray-700 transition-colors"
                                title="Esporta il contesto corrente in un file di testo"
                            >
                                <ArrowDownTrayIcon className="h-4 w-4" />
                                <span>Esporta</span>
                            </button>
                        </div>
                    </div>
                    <textarea
                        value={editedContext}
                        onChange={(e) => setEditedContext(e.target.value)}
                        className="w-full h-64 p-3 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-200 resize-none"
                        placeholder={placeholder}
                        aria-label={`${title} per l'AI`}
                    />
                </div>
            </Modal>
            <ConfirmationModal
                isOpen={isRestoreConfirmOpen}
                onClose={() => setIsRestoreConfirmOpen(false)}
                onConfirm={handleConfirmRestore}
                title="Conferma Ripristino"
                confirmText="Sì, ripristina"
            >
                Sei sicuro di voler ripristinare il contenuto predefinito? Tutte le modifiche personalizzate andranno perse.
            </ConfirmationModal>
        </>
    );
};

export default ContextModal;