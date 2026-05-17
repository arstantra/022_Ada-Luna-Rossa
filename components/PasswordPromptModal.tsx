import React, { useState, FormEvent, useEffect, useRef } from 'react';
import Modal from './Modal';

interface PasswordPromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (password: string) => void;
    title: string;
    children: React.ReactNode;
    buttonText?: string;
    isLoading?: boolean;
}

const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({ isOpen, onClose, onSubmit, title, children, buttonText, isLoading }) => {
    const [password, setPassword] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setPassword('');
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100); // Small delay to ensure modal is rendered
        }
    }, [isOpen]);

    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (password) {
            onSubmit(password);
        }
    };

    const footer = (
        <>
            <div></div>
            <div className="space-x-3">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700"
                >
                    Annulla
                </button>
                <button
                    type="submit"
                    form="password-prompt-form"
                    disabled={!password || isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                    {isLoading ? 'Elaborazione...' : (buttonText || "Conferma")}
                </button>
            </div>
        </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title} footer={footer}>
            <form id="password-prompt-form" onSubmit={handleSubmit}>
                <p className="text-gray-300 text-sm mb-4">
                    {children}
                </p>
                <input
                    ref={inputRef}
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full p-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                    placeholder="Password"
                    required
                />
            </form>
        </Modal>
    );
};

export default PasswordPromptModal;
