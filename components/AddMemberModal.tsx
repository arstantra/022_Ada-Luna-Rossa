import React, { useMemo } from 'react';
import Modal from './Modal';
import type { Conversation, Student, LessonWithGroups } from '../types';

interface AddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddMember: (studentId: string) => void;
    lesson: LessonWithGroups;
    students: Student[];
    conversations: Conversation[];
}

const AddMemberModal: React.FC<AddMemberModalProps> = ({ isOpen, onClose, onAddMember, lesson, students, conversations }) => {
    const availableStudents = useMemo(() => {
        const allStudentIdsInLesson = new Set(
            conversations.find(c => c.id === lesson.convoId)?.weekPlan?.students.map(s => s.id)
        );
        const assignedStudentIds = new Set(lesson.groups.flatMap(g => g.studentIds));
        const availableStudentIds = [...allStudentIdsInLesson].filter(id => !assignedStudentIds.has(id));
        return students.filter(s => availableStudentIds.includes(s.id));
    }, [lesson, students, conversations]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Aggiungi Membro al Gruppo">
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                {availableStudents.length > 0 ? (
                    availableStudents.map(student => (
                        <button
                            key={student.id}
                            onClick={() => { onAddMember(student.id); onClose(); }}
                            className="w-full text-left p-2 rounded-md hover:bg-gray-700/50 transition-colors"
                        >
                            {student.name}
                        </button>
                    ))
                ) : (
                    <p className="text-gray-400 text-center p-4">Tutte le studentesse sono già state assegnate a un gruppo per questa missione.</p>
                )}
            </div>
        </Modal>
    );
};

export default AddMemberModal;