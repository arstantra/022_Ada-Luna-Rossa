import React, { createContext, useContext, useMemo } from 'react';
import { parseConstitution } from '../services/constitutionParser';
import type { ParsedConstitution } from '../types';

const ConstitutionCacheContext = createContext<ParsedConstitution | null>(null);

export const ConstitutionCacheProvider: React.FC<{ constitutionText: string; children: React.ReactNode }> = ({ constitutionText, children }) => {
    const cachedData = useMemo(() => parseConstitution(constitutionText), [constitutionText]);
    
    return (
        <ConstitutionCacheContext.Provider value={cachedData}>
            {children}
        </ConstitutionCacheContext.Provider>
    );
};

export const useConstitutionCache = (): ParsedConstitution => {
    const context = useContext(ConstitutionCacheContext);
    if (!context) {
        throw new Error('useConstitutionCache must be used within a ConstitutionCacheProvider');
    }
    return context;
};