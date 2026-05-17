import React, { useEffect, useRef, useState, useMemo, memo, useCallback } from 'react';
import type { Conversation, Student } from '../types';
import MessageView from './MessageView';
import ChatInput from './ChatInput';
import StudentSheetHeader from './StudentSheetHeader';
import { ChatBubbleOvalLeftEllipsisIcon } from './Icons';

interface ChatViewProps {
  conversation: Conversation | null;
  students: Student[];
  onSendMessage: (content: string, file?: File, actionPayload?: string) => void;
  isLoading: boolean;
  onShowToast: (message: string, type: 'success' | 'info' | 'error') => void;
}

const WelcomeScreen: React.FC = () => (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-6">
        <div className="space-y-2">
            <div className="font-display text-6xl font-800 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-gray-200 to-gray-500">
                Ada
            </div>
            <p className="font-display text-sm font-600 tracking-[0.3em] uppercase text-purple-400">
                Laboratorio di Design
            </p>
        </div>
        <div className="w-16 h-px bg-gradient-to-r from-transparent via-gray-600 to-transparent" />
        <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
            Seleziona una conversazione dalla barra laterale o creane una nuova per iniziare a lavorare con Ada.
        </p>
    </div>
);

const ChatView: React.FC<ChatViewProps> = ({
  conversation, students, onSendMessage, isLoading,
  onShowToast
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const studentForConversation = useMemo(() => {
    if (conversation?.studentId) {
      return students.find(s => s.id === conversation.studentId) || null;
    }
    return null;
  }, [conversation, students]);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      const isNearBottom = scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight < 150;
      if (isNearBottom) {
        // A small delay can help ensure the DOM has fully updated.
        setTimeout(() => {
          scrollContainer.scrollTo({ top: scrollContainer.scrollHeight, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [conversation?.messages, isLoading]);


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
      {/* Header conversazione */}
      <div className="flex-shrink-0 flex items-center gap-3 px-6 py-4 border-b border-gray-800/60 bg-gray-900/60 backdrop-blur-sm">
        <ChatBubbleOvalLeftEllipsisIcon className="h-5 w-5 text-purple-400 flex-shrink-0" />
        <h1 className="font-display font-600 text-white truncate">{conversation.title}</h1>
      </div>

      {studentForConversation && <StudentSheetHeader student={studentForConversation} />}

      {/* Messaggi */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
          {conversation.messages.filter(msg => (msg.content || msg.attachment || msg.generatedImages)).map((msg, index) => (
            <div key={msg.id} id={`message-${msg.id}`} className="animate-fade-in-up">
              <MessageView
                message={msg}
                onShowToast={onShowToast}
                isLastMessage={index === conversation.messages.length - 1}
                onSendMessage={onSendMessage}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="flex-shrink-0 px-6 pb-5 pt-4 border-t border-gray-800/40 bg-gray-900/40 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto">
          <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} onShowToast={onShowToast} />
        </div>
      </div>
    </main>
  );
};

export default memo(ChatView);