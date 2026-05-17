import React from 'react';
import type { Student } from '../types';
import { UserIcon } from './Icons';

interface StudentSheetHeaderProps {
    student: Student;
}

const StudentSheetHeader: React.FC<StudentSheetHeaderProps> = ({ student }) => {
    return (
        <div className="flex-shrink-0 p-3.5 pl-6 border-b border-gray-700/50 bg-gray-900/50">
            <div className="flex items-center gap-3">
                <UserIcon className="h-5 w-5 text-gray-400" />
                <div className="flex-1">
                    <h3 className="font-semibold text-white leading-tight">
                        {student.name}
                    </h3>
                    {student.notes && (
                        <p className="text-sm text-amber-300 leading-tight mt-1">
                           {student.notes}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default React.memo(StudentSheetHeader);
