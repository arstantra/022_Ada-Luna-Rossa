import React, { useState, useMemo } from 'react';
import { ChevronDownIcon, UsersIcon, CheckCircleIcon, XCircleIcon } from './Icons';

interface AttendanceSummaryProps {
    presentStudentIds: string[];
    allStudents: { id: string; name: string }[];
}

const AttendanceSummary: React.FC<AttendanceSummaryProps> = ({ presentStudentIds, allStudents }) => {
    const [isOpen, setIsOpen] = useState(false);

    const { presentStudents, absentStudents } = useMemo(() => {
        const present = allStudents.filter(s => presentStudentIds.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));
        const absent = allStudents.filter(s => !presentStudentIds.includes(s.id)).sort((a, b) => a.name.localeCompare(b.name));
        return { presentStudents: present, absentStudents: absent };
    }, [presentStudentIds, allStudents]);

    return (
        <div className="mt-4 border-t border-gray-700/50 pt-3">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between text-left"
                aria-expanded={isOpen}
            >
                <div className="flex items-center gap-2">
                    <UsersIcon className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-semibold text-white">
                        Presenze Registrate: {presentStudents.length} / {allStudents.length}
                    </span>
                </div>
                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm animate-fade-in-down">
                    <div>
                        <h4 className="font-semibold text-green-400 mb-2 flex items-center gap-2">
                            <CheckCircleIcon className="h-4 w-4" />
                            Presenti ({presentStudents.length})
                        </h4>
                        <ul className="space-y-1 pl-2 max-h-48 overflow-y-auto custom-scrollbar">
                            {presentStudents.map(student => (
                                <li key={student.id} className="text-gray-300">{student.name}</li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-semibold text-red-400 mb-2 flex items-center gap-2">
                            <XCircleIcon className="h-4 w-4" />
                            Assenti ({absentStudents.length})
                        </h4>
                         {absentStudents.length > 0 ? (
                            <ul className="space-y-1 pl-2">
                                {absentStudents.map(student => (
                                    <li key={student.id} className="text-gray-300">{student.name}</li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-xs text-gray-500 italic pl-2">Nessun assente.</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default React.memo(AttendanceSummary);