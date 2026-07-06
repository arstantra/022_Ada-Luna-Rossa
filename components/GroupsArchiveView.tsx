import React, { useState, useMemo, memo, useCallback } from 'react';
import type { Conversation, Student, GroupDefinition, BlockDetails, LessonWithGroups, Activity } from '../types';
import { UsersIcon, XIcon, SearchIcon, ChevronDownIcon, CalendarDaysIcon, PlusCircleIcon, CheckCircleIcon, PencilIcon, HomeIcon } from './Icons';
import { getExactDateForBlock } from '../utils';
import type { useMasterContext } from '../hooks/useMasterContext';
import AddMemberModal from './AddMemberModal';

interface GroupsArchiveViewProps {
    conversations: Conversation[];
    students: Student[];
    onClose: () => void;
    masterContext: ReturnType<typeof useMasterContext>;
    onUpdateBlock: (convoId: string, blockIndex: number, updatedBlockData: Partial<BlockDetails>) => void;
    /** Attività del corso — usate per le osservazioni qualitative sui gruppi (refType 'group') */
    activities?: Activity[];
    /** Drill-down: click su uno studente apre la sua scheda personale */
    onSelectStudent?: (student: Student) => void;
}

// ── Report Lavori di Gruppo (quantitativo + qualitativo, sola lettura) ────────

interface GroupsReportSectionProps {
    lessons: LessonWithGroups[];
    students: Student[];
    activities: Activity[];
    onSelectStudent?: (student: Student) => void;
}

const GroupsReportSection: React.FC<GroupsReportSectionProps> = ({ lessons, students, activities, onSelectStudent }) => {
    const [isOpen, setIsOpen] = useState(true);

    const stats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let totalGroups = 0, completed = 0, individual = 0, memberSum = 0;
        let onTime = 0, lateDone = 0, openOk = 0, openOverdue = 0;
        const sizeDist = new Map<string, number>();
        const perStudent = new Map<string, { works: number; completed: number }>();
        const groupNotes: { label: string; group: string; note: string }[] = [];

        for (const l of lessons) {
            const deadline = l.projectDeadline ? new Date(l.projectDeadline) : null;
            for (const g of l.groups) {
                totalGroups++;
                const size = g.studentIds.length;
                memberSum += size;
                if (size === 1) individual++;
                const key = size >= 5 ? '5+' : String(size);
                sizeDist.set(key, (sizeDist.get(key) ?? 0) + 1);
                if (g.isComplete) {
                    completed++;
                    if (deadline && g.completionDate && new Date(g.completionDate) > deadline) lateDone++;
                    else onTime++;
                } else {
                    if (deadline && deadline < today) openOverdue++;
                    else openOk++;
                }
                for (const sid of g.studentIds) {
                    if (!perStudent.has(sid)) perStudent.set(sid, { works: 0, completed: 0 });
                    const e = perStudent.get(sid)!;
                    e.works++;
                    if (g.isComplete) e.completed++;
                }
                if (g.notes?.trim()) {
                    groupNotes.push({ label: `S${l.weekNumber} · ${l.blockDay}`, group: g.name, note: g.notes.trim() });
                }
            }
        }

        const perStudentRows = students
            .map(s => ({ student: s, ...(perStudent.get(s.id) ?? { works: 0, completed: 0 }) }))
            .filter(r => r.works > 0)
            .sort((a, b) => b.works - a.works || a.student.name.localeCompare(b.student.name));
        const maxWorks = perStudentRows.reduce((m, r) => Math.max(m, r.works), 1);

        const groupObservations = activities
            .flatMap(a => (a.observations ?? [])
                .filter(o => o.refType === 'group')
                .map(o => ({
                    activity: a.title,
                    refId: o.refId,
                    text: o.text,
                    sentiment: o.adaInsights?.sentiment,
                    timestamp: o.timestamp,
                })))
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return {
            totalLessons: lessons.length,
            totalGroups, completed, individual,
            avgSize: totalGroups > 0 ? (memberSum / totalGroups) : 0,
            pctComplete: totalGroups > 0 ? Math.round((completed / totalGroups) * 100) : 0,
            onTime, lateDone, openOk, openOverdue,
            sizeDist, perStudentRows, maxWorks, groupNotes, groupObservations,
        };
    }, [lessons, students, activities]);

    if (lessons.length === 0) return null;

    // Donut stato lavori — segmenti su circonferenza
    const donutSegments = [
        { label: 'Conclusi in tempo', value: stats.onTime, color: '#10b981' },
        { label: 'Conclusi oltre scadenza', value: stats.lateDone, color: '#fbbf24' },
        { label: 'Aperti', value: stats.openOk, color: '#64748b' },
        { label: 'Aperti oltre scadenza', value: stats.openOverdue, color: '#f43f5e' },
    ].filter(s => s.value > 0);
    const donutTotal = donutSegments.reduce((s, x) => s + x.value, 0);
    const R = 34, CIRC = 2 * Math.PI * R;
    let accum = 0;

    const SIZE_ORDER = ['1', '2', '3', '4', '5+'];
    const sizeRows = SIZE_ORDER.filter(k => (stats.sizeDist.get(k) ?? 0) > 0)
        .map(k => ({ key: k, count: stats.sizeDist.get(k)! }));
    const maxSize = sizeRows.reduce((m, r) => Math.max(m, r.count), 1);

    const sentimentDot: Record<string, string> = { positivo: 'bg-emerald-500', neutro: 'bg-amber-400', critico: 'bg-rose-500' };

    return (
        <div className="rounded-xl border border-gray-600/55 bg-gray-800/30 overflow-hidden">
            <button
                onClick={() => setIsOpen(p => !p)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-700/30 transition-colors"
            >
                <span className="text-sm font-semibold text-white">Report Lavori di Gruppo</span>
                <ChevronDownIcon className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && (
                <div className="border-t border-gray-700/50 p-5 space-y-5">
                    {/* KPI row */}
                    <div className="flex flex-wrap gap-2.5">
                        {[
                            { label: 'lavori', value: stats.totalLessons },
                            { label: 'gruppi', value: stats.totalGroups },
                            { label: 'individuali', value: stats.individual },
                            { label: 'conclusi', value: `${stats.pctComplete}%` },
                            { label: 'dim. media', value: stats.avgSize.toFixed(1) },
                        ].map(kpi => (
                            <div key={kpi.label} className="flex items-baseline gap-1.5 bg-gray-900/50 border border-gray-700/40 rounded-lg px-3 py-1.5">
                                <span className="text-lg font-display font-bold text-white tabular-nums">{kpi.value}</span>
                                <span className="text-[9px] font-mono uppercase tracking-widest text-gray-500">{kpi.label}</span>
                            </div>
                        ))}
                    </div>

                    <div className="flex flex-col lg:flex-row gap-6">
                        {/* Donut stato lavori */}
                        <div className="flex-shrink-0">
                            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Stato dei lavori</p>
                            <div className="flex items-center gap-4">
                                <svg width="96" height="96" viewBox="0 0 96 96">
                                    <circle cx="48" cy="48" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="11" />
                                    {donutSegments.map(seg => {
                                        const frac = seg.value / donutTotal;
                                        const dash = `${(frac * CIRC).toFixed(2)} ${(CIRC - frac * CIRC).toFixed(2)}`;
                                        const offset = -(accum * CIRC);
                                        accum += frac;
                                        return (
                                            <circle key={seg.label} cx="48" cy="48" r={R} fill="none"
                                                stroke={seg.color} strokeOpacity="0.85" strokeWidth="11"
                                                strokeDasharray={dash} strokeDashoffset={offset.toFixed(2)}
                                                transform="rotate(-90 48 48)">
                                                <title>{seg.label}: {seg.value}</title>
                                            </circle>
                                        );
                                    })}
                                    <text x="48" y="46" textAnchor="middle" fontSize="16" fontWeight="700" fill="white" fontFamily="monospace">{stats.pctComplete}%</text>
                                    <text x="48" y="58" textAnchor="middle" fontSize="6" fill="rgba(156,163,175,0.7)" fontFamily="monospace">conclusi</text>
                                </svg>
                                <ul className="space-y-1">
                                    {donutSegments.map(seg => (
                                        <li key={seg.label} className="flex items-center gap-1.5 text-[10px] font-mono text-gray-400">
                                            <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: seg.color, opacity: 0.85 }} />
                                            {seg.label} · {seg.value}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Distribuzione dimensioni */}
                            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mt-4 mb-2">Dimensione gruppi</p>
                            <div className="space-y-1">
                                {sizeRows.map(r => (
                                    <div key={r.key} className="flex items-center gap-2">
                                        <span className="text-[9px] font-mono text-gray-500 w-8 text-right flex-shrink-0">{r.key === '1' ? '1 (ind.)' : r.key}</span>
                                        <div className="w-36 h-3 bg-gray-900/60 rounded-sm overflow-hidden">
                                            <div className="h-full bg-indigo-500/50 rounded-sm" style={{ width: `${(r.count / maxSize) * 100}%` }} />
                                        </div>
                                        <span className="text-[9px] font-mono text-gray-400 tabular-nums">{r.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Partecipazione per studente (drill-down) */}
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Partecipazione per studente</p>
                            {stats.perStudentRows.length === 0 ? (
                                <p className="text-xs text-gray-600">Nessuno studente assegnato a gruppi.</p>
                            ) : (
                                <div className="space-y-1 max-h-64 overflow-y-auto custom-scrollbar pr-1.5">
                                    {stats.perStudentRows.map(r => (
                                        <div key={r.student.id} className="flex items-center gap-2">
                                            <button
                                                onClick={() => onSelectStudent?.(r.student)}
                                                disabled={!onSelectStudent}
                                                title={onSelectStudent ? `Apri la scheda di ${r.student.name}` : r.student.name}
                                                className={`w-32 flex-shrink-0 text-left text-[10px] font-mono truncate ${onSelectStudent ? 'text-gray-400 hover:text-white hover:underline cursor-pointer' : 'text-gray-400'}`}
                                            >
                                                {r.student.name}
                                            </button>
                                            <div className="flex-1 flex h-3 bg-gray-900/60 rounded-sm overflow-hidden">
                                                <div className="h-full bg-emerald-500/70" style={{ width: `${(r.completed / stats.maxWorks) * 100}%` }} title={`${r.completed} conclusi`} />
                                                <div className="h-full bg-slate-500/60" style={{ width: `${((r.works - r.completed) / stats.maxWorks) * 100}%` }} title={`${r.works - r.completed} aperti`} />
                                            </div>
                                            <span className="text-[9px] font-mono text-gray-400 tabular-nums w-10 text-right flex-shrink-0">{r.completed}/{r.works}</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center gap-3 pt-1.5">
                                        <span className="flex items-center gap-1 text-[8px] font-mono text-gray-600">
                                            <span className="w-2 h-2 rounded-sm bg-emerald-500/70 inline-block" />conclusi
                                        </span>
                                        <span className="flex items-center gap-1 text-[8px] font-mono text-gray-600">
                                            <span className="w-2 h-2 rounded-sm bg-slate-500/60 inline-block" />aperti
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Qualitativo — note gruppo + osservazioni Ada */}
                    {(stats.groupNotes.length > 0 || stats.groupObservations.length > 0) && (
                        <div>
                            <p className="text-xs font-mono text-gray-400 uppercase tracking-widest mb-2">Note e osservazioni qualitative</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {stats.groupNotes.map((n, i) => (
                                    <div key={`note-${i}`} className="bg-gray-900/50 border border-gray-700/40 rounded-lg px-3 py-2 text-xs">
                                        <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500">{n.label} · {n.group}</span>
                                        <p className="text-gray-300 mt-0.5">{n.note}</p>
                                    </div>
                                ))}
                                {stats.groupObservations.map((o, i) => (
                                    <div key={`obs-${i}`} className="bg-gray-900/50 border border-gray-700/40 rounded-lg px-3 py-2 text-xs">
                                        <span className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider text-gray-500">
                                            {o.sentiment && <span className={`w-1.5 h-1.5 rounded-full inline-block ${sentimentDot[o.sentiment]}`} title={`Sentiment: ${o.sentiment}`} />}
                                            {o.activity}{o.refId ? ` · ${o.refId}` : ''}
                                        </span>
                                        <p className="text-gray-300 mt-0.5">{o.text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const GroupsArchiveView: React.FC<GroupsArchiveViewProps> = ({ conversations, students, onClose, masterContext, onUpdateBlock, activities = [], onSelectStudent }) => {
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
            <div className="flex-shrink-0 flex items-center justify-between px-6 pt-3.5 pb-2 border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="flex-shrink-0 p-1.5 text-gray-500 hover:text-purple-400 rounded-lg hover:bg-purple-500/10 transition-colors" title="Torna alla home">
                        <HomeIcon className="h-4 w-4" />
                    </button>
                    <UsersIcon className="h-5 w-5 text-gray-400" />
                    <h2 className="text-base font-display font-semibold text-white">Archivio Gruppi di Lavoro</h2>
                </div>
                <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white" aria-label="Chiudi">
                    <XIcon className="h-5 w-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-6xl mx-auto space-y-6">

                    {/* Report grafico quantitativo + qualitativo */}
                    <GroupsReportSection
                        lessons={lessonsWithGroups}
                        students={students}
                        activities={activities}
                        onSelectStudent={onSelectStudent}
                    />

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
                                    ? 'border-emerald-500'
                                    : 'border-amber-400';

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
                                                    <div className="text-sm font-semibold text-emerald-400 mt-2 flex items-center gap-2">
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
                                                                ? 'border-emerald-500'
                                                                : (deadline && deadline < today)
                                                                ? 'border-red-500'
                                                                : 'border-gray-700';

                                                            return (
                                                                <div key={groupIndex} className={`bg-gray-900/50 rounded-lg p-3 border ${borderColor} flex flex-col transition-colors`}>
                                                                    <h4 className="font-semibold text-white flex items-center gap-2">
                                                                        {group.name}
                                                                        {group.studentIds.length === 1 && (
                                                                            <span className="text-[9px] font-mono uppercase tracking-wider text-indigo-400/80 border border-indigo-500/25 rounded px-1.5 py-0.5" title="Lavoro individuale (gruppo da 1)">individuale</span>
                                                                        )}
                                                                    </h4>
                                                                    <div className="text-sm text-gray-300 mt-2 list-inside space-y-1">
                                                                        {group.studentIds.map(id => {
                                                                            const st = students.find(s => s.id === id);
                                                                            return (
                                                                                <p key={id}>- {onSelectStudent && st ? (
                                                                                    <button onClick={() => onSelectStudent(st)} className="hover:text-white hover:underline" title={`Apri la scheda di ${st.name}`}>{st.name}</button>
                                                                                ) : getStudentNameById(id)}{(group.addedStudentIds || []).includes(id) && <span className="text-amber-400 ml-1">*</span>}</p>
                                                                            );
                                                                        })}
                                                                        <button onClick={() => setAddMemberModalInfo({ lesson, groupIndex })} className="text-xs text-blue-400 hover:underline flex items-center gap-1"><PlusCircleIcon className="h-4 w-4"/>Aggiungi Membro</button>
                                                                    </div>

                                                                    <div className="mt-4 pt-3 border-t border-gray-700/50 space-y-2">
                                                                        <label className="flex items-center text-sm cursor-pointer">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={!!group.isComplete}
                                                                                onChange={(e) => handleUpdateGroup(lesson, groupIndex, { isComplete: e.target.checked, completionDate: e.target.checked ? new Date().toISOString().split('T')[0] : undefined })}
                                                                                className="h-4 w-4 rounded border-gray-500 text-emerald-500 focus:ring-emerald-600 bg-gray-700"
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
