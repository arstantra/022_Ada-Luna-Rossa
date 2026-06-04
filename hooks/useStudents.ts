// hooks/useStudents.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Student, Evaluation, BlockDetails } from '../types';
// Student type ora include firstName, lastName, hasBES, hasDSA, besNotes, dsaNotes, certificationNotes
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

                // Migrazione: corregge nomi corrotti dal bug parseCrewContextToNames.
                // I nomi corrotti contengono il formato ricco di buildCrewContext:
                // "Andrea Poletti [BES] — BES: scrive male | Note: ragazzo brillante"
                // Estrae nome pulito, flag e note dal nome corrotto e aggiorna il record.
                const migratedStudents: Student[] = validStudents.map(s => {
                    if (!s.name.includes('[') && !s.name.includes(' — ')) return s;
                    const flagMatch = s.name.match(/\[(.*?)\]/);
                    const flags = flagMatch ? flagMatch[1].split(',').map(f => f.trim()) : [];
                    const notesSection = (s.name.match(/—\s*(.*?)$/) ?? [])[1] ?? '';
                    const extract = (key: string) =>
                        (notesSection.match(new RegExp(`${key}:\\s*(.*?)(?:\\s*\\||\\s*$)`)) ?? [])[1]?.trim();
                    const cleanName = s.name.replace(/\s*\[.*?\]/, '').replace(/\s*—.*$/, '').trim();
                    const parts = cleanName.split(/\s+/);
                    return {
                        ...s,
                        name: cleanName,
                        firstName: s.firstName || (parts.length >= 2 ? parts.slice(0, -1).join(' ') : cleanName),
                        lastName:  s.lastName  || (parts.length >= 2 ? parts.at(-1)! : ''),
                        hasBES: s.hasBES || flags.includes('BES') || undefined,
                        hasDSA: s.hasDSA || flags.includes('DSA') || undefined,
                        hasPEI: s.hasPEI || flags.includes('PEI') || undefined,
                        besNotes:           s.besNotes           || extract('BES'),
                        dsaNotes:           s.dsaNotes           || extract('DSA'),
                        peiNotes:           s.peiNotes           || extract('PEI'),
                        certificationNotes: s.certificationNotes || extract('Certificazioni'),
                        notes:              s.notes              || extract('Note') || '',
                    };
                });
                const toRepair = migratedStudents.filter((s, i) => s.name !== validStudents[i].name);
                if (toRepair.length > 0) {
                    await db.bulkSaveStudents(toRepair);
                    console.info(`[useStudents] Migrati ${toRepair.length} record con nome corrotto.`);
                }

                setStudents(migratedStudents);
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

    /** Aggiunge uno studente dalla lista strutturata (modale Equipaggio) */
    const addStructuredStudent = useCallback(async (data: Omit<Student, 'id' | 'evaluations' | 'adaSummary'>): Promise<Student> => {
        const newStudent: Student = {
            id: `student-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            name: data.name,
            firstName: data.firstName,
            lastName: data.lastName,
            notes: data.notes ?? '',
            evaluations: [],
            hasBES: data.hasBES,
            hasDSA: data.hasDSA,
            hasPEI: data.hasPEI,
            besNotes: data.besNotes,
            dsaNotes: data.dsaNotes,
            peiNotes: data.peiNotes,
            certificationNotes: data.certificationNotes,
        };
        setStudents(prev => [...prev, newStudent].sort((a, b) => a.name.localeCompare(b.name, 'it')));
        await db.saveStudent(newStudent);
        return newStudent;
    }, []);

    /** Aggiorna i dati anagrafici/inclusione di uno studente (modale Equipaggio) */
    const updateStructuredStudent = useCallback(async (id: string, data: Partial<Omit<Student, 'id' | 'evaluations' | 'adaSummary'>>) => {
        let updated: Student | null = null;
        setStudents(prev => prev.map(s => {
            if (s.id !== id) return s;
            updated = { ...s, ...data };
            return updated;
        }));
        if (updated) await db.saveStudent(updated);
    }, []);

    /** Elimina uno studente dalla lista strutturata */
    const deleteStructuredStudent = useCallback(async (id: string) => {
        setStudents(prev => prev.filter(s => s.id !== id));
        await db.bulkDeleteStudents([id]);
    }, []);

    return {
        students,
        isLoading,
        syncStudentsWithContext,
        addEvaluationToStudent,
        updateStudentNotes,
        updateStudentSummary,
        recordAttendanceForBlock,
        addStructuredStudent,
        updateStructuredStudent,
        deleteStructuredStudent,
    };
};
