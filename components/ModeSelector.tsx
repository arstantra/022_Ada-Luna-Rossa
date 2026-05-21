import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const currentMode = MODES.find(m => m.id === currentModeId) || MODES[0];

  // Per la modalità compact usiamo position:fixed calcolato dal bounding rect
  // così sfuggiamo a qualsiasi overflow:hidden dei parent.
  const computeFixedPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const dropdownHeight = 280; // stima altezza dropdown
    const dropdownWidth = 256;  // w-64

    // Apre sempre verso l'alto rispetto al bottone
    let top = rect.top - dropdownHeight - 4;
    // Se esce fuori in alto, apre verso il basso
    if (top < 8) top = rect.bottom + 4;

    // Allineato a sinistra con il bottone, ma non uscire a destra
    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 8) {
      left = window.innerWidth - dropdownWidth - 8;
    }

    setDropdownStyle({ position: 'fixed', top, left, width: dropdownWidth, zIndex: 9999 });
  }, []);

  useEffect(() => {
    if (compact && isOpen) {
      computeFixedPosition();
    }
  }, [compact, isOpen, computeFixedPosition]);

  // Chiude al click fuori e al resize/scroll
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleClose() { setIsOpen(false); }

    document.addEventListener('mousedown', handleClickOutside);
    if (compact) {
      window.addEventListener('resize', handleClose);
      window.addEventListener('scroll', handleClose, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (compact) {
        window.removeEventListener('resize', handleClose);
        window.removeEventListener('scroll', handleClose, true);
      }
    };
  }, [isOpen, compact]);

  const dropdownContent = (
    <div
      className="w-64 bg-gray-800 border border-gray-700/50 rounded-lg shadow-2xl p-2 animate-fade-in-down"
      style={compact ? dropdownStyle : undefined}
    >
      <p className="px-2 py-1 text-xs font-semibold text-gray-400">Seleziona Modalità</p>
      <div className="mt-1 space-y-1">
        {MODES.map(mode => (
          <button
            key={mode.id}
            onClick={() => { onModeChange(mode.id); setIsOpen(false); }}
            className={`w-full text-left flex items-center justify-between p-2 rounded-md text-sm ${mode.colorClasses.hoverBg} ${currentModeId === mode.id ? 'bg-gray-700/50' : ''}`}
          >
            <div className="flex-1 pr-2">
              <p className={`font-semibold ${mode.colorClasses.text}`}>{mode.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 whitespace-normal">{mode.stylePrompt.split('.')[0]}.</p>
            </div>
            {currentModeId === mode.id && <CheckIcon className={`h-5 w-5 flex-shrink-0 ${mode.colorClasses.text}`} />}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative">
      {compact ? (
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-700/40 transition-colors"
          title={`Modalità: ${currentMode.label}`}
        >
          <SparklesIcon className={`h-3 w-3 ${currentMode.colorClasses.text} opacity-80`} />
          <span className="font-mono tracking-wide">{currentMode.label}</span>
          <ChevronDownIcon className={`h-3 w-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${currentMode.colorClasses.badge} hover:ring-2`}
        >
          <SparklesIcon className={`h-4 w-4 ${currentMode.colorClasses.text}`} />
          <span className={currentMode.colorClasses.text}>{currentMode.label}</span>
          <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''} ${currentMode.colorClasses.text}`} />
        </button>
      )}

      {isOpen && (
        compact
          ? dropdownContent   // fixed, fuori da qualsiasi overflow
          : (
            <div className="absolute right-0 top-full mt-2 z-50">
              {dropdownContent}
            </div>
          )
      )}
    </div>
  );
};

export default memo(ModeSelector);
