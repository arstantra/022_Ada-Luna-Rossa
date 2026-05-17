import React, { useEffect } from 'react';

interface ToastProps {
    message: string;
    type: 'success' | 'info' | 'error';
    onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000); // Chiude automaticamente dopo 3 secondi

        return () => {
            clearTimeout(timer);
        };
    }, [onClose]);

    const baseClasses = "fixed bottom-5 right-5 z-50 px-4 py-3 rounded-md shadow-lg text-white text-sm font-medium flex items-center transition-all duration-300 ease-in-out";
    
    const typeClasses = {
        success: 'bg-green-600',
        info: 'bg-blue-600',
        error: 'bg-red-600'
    };

    return (
        <div className={`${baseClasses} ${typeClasses[type]}`}>
            <span>{message}</span>
            <button onClick={onClose} className="ml-4 -mr-1 text-xl font-semibold leading-none flex items-center justify-center" aria-label="Chiudi notifica">&times;</button>
        </div>
    );
};

export default Toast;