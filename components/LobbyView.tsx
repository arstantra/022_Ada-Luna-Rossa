import React, { useState, useRef, useCallback, useEffect } from 'react';
import { SparklesIcon, SendIcon } from './Icons';
import { parseTeacherName } from '../utils';

// ── Posizioni fisse del pattern stelline — distribuzione irregolare intenzionale
const SPARKLE_PATTERN = [
  { top: '7%',  left: '9%',  size: 10, delay: '0s',    opacity: 0.045 },
  { top: '13%', left: '67%', size: 14, delay: '2.1s',  opacity: 0.038 },
  { top: '19%', left: '38%', size:  8, delay: '4.4s',  opacity: 0.030 },
  { top: '22%', left: '88%', size: 12, delay: '1.0s',  opacity: 0.042 },
  { top: '31%', left: '5%',  size: 16, delay: '3.2s',  opacity: 0.035 },
  { top: '38%', left: '55%', size:  9, delay: '0.7s',  opacity: 0.028 },
  { top: '44%', left: '82%', size: 13, delay: '5.0s',  opacity: 0.040 },
  { top: '51%', left: '22%', size: 11, delay: '2.8s',  opacity: 0.032 },
  { top: '57%', left: '73%', size:  8, delay: '1.6s',  opacity: 0.036 },
  { top: '63%', left: '14%', size: 15, delay: '3.9s',  opacity: 0.028 },
  { top: '68%', left: '48%', size: 10, delay: '0.4s',  opacity: 0.044 },
  { top: '74%', left: '91%', size: 12, delay: '2.5s',  opacity: 0.033 },
  { top: '80%', left: '32%', size:  9, delay: '4.7s',  opacity: 0.038 },
  { top: '86%', left: '62%', size: 14, delay: '1.3s',  opacity: 0.030 },
  { top: '91%', left: '7%',  size: 11, delay: '3.6s',  opacity: 0.042 },
];

const CHIPS = [
  'Come funziona la Progettazione del corso?',
  'Aiutami a pianificare la prossima settimana',
  'Cosa posso fare con Ada?',
  'Come uso il Laboratorio per un blocco?',
];

interface LobbyViewProps {
  teacherProfile: string;
  onStartChat: (message: string) => void;
}

const LobbyView: React.FC<LobbyViewProps> = ({ teacherProfile, onStartChat }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const teacherName = parseTeacherName(teacherProfile);
  const firstName = teacherName ? teacherName.split(' ')[0] : null;

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = `${Math.min(ta.scrollHeight, 160)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    onStartChat(trimmed);
  }, [input, onStartChat]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  return (
    <main className="relative flex-1 flex flex-col items-center justify-center overflow-hidden bg-[#0D1117]">

      {/* ── Pattern stelline sfondo ──────────────────────────────────────── */}
      {SPARKLE_PATTERN.map((s, i) => (
        <SparklesIcon
          key={i}
          className="absolute text-purple-400 animate-pulse pointer-events-none select-none"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            opacity: s.opacity,
            animationDelay: s.delay,
            animationDuration: '6s',
          }}
        />
      ))}

      {/* ── Contenuto centrale ───────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-col items-center w-full max-w-xl px-6 gap-8">

        {/* Logo Ada */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-purple-500 rounded-full blur-2xl opacity-15 scale-150" />
            <SparklesIcon className="relative w-14 h-14 text-purple-400" />
          </div>
          <div className="text-center space-y-1">
            <div
              className="font-display text-5xl font-800 tracking-tight bg-clip-text text-transparent"
              style={{
                background: 'linear-gradient(135deg, #ffffff, #d1d5db, #6b7280)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Ada
            </div>
            <p className="font-display text-[11px] font-600 tracking-[0.35em] uppercase text-purple-400/80">
              Assistente Didattico
            </p>
          </div>
        </div>

        {/* Greeting */}
        <p className="text-gray-400 text-sm text-center leading-relaxed">
          {firstName
            ? <>Ciao, <span className="text-gray-200">{firstName}</span> — cosa facciamo oggi?</>
            : 'Da dove vuoi iniziare?'
          }
        </p>

        {/* Input */}
        <div className="w-full">
          <div className="relative flex items-end gap-2 bg-gray-900/80 border border-gray-700/60 rounded-2xl px-4 py-3 shadow-lg shadow-black/30 focus-within:border-purple-500/40 focus-within:shadow-purple-900/20 transition-all duration-200">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Chiedimi come usare Ada, o da dove vuoi iniziare…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none leading-relaxed"
              style={{ minHeight: '24px', maxHeight: '160px' }}
            />
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-xl bg-purple-600/80 text-white hover:bg-purple-500 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150 shadow-sm shadow-purple-900/40 mb-0.5"
            >
              <SendIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Chip suggeriti */}
        <div className="flex flex-wrap justify-center gap-2">
          {CHIPS.map((chip, i) => (
            <button
              key={i}
              onClick={() => onStartChat(chip)}
              className="text-[11px] font-mono text-gray-500 border border-gray-700/50 rounded-full px-3 py-1.5 hover:text-gray-300 hover:border-gray-600/70 hover:bg-gray-800/40 transition-all duration-150"
            >
              {chip}
            </button>
          ))}
        </div>

      </div>
    </main>
  );
};

export default React.memo(LobbyView);
