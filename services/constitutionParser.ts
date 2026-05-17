// services/constitutionParser.ts
import type { Pillar, ModuleDetails, ParsedConstitution } from '../types';

const parsePillarsOrActivities = (text: string): string[] => {
    if (!text) return [];
    // Content can be "⦁ Item 1; Item 2" or "⦁ Item 1\n⦁ Item 2" or just a list separated by ;
    return text.split(/⦁|;|\n\s*-/)
        .map(p => p.trim())
        .filter(Boolean);
};

export const parseConstitution = (constitutionText: string): ParsedConstitution => {
    const modules: ModuleDetails[] = [];
    const moduleMap = new Map<string, ModuleDetails>();

    // Split text into module sections, keeping the delimiter, and filter out any empty strings.
    const moduleSections = constitutionText.split(/(?=^MODULO \d+:)/gm).filter(s => s.trim().startsWith('MODULO'));
    const totalModules = moduleSections.length;

    for (let i = 0; i < totalModules; i++) {
        const section = moduleSections[i];

        const nameMatch = section.match(/^MODULO \d+:.*$/m);
        const name = nameMatch ? nameMatch[0].trim() : 'Modulo Sconosciuto';
        
        const moduleNumberMatch = name.match(/^MODULO (\d+):/);
        const moduleNumber = moduleNumberMatch ? parseInt(moduleNumberMatch[1], 10) : -1;

        // Module 0 (introductory) and the last module (conclusive) are special cases
        // and should not have pillars or activities.
        const isSpecialModule = (moduleNumber === 0) || (i === totalModules - 1);

        // Regexes made more robust to handle optional sections and varying whitespace.
        const roleMatch = section.match(/Ruolo:\s*([\s\S]*?)(?=Significato:|⦁\s*Pilastri|Attività Chiave:|$)/);
        const significanceMatch = section.match(/Significato:\s*([\s\S]*?)(?=⦁\s*Pilastri|Attività Chiave:|$)/);
        
        let sintonizzazionePillars: Pillar[] = [];
        let operativiPillars: Pillar[] = [];
        let attivitaChiaveItems: string[] = [];

        // Only parse pillars and activities for standard modules.
        if (!isSpecialModule) {
            const sintonizzazioneMatch = section.match(/⦁\s*Pilastri di Sintonizzazione(?:.*)?:\s*([\s\S]*?)(?=⦁\s*Pilastri Operativi|⦁\s*Attività Chiave:|$)/);
            const operativiMatch = section.match(/⦁\s*Pilastri Operativi(?:.*)?:\s*([\s\S]*?)(?=⦁\s*Attività Chiave:|$)/);
            let attivitaChiaveMatch = section.match(/⦁\s*Attività Chiave(?:.*)?:\s*([\s\S]*?)(?=\nMODULO|$)/);
            
            sintonizzazionePillars = sintonizzazioneMatch 
                ? parsePillarsOrActivities(sintonizzazioneMatch[1]).map(name => ({name})) 
                : [];
            
            operativiPillars = operativiMatch 
                ? parsePillarsOrActivities(operativiMatch[1]).map(name => ({name})) 
                : [];

            attivitaChiaveItems = attivitaChiaveMatch 
                ? parsePillarsOrActivities(attivitaChiaveMatch[1])
                : [];
        }


        const moduleDetail: ModuleDetails = {
            name,
            role: roleMatch ? roleMatch[1].trim() : '',
            significance: significanceMatch ? significanceMatch[1].trim() : '',
            sintonizzazione: sintonizzazionePillars,
            operativi: operativiPillars,
            attivitaChiave: attivitaChiaveItems,
        };
        
        modules.push(moduleDetail);
        moduleMap.set(name, moduleDetail);
    }
    
    return { modules, moduleMap };
};
