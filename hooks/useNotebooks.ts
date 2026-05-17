// hooks/useNotebooks.ts
import { useState, useEffect, useCallback } from 'react';
import type { Notebook } from '../types';
import * as db from '../services/db';

export const useNotebooks = (showToast: (message: string, type?: 'success' | 'info' | 'error') => void) => {
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const savedNotebooks = await db.getAllNotebooks();
                const validNotebooks = savedNotebooks.filter((n: any): n is Notebook => 
                    n && typeof n.id === 'string' && typeof n.title === 'string' && typeof n.url === 'string'
                );
                setNotebooks(validNotebooks);
            } catch (error) {
                console.error("Failed to load notebooks from DB:", error);
                showToast("Errore nel caricamento dei notebook.", 'error');
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [showToast]);

    const addNotebook = useCallback(async (title: string, url: string, notes: string): Promise<Notebook | undefined> => {
        const newNotebook: Notebook = {
            id: `notebook-${Date.now()}`,
            title,
            url,
            notes,
            dateAdded: new Date().toISOString(),
            lastAccessed: null,
        };
        const originalNotebooks = notebooks;
        setNotebooks(prev => [newNotebook, ...prev]);
        try {
            await db.saveNotebook(newNotebook);
            showToast('Notebook aggiunto con successo!', 'success');
            return newNotebook;
        } catch (error) {
            console.error("Failed to add notebook:", error);
            showToast("Errore nell'aggiungere il notebook.", 'error');
            setNotebooks(originalNotebooks); // Revert
            return undefined;
        }
    }, [showToast, notebooks]);

    const updateNotebook = useCallback(async (id: string, updates: Partial<Omit<Notebook, 'id'>>) => {
        let updatedNotebook: Notebook | null = null;
        const originalNotebooks = notebooks;
        setNotebooks(prev => prev.map(nb => {
            if (nb.id === id) {
                updatedNotebook = { ...nb, ...updates };
                return updatedNotebook;
            }
            return nb;
        }));
        if (updatedNotebook) {
            try {
                await db.saveNotebook(updatedNotebook);
            } catch (error) {
                console.error("Failed to update notebook:", error);
                showToast("Errore nell'aggiornare il notebook.", 'error');
                setNotebooks(originalNotebooks); // Revert
            }
        }
    }, [showToast, notebooks]);
    
    const accessNotebook = useCallback((id: string) => {
        updateNotebook(id, { lastAccessed: new Date().toISOString() });
    }, [updateNotebook]);

    const removeNotebook = useCallback(async (id: string) => {
        const originalNotebooks = notebooks;
        setNotebooks(prev => prev.filter(nb => nb.id !== id));
        try {
            await db.deleteNotebook(id);
            showToast('Collegamento al notebook rimosso.', 'success');
        } catch (error) {
            console.error("Failed to remove notebook:", error);
            showToast("Errore nella rimozione del notebook.", 'error');
            setNotebooks(originalNotebooks); // Revert
        }
    }, [showToast, notebooks]);

    return {
        notebooks,
        isLoading,
        addNotebook,
        updateNotebook,
        removeNotebook,
        accessNotebook,
    };
};
