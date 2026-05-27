import React, { useState, useMemo, memo, useCallback } from 'react';
import type { Conversation, Student, GroupDefinition, BlockDetails, LessonWithGroups } from '../types';
import { UsersIcon, XIcon, SearchIcon, ChevronDownIcon, CalendarDaysIcon, PlusCircleIcon, CheckCircleIcon, PencilIcon } from './Icons';
import { getExactDateForBlock } from '../utils';
import type { useMasterContext } from '../hooks/useMasterContext';
import AddMemberModal from './AddMemberModal';

interface GroupsArchiveViewProps {
    conversations: Conversation[];
    students: Student[];
    onClose: () => void;
    masterContext: ReturnType<typeof useMasterContext>;
    onUpdateBlock: (convoId: string, blockIndex: number, updatedBlockData: Partial<BlockDetails>) => void;
}

const GroupsArchiveView: React.FC<GroupsArchiveViewProps> = ({ conversations, students, onClose, masterContext, onUpdateBlock }) => {
    const [selectedWeek, setSelectedWeek] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [openLessons, setOpenLessons] = useState<Set<string>>(new Set());
    const [editingDeadline, setEditingDeadline] = useState<string | null>(null); // lessonId
    const [editingCompletionDate, setEditingCompletionDate] = useState<string | null>(null); // `${lessonId}-${groupIndex}`
    const [editingMissionCompletionDate, setEditingMissionCompletionDate] = useState<string | null>(null); // lessonId
    const [addMemberModalInfo, setAddMemberModalInfo] = useState<{ lesson: LessonWithGroups; groupIndex: number } | null>(null);

    const { lessonsWithGroups, availableWeeks } = useMemo(() => {
        const lessons: LessonWithGroups[] = [];
        const weekNumbers = new Set<number>();

        for (const convo of conversations) {
            if (convo.weekPlan && Array.isArray(convo.weekPlan.blocks)) {
                for (const [index, block] of convo.weekPlan.blocks.entries()) {
                    if (block.allocations?.data.groups && block.allocations.data.groups.length > 0) {
                        const sortableDate = getExactDateForBlock(convo.weekPlan.dates, block.day, masterContext.teacherProfile) || new Date(0);
                        lessons.push({
                            convoId: convo.id,
                            weekNumber: convo.weekPlan.weekNumber,
                            weekTheme: convo.weekPlan.theme,
                            blockIndex: index,
                            blockDay: block.day,
                            blockObjective: block.objective,
                            groups: block.allocations.data.groups,
                            sortableDate,
                            weekDates: convo.weekPlan.dates,
                            projectDeadline: block.projectDeadline,
                        });
                        weekNumbers.add(convo.weekPlan.weekNumber);
                    }
                }
            }
        }
        lessons.sort((a, b) => b.sortableDate.getTime() - a.sortableDate.getTime());
        return { lessonsWithGroups: lessons, availableWeeks: Array.from(weekNumbers).sort((a, b) => a - b) };
    }, [conversations, masterContext.teacherProfile]);

    const filteredLessons = useMemo(() => {
        const studentNameQuery = searchQuery.toLowerCase().trim();
        const studentIdMap = new Map(students.map(s => [s.id, s.name.toLowerCase()]));

        return lessonsWithGroups.filter(lesson => {
            const weekMatch = selectedWeek === 'all' || lesson.weekNumber === parseInt(selectedWeek, 10);
            if (!weekMatch) return false;

            if (studentNameQuery) {
                for (const group of lesson.groups) {
                    for (const studentId of group.studentIds) {
                        const studentName = studentIdMap.get(studentId);
                        if (studentName && typeof studentName === 'string' && studentName.includes(studentNameQuery)) {
                            return true;
                        }
                    }
                }
                return false;
            }

            return true;
        });
    }, [lessonsWithGroups, selectedWeek, searchQuery, students]);
    
    const getStudentNameById = (id: string): string => students.find(s => s.id === id)?.name || 'Sconosciuto';

    const handleToggleLesson = (lessonId: string) => {
        setOpenLessons(prev => {
            const newSet = new Set(prev);
            if (newSet.has(lessonId)) {
                newSet.delete(lessonId);
            } else {
                newSet.add(lessonId);
            }
            return newSet;
        });
    };
    
    const handleUpdateGroup = useCallback((lesson: LessonWithGroups, groupIndex: number, newGroupData: Partial<GroupDefinition>) => {
        const newGroups = [...lesson.groups];
        newGroups[groupIndex] = { ...newGroups[groupIndex], ...newGroupData };
        onUpdateBlock(lesson.convoId, lesson.blockIndex, {
            allocations: { type: 'group', data: { groups: newGroups } }
        });
    }, [onUpdateBlock]);
    
    const handleMissionCompletionDateChange = useCallback((lesson: LessonWithGroups, newDate: string) => {
        const newGroups = lesson.groups.map(g => ({
            ...g,
            completionDate: newDate,
            isComplete: true
        }));
        onUpdateBlock(lesson.convoId, lesson.blockIndex, {
            allocations: { type: 'group', data: { groups: newGroups } }
        });
    }, [onUpdateBlock]);

    const handleAddMember = (studentId: string) => {
        if (!addMemberModalInfo) return;
        const { lesson, groupIndex } = addMemberModalInfo;
        const group = lesson.groups[groupIndex];

        const updatedGroup: Partial<GroupDefinition> = {
            studentIds: [...group.studentIds, studentId],
            addedStudentIds: [...(group.addedStudentIds || []), studentId],
        };
        handleUpdateGroup(lesson, groupIndex, updatedGroup);
    };

    return (
        <main className="flex-1 flex flex-col bg-gray-900 overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-3.5 pl-6 border-b border-gray-700/50 bg-gray-800/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <UsersIcon className="h-6 w-6 text-indigo-400" />
                    <h2 className="text-lg font-semibold truncate">Archivio Gruppi di Lavoro</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" aria-label="Chiudi">
                    <XIcon className="h-5 w-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* Filters */}
                    <div className="p-4 bg-gray-800 rounded-lg border border-gray-700/50 flex flex-col md:flex-row items-center gap-4">
                        <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="w-full md:w-auto bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
                            <option value="all">Tutte le settimane</option>
                            {availableWeeks.map(weekNum => <option key={weekNum} value={weekNum}>Settimana {weekNum}</option>)}
                        </select>
                        <div className="relative flex-grow w-full md:w-auto">
                            <SearchIcon className="h-5 w-5 text-gray-400 absolute top-1/2 left-3 -translate-y-1/2" />
                            <input 
                                type="search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Cerca per nome studente..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Group List */}
                    {filteredLessons.length > 0 ? (
                        <div className="space-y-3">
                            {filteredLessons.map(lesson => {
                                const lessonId = `${lesson.convoId}-${lesson.blockIndex}`;
                                const isOpen = openLessons.has(lessonId);
                                
                                const date = lesson.sortableDate;
                                let formattedDate = 'Data non disponibile';
                                if (date.getTime() !== 0) {
                                    const weekday = date.toLocaleDateString('it-IT', { weekday: 'short' });
                                    const day = String(date.getDate()).padStart(2, '0');
                                    let month = date.toLocaleDateString('it-IT', { month: 'short' });
                                    if (!month.endsWith('.')) {
                                        month += '.';
                                    }
                                    const year = date.getFullYear();
                                    formattedDate = `${weekday} ${day} ${month} ${year}`;
                                }


                                const allGroupsComplete = lesson.groups.length > 0 && lesson.groups.every(g => g.isComplete);
                                let lastCompletionDate: Date | null = null;
                                if (allGroupsComplete) {
                                    const completionDates = lesson.groups
                                        .map(g => g.completionDate)
                                        .filter((d): d is string => !!d)
                                        .map(d => new Date(d));
                                    if (completionDates.length > 0) {
                                        lastCompletionDate = new Date(Math.max(...completionDates.map(d => d.getTime())));
                                    }
                                }

                                const accordionBorderClass = allGroupsComplete
                                    ? 'border-green-500'
                                    : 'border-yellow-500';

                                return (
                                    <div key={lessonId} className={`bg-gray-800/60 rounded-lg border ${accordionBorderClass} overflow-hidden`}>
                                        <button
                                            onClick={() => handleToggleLesson(lessonId)}
                                            className="w-full text-left p-4 flex justify-between items-center hover:bg-gray-700/30 transition-colors"
                                            aria-expanded={isOpen}
                                        >
                                            <div className="group">
                                                <p className="text-sm text-gray-400">Settimana {lesson.weekNumber}: {lesson.weekTheme}</p>
                                                <h3 className="text-lg text-white mt-1">
                                                    <strong className="font-bold">Lavoro di Gruppo di {formattedDate}:</strong>{' '}
                                                    <span className="font-normal">{lesson.blockObjective || 'Missione non specificata'}</span>
                                                </h3>

                                                {allGroupsComplete && lastCompletionDate && (
                                                    <div className="text-sm font-semibold text-green-400 mt-2 flex items-center gap-2">
                                                        <CheckCircleIcon className="h-5 w-5" />
                                                        <span>Missione Conclusa il:</span>
                                                        {editingMissionCompletionDate === lessonId ? (
                                                            <input
                                                                type="date"
                                                                value={lastCompletionDate.toISOString().split('T')[0]}
                                                                onChange={(e) => handleMissionCompletionDateChange(lesson, e.target.value)}
                                                                onBlur={() => setEditingMissionCompletionDate(null)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                autoFocus
                                                                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white"
                                                            />
                                                        ) : (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setEditingMissionCompletionDate(lessonId); }}
                                                                className="hover:underline flex items-center gap-1"
                                                            >
                                                                {lastCompletionDate.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                                <PencilIcon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <ChevronDownIcon className={`h-6 w-6 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        
                                        <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                                            <div className="overflow-hidden">
                                                <div className="p-4 border-t border-gray-700/50">
                                                    <div className="mb-4 flex items-center gap-4">
                                                        {editingDeadline === lessonId ? (
                                                            <input
                                                                type="date"
                                                                value={lesson.projectDeadline || ''}
                                                                onChange={(e) => onUpdateBlock(lesson.convoId, lesson.blockIndex, { projectDeadline: e.target.value })}
                                                                onBlur={() => setEditingDeadline(null)}
                                                                autoFocus
                                                                className="bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm"
                                                            />
                                                        ) : (
                                                            <button onClick={() => setEditingDeadline(lessonId)} className="flex items-center gap-2 text-sm text-gray-300 hover:text-white">
                                                                <CalendarDaysIcon className="h-5 w-5"/>
                                                                <span>Data di Consegna: {lesson.projectDeadline ? new Date(lesson.projectDeadline).toLocaleDateString('it-IT') : 'Non impostata'}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        {lesson.groups.map((group, groupIndex) => {
                                                            const deadline = lesson.projectDeadline ? new Date(lesson.projectDeadline) : null;
                                                            const today = new Date();
                                                            today.setHours(0,0,0,0);
                                                            
                                                            const borderColor = group.isComplete
                                                                ? 'border-green-500'
                                                                : (deadline && deadline < today)
                                                                ? 'border-red-500'
                                                                : 'border-gray-700';

                                                            return (
                                                                <div key={groupIndex} className={`bg-gray-900/50 rounded-lg p-3 border ${borderColor} flex flex-col transition-colors`}>
                                                                    <h4 className="font-semibold text-white">{group.name}</h4>
                                                                    <div className="text-sm text-gray-300 mt-2 list-inside space-y-1">
                                                                        {group.studentIds.map(id => <p key={id}>- {getStudentNameById(id)}{(group.addedStudentIds || []).includes(id) && <span className="text-amber-400 ml-1">*</span>}</p>)}
                                                                        <button onClick={() => setAddMemberModalInfo({ lesson, groupIndex })} className="text-xs text-blue-400 hover:underline flex items-center gap-1"><PlusCircleIcon className="h-4 w-4"/>Aggiungi Membro</button>
                                                                    </div>

                                                                    <div className="mt-4 pt-3 border-t border-gray-700/50 space-y-2">
                                                                        <label className="flex items-center text-sm cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!group.isComplete}
                                                                                onChange={(e) => handleUpdateGroup(lesson, groupIndex, { isComplete: e.target.checked, completionDate: e.target.checked ? new Date().toISOString().split('T')[0] : undefined })}
                                                                                className="h-4 w-4 rounded border-gray-500 text-green-500 focus:ring-green-600 bg-gray-700"
                                                                            />
                                                                            <span className="ml-2 text-white">Lavoro Concluso</span>
                                                                        </label>
                                                                        {group.isComplete && (
                                                                            <div className="text-xs text-gray-400 flex items-center gap-2 group">
                                                                                <span>Completato il:</span>
                                                                                {editingCompletionDate === `${lessonId}-${groupIndex}` ? (
                                                                                     <input
                                                                                        type="date"
                                                                                        value={group.completionDate || ''}
                                                                                        onChange={(e) => handleUpdateGroup(lesson, groupIndex, { completionDate: e.target.value })}
                                                                                        onBlur={() => setEditingCompletionDate(null)}
                                                                                        autoFocus
                                                                                        className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs"
                                                                                    />
                                                                                ) : (
                                                                                    <button onClick={() => setEditingCompletionDate(`${lessonId}-${groupIndex}`)} className="flex items-center gap-1 hover:text-white">
                                                                                        {group.completionDate ? new Date(group.completionDate).toLocaleDateString('it-IT') : 'N/D'}
                                                                                        <PencilIcon className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20 px-4 bg-gray-800 rounded-lg border border-gray-700/50">
                            <UsersIcon className="h-16 w-16 mx-auto text-gray-600" />
                            <p className="mt-4 text-gray-300 font-semibold">Nessun gruppo trovato</p>
                            <p className="text-gray-400 text-sm mt-1">
                                {lessonsWithGroups.length === 0 ? "Non sono state ancora registrate attività di gruppo." : "Prova a modificare i filtri di ricerca."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
            {addMemberModalInfo && (
                <AddMemberModal
                    isOpen={!!addMemberModalInfo}
                    onClose={() => setAddMemberModalInfo(null)}
                    onAddMember={handleAddMember}
                    lesson={addMemberModalInfo.lesson}
                    students={students}
                    conversations={conversations}
                />
            )}
        </main>
    );
};

export default memo(GroupsArchiveView);
