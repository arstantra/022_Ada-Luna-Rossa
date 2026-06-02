import { useMemo } from 'react';
import type { Conversation, MasterLibraryEntry } from '../types';

const DAY_ORDER: Record<string, number> = {
    lunedì: 1, martedì: 2, mercoledì: 3, giovedì: 4, venerdì: 5, sabato: 6, domenica: 7,
};

export function useMasterLibrary(conversations: Conversation[]) {
    const entries = useMemo<MasterLibraryEntry[]>(() => {
        const result: MasterLibraryEntry[] = [];

        for (const conv of conversations) {
            const weekPlan = conv.weekPlan;
            if (!weekPlan) continue;

            for (const block of weekPlan.blocks) {
                if (!block.contentBlocks || block.contentBlocks.length === 0) continue;

                result.push({
                    blockId: block.id,
                    conversationId: conv.id,
                    weekNumber: weekPlan.weekNumber,
                    blockDay: block.day,
                    moduleRef: block.module,
                    type: 'lesson_content',
                    title: block.blockTitle || block.objective || 'Blocco senza titolo',
                    contentBlocks: block.contentBlocks,
                });
            }
        }

        result.sort((a, b) => {
            if (a.weekNumber !== b.weekNumber) return a.weekNumber - b.weekNumber;
            return (DAY_ORDER[a.blockDay] ?? 99) - (DAY_ORDER[b.blockDay] ?? 99);
        });

        return result;
    }, [conversations]);

    const getEntriesByModule = useMemo(() => {
        return (moduleRef: string): MasterLibraryEntry[] =>
            entries.filter(e => e.moduleRef === moduleRef);
    }, [entries]);

    return { entries, getEntriesByModule };
}
