import React, { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react';
import type { Conversation, Student, Mode } from '../types';
import MessageView from './MessageView';
import ChatInput from './ChatInput';
import StudentSheetHeader from './StudentSheetHeader';
import ModeSelector from './ModeSelector';
import { ChatBubbleOvalLeftEllipsisIcon, SearchIcon, XIcon } from './Icons';
import { ADA_QUICK_CHAT_ID } from '../constants';

interface ChatViewProps {
  conversation: Conversation | null;
  students: Student[];
  onSendMessage: (content: string, file?: File, actionPayload?: string) => void;
  isLoading: boolean;
  onShowToast: (message: string, type: 'success' | 'info' | 'error') => void;
  currentModeId?: Mode['id'];
  onModeChange?: (modeId: Mode['id']) => void;
  useGoogleSearch?: boolean;
  onGoogleSearchChange?: (value: boolean) => void;
  onOpenImageGenerator?: () => void;
}

// ── Welcome screen per la chat vuota ─────────────────────────────────────────
const WelcomeScreen: React.FC = () => (
  <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-6">
    <div className="space-y-2">
      <div
        className="font-display text-6xl font-800 tracking-tight bg-clip-text text-transparent"
        style={{ background: 'linear-gradient(135deg, #ffffff, #d1d5db, #6b7280)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
      >
        Ada
      </div>
      <p className="font-display text-sm font-600 tracking-[0.3em] uppercase text-purple-400">
        Assistente Didattico
      </p>
    </div>
    <div className="w-16 h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
    <p className="text-sm text-gray-600 max-w-sm leading-relaxed">
      Scrivi un messaggio per iniziare. Usa il selettore modalità per cambiare stile di risposta.
    </p>
  </div>
);

// ── Componente principale ─────────────────────────────────────────────────────
const ChatView: React.FC<ChatViewProps> = ({
  conversation, students, onSendMessage, isLoading,
  onShowToast, currentModeId, onModeChange,
  useGoogleSearch, onGoogleSearchChange, onOpenImageGenerator,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchHighlight, setSearchHighlight] = useState('');

  const isQuickChat = conversation?.id === ADA_QUICK_CHAT_ID;

  const studentForConversation = useMemo(() => {
    if (conversation?.studentId) {
      return students.find(s => s.id === conversation.studentId) || null;
    }
    return null;
  }, [conversation, students]);

  // Auto-scroll verso il fondo quando arrivano nuovi messaggi
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    if (isNearBottom) {
      setTimeout(() => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }), 100);
    }
  }, [conversation?.messages, isLoading]);

  // Apri/chiudi search
  useEffect(() => {
    if (isSearchOpen) searchInputRef.current?.focus();
    else { setSearchQuery(''); setSearchHighlight(''); }
  }, [isSearchOpen]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') setSearchHighlight(searchQuery);
    if (e.key === 'Escape') setIsSearchOpen(false);
  }, [searchQuery]);

  // Filtra messaggi in base alla ricerca
  const visibleMessages = useMemo(() => {
    if (!conversation) return [];
    const msgs = conversation.messages.filter(m => m.content || m.attachment || m.generatedImages);
    if (!searchHighlight) return msgs;
    return msgs.filter(m =>
      m.content?.toLowerCase().includes(searchHighlight.toLowerCase())
    );
  }, [conversation, searchHighlight]);

  // ── Stato: nessuna conversazione ─────────────────────────────────────────
  if (!conversation) {
    return (
      <main className="flex-1 flex flex-col bg-[#0D1117] overflow-hidden">
        <WelcomeScreen />
        <div className="flex-shrink-0 px-6 pb-6 max-w-3xl mx-auto w-full">
          <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} onShowToast={onShowToast} />
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col bg-[#0D1117] overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
        <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 text-purple-400 flex-shrink-0" />

        {/* Titolo */}
        {isSearchOpen ? (
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Cerca nella conversazione…"
            className="flex-1 bg-transparent text-white placeholder-gray-600 text-sm focus:outline-none"
          />
        ) : (
          <h1 className="flex-1 font-display font-600 text-white truncate text-sm">
            {isQuickChat ? 'Conversazione con Ada' : conversation.title}
          </h1>
        )}

        {/* Controlli destra: Search + ModeSelector */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Ricerca nella chat */}
          {isSearchOpen ? (
            <>
              {searchHighlight && (
                <span className="text-xs text-gray-600 font-mono">
                  {visibleMessages.length} risultati
                </span>
              )}
              <button
                onClick={() => setIsSearchOpen(false)}
                className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-gray-700/50 transition-colors"
                title="Chiudi ricerca"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsSearchOpen(true)}
              className="p-1.5 text-gray-600 hover:text-gray-300 rounded-lg hover:bg-gray-700/50 transition-colors"
              title="Cerca nella conversazione"
            >
              <SearchIcon className="h-4 w-4" />
            </button>
          )}

          {/* Selettore modalità — solo se i prop sono disponibili */}
          {currentModeId && onModeChange && (
            <ModeSelector currentModeId={currentModeId} onModeChange={onModeChange} />
          )}
        </div>
      </div>

      {/* Avviso ricerca attiva */}
      {searchHighlight && (
        <div className="flex-shrink-0 px-4 py-2 bg-purple-900/20 border-b border-purple-800/30 flex items-center justify-between">
          <span className="text-xs text-purple-400 font-mono">
            Ricerca: "{searchHighlight}" — {visibleMessages.length} messaggi trovati
          </span>
          <button
            onClick={() => { setSearchHighlight(''); setSearchQuery(''); }}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
          >
            Cancella
          </button>
        </div>
      )}

      {studentForConversation && <StudentSheetHeader student={studentForConversation} />}

      {/* ── Messaggi ───────────────────────────────────────────────────── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {visibleMessages.map((msg, index) => (
            <div key={msg.id} id={`message-${msg.id}`} className="animate-fade-in-up">
              <MessageView
                message={msg}
                onShowToast={onShowToast}
                isLastMessage={index === visibleMessages.length - 1}
                onSendMessage={onSendMessage}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Input ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-6 pb-5 pt-4 border-t border-gray-800/40 bg-gray-900/40 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} onShowToast={onShowToast} />
        </div>
      </div>
    </main>
  );
};

export default memo(ChatView);
