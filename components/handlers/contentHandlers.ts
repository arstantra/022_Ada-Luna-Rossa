import React from 'react';
import TurndownService from 'turndown';
import type { Conversation, WeekPlan, BlockDetails } from '../../types';
import * as GeminiService from '../../services/gemini';
import { generateExportContent } from '../../utils';

export interface ContentHandlerDeps {
  conversationsRef: React.MutableRefObject<Conversation[]>;
  activeConversationId: string | null;
  updateConversation: (id: string, updater: Partial<Conversation> | ((c: Conversation) => Conversation)) => void;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  handleSelectConversation: (id: string) => void;
  setNotebookSuggestion: React.Dispatch<React.SetStateAction<{ title: string } | null>>;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setView: (v: string) => void;
}

export function createContentHandlers(deps: ContentHandlerDeps) {
  const {
    conversationsRef, activeConversationId, updateConversation, setConversations,
    handleSelectConversation, setNotebookSuggestion, showToast, setIsLoading, setView,
  } = deps;

  const handleUpdateWeekPlan = (updater: (plan: WeekPlan) => WeekPlan) => {
    if (activeConversationId) {
      updateConversation(activeConversationId, conversation => {
        if (!conversation.weekPlan) return conversation;
        return { ...conversation, weekPlan: updater(conversation.weekPlan) };
      });
    }
  };

  const handleExportContent = async (plan: WeekPlan, block: BlockDetails, blockIndex: number, format: string) => {
    if (format === 'document') {
      const htmlBody = (block.contentBlocks || [])
        .map(cb => cb.content)
        .join('<hr style="border: 0; height: 1px; background-image: linear-gradient(to right, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.2), rgba(0, 0, 0, 0)); margin: 2em 0;" />');

      const fullHtml = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${plan.theme} - Blocco ${blockIndex + 1}</title>
  <style>
    body { font-family: 'Lora', serif; line-height: 1.7; color: #1f2937; max-width: 21cm; margin: 2rem auto; padding: 2.54cm; }
    h1, h2, h3 { font-family: sans-serif; }
    h1 { font-size: 2em; } h2 { font-size: 1.5em; } h3 { font-size: 1.17em; }
    blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; font-style: italic; color: #4b5563; }
    a { color: #2563eb; }
  </style>
</head>
<body>
<h1>Settimana ${plan.weekNumber}: ${plan.theme}</h1>
<h2>Blocco ${blockIndex + 1} - ${block.day}: ${block.objective || ''}</h2>
<hr>
${htmlBody}
</body>
</html>`;

      const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `documento_blocco_${blockIndex + 1}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast('Documento HTML esportato!', 'success');
      return;
    }

    if (!block.contentBlocks || block.contentBlocks.length === 0) {
      showToast('Nessun contenuto da esportare per questo blocco.', 'error');
      return;
    }
    setIsLoading(true);
    showToast(`Sto generando l'esportazione come ${format}...`, 'info');
    try {
      const { prompt, filename } = generateExportContent(plan, block, blockIndex, format);
      const exportedText = await GeminiService.distillText(prompt);

      const blob = new Blob([exportedText], {
        type: format === 'notebooklm' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8',
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Esportazione completata!', 'success');

      if (format === 'notebooklm') {
        setNotebookSuggestion({ title: `Settimana ${plan.weekNumber} - ${plan.theme}` });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Errore sconosciuto durante l'esportazione.";
      console.error('Export failed:', error);
      showToast(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormatBlocks = (selectedIds: Set<string>) => {
    const turndownService = new TurndownService();

    const allBlocks = conversationsRef.current
      .filter(c => c.weekPlan)
      .flatMap(convo =>
        convo.weekPlan!.blocks.map((block, index) => ({
          ...block,
          uniqueId: `${convo.id}-${index}`,
          weekPlan: convo.weekPlan!,
          convoId: convo.id,
          blockIndex: index,
        }))
      );

    const selectedBlocks = allBlocks.filter(b => selectedIds.has(b.uniqueId));
    if (selectedBlocks.length === 0) {
      showToast('Nessun blocco valido selezionato.', 'error');
      return;
    }

    selectedBlocks.sort((a, b) => {
      if (a.weekPlan.weekNumber !== b.weekPlan.weekNumber) {
        return a.weekPlan.weekNumber - b.weekPlan.weekNumber;
      }
      return a.blockIndex - b.blockIndex;
    });

    const titleParts = selectedBlocks.map(b => `Blocco ${b.blockIndex + 1}`).join(', ');
    const weekInfo = `Settimana ${selectedBlocks[0].weekPlan.weekNumber}`;
    const newTitle = `Lavorazione: ${titleParts} / ${weekInfo}`;

    let aggregatedContent = `### **SESSIONE DI LAVORAZIONE MULTI-BLOCCO**\n\nSono stati selezionati i seguenti Contenuti Master:\n\n---\n\n`;
    selectedBlocks.forEach((block, index) => {
      const masterContentHtml = block.contentBlocks?.map(cb => cb.content).join('\n<hr>\n') || '_Nessun contenuto_';
      const masterContentMd = turndownService.turndown(masterContentHtml);

      aggregatedContent += `### **CONTENUTO ${index + 1}**\n`;
      aggregatedContent += `*   **Settimana:** ${block.weekPlan.weekNumber} - ${block.weekPlan.theme}\n`;
      aggregatedContent += `*   **Blocco:** ${block.blockIndex + 1} - ${block.objective || 'N/D'}\n`;
      aggregatedContent += `*   **Modulo:** ${block.module || 'N/D'}\n\n`;
      aggregatedContent += `${masterContentMd}\n\n---\n\n`;
    });
    aggregatedContent += `### **ISTRUZIONI PER LA MANIPOLAZIONE**\n\nAda, basandoti sui contenuti aggregati qui sopra, aiutami a: `;

    const newConversation: Conversation = {
      id: `conv-creative-${Date.now()}`,
      title: newTitle,
      messages: [{ id: `msg-user-${Date.now()}`, role: 'user', content: aggregatedContent }],
    };

    setConversations([newConversation, ...conversationsRef.current]);
    handleSelectConversation(newConversation.id);
    setView('chat');
    showToast('Atelier Creativo pronto! Inizia a dare istruzioni.', 'success');
  };

  return {
    handleUpdateWeekPlan,
    handleExportContent,
    handleFormatBlocks,
  };
}
