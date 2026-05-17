import React, { useState } from 'react';
import type { ToolkitShortcut } from '../types';
import { PencilIcon, TrashIcon, WebIcon } from './Icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ShortcutCardProps {
    shortcut: ToolkitShortcut;
    onEdit: () => void;
    onDelete: () => void;
}

const ShortcutCard: React.FC<ShortcutCardProps> = ({ shortcut, onEdit, onDelete }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ 
        id: shortcut.id,
        data: {
            // This allows us to identify the parent container during drag operations
            sortable: { containerId: shortcut.categoryId }
        }
    });
    
    const [imgError, setImgError] = useState(false);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    let hostname = 'default';
    try {
        if (shortcut.url) {
            hostname = new URL(shortcut.url).hostname;
        }
    } catch (e) {
        console.warn("Invalid URL for shortcut:", shortcut.url);
    }
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

    // The component is restructured to separate the drag handle (`listeners`)
    // from the interactive buttons (`onClick`).
    return (
        <div 
            ref={setNodeRef}
            style={style}
            className="group relative bg-gray-700/60 rounded-lg shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-200 h-full flex flex-col"
        >
            {/* This div is the handle, containing the main clickable content. */}
            <div
                {...attributes}
                {...listeners}
                className="flex-grow p-4 cursor-grab active:cursor-grabbing"
            >
                <a href={shortcut.url} target="_blank" rel="noopener noreferrer" className="flex-grow flex flex-col">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 w-6 h-6 mr-3">
                            {imgError || hostname === 'default' ? (
                                <WebIcon className="w-6 h-6 text-gray-400" />
                            ) : (
                                <img
                                    src={faviconUrl}
                                    alt={`${hostname} favicon`}
                                    className="w-6 h-6 object-contain rounded"
                                    onError={() => setImgError(true)}
                                />
                            )}
                        </div>
                        <div className="flex-grow overflow-hidden">
                            <h3 className="font-bold text-white truncate group-hover:text-blue-400 transition-colors">{shortcut.name}</h3>
                        </div>
                    </div>

                    {shortcut.notes && (
                        <p className="text-sm text-gray-300 mt-3 whitespace-pre-wrap text-ellipsis overflow-hidden flex-grow" style={{ display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical' }}>
                            {shortcut.notes}
                        </p>
                    )}
                </a>
            </div>
            
            {/* These buttons are siblings to the handle, preventing their clicks from being intercepted. */}
            <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={onEdit} 
                    className="p-1.5 rounded-full text-gray-300 bg-gray-800/50 hover:bg-gray-600 hover:text-white" title="Modifica">
                    <PencilIcon className="h-4 w-4" />
                </button>
                 <button 
                    onClick={onDelete} 
                    className="p-1.5 rounded-full text-gray-300 bg-gray-800/50 hover:bg-red-500/50 hover:text-red-300" title="Elimina">
                    <TrashIcon className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default React.memo(ShortcutCard);