import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { SendIcon, PaperclipIcon, XCircleIcon } from './Icons';

interface ChatInputProps {
  onSendMessage: (content: string, file?: File) => void;
  isLoading: boolean;
  onShowToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSendMessage, isLoading, onShowToast }) => {
  const [input, setInput] = useState('');
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(() => {
    if ((input.trim() || attachedFile) && !isLoading) {
      onSendMessage(input.trim(), attachedFile || undefined);
      setInput('');
      setAttachedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
  }, [input, attachedFile, isLoading, onSendMessage]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      onShowToast('Il file è troppo grande (max 20MB).', 'error');
      return;
    }
    setAttachedFile(file);
  };

  const removeAttachedFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSend = (input.trim() || attachedFile) && !isLoading;

  return (
    <div className="flex flex-col gap-2">
      {/* File allegato */}
      {attachedFile && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-700/60 rounded-2xl text-sm text-gray-300 animate-fade-in-down border border-gray-600/40">
          <div className="flex items-center gap-2 overflow-hidden">
            <PaperclipIcon className="h-4 w-4 flex-shrink-0 text-purple-400" />
            <span className="truncate font-mono text-xs">{attachedFile.name}</span>
          </div>
          <button onClick={removeAttachedFile} className="ml-3 text-gray-500 hover:text-red-400 transition-colors">
            <XCircleIcon className="h-4 w-4" />
          </button>
        </div>
      )}

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
        {/* Allega file */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          aria-label="Allega file"
          className="flex-shrink-0 mb-0.5 p-1.5 text-gray-500 hover:text-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg hover:bg-purple-500/10"
        >
          <PaperclipIcon className="h-5 w-5" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,application/pdf,.txt,.md,.json,.csv"
        />

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
              ? 'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-900/40'
              : 'bg-gray-700/50 text-gray-600 cursor-not-allowed'
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
