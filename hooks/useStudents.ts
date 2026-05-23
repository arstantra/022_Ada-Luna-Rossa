// hooks/useStudents.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Student, Evaluation, BlockDetails } from '../types';
import { parseCrewContextToNames } from '../utils';
import * as db from '../services/db';

export const useStudents = (crewContext: string) => {
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const studentsRef = useRef(students);

    useEffect(() => {
        studentsRef.current = students;
    }, [students]);

    useEffect(() => {
        async function loadData() {
            try {
                const savedStudents = await db.getAllStudents();
                const validStudents = savedStudents.filter(
                    (s: any): s is Student => s && typeof s.id === 'string' && typeof s.name === 'string' && Array.isArray(s.evaluations)
                );
                setStudents(validStudents);
            } catch (error) {
                console.error("Failed to load students from DB:", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    const syncStudentsWithContext = useCallback(async () => {
        try {
            const studentNamesFromContext = parseCrewContextToNames(crewContext);
            const allStudentsFromDB = await db.getAllStudents();
            const dbStudentMap = new Map(allStudentsFromDB.map(s => [s.name, s]));
            const contextStudentNames = new Set(studentNamesFromContext);

            const finalStudentList: Student[] = [];
            const studentsToAdd: Student[] = [];
            
            for (const name of studentNamesFromContext) {
                const existingStudent = dbStudentMap.get(name);
                if (existingStudent) {
                    finalStudentList.push(existingStudent);
                } else {
                    const newStudent: Student = {
                        id: `student-${Date.now()}-${Math.random()}`,
                        name,
                        evaluations: [],
                        notes: '',
                    };
                    finalStudentList.push(newStudent);
                    studentsToAdd.push(newStudent);
                }
            }
            
            const studentsToDelete = allStudentsFromDB.filter(s => !contextStudentNames.has(s.name));

            if (studentsToAdd.length > 0) {
                await db.bulkSaveStudents(studentsToAdd);
            }
            if (studentsToDelete.length > 0) {
                await db.bulkDeleteStudents(studentsToDelete.map(s => s.id));
            }

            if (studentsToAdd.length > 0 || studentsToDelete.length > 0) {
                setStudents(finalStudentList);
            }
        } catch (error) {
            console.error("Failed to sync students with context:", error);
        }
    }, [crewContext]);

    const addEvaluationToStudent = useCallback(async (studentId: string, evaluation: Evaluation) => {
        let updatedStudent: Student | null = null;
        const originalStudents = studentsRef.current;
        setStudents(prev => prev.map(s => {
            if (s.id === studentId) {
                const existingEvals = Array.isArray(s.evaluations) ? s.evaluations : [];
                updatedStudent = { ...s, evaluations: [...existingEvals, evaluation] };
                return updatedStudent;
            }
            return s;
        }));
        if (updatedStudent) {
            try {
                await db.saveStudent(updatedStudent);
            } catch (error) {
                console.error("Failed to add evaluation:", error);
                setStudents(originalStudents); // Revert
            }
        }
    }, []);

    const updateStudentNotes = useCallback(async (studentId: string, notes: string) => {
        let updatedStudent: Student | null = null;
        const originalStudents = studentsRef.current;
        setStudents(prev => prev.map(s => {
            if (s.id === studentId) {
                updatedStudent = { ...s, notes };
                return updatedStudent;
            }
            return s;
        }));
        if (updatedStudent) {
            try {
                await db.saveStudent(updatedStudent);
            } catch (error) {
                console.error("Failed to update student notes:", error);
                setStudents(originalStudents); // Revert
            }
        }
    }, []);

    const updateStudentSummary = useCallback(async (studentId: string, summary: { content: string; date: string; }) => {
        let updatedStudent: Student | null = null;
        const originalStudents = studentsRef.current;
        setStudents(prev => prev.map(s => {
            if (s.id === studentId) {
                updatedStudent = { ...s, adaSummary: summary };
                return updatedStudent;
            }
            return s;
        }));
        if (updatedStudent) {
            try {
                await db.saveStudent(updatedStudent);
            } catch (error) {
                console.error("Failed to update student summary:", error);
                setStudents(originalStudents); // Revert
            }
        }
    }, []);

    const recordAttendanceForBlock = useCallback(async (block: BlockDetails, blockIndex: number, weekNumber: number, allWeekStudentIds: string[], presentStudentIds: string[]) => {
        const date = new Date().toISOString();
        const notes = `Blocco ${block.day}: ${block.objective || 'Attività FSL'}`;

        const studentsToUpdate: Student[] = [];
        const originalStudents = studentsRef.current;
        const updatedStudents = originalStudents.map(student => {
            if (allWeekStudentIds.includes(student.id)) {
                const isPresent = presentStudentIds.includes(student.id);
                const evaluation: Evaluation = {
                    date,
                    value: isPresent ? 'Presente' : 'Assente',
                    notes,
                    weekNumber,
                    blockIndex,
                    module: block.module,
                };
                const existingEvals = Array.isArray(student.evaluations) ? student.evaluations : [];
                const updatedStudent = { ...student, evaluations: [...existingEvals, evaluation] };
                studentsToUpdate.push(updatedStudent);
                return updatedStudent;
            }
            return student;
        });

        if (studentsToUpdate.length > 0) {
            setStudents(updatedStudents);
            try {
                await db.bulkSaveStudents(studentsToUpdate);
            } catch (error) {
                console.error("Failed to record attendance:", error);
                setStudents(originalStudents); // Revert
            }
        }
    }, []);

    return {
        students,
        isLoading,
        syncStudentsWithContext,
        addEvaluationToStudent,
        updateStudentNotes,
        updateStudentSummary,
        recordAttendanceForBlock,
    };
};