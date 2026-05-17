import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import type { Student, Evaluation } from '../types';
import { XIcon, UserIcon, ChevronDownIcon, CheckCircleIcon, XCircleIcon, SparklesIcon, ClipboardDocumentCheckIcon } from './Icons';
import * as GeminiService from '../services/gemini';
import MarkdownRenderer from './MarkdownRenderer';


interface StudentProfileViewProps {
    student: Student;
    onClose: () => void;
    onUpdateNotes: (studentId: string, notes: string) => void;
    onUpdateSummary: (studentId: string, summary: { content: string; date: string; }) => void;
    onOpenImportModal: (student: Student) => void;
}

interface LogbookEntry extends Evaluation {
    id: string; // Use date as a unique ID for rendering
}

interface GroupedLogbook {
    [weekNumber: number]: {
        blocks: LogbookEntry[];
    };
}

const LogbookAccordion: React.FC<{ weekNumber: number; blocks: LogbookEntry[] }> = memo(({ weekNumber, blocks }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-gray-700/50 rounded-lg">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-gray-700 transition-colors"
            >
                <span className="font-semibold text-white">Settimana {weekNumber}</span>
                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="border-t border-gray-600/50 p-3 space-y-2">
                    {blocks.sort((a, b) => (a.blockIndex ?? 0) - (b.blockIndex ?? 0)).map(block => (
                         <div key={block.id} className="flex items-start gap-3 p-2 rounded-md bg-gray-800/50">
                            {block.value === 'Presente' 
                                ? <CheckCircleIcon className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" /> 
                                : <XCircleIcon className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />}
                           <div>
                               <p className="font-medium text-gray-200">{block.notes}</p>
                               <p className="text-xs text-gray-400">
                                   {block.module}{block.pillar ? ` > ${block.pillar}`: ''}
                               </p>
                           </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

const StudentProfileView: React.FC<StudentProfileViewProps> = ({ student, onClose, onUpdateNotes, onUpdateSummary, onOpenImportModal }) => {
    const [currentNotes, setCurrentNotes] = useState(student.notes || '');
    const autosaveTimeoutRef = useRef<number | null>(null);
    const [isSummarizing, setIsSummarizing] = useState(false);

    useEffect(() => {
        setCurrentNotes(student.notes || '');
    }, [student]);

    useEffect(() => {
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
        }
        autosaveTimeoutRef.current = window.setTimeout(() => {
            if (currentNotes !== student.notes) {
                onUpdateNotes(student.id, currentNotes);
            }
        }, 1500); // Autosave after 1.5 seconds of inactivity

        return () => {
            if (autosaveTimeoutRef.current) {
                clearTimeout(autosaveTimeoutRef.current);
            }
        };
    }, [currentNotes, student.id, student.notes, onUpdateNotes]);

    const handleGenerateSummary = async () => {
        setIsSummarizing(true);
        try {
            const summaryContent = await GeminiService.generateStudentSummary(
                student.name,
                student.notes || '',
                student.evaluations || []
            );
            onUpdateSummary(student.id, {
                content: summaryContent,
                date: new Date().toISOString(),
            });
        } catch (error) {
            console.error("Failed to generate student summary", error);
            // In a real app, you'd show a toast notification here.
        } finally {
            setIsSummarizing(false);
        }
    };

    const logbookData = useMemo<GroupedLogbook>(() => {
        return student.evaluations
            .filter((e): e is LogbookEntry => typeof e.weekNumber === 'number')
            .reduce((acc, entry) => {
                const week = entry.weekNumber!;
                if (!acc[week]) {
                    acc[week] = { blocks: [] };
                }
                acc[week].blocks.push({ ...entry, id: entry.date });
                return acc;
            }, {} as GroupedLogbook);
    }, [student.evaluations]);

    const sortedWeeks = useMemo(() => Object.keys(logbookData).sort((a, b) => parseInt(a) - parseInt(b)), [logbookData]);

    return (
        <main className="flex-1 flex flex-col bg-gray-800 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-3.5 pl-6 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <UserIcon className="h-6 w-6 text-gray-300" />
                    <h2 className="text-lg font-semibold truncate">Scheda Personale: {student.name}</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" aria-label="Chiudi scheda">
                    <XIcon className="h-5 w-5" />
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* LEFT COLUMN */}
                    <div className="flex flex-col gap-8">
                        {/* Notes Section */}
                        <div className="flex flex-col">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xl font-bold text-white">Note e Osservazioni</h3>
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => onOpenImportModal(student)}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 transition-colors"
                                    >
                                        <ClipboardDocumentCheckIcon className="h-4 w-4"/>
                                        Importa Valutazione
                                    </button>
                                    <button 
                                        onClick={handleGenerateSummary} 
                                        disabled={isSummarizing}
                                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 transition-colors disabled:opacity-60"
                                    >
                                        <SparklesIcon className={`h-4 w-4 ${isSummarizing ? 'animate-pulse' : ''}`}/>
                                        {isSummarizing ? 'Analisi...' : (student.adaSummary ? 'Aggiorna' : 'Crea Sintesi')}
                                    </button>
                                </div>
                            </div>
                            <textarea
                                value={currentNotes}
                                onChange={(e) => setCurrentNotes(e.target.value)}
                                placeholder="Inserisci qui note non strutturate sulla studentessa (estratti PEI, osservazioni, stile di apprendimento...)"
                                className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 text-gray-200 resize-none min-h-[250px]"
                            />
                            <p className="text-xs text-right text-gray-400 mt-2">Le note vengono salvate automaticamente.</p>
                        </div>
                        
                        {/* Ada Summary Section */}
                        {isSummarizing && !student.adaSummary && (
                             <div className="bg-gray-700/30 p-4 rounded-lg border border-purple-500/30 flex items-center justify-center h-48">
                                <p className="text-purple-300 flex items-center gap-2"><SparklesIcon className="h-5 w-5 animate-pulse" /> Sto generando la sintesi...</p>
                            </div>
                        )}
                        {student.adaSummary && (
                            <div className="bg-gray-700/30 p-4 rounded-lg border border-purple-500/30 animate-fade-in-down">
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-semibold text-purple-300 flex items-center gap-2">
                                        <SparklesIcon className="h-5 w-5"/>
                                        Sintesi Analitica di Ada
                                    </h4>
                                    <p className="text-xs text-gray-400">
                                        Analisi del {new Date(student.adaSummary.date).toLocaleDateString('it-IT')}
                                    </p>
                                </div>
                                <MarkdownRenderer content={student.adaSummary.content} />
                            </div>
                        )}
                    </div>
                    {/* Logbook Section */}
                    <div>
                        <h3 className="text-xl font-bold text-white mb-3">Diario di Bordo Individuale</h3>
                        <div className="space-y-3">
                            {sortedWeeks.length > 0 ? (
                                sortedWeeks.map(weekNum => (
                                    <LogbookAccordion 
                                        key={weekNum}
                                        weekNumber={parseInt(weekNum)}
                                        blocks={logbookData[parseInt(weekNum)].blocks}
                                    />
                                ))
                            ) : (
                                <div className="text-center p-8 bg-gray-700/30 rounded-lg">
                                    <p className="text-gray-400">Nessuna attività registrata nel diario di bordo.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default React.memo(StudentProfileView);