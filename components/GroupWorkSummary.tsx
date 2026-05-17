import React, { useState, useEffect, useRef } from 'react';
import type { GroupDefinition, Student } from '../types';
import { ChevronDownIcon, UsersIcon } from './Icons';

interface GroupWorkSummaryProps {
    groups: GroupDefinition[];
    allStudents: { id: string; name: string; }[];
    isEditable: boolean;
    onUpdateGroups: (groups: GroupDefinition[]) => void;
    onUpdateGroupNotes: (groupIndex: number, notes: string) => void;
}

const StudentPill: React.FC<{ 
    student: {id: string, name: string}, 
    isDraggable: boolean,
    onDragStart: (e: React.DragEvent<HTMLDivElement>, studentId: string) => void 
}> = React.memo(({ student, isDraggable, onDragStart }) => (
    <div
        draggable={isDraggable}
        onDragStart={isDraggable ? (e) => onDragStart(e, student.id) : undefined}
        className={`flex items-center px-3 py-1.5 bg-gray-700 rounded-full ${isDraggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
    >
        <span className="font-medium text-white text-sm">{student.name}</span>
    </div>
));
StudentPill.displayName = 'StudentPill';


const GroupCard: React.FC<{
    group: GroupDefinition;
    groupIndex: number;
    allStudents: { id: string; name: string; }[];
    isEditable: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, studentId: string, sourceGroupIndex: number) => void;
    onDrop: (e: React.DragEvent<HTMLDivElement>, targetGroupIndex: number) => void;
    onUpdateNotes: (notes: string) => void;
}> = React.memo(({ group, groupIndex, allStudents, isEditable, onDragStart, onDrop, onUpdateNotes }) => {
    const [notes, setNotes] = useState(group.notes || '');
    const autosaveTimeoutRef = useRef<number | null>(null);
    const getStudentById = (id: string) => allStudents.find(s => s.id === id);
    
    useEffect(() => {
        setNotes(group.notes || '');
    }, [group.notes]);

    useEffect(() => {
        if (!isEditable) return;
        if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = window.setTimeout(() => {
            if (notes !== (group.notes || '')) {
                onUpdateNotes(notes);
            }
        }, 1500);
        return () => {
            if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
        };
    }, [notes, group.notes, onUpdateNotes, isEditable]);


    return (
        <div
            onDrop={isEditable ? (e) => onDrop(e, groupIndex) : undefined}
            onDragOver={isEditable ? (e) => e.preventDefault() : undefined}
            className="p-4 bg-gray-900/50 rounded-lg border border-gray-700"
        >
            <h4 className="font-bold text-white">{group.name}</h4>
            <div className="flex flex-wrap gap-2 my-3 min-h-[44px]">
                {group.studentIds.map(studentId => {
                    const student = getStudentById(studentId);
                    return student ? <StudentPill key={studentId} student={student} isDraggable={isEditable} onDragStart={(e, id) => onDragStart(e, id, groupIndex)} /> : null;
                })}
            </div>
            {group.justification && (
                <p className="text-xs text-amber-200 bg-amber-900/30 p-2 rounded-md">
                   <span className="font-semibold">💡 Motivazione:</span> {group.justification}
                </p>
            )}
            <div className="mt-3">
                 <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    readOnly={!isEditable}
                    placeholder="Aggiungi note sul lavoro del gruppo..."
                    className="w-full text-sm p-2 bg-gray-800 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-200 resize-y disabled:bg-gray-800/50"
                />
            </div>
        </div>
    );
});
GroupCard.displayName = 'GroupCard';

const GroupWorkSummary: React.FC<GroupWorkSummaryProps> = ({ groups, allStudents, isEditable, onUpdateGroups, onUpdateGroupNotes }) => {
    const [isOpen, setIsOpen] = useState(true);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, studentId: string, sourceGroupIndex: number) => {
        if (!isEditable) return;
        e.dataTransfer.setData('studentId', studentId);
        e.dataTransfer.setData('sourceGroupIndex', sourceGroupIndex.toString());
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetGroupIndex: number) => {
        if (!isEditable) return;
        e.preventDefault();
        const studentId = e.dataTransfer.getData('studentId');
        const sourceGroupIndex = parseInt(e.dataTransfer.getData('sourceGroupIndex'), 10);

        if (studentId && sourceGroupIndex !== targetGroupIndex) {
            const newGroups = JSON.parse(JSON.stringify(groups));
            const studentIndex = newGroups[sourceGroupIndex].studentIds.indexOf(studentId);
            if (studentIndex > -1) {
                newGroups[sourceGroupIndex].studentIds.splice(studentIndex, 1);
                newGroups[targetGroupIndex].studentIds.push(studentId);
                onUpdateGroups(newGroups);
            }
        }
    };

    return (
        <div className="mt-4">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-left"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-semibold text-white">
                        Gruppi di Lavoro ({groups.length})
                    </span>
                </div>
                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="mt-3 space-y-4 animate-fade-in-down">
                    {groups.map((group, index) => (
                        <GroupCard
                            key={`${group.name}-${index}`}
                            group={group}
                            groupIndex={index}
                            allStudents={allStudents}
                            isEditable={isEditable}
                            onDragStart={handleDragStart}
                            onDrop={handleDrop}
                            onUpdateNotes={(notes) => onUpdateGroupNotes(index, notes)}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default React.memo(GroupWorkSummary);