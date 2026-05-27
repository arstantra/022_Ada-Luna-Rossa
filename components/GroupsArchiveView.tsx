import React, { useState, useMemo, memo, useCallback } from 'react';
import type { Conversation, Student, GroupDefinition, BlockDetails, LessonWithGroups } from '../types';
import { UsersIcon, XIcon, SearchIcon, ChevronDownIcon, CalendarDaysIcon, PlusCircleIcon, CheckCircleIcon, PencilIcon, SparklesIcon } from './Icons';
import { getExactDateForBlock } from '../utils';
import type { useMasterContext } from '../hooks/useMasterContext';
import Modal from './Modal';
import AddMemberModal from './AddMemberModal';
import * as GeminiService from '../services/gemini';

interface GroupsArchiveViewProps {
    conversations: Conversation[];
    students: Student[];
    onClose: () => void;
    masterContext: ReturnType<typeof useMasterContext>;
    onUpdateBlock: (convoId: string, blockIndex: number, updatedBlockData: Partial<BlockDetails>) => void;
    showToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

const CRITERIA_OPTIONS = [
    { id: 'Livello competenza', label: 'Livello competenza' },
    { id: 'Stile apprendimento', label: 'Stile apprendimento' },
    { id: 'Dinamiche relazionali', label: 'Dinamiche relazionali' },
    { id: 'Mix casuale', label: 'Mix casuale' },
];

const GroupsArchiveView: React.FC<GroupsArchiveViewProps> = ({ conversations, students, onClose, masterContext, onUpdateBlock, showToast }) => {
    const [selectedWeek, setSelectedWeek] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [openLessons, setOpenLessons] = useState<Set<string>>(new Set());
    const [editingDeadline, setEditingDeadline] = useState<string | null>(null); // lessonId
    const [editingCompletionDate, setEditingCompletionDate] = useState<string | null>(null); // `${lessonId}-${groupIndex}`
    const [editingMissionCompletionDate, setEditingMissionCompletionDate] = useState<string | null>(null); // lessonId
    const [addMemberModalInfo, setAddMemberModalInfo] = useState<{ lesson: LessonWithGroups; groupIndex: number } | null>(null);

    // Composer state
    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [composerConvoId, setComposerConvoId] = useState<string>('');
    const [composerBlockIndex, setComposerBlockIndex] = useState<number>(0);
    const [groupSize, setGroupSize] = useState(3);
    const [selectedCriteria, setSelectedCriteria] = useState<string[]>(['Livello competenza']);
    const [proposedGroups, setProposedGroups] = useState<GroupDefinition[]>([]);
    const [isLoadingGroupSuggestion, setIsLoadingGroupSuggestion] = useState(false);

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

    // Upcoming blocks available for group assignment
    const composerBlocks = useMemo(() => {
        const result: { convoId: string; blockIndex: number; label: string }[] = [];
        for (const convo of conversations) {
            if (!convo.weekPlan) continue;
            for (const [i, block] of convo.weekPlan.blocks.entries()) {
                if (block.status === 'saltato' || block.status === 'annullato') continue;
                if (block.lessonState === 'archiviata') continue;
                const weekLabel = `Settimana ${convo.weekPlan.weekNumber}`;
                const blockLabel = block.lessonTitle || block.objective || `Blocco ${i + 1}`;
                result.push({
                    convoId: convo.id,
                    blockIndex: i,
                    label: `${weekLabel} · ${block.day || `BL${i + 1}`} — ${blockLabel}`,
                });
            }
        }
        return result;
    }, [conversations]);

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

    const toggleCriteria = (criterionId: string) => {
        setSelectedCriteria(prev =>
            prev.includes(criterionId)
                ? prev.filter(c => c !== criterionId)
                : [...prev, criterionId]
        );
        setProposedGroups([]);
    };

    const handleGenerateGroups = async () => {
        if (selectedCriteria.length === 0) {
            showToast('Seleziona almeno un criterio.', 'error');
            return;
        }
        if (selectedCriteria.length === 1 && selectedCriteria[0] === 'Mix casuale') {
            // Local random shuffle — no Gemini needed
            const shuffled = [...students].sort(() => Math.random() - 0.5);
            const groups: GroupDefinition[] = [];
            let i = 0;
            let groupNum = 1;
            while (i < shuffled.length) {
                groups.push({
                    name: `Gruppo ${groupNum}`,
                    studentIds: shuffled.slice(i, i + groupSize).map(s => s.id),
                    justification: 'Composizione casuale.',
                });
                i += groupSize;
                groupNum++;
            }
            setProposedGroups(groups);
            return;
        }
        setIsLoadingGroupSuggestion(true);
        try {
            const groups = await GeminiService.generateGroupSuggestionWithCriteria(students, selectedCriteria, groupSize);
            setProposedGroups(groups);
        } catch (err) {
            showToast(err instanceof Error ? err.message : 'Errore durante la generazione dei gruppi.', 'error');
        } finally {
            setIsLoadingGroupSuggestion(false);
        }
    };

    const handleSaveProposedGroups = () => {
        if (proposedGroups.length === 0 || !composerConvoId) return;
        onUpdateBlock(composerConvoId, composerBlockIndex, {
            allocations: { type: 'group', data: { groups: proposedGroups } },
        });
        showToast('Gruppi salvati!', 'success');
        setProposedGroups([]);
        setIsComposerOpen(false);
    };

    const handleRemoveStudentFromGroup = (groupIndex: number, studentId: string) => {
        setProposedGroups(prev => {
            const next = [...prev];
            next[groupIndex] = {
                ...next[groupIndex],
                studentIds: next[groupIndex].studentIds.filter(id => id !== studentId),
            };
            return next;
        });
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

                    {/* ── Composer: Crea Nuovi Gruppi ── */}
                    <div className="rounded-xl border border-gray-600/55 bg-gray-800/55 overflow-hidden">
                        <button
                            onClick={() => {
                                setIsComposerOpen(p => {
                                    if (!p && composerBlocks.length > 0 && !composerConvoId) {
                                        setComposerConvoId(composerBlocks[0].convoId);
                                        setComposerBlockIndex(composerBlocks[0].blockIndex);
                                    }
                                    return !p;
                                });
                            }}
                            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-700/30 transition-colors"
                        >
                            <div className="flex items-center gap-2.5">
                                <SparklesIcon className="h-4 w-4 text-purple-400" />
                                <span className="text-sm font-semibold text-white">Crea Nuovi Gruppi</span>
                            </div>
                            <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isComposerOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isComposerOpen && (
                            <div className="border-t border-gray-700/50 px-5 py-4 space-y-4">
                                {/* Block selector */}
                                {composerBlocks.length > 0 ? (
                                    <div>
                                        <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-1.5">Per quale blocco?</label>
                                        <select
                                            value={composerConvoId ? `${composerConvoId}::${composerBlockIndex}` : ''}
                                            onChange={e => {
                                                const [cid, bi] = e.target.value.split('::');
                                                setComposerConvoId(cid);
                                                setComposerBlockIndex(Number(bi));
                                                setProposedGroups([]);
                                            }}
                                            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        >
                                            {!composerConvoId && <option value="" disabled>— seleziona blocco —</option>}
                                            {composerBlocks.map(b => (
                                                <option key={`${b.convoId}::${b.blockIndex}`} value={`${b.convoId}::${b.blockIndex}`}>{b.label}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">Nessun blocco disponibile. Crea prima una settimana in Progettazione.</p>
                                )}

                                {/* Group size */}
                                <div>
                                    <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-1.5">Persone per gruppo</label>
                                    <div className="flex gap-2">
                                        {[2, 3, 4, 5].map(n => (
                                            <button
                                                key={n}
                                                onClick={() => { setGroupSize(n); setProposedGroups([]); }}
                                                className={`w-10 h-10 rounded-lg text-sm font-semibold border transition-colors ${groupSize === n ? 'bg-purple-600/80 border-purple-500 text-white' : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white'}`}
                                            >
                                                {n}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Criteria chips */}
                                <div>
                                    <label className="block text-xs font-mono text-gray-400 uppercase tracking-widest mb-1.5">Criteri di bilanciamento</label>
                                    <div className="flex flex-wrap gap-2">
                                        {CRITERIA_OPTIONS.map(c => (
                                            <button
                                                key={c.id}
                                                onClick={() => toggleCriteria(c.id)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${selectedCriteria.includes(c.id) ? 'bg-indigo-600/60 border-indigo-500/60 text-indigo-200' : 'border-gray-600 text-gray-400 hover:border-gray-500 hover:text-white'}`}
                                            >
                                                {selectedCriteria.includes(c.id) ? '✓ ' : ''}{c.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Generate button */}
                                <button
                                    onClick={handleGenerateGroups}
                                    disabled={isLoadingGroupSuggestion || selectedCriteria.length === 0 || composerBlocks.length === 0}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-purple-400 border border-purple-500/25 hover:bg-purple-500/10 hover:border-purple-400/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {isLoadingGroupSuggestion ? (
                                        <><span className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />Generazione in corso...</>
                                    ) : (
                                        <><SparklesIcon className="h-4 w-4" />{selectedCriteria.length === 1 && selectedCriteria[0] === 'Mix casuale' ? 'Genera Casuale' : 'Suggerisci con Ada'}</>
                                    )}
                                </button>

                                {/* Proposed groups */}
                                {proposedGroups.length > 0 && (
                                    <div className="space-y-3 pt-2">
                                        <p className="text-xs font-mono text-gray-400 uppercase tracking-widest">Proposta Ada</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {proposedGroups.map((group, gi) => (
                                                <div key={gi} className="bg-gray-900/60 rounded-lg border border-gray-700/50 p-3">
                                                    <p className="text-sm font-semibold text-white mb-1">{group.name}</p>
                                                    {group.justification && (
                                                        <p className="text-[11px] text-gray-500 mb-2 italic">{group.justification}</p>
                                                    )}
                                                    <ul className="space-y-0.5">
                                                        {group.studentIds.map(sid => (
                                                            <li key={sid} className="flex items-center justify-between text-xs text-gray-300">
                                                                <span>{getStudentNameById(sid)}</span>
                                                                <button
                                                                    onClick={() => handleRemoveStudentFromGroup(gi, sid)}
                                                                    className="text-gray-600 hover:text-red-400 ml-2"
                                                                    title="Rimuovi"
                                                                >
                                                                    <XIcon className="h-3 w-3" />
                                                                </button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            onClick={handleSaveProposedGroups}
                                            disabled={!composerConvoId}
                                            className="px-4 py-2 rounded-lg bg-blue-600/80 text-white text-sm font-semibold hover:bg-blue-500 shadow-sm shadow-blue-900/40 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            Salva composizione
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

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
                                placeholder="Cerca per nome studentessa..."
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
