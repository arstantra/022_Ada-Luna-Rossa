import React, { memo } from 'react';
import type { Mode } from '../types';
import { MODES } from '../constants';

interface ModePillsProps {
  currentModeId: Mode['id'];
  onModeChange: (modeId: Mode['id']) => void;
}

// Pill inline ultra-compatte, nessun dropdown, zero conflitti di z-index/overflow.
// Pill attiva: sfondo colorato + ring (badge). Pill inattive: solo testo grigio.
const ModePills: React.FC<ModePillsProps> = ({ currentModeId, onModeChange }) => {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {MODES.map(mode => {
        const isActive = mode.id === currentModeId;
        return (
          <button
            key={mode.id}
            onClick={() => { if (!isActive) onModeChange(mode.id); }}
            title={mode.stylePrompt.split('.')[0] + '.'}
            className={`px-2 py-0.5 rounded-full text-[10px] font-mono tracking-wide transition-all duration-150 focus:outline-none ${
              isActive
                ? mode.colorClasses.badge + ' cursor-default'
                : 'text-gray-600 hover:text-gray-400 bg-transparent'
            }`}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
};

export default memo(ModePills);
