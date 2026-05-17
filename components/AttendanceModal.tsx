import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import type { Student } from '../types';

interface AttendanceModalProps {
    isOpen: boolean;
    onClose: () => void;
    students: Omit<Student, 'notes' | 'evaluations' | 'autonomousActivities'>[];
    onSubmit: (presentStudentIds: string[]) => void;
    blockTitle: string;
}

const AttendanceModal: React.FC<AttendanceModalProps> = ({ isOpen, onClose, students, onSubmit, blockTitle }) => {
    // By default, everyone is present
    const [presentIds, setPresentIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen) {
            setPresentIds(new Set(students.map(s => s.id)));
        }
    }, [isOpen, students]);

    const handleToggleStudent = (studentId: string) => {
        setPresentIds(prev => {
            const newSet = new Set(prev);
            if (newSet.has(studentId)) {
                newSet.delete(studentId); // Mark as absent
            } else {
                newSet.add(studentId); // Mark as present
            }
            return newSet;
        });
    };
    
    const handleSelectAll = () => {
        if (presentIds.size === students.length) {
            setPresentIds(new Set()); // Deselect all
        } else {
            setPresentIds(new Set(students.map(s => s.id))); // Select all
        }
    }

    const handleSubmit = () => {
        onSubmit(Array.from(presentIds));
    };

    const footer = (
      <>
        <div></div>
        <div className="space-x-3">
             <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
            <button onClick={handleSubmit} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">
                Conferma Presenze e Procedi
            </button>
        </div>
      </>
    );

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Appello per ${blockTitle}`} footer={footer}>
            <p className="text-gray-400 text-sm mb-4">Deseleziona le studentesse assenti. Le presenze verranno registrate nel loro diario di bordo.</p>
            <div className="border-b border-t border-gray-700">
                <div className="flex items-center justify-between p-2">
                    <label htmlFor="select-all-students-attendance" className="flex items-center text-sm font-medium text-gray-200 cursor-pointer">
                        <input
                            id="select-all-students-attendance"
                            type="checkbox"
                            checked={students.length > 0 && presentIds.size === students.length}
                            onChange={handleSelectAll}
                            className="h-4 w-4 rounded border-gray-500 text-blue-500 focus:ring-blue-600 bg-gray-700 mr-3"
                        />
                         {presentIds.size === students.length ? 'Deseleziona Tutto' : 'Seleziona Tutto'}
                    </label>
                    <span className="text-sm text-gray-400">{presentIds.size} / {students.length} presenti</span>
                </div>
            </div>
            <div className="max-h-80 overflow-y-auto mt-2 pr-2 grid grid-cols-2 gap-2">
                {students.map(student => {
                    const isPresent = presentIds.has(student.id);
                    return (
                        <label
                            key={student.id}
                            htmlFor={`student-attendance-check-${student.id}`}
                            className={`flex items-center p-2 rounded-md cursor-pointer transition-colors border ${isPresent ? 'bg-blue-500/10 border-blue-500/50' : 'bg-gray-700/50 border-transparent hover:bg-gray-700'}`}
                        >
                            <input
                                id={`student-attendance-check-${student.id}`}
                                type="checkbox"
                                checked={isPresent}
                                onChange={() => handleToggleStudent(student.id)}
                                className="h-4 w-4 rounded border-gray-500 text-blue-500 focus:ring-blue-600 bg-gray-700"
                            />
                            <span className="ml-3 text-sm text-white">{student.name}</span>
                        </label>
                    );
                })}
            </div>
        </Modal>
    );
};

export default AttendanceModal;
