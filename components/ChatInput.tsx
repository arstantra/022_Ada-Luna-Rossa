import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { SendIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  onShowToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(() => {
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  }, [input, isLoading, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const canSend = input.trim() && !isLoading;

  return (
    <div className="flex flex-col gap-2">
      {/* Box principale */}
      <div className={`
        relative flex items-end gap-2 px-4 py-3
        bg-gray-800/80 backdrop-blur-sm
        border rounded-2xl transition-all duration-200
        ${isLoading
          ? 'border-gray-700/40'
          : 'border-gray-600/50 focus-within:border-purple-500/60 focus-within:shadow-[0_0_0_3px_rgba(168,85,247,0.08)]'
        }
      `}>
        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isLoading ? "Ada sta elaborando…" : "Scrivi a Ada… (Invio per inviare, Shift+Invio per andare a capo)"}
          rows={1}
          disabled={isLoading}
          className="
            flex-1 bg-transparent text-gray-100 placeholder-gray-600
            focus:outline-none resize-none no-scrollbar
            py-1 text-sm leading-relaxed font-sans
          "
        />

        {/* Invio */}
        <button
          onClick={handleSubmit}
          disabled={!canSend}
          aria-label="Invia messaggio"
          className={`
            flex-shrink-0 mb-0.5 p-2 rounded-xl transition-all duration-200
            ${canSend
              ? 'bg-purple-600/80 text-white hover:bg-purple-500 shadow-sm shadow-purple-900/40'
              : 'bg-purple-900/30 text-purple-700/50 cursor-not-allowed'
            }
          `}
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </div>

      <p className="text-center text-xs text-gray-700 font-mono">
        Ada · Powered by Gemini API · I dati restano nel tuo browser
      </p>
    </div>
  );
};

export default memo(ChatInput);
