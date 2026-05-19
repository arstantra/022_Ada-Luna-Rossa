import React, { useState, useEffect, useRef } from 'react';

interface EditableTextareaProps {
    value: string;
    onSave: (newValue: string) => void;
    placeholder: string;
    rows?: number;
    className?: string;
    disabled?: boolean;
}

const EditableTextarea: React.FC<EditableTextareaProps> = ({ value, onSave, placeholder, rows = 3, className, disabled }) => {
    const [text, setText] = useState(value);
    const [justSaved, setJustSaved] = useState(false);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        setText(value);
    }, [value]);

    useEffect(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, [text]);

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

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
        }
    };

    return (
        <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            placeholder={placeholder}
            rows={rows}
            disabled={disabled}
            className={`w-full p-2 rounded-md text-gray-300 text-sm resize-none overflow-hidden transition-colors duration-300 ${
                disabled
                    ? 'bg-transparent border-transparent cursor-not-allowed opacity-80'
                    : justSaved
                        ? 'bg-gray-900/50 border border-emerald-500/50 focus:outline-none'
                        : 'bg-gray-900/50 border border-gray-700 focus:border-blue-500 focus:outline-none'
            } ${className}`}
        />
    );
};

export default EditableTextarea;
