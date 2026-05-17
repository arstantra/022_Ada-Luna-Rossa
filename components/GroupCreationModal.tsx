import React, { useState, useEffect, useCallback } from 'react';
import Modal from './Modal';
import { SparklesIcon, RefreshIcon } from './Icons';
import * as GeminiService from '../services/gemini';
import type { Student, BlockDetails, GroupDefinition } from '../types';

interface GroupCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    block: BlockDetails;
    studentsInWeek: Student[];
    onSaveGroups: (groups: GroupDefinition[]) => void;
}

const StudentPill: React.FC<{ student: Student, onDragStart: (e: React.DragEvent<HTMLDivElement>, studentId: string) => void }> = ({ student, onDragStart }) => (
    <div
        draggable
        onDragStart={(e) => onDragStart(e, student.id)}
        className="flex items-center px-3 py-1.5 bg-gray-700 rounded-full cursor-grab active:cursor-grabbing"
    >
        <span className="font-medium text-white text-sm">{student.name}</span>
    </div>
);

const GroupCreationModal: React.FC<GroupCreationModalProps> = ({ isOpen, onClose, block, studentsInWeek, onSaveGroups }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [groups, setGroups] = useState<GroupDefinition[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [maxGroupSize, setMaxGroupSize] = useState(3);

    const handleGenerate = useCallback(() => {
        if (studentsInWeek.length === 0) {
            setError("Nessuna studentessa presente per formare i gruppi.");
            return;
        }
        setIsLoading(true);
        setError(null);
        setGroups([]);
        GeminiService.generateGroupSuggestions(studentsInWeek, block.objective || 'Attività di laboratorio', maxGroupSize)
            .then(response => {
                setGroups(response.groups);
            })
            .catch(err => {
                console.error("Error generating groups:", err);
                setError("Impossibile generare i gruppi. Riprova più tardi.");
            })
            .finally(() => {
                setIsLoading(false);
            });
    }, [studentsInWeek, block.objective, maxGroupSize]);

    useEffect(() => {
        if (isOpen) {
            handleGenerate();
        }
    }, [isOpen]); // handleGenerate is stable

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, studentId: string, sourceGroupIndex: number) => {
        e.dataTransfer.setData('studentId', studentId);
        e.dataTransfer.setData('sourceGroupIndex', sourceGroupIndex.toString());
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetGroupIndex: number) => {
        e.preventDefault();
        const studentId = e.dataTransfer.getData('studentId');
        const sourceGroupIndex = parseInt(e.dataTransfer.getData('sourceGroupIndex'), 10);

        if (studentId && sourceGroupIndex !== targetGroupIndex) {
            setGroups(prevGroups => {
                const newGroups = JSON.parse(JSON.stringify(prevGroups));
                const studentIndex = newGroups[sourceGroupIndex].studentIds.indexOf(studentId);
                if (studentIndex > -1) {
                    newGroups[sourceGroupIndex].studentIds.splice(studentIndex, 1);
                    newGroups[targetGroupIndex].studentIds.push(studentId);
                }
                return newGroups;
            });
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };
    
    const handleSave = () => {
        onSaveGroups(groups);
    }

    const footer = (
      <>
        <div></div>
        <div className="space-x-3">
             <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700/50 rounded-md hover:bg-gray-700">Annulla</button>
            <button onClick={handleSave} disabled={isLoading || !!error || groups.length === 0} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
                Conferma e Registra Gruppi
            </button>
        </div>
      </>
    );

    const getStudentById = (id: string) => studentsInWeek.find(s => s.id === id);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Creazione Gruppi di Lavoro" footer={footer}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4 p-3 bg-gray-900/50 rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-3 flex-shrink-0">
                    <label htmlFor="max-group-size" className="text-sm font-medium text-white">Max studentesse per gruppo:</label>
                    <input
                        id="max-group-size"
                        type="number"
                        min="2"
                        max={studentsInWeek.length || 2}
                        value={maxGroupSize}
                        onChange={(e) => setMaxGroupSize(Math.max(2, parseInt(e.target.value, 10)))}
                        className="w-20 p-1.5 bg-gray-700 border border-gray-600 rounded-md text-center focus:ring-2 focus:ring-blue-500"
                    />
                     <button onClick={handleGenerate} disabled={isLoading} className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-60">
                        <RefreshIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}/>
                        Rigenera
                    </button>
                </div>
                <p className="text-gray-400 text-sm text-right flex-grow">
                    Ada propone una suddivisione bilanciata. Puoi modificare i gruppi trascinando i nomi.
                </p>
            </div>

            {isLoading && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                    <SparklesIcon className="h-10 w-10 text-purple-400 animate-pulse mb-4" />
                    <p className="font-semibold text-white">Analizzo le schede personali...</p>
                    <p className="text-sm text-gray-400">Sto creando una proposta di gruppi bilanciati.</p>
                </div>
            )}

            {error && <div className="text-center text-red-400 p-8">{error}</div>}

            {!isLoading && !error && groups.length > 0 && (
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {groups.map((group, groupIndex) => (
                        <div
                            key={`${group.name}-${groupIndex}`}
                            onDrop={(e) => handleDrop(e, groupIndex)}
                            onDragOver={handleDragOver}
                            className="p-4 bg-gray-900/50 rounded-lg border border-gray-700"
                        >
                            <h4 className="font-bold text-white">{group.name}</h4>
                            <div className="flex flex-wrap gap-2 my-3 min-h-[44px]">
                                {group.studentIds.map(studentId => {
                                    const student = getStudentById(studentId);
                                    return student ? <StudentPill key={studentId} student={student} onDragStart={(e, id) => handleDragStart(e, id, groupIndex)} /> : null;
                                })}
                            </div>
                             <p className="text-xs text-amber-200 bg-amber-900/30 p-2 rounded-md">
                               <span className="font-semibold">💡 Motivazione:</span> {group.justification}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </Modal>
    );
};

export default GroupCreationModal;