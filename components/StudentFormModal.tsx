import React, { useState, useEffect, useMemo } from 'react';
import type { Student } from '../types';
import { XIcon } from './Icons';
import { STUDENT_MEASURES } from '../constants';
import { normalizeStudentCode, isValidStudentCode, findSensitiveTerms } from '../utils';

/**
 * Scheda studente — SOLO CODICI.
 * Ada non conosce nomi e cognomi: lo studente è identificato da un codice (es. "S07")
 * generato fuori da Ada. Al posto delle note sanitarie ci sono "Strumenti e misure":
 * cosa serve per lavorare, mai il perché.
 */

interface StudentFormData {
    code: string;
    hasBES: boolean;
    hasDSA: boolean;
    hasPEI: boolean;
    measures: string[];
    otherMeasures: string;
    notes: string;
}

interface StudentFormModalProps {
    /** Studente da modificare, oppure null per nuovo inserimento */
    student?: Student | null;
    /** Codici già presenti nella classe (per evitare duplicati) */
    existingCodes?: string[];
    onSave: (data: Omit<Student, 'id' | 'evaluations' | 'adaSummary'>) => void;
    onClose: () => void;
}

const emptyForm = (): StudentFormData => ({
    code: '',
    hasBES: false,
    hasDSA: false,
    hasPEI: false,
    measures: [],
    otherMeasures: '',
    notes: '',
});

/** Il profilo contiene campi del vecchio formato (nome reale, note BES/DSA/PEI, certificazioni)? */
const hasLegacyData = (s: Student): boolean =>
    !!(s.firstName || s.lastName || s.besNotes || s.dsaNotes || s.peiNotes || s.certificationNotes) ||
    !isValidStudentCode(normalizeStudentCode(s.name));

const labelCls = 'block text-[10px] font-mono tracking-[0.12em] uppercase text-gray-500 mb-1.5';
const inputCls = 'w-full bg-gray-900/70 border border-gray-700/50 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 transition-colors';

const StudentFormModal: React.FC<StudentFormModalProps> = ({ student, existingCodes = [], onSave, onClose }) => {
    const [form, setForm] = useState<StudentFormData>(() => {
        if (!student) return emptyForm();
        const legacyCode = normalizeStudentCode(student.name);
        return {
            code: isValidStudentCode(legacyCode) ? legacyCode : '',
            hasBES: student.hasBES ?? false,
            hasDSA: student.hasDSA ?? false,
            hasPEI: student.hasPEI ?? false,
            measures: student.measures ?? [],
            otherMeasures: student.otherMeasures ?? '',
            notes: student.notes ?? '',
        };
    });
    const showLegacyWarning = !!student && hasLegacyData(student);

    // Chiudi con Escape
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [onClose]);

    const set = <K extends keyof StudentFormData>(key: K, value: StudentFormData[K]) =>
        setForm(prev => ({ ...prev, [key]: value }));

    const toggleMeasure = (m: string) =>
        setForm(prev => ({
            ...prev,
            measures: prev.measures.includes(m) ? prev.measures.filter(x => x !== m) : [...prev.measures, m],
        }));

    const code = normalizeStudentCode(form.code);
    const otherCodes = existingCodes
        .map(normalizeStudentCode)
        .filter(c => !student || c !== normalizeStudentCode(student.name));
    const codeError = !code
        ? ''
        : !isValidStudentCode(code)
            ? 'Solo lettere, cifre e trattini, con almeno una cifra (es. S07). Niente nomi.'
            : otherCodes.includes(code)
                ? 'Codice già presente in questa classe.'
                : '';

    const sensitiveTerms = useMemo(
        () => Array.from(new Set([...findSensitiveTerms(form.otherMeasures), ...findSensitiveTerms(form.notes)])),
        [form.otherMeasures, form.notes]
    );

    const isValid = !!code && !codeError && sensitiveTerms.length === 0;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!isValid) return;
        onSave({
            name: code,
            hasBES: form.hasBES || undefined,
            hasDSA: form.hasDSA || undefined,
            hasPEI: form.hasPEI || undefined,
            measures: form.measures.length > 0 ? form.measures : undefined,
            otherMeasures: form.otherMeasures.trim() || undefined,
            notes: form.notes.trim() || undefined,
            // Campi del vecchio formato: eliminati a ogni salvataggio
            firstName: undefined,
            lastName: undefined,
            besNotes: undefined,
            dsaNotes: undefined,
            peiNotes: undefined,
            certificationNotes: undefined,
        });
    };

    const flagBtn = (key: 'hasBES' | 'hasDSA' | 'hasPEI', label: string, on: string, dot: string) => (
        <button
            type="button"
            onClick={() => set(key, !form[key])}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-mono transition-colors ${
                form[key] ? on : 'bg-gray-900/50 border-gray-700/40 text-gray-500 hover:text-gray-400 hover:border-gray-600/50'
            }`}
        >
            <span className={`w-2 h-2 rounded-full ${form[key] ? dot : 'bg-gray-600'}`} />
            {label}
        </button>
    );

    return (
        /* Overlay */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="relative w-full max-w-md max-h-[90vh] flex flex-col bg-gray-850 border border-gray-700/60 rounded-2xl shadow-2xl overflow-hidden"
                 style={{ backgroundColor: '#161b22' }}
            >
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
                    <h3 className="text-sm font-semibold text-white">
                        {student ? 'Modifica studente' : 'Aggiungi studente'}
                    </h3>
                    <button onClick={onClose} className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors">
                        <XIcon className="h-4 w-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5 overflow-y-auto">
                    {showLegacyWarning && (
                        <p className="text-[11px] leading-relaxed text-amber-300/90 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2">
                            Questo profilo è nel vecchio formato (nome reale o note BES/DSA/PEI/certificazioni).
                            Al salvataggio quei campi vengono eliminati: assegna un codice e indica solo strumenti e misure.
                        </p>
                    )}

                    {/* Codice */}
                    <div>
                        <label className={labelCls}>
                            Codice studente <span className="text-red-400">*</span>
                        </label>
                        <input
                            autoFocus
                            type="text"
                            value={form.code}
                            onChange={e => set('code', e.target.value.toUpperCase())}
                            placeholder="es. S07"
                            maxLength={10}
                            className={`${inputCls} font-mono tracking-wider`}
                        />
                        {codeError
                            ? <p className="mt-1.5 text-[11px] text-red-400">{codeError}</p>
                            : <p className="mt-1.5 text-[11px] text-gray-500">Mai nomi né cognomi: la corrispondenza codice ↔ studente la tieni fuori da Ada.</p>}
                    </div>

                    {/* Inclusione */}
                    <div className="pt-1">
                        <p className="text-[9px] font-mono tracking-[0.14em] uppercase text-gray-500/70 mb-3">
                            Inclusione
                        </p>
                        <div className="flex gap-3">
                            {flagBtn('hasBES', 'BES', 'bg-amber-500/15 border-amber-500/40 text-amber-300', 'bg-amber-400')}
                            {flagBtn('hasDSA', 'DSA', 'bg-blue-500/15 border-blue-500/40 text-blue-300', 'bg-blue-400')}
                            {flagBtn('hasPEI', 'PEI', 'bg-violet-500/15 border-violet-500/40 text-violet-300', 'bg-violet-400')}
                        </div>
                        <p className="mt-2 text-[10px] font-mono text-red-400/70">Demo: solo profili inventati</p>
                    </div>

                    {/* Strumenti e misure */}
                    <div>
                        <label className={labelCls}>Strumenti e misure</label>
                        <div className="space-y-3">
                            {STUDENT_MEASURES.map(g => (
                                <div key={g.group}>
                                    <p className="text-[10px] text-gray-500 mb-1.5">{g.group}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {g.items.map(m => {
                                            const on = form.measures.includes(m);
                                            return (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => toggleMeasure(m)}
                                                    aria-pressed={on}
                                                    className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${
                                                        on
                                                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                                            : 'bg-gray-900/50 border-gray-700/40 text-gray-500 hover:text-gray-300 hover:border-gray-600/60'
                                                    }`}
                                                >
                                                    {m}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <textarea
                            value={form.otherMeasures}
                            onChange={e => set('otherMeasures', e.target.value)}
                            rows={2}
                            placeholder="Altre misure didattiche (es. consegne lette ad alta voce). Mai diagnosi, certificazioni o informazioni sanitarie."
                            className={`${inputCls} mt-3 resize-none`}
                        />
                    </div>

                    {/* Note didattiche */}
                    <div>
                        <label className={labelCls}>Note didattiche</label>
                        <textarea
                            value={form.notes}
                            onChange={e => set('notes', e.target.value)}
                            rows={2}
                            placeholder="Punti di forza, aree di sviluppo, come lavora meglio…"
                            className={`${inputCls} resize-none`}
                        />
                    </div>

                    {sensitiveTerms.length > 0 && (
                        <p className="text-[11px] leading-relaxed text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                            Il testo sembra contenere informazioni sanitarie ({sensitiveTerms.join(', ')}).
                            Riformula descrivendo solo le misure didattiche: cosa serve, non il perché.
                        </p>
                    )}

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
