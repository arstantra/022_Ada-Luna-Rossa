import React from 'react';
import type { WeekPlan } from '../types';
import { FolderIcon, FolderOpenIcon, PencilIcon } from './Icons';

interface MaterialsFolderManagerProps {
    weekPlan: WeekPlan;
    onSetFolder: (handle: any) => void;
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

const MaterialsFolderManager: React.FC<MaterialsFolderManagerProps> = ({ weekPlan, onSetFolder, showToast }) => {
    const folderHandle = weekPlan.materialsFolderHandle;

    const handleSelectFolder = async () => {
        try {
            // @ts-ignore - showDirectoryPicker is a new API and may not be in all TS lib versions
            const handle = await window.showDirectoryPicker();
            onSetFolder(handle);
        } catch (err) {
            if (err instanceof Error && err.name !== 'AbortError') {
                console.error("Error selecting directory:", err);
                showToast(`Errore durante la selezione: ${err.message}`, "error");
            }
        }
    };

    const handleOpenFolder = () => {
        showToast("L'apertura diretta di cartelle dal browser non è supportata per motivi di sicurezza.", "info");
    };

    if (folderHandle) {
        return (
            <div className="p-3 bg-gray-700/30 rounded-lg flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 min-w-0">
                    <FolderIcon className="h-5 w-5 text-amber-400 flex-shrink-0" />
                    <div className="min-w-0">
                        <span className="text-gray-400">Cartella Materiali:</span>
                        <span className="font-semibold text-white ml-2 truncate" title={folderHandle.name}>{folderHandle.name}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                        onClick={handleOpenFolder}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-gray-600 rounded-md hover:bg-gray-500 transition-colors"
                    >
                        <FolderOpenIcon className="h-4 w-4" />
                        Apri
                    </button>
                    <button
                        onClick={handleSelectFolder}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-300 rounded-md hover:bg-gray-600 transition-colors"
                    >
                        <PencilIcon className="h-4 w-4" />
                        Cambia
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex justify-start">
            <button
                onClick={handleSelectFolder}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
                <FolderIcon className="h-5 w-5" />
                Scegli Cartella dei Materiali
            </button>
        </div>
    );
};

export default MaterialsFolderManager;