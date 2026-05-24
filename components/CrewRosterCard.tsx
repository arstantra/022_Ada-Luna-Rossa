import React, { useState, useCallback } from 'react';
import type { Student } from '../types';
import StudentFormModal from './StudentFormModal';
import { PencilIcon, XIcon } from './Icons';

interface CrewRosterCardProps {
    students: Student[];
    onAddStudent: (data: Omit<Student, 'id' | 'evaluations' | 'adaSummary'>) => Promise<Student>;
    onUpdateStudent: (id: string, data: Partial<Omit<Student, 'id' | 'evaluations' | 'adaSummary'>>) => Promise<void>;
    onDeleteStudent: (id: string) => Promise<void>;
    /** Chiamata ogni volta che la lista cambia, per aggiornare il crewContext di Ada */
    onCrewContextChange: (crewContext: string) => void;
}

/**
 * Genera il crewContext testuale che Ada usa come contesto.
 * Il formato è leggibile e strutturato: un'riga per studente con eventuale
 * indicazione di BES/DSA e note, così Ada può ragionare su ogni profilo.
 */
export const buildCrewContext = (students: Student[]): string => {
    if (students.length === 0) return '';
    return students
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'it'))
        .map(s => {
            let line = s.name;
            const flags: string[] = [];
            if (s.hasBES) flags.push('BES');
            if (s.hasDSA) flags.push('DSA');
            if (flags.length > 0) line += ` [${flags.join(', ')}]`;
            const details: string[] = [];
            if (s.besNotes) details.push(`BES: ${s.besNotes}`);
            if (s.dsaNotes) details.push(`DSA: ${s.dsaNotes}`);
            if (s.certificationNotes) details.push(`Certificazioni: ${s.certificationNotes}`);
            if (s.notes) details.push(`Note: ${s.notes}`);
            if (details.length > 0) line += ` — ${details.join(' | ')}`;
            return line;
        })
        .join('\n');
};

/** Iniziali per l'avatar */
const initials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return name.slice(0, 2).toUpperCase();
};

/** Colore avatar deterministico dal nome */
const avatarColor = (name: string): string => {
    const colors = [
        'bg-violet-700/60', 'bg-blue-700/60', 'bg-teal-700/60',
        'bg-emerald-700/60', 'bg-amber-700/60', 'bg-rose-700/60',
        'bg-sky-700/60', 'bg-indigo-700/60', 'bg-fuchsia-700/60',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
};

const CrewRosterCard: React.FC<CrewRosterCardProps> = ({
    students,
    onAddStudent,
    onUpdateStudent,
    onDeleteStudent,
    onCrewContextChange,
}) => {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingStudent, setEditingStudent] = useState<Student | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const sorted = [...students].sort((a, b) => a.name.localeCompare(b.name, 'it'));

    const handleSave = useCallback(async (data: Omit<Student, 'id' | 'evaluations' | 'adaSummary'>) => {
        if (editingStudent) {
            await onUpdateStudent(editingStudent.id, data);
            // Aggiorna crewContext con la lista modificata
            const updated = students.map(s => s.id === editingStudent.id ? { ...s, ...data } : s);
            onCrewContextChange(buildCrewContext(updated));
        } else {
            const newStudent = await onAddStudent(data);
            onCrewContextChange(buildCrewContext([...students, newStudent]));
        }
        setModalOpen(false);
        setEditingStudent(null);
    }, [editingStudent, students, onAddStudent, onUpdateStudent, onCrewContextChange]);

    const handleDelete = useCallback(async (id: string) => {
        setDeletingId(id);
        await onDeleteStudent(id);
        const remaining = students.filter(s => s.id !== id);
        onCrewContextChange(buildCrewContext(remaining));
        setDeletingId(null);
    }, [students, onDeleteStudent, onCrewContextChange]);

    const openEdit = (s: Student) => {
        setEditingStudent(s);
        setModalOpen(true);
    };

    const openAdd = () => {
        setEditingStudent(null);
        setModalOpen(true);
    };

    return (
        <div className="space-y-2">
            {/* Lista studenti */}
            {sorted.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-sm">
                    <p>Nessuno studente ancora.</p>
                    <p className="text-xs mt-1 text-gray-700">Aggiungi il primo con il pulsante qui sotto.</p>
                </div>
            ) : (
                <div className="space-y-1.5">
                    {sorted.map(s => (
                        <div
                            key={s.id}
                            className="group flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gray-900/50 border border-gray-700/30 hover:border-gray-600/40 transition-colors"
                        >
                            {/* Avatar */}
                            <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold text-white ${avatarColor(s.name)}`}>
                                {initials(s.name)}
                            </div>

                            {/* Nome + badge */}
                            <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                                <span className="text-sm text-gray-200 truncate">{s.name}</span>
                                {s.hasBES && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/25 text-amber-400">
                                        BES
                                    </span>
                                )}
                                {s.hasDSA && (
                                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/25 text-blue-400">
                                        DSA
                                    </span>
                                )}
                            </div>

                            {/* Azioni — visibili al hover */}
                            <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => openEdit(s)}
                                    title="Modifica"
                                    className="p-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 transition-colors"
                                >
                                    <PencilIcon className="h-3.5 w-3.5" />
                                </button>
                                <button
                                    onClick={() => handleDelete(s.id)}
                                    disabled={deletingId === s.id}
                                    title="Rimuovi"
                                    className="p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                                >
                                    <XIcon className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Conteggio + pulsante aggiungi */}
            <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] font-mono text-gray-600">
                    {sorted.length > 0 ? `${sorted.length} student${sorted.length === 1 ? 'e' : 'sse/i'}` : ''}
                </span>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-300 border border-gray-700/50 rounded-lg hover:bg-gray-800/60 hover:border-gray-600/60 hover:text-white transition-colors"
                >
                    <span className="text-base leading-none font-light text-gray-400">+</span>
                    Aggiungi studente
                </button>
            </div>

            {/* Modale */}
            {modalOpen && (
                <StudentFormModal
                    student={editingStudent}
                    onSave={handleSave}
                    onClose={() => { setModalOpen(false); setEditingStudent(null); }}
                />
            )}
        </div>
    );
};

export default CrewRosterCard;
