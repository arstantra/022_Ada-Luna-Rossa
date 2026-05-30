import React from 'react';
import type { Conversation, WeekRouteInfo, BlockStatus, LessonType, TeachingMethodology, DetachedLesson } from '../../types';
import type { SaltaChoice } from '../SaltaLezioneModal';

export interface BlockStatusDeps {
  conversationsRef: React.MutableRefObject<Conversation[]>;
  updateConversation: (id: string, updater: Partial<Conversation> | ((c: Conversation) => Conversation)) => void;
  availableWeeks: WeekRouteInfo[];
  getOrCreateConversationForWeek: (weekInfo: WeekRouteInfo) => Conversation;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  setPendingSaltaInfo: React.Dispatch<React.SetStateAction<{ weekNumber: number; blockIndex: number; block: import('../../types').BlockDetails } | null>>;
  pendingSaltaInfoRef: React.MutableRefObject<{ weekNumber: number; blockIndex: number; block: import('../../types').BlockDetails } | null>;
}

export function createApplyBlockStatus(deps: Pick<BlockStatusDeps, 'conversationsRef' | 'updateConversation' | 'availableWeeks' | 'getOrCreateConversationForWeek'>) {
  const { conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek } = deps;

  return (weekNumber: number, blockIndex: number, status: BlockStatus, reason?: string) => {
    const existingConvo = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);

    const updateBlockInConversation = (c: Conversation) => {
      if (!c.weekPlan) return c;
      const newBlocks = [...c.weekPlan.blocks];
      if (newBlocks[blockIndex]) {
        const updatedBlock = { ...newBlocks[blockIndex], status, reason: reason || undefined };
        if (status === 'normale') {
          delete updatedBlock.reason;
        }
        newBlocks[blockIndex] = updatedBlock;
      }
      return { ...c, weekPlan: { ...c.weekPlan!, blocks: newBlocks } };
    };

    if (existingConvo) {
      updateConversation(existingConvo.id, updateBlockInConversation);
    } else {
      const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
      if (!weekInfo) {
        console.error(`Cannot create and update status for non-existent week: ${weekNumber}`);
        return;
      }
      const newConversation = getOrCreateConversationForWeek(weekInfo);
      updateConversation(newConversation.id, updateBlockInConversation);
    }
  };
}

export function createBlockStatusHandlers(deps: BlockStatusDeps) {
  const { conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek, showToast, setPendingSaltaInfo, pendingSaltaInfoRef } = deps;

  const applyBlockStatus = createApplyBlockStatus({ conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek });

  const handleUpdateBlockModule = (weekNumber: number, blockIndex: number, module: string, lessonTitle: string) => {
    let conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
    if (!conversation) {
      const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
      if (!weekInfo) {
        console.warn(`Attempted to update for non-existent week number: ${weekNumber}`);
        return;
      }
      conversation = getOrCreateConversationForWeek(weekInfo);
    }
    if (conversation.weekPlan) {
      updateConversation(conversation.id, c => {
        const newBlocks = [...c.weekPlan!.blocks];
        if (newBlocks[blockIndex]) {
          newBlocks[blockIndex] = { ...newBlocks[blockIndex], module, lessonTitle };
        }
        return { ...c, weekPlan: { ...c.weekPlan!, blocks: newBlocks } };
      });
    }
  };

  const handleUpdateBlockStatus = (weekNumber: number, blockIndex: number, status: BlockStatus, reason?: string) => {
    if (status === 'saltato') {
      const convo = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
      const block = convo?.weekPlan?.blocks[blockIndex];
      const hasContent = block && (
        block.objective?.trim() ||
        block.lessonTitle?.trim() ||
        (block.messages && block.messages.length > 0) ||
        (block.contentBlocks && block.contentBlocks.length > 0)
      );
      if (hasContent && block) {
        setPendingSaltaInfo({ weekNumber, blockIndex, block });
        return;
      }
    }
    applyBlockStatus(weekNumber, blockIndex, status, reason);
  };

  const handleUpdateBlockTipologia = (weekNumber: number, blockIndex: number, tipologia: LessonType | '') => {
    const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
    if (!weekInfo) return;
    const conversation = getOrCreateConversationForWeek(weekInfo);
    updateConversation(conversation.id, c => {
      if (!c.weekPlan) return c;
      const blocks = c.weekPlan.blocks.map((b, i) =>
        i === blockIndex ? { ...b, tipologia: (tipologia || undefined) as LessonType | undefined } : b
      );
      return { ...c, weekPlan: { ...c.weekPlan, blocks } };
    });
  };

  const handleUpdateBlockMetodologia = (weekNumber: number, blockIndex: number, metodologia: TeachingMethodology | '') => {
    const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
    if (!weekInfo) return;
    const conversation = getOrCreateConversationForWeek(weekInfo);
    updateConversation(conversation.id, c => {
      if (!c.weekPlan) return c;
      const blocks = c.weekPlan.blocks.map((b, i) =>
        i === blockIndex ? { ...b, metodologia: (metodologia || undefined) as TeachingMethodology | undefined } : b
      );
      return { ...c, weekPlan: { ...c.weekPlan, blocks } };
    });
  };

  const handleToggleFslPeriod = (weekNumber: number, blockIndex: number, value: boolean) => {
    const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
    if (!weekInfo) return;
    const conversation = getOrCreateConversationForWeek(weekInfo);
    updateConversation(conversation.id, c => {
      if (!c.weekPlan) return c;
      const blocks = c.weekPlan.blocks.map((b, i) =>
        i === blockIndex ? { ...b, isFslPeriod: value || undefined } : b
      );
      return { ...c, weekPlan: { ...c.weekPlan, blocks } };
    });
  };

  const handleSaltaChoice = (choice: SaltaChoice) => {
    const pendingSaltaInfo = pendingSaltaInfoRef.current;
    if (!pendingSaltaInfo) return;
    const { weekNumber, blockIndex, block } = pendingSaltaInfo;
    const convo = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
    if (!convo) return;

    if (choice === 'accorpa') {
      let targetConvoId: string | null = null;
      let targetBlockIndex: number | null = null;

      const sameWeekBlocks = convo.weekPlan!.blocks;
      for (let i = blockIndex + 1; i < sameWeekBlocks.length; i++) {
        if (sameWeekBlocks[i].status !== 'saltato' && sameWeekBlocks[i].status !== 'annullato') {
          targetConvoId = convo.id;
          targetBlockIndex = i;
          break;
        }
      }

      if (targetConvoId === null) {
        const sortedConvos = conversationsRef.current
          .filter(c => c.weekPlan && c.weekPlan.weekNumber > weekNumber)
          .sort((a, b) => a.weekPlan!.weekNumber - b.weekPlan!.weekNumber);
        for (const nextConvo of sortedConvos) {
          const idx = nextConvo.weekPlan!.blocks.findIndex(
            b => b.status !== 'saltato' && b.status !== 'annullato'
          );
          if (idx !== -1) {
            targetConvoId = nextConvo.id;
            targetBlockIndex = idx;
            break;
          }
        }
      }

      if (targetConvoId !== null && targetBlockIndex !== null) {
        updateConversation(targetConvoId, c => {
          if (!c.weekPlan) return c;
          const newBlocks = [...c.weekPlan.blocks];
          const target = { ...newBlocks[targetBlockIndex!] };
          if (block.objective?.trim()) {
            target.objective = target.objective?.trim()
              ? `${target.objective}\n\n[Accorpato] ${block.objective}`
              : block.objective;
          }
          if (block.lessonTitle?.trim() && !target.lessonTitle?.trim()) {
            target.lessonTitle = block.lessonTitle;
          }
          if (block.lessonSyllabus?.trim() && !target.lessonSyllabus?.trim()) {
            target.lessonSyllabus = block.lessonSyllabus;
          }
          newBlocks[targetBlockIndex!] = target;
          return { ...c, weekPlan: { ...c.weekPlan!, blocks: newBlocks } };
        });
      } else {
        showToast('Nessun blocco disponibile per accorpare. Il contenuto è stato messo in coda.', 'info');
        const detached: DetachedLesson = {
          id: crypto.randomUUID(),
          sourceBlockId: block.id,
          sourceWeekNumber: weekNumber,
          sourceDay: block.day,
          objective: block.objective,
          lessonTitle: block.lessonTitle,
          lessonSyllabus: block.lessonSyllabus,
          messages: block.messages,
          contentBlocks: block.contentBlocks,
          detachedAt: new Date().toISOString(),
        };
        updateConversation(convo.id, c => ({
          ...c,
          pendingContent: [...(c.pendingContent || []), detached],
        }));
      }
      applyBlockStatus(weekNumber, blockIndex, 'saltato');
      setPendingSaltaInfo(null);
      return;
    }

    const detached: DetachedLesson = {
      id: crypto.randomUUID(),
      sourceBlockId: block.id,
      sourceWeekNumber: weekNumber,
      sourceDay: block.day,
      objective: block.objective,
      lessonTitle: block.lessonTitle,
      lessonSyllabus: block.lessonSyllabus,
      messages: block.messages,
      contentBlocks: block.contentBlocks,
      detachedAt: new Date().toISOString(),
      distribuita: choice === 'distribuisci' ? true : undefined,
      archiviata: choice === 'archivia' ? true : undefined,
    };

    updateConversation(convo.id, c => ({
      ...c,
      pendingContent: [...(c.pendingContent || []), detached],
    }));
    applyBlockStatus(weekNumber, blockIndex, 'saltato');
    setPendingSaltaInfo(null);
  };

  return {
    applyBlockStatus,
    handleUpdateBlockModule,
    handleUpdateBlockStatus,
    handleUpdateBlockTipologia,
    handleUpdateBlockMetodologia,
    handleToggleFslPeriod,
    handleSaltaChoice,
  };
}
