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
      const scrollHeight = textarea.scrollHeight;
      const maxHeight = 192; 
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
    }
  }, [input]);

  const handleSubmit = useCallback(() => {
    if ((input.trim() || attachedFile) && !isLoading) {
      onSendMessage(input.trim(), attachedFile || undefined);
      setInput('');
      setAttachedFile(null);
      if (fileInputRef.current) {
          fileInputRef.current.value = '';
      }
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [input, attachedFile, isLoading, onSendMessage]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        handleSubmit();
      }
  }, [handleSubmit]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
        onShowToast('Il file è troppo grande (max 20MB).', 'error');
        return;
      }
      setAttachedFile(file);
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };
  
  const removeAttachedFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  return (
    <div className="flex flex-col gap-2">
      {attachedFile && (
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-600 rounded-lg text-sm text-gray-200 animate-fade-in-down">
          <div className="flex items-center gap-2 overflow-hidden">
            <PaperclipIcon className="h-4 w-4 flex-shrink-0"/>
            <span className="truncate">File allegato: {attachedFile.name}</span>
          </div>
          <button onClick={removeAttachedFile} className="ml-2 text-gray-400 hover:text-white">
            <XCircleIcon className="h-5 w-5" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-3">
          <div className="flex-1 relative flex items-center bg-[#374151] rounded-lg focus-within:ring-2 focus-within:ring-blue-500">
              <button
                  onClick={handleAttachClick}
                  disabled={isLoading}
                  aria-label="Allega file"
                  className="flex-shrink-0 p-3 text-gray-400 hover:text-white disabled:cursor-not-allowed transition-colors"
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
              <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isLoading ? "In attesa della risposta..." : "Chiedi un'analisi..."}
                  aria-label="Chiedi un'analisi"
                  rows={1}
                  disabled={isLoading}
                  className="no-scrollbar w-full pr-2 py-2.5 bg-transparent text-gray-100 placeholder-gray-400 focus:outline-none resize-none"
              />
          </div>
          <button
              onClick={handleSubmit}
              disabled={(!input.trim() && !attachedFile) || isLoading}
              aria-label="Invia messaggio"
              className="flex-shrink-0 p-3 bg-gray-600 rounded-full text-gray-300 hover:bg-blue-600 hover:text-white disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors"
          >
              <SendIcon className="h-5 w-5" />
          </button>
      </div>
    </div>
  );
};

export default memo(ChatInput);
