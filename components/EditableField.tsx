import React, { useState, useEffect } from 'react';

interface EditableFieldProps {
    value: string;
    onSave: (newValue: string) => void;
    placeholder: string;
    className?: string;
    disabled?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({ value, onSave, placeholder, className, disabled }) => {
    const [text, setText] = useState(value);

    useEffect(() => {
        setText(value);
    }, [value]);

    const handleBlur = () => {
        if (text.trim() !== value) {
            onSave(text.trim());
        }
    };
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // Stop Enter and Space from toggling parent <details> elements
        if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
        }
        if (e.key === 'Enter') {
            e.preventDefault(); // Also prevent default behavior for Enter specifically
            e.currentTarget.blur();
        }
    };
    return (
        <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()} // Also stop click propagation
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full bg-transparent focus:outline-none text-white py-1 ${
                disabled 
                ? 'border-b border-transparent opacity-80 cursor-not-allowed' 
                : 'border-b border-dashed border-gray-600 focus:border-solid focus:border-blue-500'
            } ${className}`}
        />
    );
};

export default EditableField;