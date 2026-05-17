// hooks/useToolkitShortcuts.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { ToolkitShortcut } from '../types';
import * as db from '../services/db';

export const useToolkitShortcuts = (showToast: (message: string, type?: 'success' | 'info' | 'error') => void) => {
    const [shortcuts, setShortcuts] = useState<ToolkitShortcut[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const shortcutsRef = useRef(shortcuts);

    useEffect(() => {
        shortcutsRef.current = shortcuts;
    }, [shortcuts]);

    useEffect(() => {
        async function loadData() {
            try {
                const savedShortcuts = await db.getAllShortcuts();
                const validShortcuts = savedShortcuts.filter((s: any): s is ToolkitShortcut => 
                    s && typeof s.id === 'string' && typeof s.name === 'string' && typeof s.url === 'string'
                );
                setShortcuts(validShortcuts);
            } catch (error) {
                console.error("Failed to load shortcuts from DB:", error);
                showToast("Errore nel caricamento del toolkit.", 'error');
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [showToast]);

    const addShortcut = useCallback(async (name: string, url: string, notes: string, categoryId: string) => {
        const shortcutsInCategory = shortcutsRef.current.filter(s => s.categoryId === categoryId);
        const maxOrder = shortcutsInCategory.length > 0 ? Math.max(...shortcutsInCategory.map(s => s.order)) : -1;

        const newShortcut: ToolkitShortcut = {
            id: `shortcut-${Date.now()}`,
            name,
            url,
            notes,
            categoryId,
            order: maxOrder + 1,
        };
        const newShortcuts = [newShortcut, ...shortcutsRef.current];
        setShortcuts(newShortcuts);
        try {
            await db.saveShortcut(newShortcut);
            showToast('Scorciatoia aggiunta!', 'success');
        } catch (error) {
            console.error("Failed to add shortcut:", error);
            showToast("Errore nella creazione della scorciatoia.", 'error');
            setShortcuts(shortcutsRef.current); // Revert state
        }
    }, [showToast]);

    const updateShortcut = useCallback(async (id: string, updates: Partial<Omit<ToolkitShortcut, 'id'>>) => {
        const originalShortcuts = shortcutsRef.current;
        const shortcutToUpdate = originalShortcuts.find(s => s.id === id);
        if (!shortcutToUpdate) {
            showToast("Scorciatoia non trovata per l'aggiornamento.", 'error');
            return;
        }

        const updatedShortcut: ToolkitShortcut = { 
            ...shortcutToUpdate,
            ...updates
        };
        setShortcuts(prev => prev.map(s => s.id === id ? updatedShortcut : s));
        try {
            await db.saveShortcut(updatedShortcut);
            showToast('Scorciatoia aggiornata.', 'success');
        } catch (error) {
            console.error("Failed to update shortcut:", error);
            showToast("Errore nell'aggiornamento della scorciatoia.", 'error');
            setShortcuts(originalShortcuts); // Revert state
        }
    }, [showToast]);

    const deleteShortcut = useCallback(async (id: string) => {
        const originalShortcuts = shortcutsRef.current;
        setShortcuts(prev => prev.filter(s => s.id !== id));
        try {
            await db.deleteShortcut(id);
            showToast('Scorciatoia eliminata.', 'success');
        } catch (error) {
            console.error("Failed to delete shortcut:", error);
            showToast("Errore nell'eliminazione della scorciatoia.", 'error');
            setShortcuts(originalShortcuts); // Revert state
        }
    }, [showToast]);
    
    const bulkUpdateShortcuts = useCallback(async (updatedShortcuts: ToolkitShortcut[]) => {
        const originalShortcuts = shortcutsRef.current;
        const shortcutMap = new Map(updatedShortcuts.map(s => [s.id, s]));

        // Update local state optimistically
        setShortcuts(prev => prev.map(s => shortcutMap.has(s.id) ? shortcutMap.get(s.id)! : s));

        try {
            await db.bulkSaveShortcuts(updatedShortcuts);
        } catch (error) {
            console.error("Failed to bulk update shortcuts:", error);
            showToast("Errore nel salvataggio del nuovo ordine.", 'error');
            setShortcuts(originalShortcuts); // Revert on error
        }
    }, [showToast]);


    return {
        shortcuts,
        isLoading,
        addShortcut,
        updateShortcut,
        deleteShortcut,
        bulkUpdateShortcuts,
    };
};