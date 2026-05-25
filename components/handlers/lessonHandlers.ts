import React from 'react';
import type { Conversation, BlockDetails, LessonState, GroupDefinition, Activity } from '../../types';

export interface LessonHandlerDeps {
  conversationsRef: React.MutableRefObject<Conversation[]>;
  conversations: Conversation[];
  updateConversation: (id: string, updater: Partial<Conversation> | ((c: Conversation) => Conversation)) => void;
  handleSelectConversation: (id: string) => void;
  reEditBlockHandler: (convoId: string, blockIndex: number) => void;
  recordAttendanceForBlock: (block: BlockDetails, blockIndex: number, weekNumber: number, allWeekStudentIds: string[], presentStudentIds: string[]) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  setView: (v: string) => void;
  activeConversationId: string | null;
}

export function createLessonHandlers(deps: LessonHandlerDeps) {
  const { conversationsRef, conversations, updateConversation, handleSelectConversation, reEditBlockHandler, recordAttendanceForBlock, showToast, setView, activeConversationId } = deps;

  const handleUpdateBlockInConversation = (convoId: string, blockIndex: number, updatedBlockData: Partial<BlockDetails>) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan.blocks];
      if (newBlocks[blockIndex]) {
        newBlocks[blockIndex] = { ...newBlocks[blockIndex], ...updatedBlockData };
      }
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
  };

  const handleReEditBlock = (convoId: string, blockIndex: number) => {
    reEditBlockHandler(convoId, blockIndex);
    setView('chat');
    handleSelectConversation(convoId);
  };

  const handleAddActivity = (activity: Omit<Activity, 'id'>) => {
    if (!activeConversationId) return;
    const newActivity: Activity = { ...activity, id: crypto.randomUUID() };
    updateConversation(activeConversationId, c => ({
      ...c,
      activities: [...(c.activities ?? []), newActivity],
    }));
  };

  const handleMarkActivityDelivered = (activityId: string) => {
    const convo = conversations.find(c => c.activities?.some(a => a.id === activityId));
    if (!convo) return;
    updateConversation(convo.id, c => ({
      ...c,
      activities: (c.activities ?? []).map(a =>
        a.id === activityId
          ? { ...a, status: 'consegnata' as const, deliveredAt: new Date().toISOString() }
          : a
      ),
    }));
  };

  const handleAvviaLezione = (convoId: string, blockIndex: number) => {
    conversationsRef.current.forEach(c => {
      if (!c.weekPlan) return;
      const hasActive = c.weekPlan.blocks.some(b => b.lessonState === 'in_corso');
      if (hasActive && c.id !== convoId) {
        updateConversation(c.id, conv => {
          if (!conv.weekPlan) return conv;
          return {
            ...conv,
            weekPlan: {
              ...conv.weekPlan,
              blocks: conv.weekPlan.blocks.map(b =>
                b.lessonState === 'in_corso' ? { ...b, lessonState: 'progettata' as LessonState } : b
              ),
            },
          };
        });
      }
    });
    updateConversation(convoId, c => {
      if (!c.weekPlan) return c;
      return {
        ...c,
        weekPlan: {
          ...c.weekPlan,
          blocks: c.weekPlan.blocks.map((b, i) =>
            i === blockIndex ? { ...b, lessonState: 'in_corso' as LessonState } : b
          ),
        },
      };
    });
    setView('lezione_in_corso');
  };

  const handleChiudiLezione = (convoId: string, blockIndex: number) => {
    updateConversation(convoId, c => {
      if (!c.weekPlan) return c;
      return {
        ...c,
        weekPlan: {
          ...c.weekPlan,
          blocks: c.weekPlan.blocks.map((b, i) =>
            i === blockIndex ? { ...b, lessonState: 'archiviata' as LessonState } : b
          ),
        },
      };
    });
    setView('archivio_lezioni');
  };

  const handleRecordAttendanceForBlock = (convoId: string, blockIndex: number, presentStudentIds: string[]) => {
    const convo = conversationsRef.current.find(c => c.id === convoId);
    if (!convo || !convo.weekPlan) return;
    const block = convo.weekPlan.blocks[blockIndex];
    const allWeekStudentIds = convo.weekPlan.students.map(s => s.id);
    updateConversation(convoId, convo => {
      const newBlocks = [...convo.weekPlan!.blocks];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], presentStudentIds };
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
    recordAttendanceForBlock(block, blockIndex, convo.weekPlan.weekNumber, allWeekStudentIds, presentStudentIds);
    showToast('Presenze registrate con successo!', 'success');
  };

  const handleUpdateGroupsForBlock = (convoId: string, blockIndex: number, groups: GroupDefinition[]) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan!.blocks];
      const currentAllocations = newBlocks[blockIndex].allocations;
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        allocations: {
          ...currentAllocations,
          type: 'group',
          data: { ...(currentAllocations?.data), groups },
        },
      };
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
  };

  const handleUpdateGroupNotesForBlock = (convoId: string, blockIndex: number, groupIndex: number, notes: string) => {
    updateConversation(convoId, convo => {
      if (!convo.weekPlan) return convo;
      const newBlocks = [...convo.weekPlan!.blocks];
      const block = newBlocks[blockIndex];
      if (block.allocations?.data.groups) {
        const newGroups = [...block.allocations.data.groups];
        newGroups[groupIndex] = { ...newGroups[groupIndex], notes };
        newBlocks[blockIndex] = {
          ...block,
          allocations: { ...block.allocations, data: { ...block.allocations.data, groups: newGroups } },
        };
      }
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
  };

  const handleSaveGroupsForBlock = (convoId: string, blockIndex: number, groups: GroupDefinition[]) => {
    updateConversation(convoId, convo => {
      const newBlocks = [...convo.weekPlan!.blocks];
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        allocations: { type: 'group', data: { groups } },
      };
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
    showToast('Gruppi di lavoro salvati!', 'success');
  };

  const handleAddArtifactForBlock = (convoId: string, blockIndex: number, artifactText: string) => {
    updateConversation(convoId, convo => {
      const newBlocks = [...convo.weekPlan!.blocks];
      const currentArtifacts = newBlocks[blockIndex].artifacts || [];
      newBlocks[blockIndex] = { ...newBlocks[blockIndex], artifacts: [...currentArtifacts, artifactText] };
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
  };

  const handleDeleteArtifactForBlock = (convoId: string, blockIndex: number, artifactIndex: number) => {
    updateConversation(convoId, convo => {
      const newBlocks = [...convo.weekPlan!.blocks];
      const currentArtifacts = newBlocks[blockIndex].artifacts || [];
      newBlocks[blockIndex] = {
        ...newBlocks[blockIndex],
        artifacts: currentArtifacts.filter((_, index) => index !== artifactIndex),
      };
      return { ...convo, weekPlan: { ...convo.weekPlan!, blocks: newBlocks } };
    });
  };

  return {
    handleUpdateBlockInConversation,
    handleReEditBlock,
    handleAddActivity,
    handleMarkActivityDelivered,
    handleAvviaLezione,
    handleChiudiLezione,
    handleRecordAttendanceForBlock,
    handleUpdateGroupsForBlock,
    handleUpdateGroupNotesForBlock,
    handleSaveGroupsForBlock,
    handleAddArtifactForBlock,
    handleDeleteArtifactForBlock,
  };
}
