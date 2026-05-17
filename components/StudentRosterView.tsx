import React from 'react';
import type { Student } from '../types';
import { XIcon, UsersIcon } from './Icons';

interface StudentRosterViewProps {
    students: Student[];
    onSelectStudent: (student: Student) => void;
    onClose: () => void;
}

const StudentRosterView: React.FC<StudentRosterViewProps> = ({ students, onSelectStudent, onClose }) => {
    return (
        <main className="flex-1 flex flex-col bg-gray-800 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-3.5 pl-6 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <UsersIcon className="h-6 w-6 text-gray-300" />
                    <h2 className="text-lg font-semibold truncate">Registro Studentesse</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Chiudi registro">
                    <XIcon className="h-5 w-5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-4xl mx-auto">
                    <p className="text-gray-400 mb-4">
                        Seleziona una studentessa per accedere alla sua scheda personale e visualizzare il suo Diario di Bordo.
                    </p>
                    {students.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {students.sort((a, b) => a.name.localeCompare(b.name)).map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => onSelectStudent(student)}
                                    className="p-3 text-left bg-gray-700/60 rounded-lg hover:bg-gray-700 hover:ring-2 hover:ring-blue-500 transition-all duration-150"
                                >
                                    <p className="font-medium text-white">{student.name}</p>
                                    {student.notes && (
                                         <p className="text-xs text-amber-300 mt-1 truncate">Nota: {student.notes}</p>
                                    )}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 px-4 bg-gray-900/50 rounded-lg">
                            <p className="text-gray-300 font-semibold">Nessuna studentessa trovata</p>
                            <p className="text-gray-400 text-sm mt-1">
                                Vai su "L'Equipaggio" per aggiungere le studentesse della classe.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};

export default React.memo(StudentRosterView);
