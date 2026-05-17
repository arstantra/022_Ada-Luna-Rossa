// hooks/useLabels.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Label } from '../types';
import { AUTO_LABELS } from '../constants';
import * as db from '../services/db';

export const useLabels = (showToast: (message: string, type?: 'success' | 'info' | 'error') => void) => {
    const [labels, setLabels] = useState<Label[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const labelsRef = useRef(labels);

    useEffect(() => {
        labelsRef.current = labels;
    }, [labels]);

    useEffect(() => {
        async function loadData() {
            try {
                const savedLabels = await db.getAllLabels();
                const validLabels = savedLabels.filter((l: any): l is Label => 
                    l && typeof l.id === 'string' && typeof l.name === 'string' && typeof l.color === 'string'
                );
                setLabels(validLabels);
            } catch (error) {
                console.error("Failed to load labels from DB:", error);
                showToast("Errore nel caricamento delle etichette.", 'error');
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [showToast]);

    const addLabel = useCallback(async (name: string, color: string) => {
        if (labelsRef.current.some(l => l.name.toLowerCase() === name.toLowerCase())) {
            showToast('Un\'etichetta con questo nome esiste già.', 'error');
            return;
        }
        const newLabel: Label = {
            id: `label-${Date.now()}`,
            name: name.trim(),
            color: color,
        };
        const newLabels = [...labelsRef.current, newLabel];
        setLabels(newLabels);
        try {
            await db.saveLabel(newLabel);
            showToast('Etichetta creata!', 'success');
        } catch (error) {
            console.error("Failed to add label:", error);
            showToast("Errore nella creazione dell'etichetta.", 'error');
            setLabels(labelsRef.current); // Revert state
        }
    }, [showToast]);

    const updateLabel = useCallback(async (id: string, name: string, color: string) => {
        if (labelsRef.current.some(l => l.id !== id && l.name.toLowerCase() === name.toLowerCase())) {
            showToast('Un\'etichetta con questo nome esiste già.', 'error');
            return;
        }
        const originalLabels = labelsRef.current;
        const updatedLabel: Label = { id, name: name.trim(), color };
        setLabels(prev => prev.map(l => l.id === id ? updatedLabel : l));
        try {
            await db.saveLabel(updatedLabel);
            showToast('Etichetta aggiornata.', 'success');
        } catch (error) {
            console.error("Failed to update label:", error);
            showToast("Errore nell'aggiornamento dell'etichetta.", 'error');
            setLabels(originalLabels); // Revert state
        }
    }, [showToast]);

    const deleteLabel = useCallback(async (id: string) => {
        const originalLabels = labelsRef.current;
        setLabels(prev => prev.filter(l => l.id !== id));
        try {
            await db.deleteLabel(id);
        } catch (error) {
            console.error("Failed to delete label:", error);
            showToast("Errore nell'eliminazione dell'etichetta.", 'error');
            setLabels(originalLabels); // Revert state
        }
    }, [showToast]);
    
    const getOrCreateLabelsByName = useCallback(async (names: string[]): Promise<Label[]> => {
        const newLabels: Label[] = [];
        const resultingLabels: Label[] = [];
        const currentLabels = [...labelsRef.current];

        names.forEach(name => {
            let existingLabel = currentLabels.find(l => l.name.toLowerCase() === name.toLowerCase());
            if (existingLabel) {
                resultingLabels.push(existingLabel);
            } else {
                let color = 'gray'; // default color
                if (name === AUTO_LABELS.PLANNING.name) color = AUTO_LABELS.PLANNING.color;
                else if (name === AUTO_LABELS.PLANNED.name) color = AUTO_LABELS.PLANNED.color;
                else if (name === AUTO_LABELS.COMPLETED.name) color = AUTO_LABELS.COMPLETED.color;

                const newLabel: Label = {
                    id: `label-${Date.now()}-${Math.random()}`,
                    name: name,
                    color: color,
                };
                newLabels.push(newLabel);
                resultingLabels.push(newLabel);
                currentLabels.push(newLabel); 
            }
        });

        if (newLabels.length > 0) {
            setLabels(prev => [...prev, ...newLabels]);
            try {
                await db.bulkSaveLabels(newLabels);
            } catch (error) {
                console.error("Failed to bulk save new labels:", error);
                showToast("Errore nel salvataggio delle nuove etichette.", 'error');
            }
        }
        
        return resultingLabels;
    }, [showToast]);


    return {
        labels,
        isLoading,
        addLabel,
        updateLabel,
        deleteLabel,
        getOrCreateLabelsByName,
    };
};