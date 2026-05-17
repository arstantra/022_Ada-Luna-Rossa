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
    <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-4">Ada Gemini</div>
        <p className="text-xl text-gray-400">Laboratorio di Design</p>
        <p className="mt-2 text-gray-500">Seleziona una conversazione o creane una nuova per iniziare.</p>
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
    return <main className="flex-1 flex flex-col bg-[#0D1117]"><WelcomeScreen /></main>;
  }

  return (
    <main className="flex-1 flex flex-col bg-[#0D1117] overflow-hidden">
        <header className="flex-shrink-0 flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-800">
            <div className="flex items-center gap-3">
                <ChatBubbleOvalLeftEllipsisIcon className="h-6 w-6 text-gray-400" />
                <h1 className="text-lg font-semibold text-white">{conversation.title}</h1>
            </div>
        </header>
        
      {studentForConversation && <StudentSheetHeader student={studentForConversation} />}

      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
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
      
      <footer className="flex-shrink-0 p-4 bg-[#1F2937]">
        <ChatInput onSendMessage={onSendMessage} isLoading={isLoading} onShowToast={onShowToast} />
      </footer>
    </main>
  );
};

export default memo(ChatView);