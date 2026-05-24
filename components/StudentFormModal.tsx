import React, { useState, useEffect } from 'react';
import type { Student } from '../types';
import { XIcon } from './Icons';

interface StudentFormData {
    firstName: string;
    lastName: string;
    hasBES: boolean;
    hasDSA: boolean;
    besNotes: string;
    dsaNotes: string;
    certificationNotes: string;
    notes: string;
}

interface StudentFormModalProps {
    /** Studente da modificare, oppure null per nuovo inserimento */
    student?: Student | null;
    onSave: (data: Omit<Student, 'id' | 'evaluations' | 'adaSummary'>) => void;
    onClose: () => void;
}

const emptyForm = (): StudentFormData => ({
    firstName: '',
    lastName: '',
    hasBES: false,
    hasDSA: false,
    besNotes: '',
    dsaNotes: '',
    certificationNotes: '',
    notes: '',
});

const StudentFormModal: React.FC<StudentFormModalProps> = ({ student, onSave, onClose }) => {
    const [form, setForm] = useState<StudentFormData>(() => {
        if (!student) return emptyForm();
        return {
            firstName: student.firstName ?? student.name.split(' ').slice(0, -1).join(' '),
            lastName:  student.lastName  ?? student.name.split(' ').at(-1) ?? '',
            hasBES: student.hasBES ?? false,
            hasDSA: student.hasDSA ?? false,
            besNotes: student.besNotes ?? '',
            dsaNotes: student.dsaNotes ?? '',
            certificationNotes: student.certificationNotes ?? '',
            notes: student.notes ?? '',
        };
    });

    // Chiudi con Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const set = <K extends keyof StudentFormData>(key: K, value: StudentFormData[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const firstName = form.firstName.trim();
        const lastName = form.lastName.trim();
        if (!firstName || !lastName) return;
        const name = `${firstName} ${lastName}`;
        onSave({
            name,
            firstName,
            lastName,
            hasBES: form.hasBES || undefined,
            hasDSA: form.hasDSA || undefined,
            besNotes: form.besNotes.trim() || undefined,
            dsaNotes: form.dsaNotes.trim() || undefined,
            certificationNotes: form.certificationNotes.trim() || undefined,
            notes: form.notes.trim() || undefined,
        });
    };

    const isValid = form.firstName.trim() && form.lastName.trim();

    return (
        /* Overlay */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative w-full max-w-md bg-gray-850 border border-gray-700/60 rounded-2xl shadow-2xl overflow-hidden"
                 style={{ backgroundColor: '#161b22' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
                    <h3 className="text-sm font-semibold text-white">
                        {student ? 'Modifica studente' : 'Aggiungi studente'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors">
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    {/* Nome + Cognome */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500 mb-1.5">
                                Nome <span className="text-red-400">*</span>
                            </label>
                            <input
                                autoFocus
                                type="text"
                                value={form.firstName}
                                onChange={e => set('firstName', e.target.value)}
                                placeholder="es. Sofia"
                                className="w-full bg-gray-900/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500 mb-1.5">
                                Cognome <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.lastName}
                                onChange={e => set('lastName', e.target.value)}
                                placeholder="es. Bianchi"
                                className="w-full bg-gray-900/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Separatore BES/DSA */}
                    <div className="pt-1">
                        <p className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-500/70 mb-3">
                            Inclusione
                        </p>
                        <div className="flex gap-3">
                            {/* Toggle BES */}
                            <button
                                type="button"
                                onClick={() => set('hasBES', !form.hasBES)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                                    form.hasBES
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                        : 'bg-gray-900/50 border-gray-700/40 text-gray-500 hover:text-gray-400 hover:border-gray-600/50'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${form.hasBES ? 'bg-amber-400' : 'bg-gray-600'}`} />
                                BES
                            </button>
                            {/* Toggle DSA */}
                            <button
                                type="button"
                                onClick={() => set('hasDSA', !form.hasDSA)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                                    form.hasDSA
                                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                                        : 'bg-gray-900/50 border-gray-700/40 text-gray-500 hover:text-gray-400 hover:border-gray-600/50'
                                }`}
                            >
                                <span className={`w-2 h-2 rounded-full ${form.hasDSA ? 'bg-blue-400' : 'bg-gray-600'}`} />
                                DSA
                            </button>
                        </div>
                    </div>

                    {/* Note BES */}
                    {form.hasBES && (
                        <div>
                            <label className="block text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500 mb-1.5">
                                Note BES
                            </label>
                            <textarea
                                value={form.besNotes}
                                onChange={e => set('besNotes', e.target.value)}
                                rows={2}
                                placeholder="Descrivi i bisogni educativi speciali e le misure adottate…"
                                className="w-full bg-gray-900/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors resize-none"
                            />
                        </div>
                    )}

                    {/* Note DSA */}
                    {form.hasDSA && (
                        <div>
                            <label className="block text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500 mb-1.5">
                                Note DSA
                            </label>
                            <textarea
                                value={form.dsaNotes}
                                onChange={e => set('dsaNotes', e.target.value)}
                                rows={2}
                                placeholder="Tipologia DSA, strumenti compensativi, misure dispensative…"
                                className="w-full bg-gray-900/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors resize-none"
                            />
                        </div>
                    )}

                    {/* Note certificazioni */}
                    <div>
                        <label className="block text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500 mb-1.5">
                            Note certificazioni / altre segnalazioni
                        </label>
                        <textarea
                            value={form.certificationNotes}
                            onChange={e => set('certificationNotes', e.target.value)}
                            rows={2}
                            placeholder="Certificazioni mediche, segnalazioni del consiglio di classe…"
                            className="w-full bg-gray-900/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors resize-none"
                        />
                    </div>

                    {/* Note generali */}
                    <div>
                        <label className="block text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500 mb-1.5">
                            Note personali
                        </label>
                        <textarea
                            value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            rows={2}
                            placeholder="Osservazioni personali, punti di forza, aree di sviluppo…"
                            className="w-full bg-gray-900/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors resize-none"
                        />
                    </div>

                    {/* Footer */}
                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm text-gray-400 border border-gray-700/50 rounded-lg hover:bg-gray-800/60 hover:text-gray-200 transition-colors"
                        >
                            Annulla
                        </button>
                        <button
                            type="submit"
                            disabled={!isValid}
                            className={`flex-1 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
                                isValid
                                    ? 'bg-blue-600/80 text-white hover:bg-blue-500 shadow-sm shadow-blue-900/40'
                                    : 'bg-gray-700/40 text-gray-500 cursor-not-allowed'
                            }`}
                        >
                            {student ? 'Salva modifiche' : 'Aggiungi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StudentFormModal;
