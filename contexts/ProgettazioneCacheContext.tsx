import React, { createContext, useContext, useMemo } from 'react';
import { parseProgettazione } from '../services/progettazioneParser';
import type { ParsedProgettazione } from '../types';

const ProgettazioneCacheContext = createContext<ParsedProgettazione | null>(null);

export const ProgettazioneCacheProvider: React.FC<{ progettazioneText: string; children: React.ReactNode }> = ({ progettazioneText, children }) => {
    const cachedData = useMemo(() => parseProgettazione(progettazioneText), [progettazioneText]);

    return (
        <ProgettazioneCacheContext.Provider value={cachedData}>
            {children}
        </ProgettazioneCacheContext.Provider>
    );
};

export const useProgettazioneCache = (): ParsedProgettazione => {
    const context = useContext(ProgettazioneCacheContext);
    if (!context) {
        throw new Error('useProgettazioneCache must be used within a ProgettazioneCacheProvider');
    }
    return context;
};
