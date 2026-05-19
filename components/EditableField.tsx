import React, { useState, useEffect, useRef } from 'react';

interface EditableFieldProps {
    value: string;
    onSave: (newValue: string) => void;
    placeholder: string;
    className?: string;
    disabled?: boolean;
}

const EditableField: React.FC<EditableFieldProps> = ({ value, onSave, placeholder, className, disabled }) => {
    const [text, setText] = useState(value);
    const [justSaved, setJustSaved] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setText(value);
    }, [value]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const handleBlur = () => {
        if (text.trim() !== value) {
            onSave(text.trim());
            if (timerRef.current) clearTimeout(timerRef.current);
            setJustSaved(true);
            timerRef.current = setTimeout(() => setJustSaved(false), 1500);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
        }
        if (e.key === 'Enter') {
            e.preventDefault();
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
            onClick={(e) => e.stopPropagation()}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full bg-transparent focus:outline-none text-white py-1 transition-colors duration-300 ${
                disabled
                    ? 'border-b border-transparent opacity-80 cursor-not-allowed'
                    : justSaved
                        ? 'border-b border-solid border-emerald-500/60'
                        : 'border-b border-dashed border-gray-600 focus:border-solid focus:border-blue-500'
            } ${className}`}
        />
    );
};

export default EditableField;
