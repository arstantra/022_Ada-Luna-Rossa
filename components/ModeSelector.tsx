import React, { useState, useRef, useEffect, memo } from 'react';
import type { Mode } from '../types';
import { MODES } from '../constants';
import { SparklesIcon, ChevronDownIcon, CheckIcon } from './Icons';

interface ModeSelectorProps {
  currentModeId: Mode['id'];
  onModeChange: (modeId: Mode['id']) => void;
  compact?: boolean;
}

const ModeSelector: React.FC<ModeSelectorProps> = ({ currentModeId, onModeChange, compact = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const currentMode = MODES.find(m => m.id === currentModeId) || MODES[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  return (
    <div ref={wrapperRef} className="relative">
      {compact ? (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-700/40 transition-colors"
          title={`Modalità: ${currentMode.label}`}
        >
          <SparklesIcon className={`h-3 w-3 ${currentMode.colorClasses.text} opacity-80`} />
          <span className="font-mono tracking-wide">{currentMode.label}</span>
          <ChevronDownIcon className={`h-3 w-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <button onClick={() => setIsOpen(!isOpen)} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${currentMode.colorClasses.badge} hover:ring-2`}>
          <SparklesIcon className={`h-4 w-4 ${currentMode.colorClasses.text}`} />
          <span className={currentMode.colorClasses.text}>{currentMode.label}</span>
          <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${currentMode.colorClasses.text}`} />
        </button>
      )}

      {isOpen && (
        <div className={`absolute ${compact ? 'bottom-full left-0 mb-1' : 'right-0 top-full mt-2'} w-64 bg-gray-800 border border-gray-700/50 rounded-lg shadow-2xl z-10 p-2 animate-fade-in-down`}>
          <p className="px-2 py-1 text-xs font-semibold text-gray-400">Seleziona Modalità</p>
          <div className="mt-1 space-y-1">
            {MODES.map(mode => (
              <button key={mode.id} onClick={() => { onModeChange(mode.id); setIsOpen(false); }} className={`w-full text-left flex items-center justify-between p-2 rounded-md text-sm ${mode.colorClasses.hoverBg} ${currentModeId === mode.id ? 'bg-gray-700/50' : ''}`}>
                <div className="flex-1 pr-2">
                  <p className={`font-semibold ${mode.colorClasses.text}`}>{mode.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 whitespace-normal">{mode.stylePrompt.split('.')[0]}.</p>
                </div>
                {currentModeId === mode.id && <CheckIcon className={`h-5 w-5 flex-shrink-0 ${mode.colorClasses.text}`} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default memo(ModeSelector);
