import React, { useState, memo, useRef, useEffect, useMemo } from 'react';
import type { ToolkitShortcut, ToolkitCategory } from '../types';
import { XIcon, ToolboxIcon, PlusCircleIcon, PencilIcon, Bars3Icon, TrashIcon, ChevronDownIcon } from './Icons';
import ShortcutModal from './ShortcutModal';
import ShortcutCard from './ShortcutCard';
import ConfirmationModal from './ConfirmationModal';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
    useDroppable,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';


interface ToolkitViewProps {
    shortcuts: ToolkitShortcut[];
    categories: ToolkitCategory[];
    onClose: () => void;
    onAddShortcut: (name: string, url: string, notes: string, categoryId: string) => void;
    onUpdateShortcut: (id: string, updates: Partial<Omit<ToolkitShortcut, 'id'>>) => void;
    onDeleteShortcut: (id: string) => void;
    onAddCategory: (name: string) => Promise<ToolkitCategory | undefined>;
    onUpdateCategory: (id: string, name: string) => void;
    onDeleteCategory: (id: string) => void;
    onBulkUpdateShortcuts: (shortcuts: ToolkitShortcut[]) => void;
    onBulkUpdateCategories: (categories: ToolkitCategory[]) => void;
    showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
}

const DroppableCategory: React.FC<{ categoryId: string; children: React.ReactNode }> = ({ categoryId, children }) => {
    const { setNodeRef, isOver } = useDroppable({ id: categoryId });
    return (
        <div ref={setNodeRef} className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 rounded-lg transition-colors p-1 -m-1 ${isOver ? 'bg-blue-900/20' : ''}`}>
            {children}
        </div>
    );
};

interface SortableCategoryProps {
    category: ToolkitCategory;
    children: React.ReactNode;
    isEditing: boolean;
    editingName: string;
    onNameChange: (name: string) => void;
    onSave: () => void;
    onCancel: () => void;
    onStartEdit: () => void;
    onDelete: () => void;
    inputRef: React.RefObject<HTMLInputElement>;
}

const SortableCategory: React.FC<SortableCategoryProps> = ({ 
    category, children, isEditing, editingName, onNameChange, onSave, onCancel, onStartEdit, onDelete, inputRef
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: category.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    
    return (
        <div ref={setNodeRef} style={style}>
            <details className="group/week bg-gray-800 rounded-lg overflow-hidden border border-gray-700/50" open>
                <summary className="list-none [&::-webkit-details-marker]:hidden p-4 flex items-center gap-2 cursor-pointer hover:bg-gray-700/50">
                    <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-gray-500 hover:text-white">
                        <Bars3Icon className="h-6 w-6" />
                    </div>
                    
                    <div className="group/title flex items-center gap-2 flex-grow">
                        {isEditing ? (
                            <input
                                ref={inputRef}
                                value={editingName}
                                onChange={(e) => onNameChange(e.target.value)}
                                onBlur={onSave}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') onSave();
                                    if (e.key === 'Escape') onCancel();
                                }}
                                className="text-2xl font-bold bg-gray-700 text-white rounded px-2 -my-1 border-2 border-blue-500 outline-none"
                            />
                        ) : (
                            <>
                                <h2 className="text-2xl font-bold text-white" onClick={onStartEdit}>
                                    {category.name}
                                </h2>
                                <button onClick={onStartEdit} className="p-1 rounded-full text-gray-400 hover:bg-gray-600 opacity-0 group-hover/title:opacity-100 transition-opacity">
                                    <PencilIcon className="h-4 w-4" />
                                </button>
                                 <button onClick={onDelete} className="p-1 rounded-full text-gray-400 hover:bg-gray-600 opacity-0 group-hover/title:opacity-100 transition-opacity" title="Elimina categoria">
                                    <TrashIcon className="h-4 w-4" />
                                </button>
                            </>
                        )}
                    </div>

                    <ChevronDownIcon className="h-6 w-6 text-gray-400 transition-transform duration-300 group-open/week:rotate-180" />
                </summary>
                <div className="p-4 border-t border-gray-700/50">
                    {children}
                </div>
            </details>
        </div>
    );
};


const ToolkitView: React.FC<ToolkitViewProps> = memo(({ 
    shortcuts: initialShortcuts,
    categories: initialCategories, 
    onClose, 
    onAddShortcut,
    onUpdateShortcut,
    onDeleteShortcut,
    onAddCategory,
    onUpdateCategory,
    onDeleteCategory,
    onBulkUpdateCategories,
    onBulkUpdateShortcuts,
    showToast
}) => {
    // We use local state to manage re-ordering optimistically.
    const [categories, setCategories] = useState(initialCategories);
    const [shortcuts, setShortcuts] = useState(initialShortcuts);
    
    // Sync with props when they change
    useEffect(() => setCategories(initialCategories), [initialCategories]);
    useEffect(() => setShortcuts(initialShortcuts), [initialShortcuts]);

    const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
    const [editingCategoryName, setEditingCategoryName] = useState('');
    const categoryInputRef = useRef<HTMLInputElement>(null);

    const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
    const [shortcutToEdit, setShortcutToEdit] = useState<ToolkitShortcut | null>(null);
    const [categoryForNewShortcut, setCategoryForNewShortcut] = useState<string | null>(null);
    const [shortcutToDelete, setShortcutToDelete] = useState<ToolkitShortcut | null>(null);
    const [categoryToDelete, setCategoryToDelete] = useState<ToolkitCategory | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    
    // Sort categories based on their order property for rendering
    const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.order - b.order), [categories]);
    
    const shortcutsByCategory = useMemo(() => {
        const grouped: Record<string, ToolkitShortcut[]> = {};
        for (const category of sortedCategories) {
            grouped[category.id] = shortcuts
                .filter(s => s.categoryId === category.id)
                .sort((a, b) => a.order - b.order);
        }
        return grouped;
    }, [shortcuts, sortedCategories]);

    useEffect(() => {
        if (editingCategoryId && categoryInputRef.current) {
            categoryInputRef.current.focus();
            categoryInputRef.current.select();
        }
    }, [editingCategoryId]);

    const handleAddCategory = async () => {
        const newCategory = await onAddCategory('Nuova Categoria');
        if (newCategory) {
            setEditingCategoryId(newCategory.id);
            setEditingCategoryName(newCategory.name);
        }
    };
    
    const handleStartEditCategory = (category: ToolkitCategory) => {
        setEditingCategoryId(category.id);
        setEditingCategoryName(category.name);
    };

    const handleSaveCategoryEdit = () => {
        if (editingCategoryId && editingCategoryName.trim()) {
            onUpdateCategory(editingCategoryId, editingCategoryName.trim());
        }
        setEditingCategoryId(null);
        setEditingCategoryName('');
    };
    
    const handleCancelCategoryEdit = () => {
        setEditingCategoryId(null);
        setEditingCategoryName('');
    };

    const handleOpenAddShortcutModal = (categoryId: string) => {
        setShortcutToEdit(null);
        setCategoryForNewShortcut(categoryId);
        setIsShortcutModalOpen(true);
    };

    const handleOpenEditShortcutModal = (shortcut: ToolkitShortcut) => {
        setShortcutToEdit(shortcut);
        setCategoryForNewShortcut(null);
        setIsShortcutModalOpen(true);
    };

    const handleSaveShortcut = (id: string | null, name: string, url: string, notes: string) => {
        if (id) {
            onUpdateShortcut(id, { name, url, notes });
        } else if (categoryForNewShortcut) {
            onAddShortcut(name, url, notes, categoryForNewShortcut);
        }
        setIsShortcutModalOpen(false);
    };
    
    const handleDeleteShortcut = () => {
        if (shortcutToDelete) {
            onDeleteShortcut(shortcutToDelete.id);
            setShortcutToDelete(null);
        }
    };

    const handleConfirmDeleteCategory = () => {
        if (!categoryToDelete) return;

        const shortcutsInCat = shortcuts.filter(s => s.categoryId === categoryToDelete.id);
        shortcutsInCat.forEach(s => onDeleteShortcut(s.id));
        onDeleteCategory(categoryToDelete.id);
        setCategoryToDelete(null);
        showToast(`Categoria "${categoryToDelete.name}" e le sue scorciatoie sono state eliminate.`, 'success');
    };
    
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;
        
        const activeId = String(active.id);
        const overId = String(over.id);

        // Handle Category Reordering
        if (activeId.startsWith('category-') && overId.startsWith('category-')) {
            if (activeId !== overId) {
                const oldIndex = sortedCategories.findIndex(c => c.id === activeId);
                const newIndex = sortedCategories.findIndex(c => c.id === overId);
                
                if (oldIndex !== -1 && newIndex !== -1) {
                    const reordered = arrayMove(sortedCategories, oldIndex, newIndex);
                    const updatesToPersist = reordered.map((category, index) => ({ ...category, order: index }));
                    onBulkUpdateCategories(updatesToPersist);
                }
            }
            return;
        }

        // Handle Shortcut Reordering
        if (activeId.startsWith('shortcut-')) {
            setShortcuts(prevShortcuts => {
                const updatesToPersist: ToolkitShortcut[] = [];
                let newShortcuts = [...prevShortcuts];
                
                const sourceCategoryId = active.data.current?.sortable.containerId;
                const targetCategoryId = over.data.current?.sortable ? over.data.current.sortable.containerId : over.id;
                
                if (!sourceCategoryId || !targetCategoryId) return prevShortcuts;
                
                const isSameContainer = sourceCategoryId === targetCategoryId;
    
                if (isSameContainer) {
                    if (activeId === overId) return prevShortcuts;
                    
                    const items = newShortcuts.filter(s => s.categoryId === sourceCategoryId).sort((a, b) => a.order - b.order);
                    const oldIndex = items.findIndex(s => s.id === activeId);
                    const newIndex = items.findIndex(s => s.id === overId);
                    
                    if (oldIndex === -1 || newIndex === -1) return prevShortcuts;
                    
                    const reorderedItems = arrayMove(items, oldIndex, newIndex);
                    const categoryUpdates = reorderedItems.map((item, index) => ({ ...item, order: index }));
                    updatesToPersist.push(...categoryUpdates);
    
                    const otherItems = newShortcuts.filter(s => s.categoryId !== sourceCategoryId);
                    newShortcuts = [...otherItems, ...categoryUpdates];
    
                } else {
                    const activeShortcut = newShortcuts.find(s => s.id === activeId)!;
                    
                    const sourceItems = newShortcuts.filter(s => s.categoryId === sourceCategoryId && s.id !== activeId).sort((a,b) => a.order - b.order);
                    const sourceUpdates: ToolkitShortcut[] = sourceItems.map((item, index) => ({ ...item, order: index }));
                    updatesToPersist.push(...sourceUpdates);
    
                    let targetItems = newShortcuts.filter(s => s.categoryId === targetCategoryId).sort((a,b) => a.order - b.order);
                    const overIsShortcut = overId.startsWith('shortcut-');
                    let newIndex = targetItems.length;
                    if (overIsShortcut) {
                        const overIndex = targetItems.findIndex(s => s.id === overId);
                        if (overIndex !== -1) newIndex = overIndex;
                    }
                    
                    const movedShortcut = { ...activeShortcut, categoryId: targetCategoryId };
                    targetItems.splice(newIndex, 0, movedShortcut);
                    
                    const targetUpdates: ToolkitShortcut[] = targetItems.map((item, index) => ({ ...item, order: index }));
                    updatesToPersist.push(...targetUpdates);
    
                    const otherItems = newShortcuts.filter(s => s.categoryId !== sourceCategoryId && s.categoryId !== targetCategoryId);
                    newShortcuts = [...otherItems, ...sourceUpdates, ...targetUpdates];
                }
    
                if (updatesToPersist.length > 0) {
                    onBulkUpdateShortcuts(updatesToPersist);
                }
                return newShortcuts;
            });
        }
    };


    return (
        <>
            <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
                <div className="flex-shrink-0 flex items-center justify-between p-3.5 pl-6 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <ToolboxIcon className="h-6 w-6 text-orange-400" />
                        <h2 className="text-lg font-semibold truncate">Toolkit</h2>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" aria-label="Chiudi">
                        <XIcon className="h-5 w-5" />
                    </button>
                </div>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                        <div className="max-w-6xl mx-auto space-y-8">
                            <SortableContext items={sortedCategories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                                {sortedCategories.map(category => (
                                    <SortableCategory
                                        key={category.id}
                                        category={category}
                                        isEditing={editingCategoryId === category.id}
                                        editingName={editingCategoryName}
                                        onNameChange={setEditingCategoryName}
                                        onSave={handleSaveCategoryEdit}
                                        onCancel={handleCancelCategoryEdit}
                                        onStartEdit={() => handleStartEditCategory(category)}
                                        onDelete={() => setCategoryToDelete(category)}
                                        inputRef={categoryInputRef}
                                    >
                                        <SortableContext 
                                            id={category.id}
                                            items={(shortcutsByCategory[category.id] || []).map(s => s.id)} 
                                            strategy={rectSortingStrategy}
                                        >
                                            <DroppableCategory categoryId={category.id}>
                                                {(shortcutsByCategory[category.id] || []).map(shortcut => (
                                                    <ShortcutCard 
                                                        key={shortcut.id}
                                                        shortcut={shortcut}
                                                        onEdit={() => handleOpenEditShortcutModal(shortcut)}
                                                        onDelete={() => setShortcutToDelete(shortcut)}
                                                    />
                                                ))}
                                                <button 
                                                    onClick={() => handleOpenAddShortcutModal(category.id)}
                                                    className="flex flex-col items-center justify-center p-6 bg-gray-800/50 border-2 border-dashed border-gray-700 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-400 transition-colors"
                                                >
                                                    <PlusCircleIcon className="h-8 w-8" />
                                                    <span className="mt-2 text-sm font-medium">Aggiungi Scorciatoia</span>
                                                </button>
                                            </DroppableCategory>
                                        </SortableContext>
                                    </SortableCategory>
                                ))}
                            </SortableContext>

                            <div className="mt-8">
                                <button onClick={handleAddCategory} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors">
                                    <PlusCircleIcon className="h-5 w-5" />
                                    Nuova Categoria
                                </button>
                            </div>

                            {categories.length === 0 && (
                                <div className="text-center py-20 px-4 text-gray-500">
                                    <ToolboxIcon className="h-16 w-16 mx-auto" />
                                    <p className="mt-4 text-lg font-semibold">Il tuo Toolkit è vuoto</p>
                                    <p>Inizia creando una categoria per organizzare le tue scorciatoie.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </DndContext>
            </main>
            <ShortcutModal 
                isOpen={isShortcutModalOpen}
                onClose={() => setIsShortcutModalOpen(false)}
                onSave={handleSaveShortcut}
                shortcutToEdit={shortcutToEdit}
            />
            <ConfirmationModal
                isOpen={!!shortcutToDelete}
                onClose={() => setShortcutToDelete(null)}
                onConfirm={handleDeleteShortcut}
                title="Conferma Eliminazione"
            >
                Sei sicuro di voler eliminare la scorciatoia "{shortcutToDelete?.name}"?
            </ConfirmationModal>
             <ConfirmationModal
                isOpen={!!categoryToDelete}
                onClose={() => setCategoryToDelete(null)}
                onConfirm={handleConfirmDeleteCategory}
                title="Conferma Eliminazione Categoria"
            >
                Sei sicuro di voler eliminare la categoria "{categoryToDelete?.name}"? 
                Questa azione eliminerà anche tutte le scorciatoie al suo interno. L'azione non è reversibile.
            </ConfirmationModal>
        </>
    );
});

export default ToolkitView;
