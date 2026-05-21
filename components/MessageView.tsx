import React, { useMemo, useState, useCallback } from 'react';
import type { Message, Action } from '../types';
import { CopyIcon, CheckIcon, WebIcon } from './Icons';
import MarkdownRenderer from './MarkdownRenderer';

// Indicatore di digitazione animato
const TypingIndicator: React.FC = () => (
  <div className="flex items-center space-x-2">
    <span className="text-gray-400 italic text-sm">Ada sta scrivendo</span>
    <div className="flex items-center space-x-1">
        <style>{`@keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } } .dot { animation: bounce 1.4s infinite ease-in-out both; } .dot-1 { animation-delay: -0.32s; } .dot-2 { animation-delay: -0.16s; }`}</style>
        <div className="dot dot-1 w-2 h-2 bg-gray-400 rounded-full"></div>
        <div className="dot dot-2 w-2 h-2 bg-gray-400 rounded-full"></div>
        <div className="dot dot-3 w-2 h-2 bg-gray-400 rounded-full"></div>
    </div>
  </div>
);

interface MessageViewProps {
  message: Message;
  onShowToast: (message: string, type: 'success' | 'info' | 'error') => void;
  highlightQuery?: string;
  isCurrentResult?: boolean;
  isLastMessage?: boolean;
  onSendMessage?: (content: string, file?: File, actionPayload?: any) => void;
  onShowConfirmation?: (props: any) => void;
}

const MessageView: React.FC<MessageViewProps> = ({ message, onShowToast, highlightQuery, isCurrentResult, isLastMessage, onSendMessage, onShowConfirmation }) => {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
        setCopied(true);
        onShowToast('Risposta copiata!', 'success');
        setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content, onShowToast]);

  const handleActionClick = useCallback((action: Action) => {
    if (action.payload.action === 'replace_entire_master_content' && onShowConfirmation) {
        onShowConfirmation({
            title: "Conferma Sostituzione",
            children: "Sei sicuro di voler sostituire l'intero Contenuto Master con questa nuova versione? L'azione non è reversibile.",
            confirmText: "Sì, sostituisci",
            confirmButtonClass: "px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-red-500 transition-colors",
            onConfirm: () => {
                if (onSendMessage) {
                    onSendMessage(action.label, undefined, action.payload);
                }
            }
        });
        return;
    }

    if (onSendMessage) {
      onSendMessage(action.label, undefined, action.payload);
    }
  }, [onSendMessage, onShowConfirmation]);

  const renderAttachment = (attachment: Message['attachment']) => attachment && (
    <div className="mt-2 border border-gray-500/50 rounded-lg p-2 flex items-center gap-3 max-w-xs">
        {attachment.type.startsWith('image/') ? <img src={attachment.data} alt={attachment.name} className="w-16 h-16 rounded-md object-cover" /> : <div className="w-16 h-16 rounded-md bg-gray-500 flex items-center justify-center text-gray-300 font-mono text-lg">{attachment.name.split('.').pop()?.toUpperCase()}</div>}
        <div className="flex-1 truncate"><p className="text-white text-sm font-medium truncate">{attachment.name}</p></div>
    </div>
  );
  
  const renderGeneratedImages = (images: string[] | undefined) => images && images.length > 0 && (
    <div className="mt-3 grid grid-cols-2 gap-2">
        {images.map((imgData, index) => (
            <a href={imgData} key={index} target="_blank" rel="noopener noreferrer"><img src={imgData} alt={`Generated image ${index + 1}`} className="rounded-lg object-cover aspect-square hover:opacity-80 transition-opacity" /></a>
        ))}
    </div>
  );

  const renderContent = () => {
    if (message.role === 'assistant' && message.content === '...') return <TypingIndicator />;
    return <>
        {message.content && <MarkdownRenderer content={message.content} highlightQuery={highlightQuery} />}
        {isUser && renderAttachment(message.attachment)}
        {!isUser && !isSystem && renderGeneratedImages(message.generatedImages)}
    </>;
  };
  
  if (isSystem) {
      return (
          <div className="text-center text-xs text-gray-400 italic my-2 py-1">
              {message.content}
          </div>
      )
  }

  return (
    <div className={`-m-2 p-2 rounded-lg transition-colors ${isCurrentResult ? 'bg-yellow-500/10' : ''}`}>
        <div className={`group flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : ''}`}>
            {/* Avatar Ada: piccolo glifo, nessun cerchio pieno */}
            {!isUser && (
                <span className="flex-shrink-0 w-5 text-center mt-1 relative">
                    <span className="text-purple-400/70 text-sm leading-none select-none">✦</span>
                    {message.sources && message.sources.length > 0 && (
                        <span className="absolute -bottom-0.5 -right-0.5" title="Contiene fonti web">
                            <WebIcon className="h-2.5 w-2.5 text-sky-400" />
                        </span>
                    )}
                </span>
            )}
            <div className={`relative max-w-2xl ${isUser ? 'ml-auto' : 'mr-auto'}`}>
                <div className={`max-w-none px-4 py-3 rounded-lg text-white ${isUser ? 'bg-gray-700/80' : 'bg-[#1F2937]'}`}>
                    {renderContent()}
                </div>
                {!isUser && message.content && message.content !== '...' && (
                    <div className="absolute top-0 right-0 -mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <button onClick={handleCopy} className="p-1.5 rounded-full bg-gray-800 hover:bg-gray-600 text-gray-300 hover:text-white" aria-label="Copia messaggio">
                            {copied ? <CheckIcon className="h-4 w-4 text-green-400" /> : <CopyIcon className="h-4 w-4" />}
                        </button>
                    </div>
                )}
            </div>
        </div>

        {!isUser && message.actions && message.actions.length > 0 && (
            <div className="mt-3 ml-8 max-w-2xl flex flex-wrap gap-2">
                {(() => {
                    if (message.actionUsed) {
                        if (message.actions.length === 1) { // Was "Valida"
                            return (
                                <button disabled className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 text-green-400 text-sm font-medium rounded-lg border border-gray-600 disabled:opacity-70 disabled:cursor-not-allowed">
                                    <CheckIcon className="h-4 w-4" />
                                    Validato
                                </button>
                            );
                        }
                        return null; // For multi-actions, hide after use
                    }
                    return message.actions.map((action, index) => (
                        <button
                            key={`${action.label}-${index}`}
                            onClick={() => handleActionClick(action)}
                            className="px-3 py-1.5 bg-gray-600/50 text-white text-sm font-medium rounded-lg border border-gray-500/50 hover:bg-gray-600 hover:border-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {action.label}
                        </button>
                    ));
                })()}
            </div>
        )}

        {!isUser && message.sources && message.sources.length > 0 && (
            <div className="mt-3 ml-8 max-w-2xl">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2 mb-2"><WebIcon className="h-4 w-4"/>Fonti</h4>
                <ul className="space-y-1.5">
                    {message.sources.map((source, index) => (
                        <li key={source.uri} className="text-sm text-gray-400 flex items-start">
                            <span className="mr-2 text-gray-500">{index + 1}.</span>
                            <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 hover:underline break-all" title={source.uri}>{source.title || source.uri}</a>
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </div>
  );
};

export default React.memo(MessageView);