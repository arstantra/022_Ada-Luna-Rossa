// hooks/useToolkitCategories.ts
import { useState, useEffect, useCallback } from 'react';
import type { ToolkitCategory } from '../types';
import * as db from '../services/db';

export const useToolkitCategories = (showToast: (message: string, type?: 'success' | 'info' | 'error') => void) => {
    const [categories, setCategories] = useState<ToolkitCategory[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                const savedCategories = await db.getAllCategories();
                savedCategories.sort((a, b) => a.order - b.order);
                setCategories(savedCategories);
            } catch (error) {
                console.error("Failed to load categories from DB:", error);
                showToast("Errore nel caricamento delle categorie del toolkit.", 'error');
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, [showToast]);

    const addCategory = useCallback(async (name: string): Promise<ToolkitCategory | undefined> => {
        const currentCategories = categories;
        const newCategory: ToolkitCategory = {
            id: `category-${Date.now()}`,
            name: name.trim(),
            order: currentCategories.length > 0 ? Math.max(...currentCategories.map(c => c.order)) + 1 : 0,
        };

        try {
            setCategories(prev => [...prev, newCategory].sort((a, b) => a.order - b.order));
            await db.saveCategory(newCategory);
            return newCategory;
        } catch (error) {
            console.error("Failed to add category:", error);
            showToast("Errore nella creazione della categoria.", 'error');
            setCategories(currentCategories); // Revert
            return undefined;
        }
    }, [showToast, categories]);

    const updateCategory = useCallback(async (id: string, name: string) => {
        const categoryToUpdate = categories.find(c => c.id === id);
        if (!categoryToUpdate || categoryToUpdate.name === name.trim()) return;
        
        const updatedCategory = { ...categoryToUpdate, name: name.trim() };

        try {
            await db.saveCategory(updatedCategory);
            setCategories(prev => prev.map(c => c.id === id ? updatedCategory : c).sort((a,b) => a.order - b.order));
        } catch (error) {
            console.error("Failed to update category:", error);
            showToast("Errore nell'aggiornamento della categoria.", 'error');
        }
    }, [showToast, categories]);

    const deleteCategory = useCallback(async (id: string) => {
        try {
            await db.deleteCategory(id);
            setCategories(prev => prev.filter(c => c.id !== id));
            showToast('Categoria eliminata.', 'success');
        } catch (error) {
            console.error("Failed to delete category:", error);
            showToast("Errore nell'eliminazione della categoria.", 'error');
        }
    }, [showToast]);

    const bulkUpdateCategories = useCallback(async (updatedCategories: ToolkitCategory[]) => {
        const originalCategories = categories;
        setCategories(updatedCategories);

        try {
            await db.bulkSaveCategories(updatedCategories);
        } catch (error) {
            console.error("Failed to bulk update categories:", error);
            showToast("Errore nel salvataggio del nuovo ordine.", 'error');
            setCategories(originalCategories); // Revert
        }
    }, [showToast, categories]);

    return {
        categories,
        isLoading,
        addCategory,
        updateCategory,
        deleteCategory,
        bulkUpdateCategories,
    };
};
