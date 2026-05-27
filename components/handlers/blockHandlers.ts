import React from 'react';
import type { Conversation, WeekRouteInfo, WeekPlan, BlockDetails, ModuleDetails } from '../../types';
import * as GeminiService from '../../services/gemini';

export interface BlockPlanningDeps {
  conversationsRef: React.MutableRefObject<Conversation[]>;
  updateConversation: (id: string, updater: Partial<Conversation> | ((c: Conversation) => Conversation)) => void;
  availableWeeks: WeekRouteInfo[];
  getOrCreateConversationForWeek: (weekInfo: WeekRouteInfo) => Conversation;
  modules: ModuleDetails[];
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

export function createBlockPlanningHandlers(deps: BlockPlanningDeps) {
  const { conversationsRef, updateConversation, availableWeeks, getOrCreateConversationForWeek, modules, showToast, setIsLoading } = deps;

  const handleSetWeekTheme = (weekInfo: WeekRouteInfo, theme: string) => {
    let conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekInfo.weekNumber);
    if (!conversation) {
      conversation = getOrCreateConversationForWeek(weekInfo);
    }
    if (conversation.weekPlan?.theme === theme) return;
    updateConversation(conversation.id, c => ({
      ...c,
      weekPlan: { ...c.weekPlan!, theme: theme || 'Tema da definire' },
    }));
  };

  const handleUpdateWeekTheme = (weekNumber: number, theme: string) => {
    const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
    if (weekInfo) {
      handleSetWeekTheme(weekInfo, theme);
    } else {
      console.warn(`Attempted to update theme for non-existent week number: ${weekNumber}`);
    }
  };

  const handleUpdateBlockObjective = (weekNumber: number, blockIndex: number, objective: string) => {
    let conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
    if (!conversation) {
      const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
      if (!weekInfo) {
        console.warn(`Attempted to update objective for non-existent week number: ${weekNumber}`);
        return;
      }
      conversation = getOrCreateConversationForWeek(weekInfo);
    }
    if (conversation.weekPlan) {
      const newBlocks = [...conversation.weekPlan.blocks];
      if (newBlocks[blockIndex]) {
        newBlocks[blockIndex] = { ...newBlocks[blockIndex], objective };
        updateConversation(conversation.id, c => ({
          ...c,
          weekPlan: { ...c.weekPlan!, blocks: newBlocks },
        }));
      } else {
        console.warn(`Attempted to update objective for non-existent block index: ${blockIndex} in week ${weekNumber}`);
      }
    }
  };

  const handleGenerateStrategicSuggestions = async (
    prompt: string,
    module: string,
  ): Promise<{ theme: string; objectives: string[]; reasoning: string }> => {
    setIsLoading(true);
    try {
      const moduleDetails = modules.find(m => m.name === module);
      const moduleContext = moduleDetails
        ? `${moduleDetails.name}\nRuolo: ${moduleDetails.role}\nSignificato: ${moduleDetails.significance}`
        : module;
      const result = await GeminiService.generateStrategicSuggestions(prompt, moduleContext, null);
      showToast('Suggerimenti strategici generati!', 'success');
      return result;
    } catch (error) {
      console.error('Failed to generate strategic suggestions:', error);
      showToast(error instanceof Error ? error.message : 'Errore durante la generazione dei suggerimenti.', 'error');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStrategicData = (weekNumber: number, theme: string, objectives: string[]) => {
    let conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
    if (!conversation) {
      const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
      if (!weekInfo) {
        console.warn(`Attempted to update strategic data for non-existent week number: ${weekNumber}`);
        return;
      }
      conversation = getOrCreateConversationForWeek(weekInfo);
    }
    if (conversation.weekPlan) {
      const newBlocks = [...conversation.weekPlan.blocks];
      objectives.forEach((obj, index) => {
        if (newBlocks[index] && obj) {
          newBlocks[index] = { ...newBlocks[index], objective: obj };
        }
      });
      updateConversation(conversation.id, c => ({
        ...c,
        weekPlan: {
          ...c.weekPlan!,
          theme: theme || 'Tema da definire',
          blocks: newBlocks,
        },
      }));
    }
  };

  const handleGenerateBlockDetails = async (weekNumber: number, blockIndex: number) => {
    const conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
    if (!conversation?.weekPlan) return;
    const block = conversation.weekPlan.blocks[blockIndex];
    const theme = conversation.weekPlan.theme;
    if (!block.objective) {
      showToast("Definisci prima l'obiettivo del blocco.", 'error');
      return;
    }
    try {
      const details = await GeminiService.generateBlockDetails(block.objective, theme);
      updateConversation(conversation.id, c => {
        const newBlocks = [...c.weekPlan!.blocks];
        newBlocks[blockIndex] = { ...newBlocks[blockIndex], ...details };
        return { ...c, weekPlan: { ...c.weekPlan!, blocks: newBlocks } };
      });
      showToast('Dettagli del blocco generati con AI!', 'success');
    } catch (error) {
      console.error('Failed to generate block details:', error);
      showToast(error instanceof Error ? error.message : 'Errore nella generazione dei dettagli.', 'error');
    }
  };

  const handleUpdateWeekDetails = (weekNumber: number, details: Partial<Pick<WeekPlan, 'notes'>>) => {
    const conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
    if (conversation?.weekPlan) {
      updateConversation(conversation.id, c => ({
        ...c,
        weekPlan: { ...c.weekPlan!, ...details },
      }));
    }
  };

  const handleUpdateBlockDetails = (
    weekNumber: number,
    blockIndex: number,
    details: Partial<Pick<BlockDetails, 'lessonTitle' | 'lessonSyllabus' | 'lessonPlanMaterials' | 'isLocked'>>,
  ) => {
    let conversation = conversationsRef.current.find(c => c.weekPlan?.weekNumber === weekNumber);
    if (!conversation) {
      const weekInfo = availableWeeks.find(w => w.weekNumber === weekNumber);
      if (!weekInfo) {
        console.warn(`Attempted to update details for non-existent week number: ${weekNumber}`);
        return;
      }
      conversation = getOrCreateConversationForWeek(weekInfo);
    }
    if (conversation.weekPlan) {
      updateConversation(conversation.id, c => {
        const newBlocks = [...c.weekPlan!.blocks];
        if (newBlocks[blockIndex]) {
          newBlocks[blockIndex] = { ...newBlocks[blockIndex], ...details };
        }
        return { ...c, weekPlan: { ...c.weekPlan!, blocks: newBlocks } };
      });
    }
  };

  return {
    handleSetWeekTheme,
    handleUpdateWeekTheme,
    handleUpdateBlockObjective,
    handleGenerateStrategicSuggestions,
    handleUpdateStrategicData,
    handleGenerateBlockDetails,
    handleUpdateWeekDetails,
    handleUpdateBlockDetails,
  };
}
