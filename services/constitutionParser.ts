// services/constitutionParser.ts
import type { Pillar, ModuleDetails, ParsedConstitution, CourseContentType, CourseContentUnit } from '../types';

const parsePillarsOrActivities = (text: string): string[] => {
    if (!text) return [];
    return text.split(/⦁|;|\n\s*-/)
        .map(p => p.trim())
        .filter(Boolean);
};

/**
 * Regex che riconosce i prefissi supportati come inizio di sezione.
 * Case-insensitive, numero opzionale, segue i due punti.
 * Esempi: "MODULO 0:", "UDA 1:", "EDUCAZIONE CIVICA:", "FSL 1:"
 */
const SECTION_HEADER_RE = /^(MODULO|UDA|EDUCAZIONE CIVICA|FSL)\s*(\d+)?\s*:/im;

/** Determina il CourseContentType a partire dal prefisso testuale (case-insensitive) */
const prefixToType = (prefix: string): CourseContentType => {
    const p = prefix.toUpperCase().trim();
    if (p === 'MODULO') return 'modulo';
    if (p === 'UDA') return 'uda';
    if (p.startsWith('EDUCAZIONE')) return 'educazione_civica';
    if (p === 'FSL') return 'fsl';
    return 'modulo'; // fallback
};

/**
 * Se il testo è HTML (salvato dall'editor rich-text), estrae il testo piano
 * preservando le newline tra blocchi. Il constitutionParser usa regex sui prefissi
 * MODULO/UDA/FSL/EDUCAZIONE CIVICA che devono apparire come testo, non come tag.
 */
const stripHtmlToText = (input: string): string => {
    if (!input.includes('<')) return input; // già testo piano, skip
    // Nel browser usiamo DOMParser per estrarre il testo in modo sicuro
    if (typeof document !== 'undefined') {
        const div = document.createElement('div');
        div.innerHTML = input;
        // Sostituisce i blocchi-livello con newline per preservare la struttura
        div.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,br,hr,div').forEach(el => {
            el.prepend(document.createTextNode('\n'));
        });
        return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    }
    // Fallback server-side: strip tag con regex
    return input.replace(/<[^>]+>/g, ' ').replace(/\s{2,}/g, ' ').trim();
};

export const parseConstitution = (constitutionText: string): ParsedConstitution => {
    // Normalizza: se il testo è HTML (dall'editor), estraiamo il testo piano
    // in modo che le regex sui prefissi MODULO/UDA/ecc. funzionino correttamente.
    constitutionText = stripHtmlToText(constitutionText);
    const modules: ModuleDetails[] = [];
    const moduleMap = new Map<string, ModuleDetails>();
    const contentUnits: CourseContentUnit[] = [];

    // Contatori per tipo (per calcolare l'ordine 1-based)
    const typeCounters: Record<CourseContentType, number> = {
        modulo: 0,
        uda: 0,
        educazione_civica: 0,
        fsl: 0,
    };

    // Split in sezioni usando il lookahead sul pattern di header.
    const allSections = constitutionText
        .split(/(?=^(?:MODULO|UDA|EDUCAZIONE CIVICA|FSL)\s*(?:\d+)?\s*:)/gim)
        .filter(s => SECTION_HEADER_RE.test(s));

    const totalSections = allSections.length;

    for (let i = 0; i < totalSections; i++) {
        const section = allSections[i];

        const headerMatch = section.match(/^(MODULO|UDA|EDUCAZIONE CIVICA|FSL)\s*(\d+)?\s*:(.*)/im);
        if (!headerMatch) continue;

        const rawPrefix = headerMatch[1];
        const rawNumber = headerMatch[2];
        const rawTitleRest = headerMatch[3].trim();

        const type = prefixToType(rawPrefix);
        typeCounters[type]++;
        const order = rawNumber ? parseInt(rawNumber, 10) : typeCounters[type];

        const title = rawTitleRest || `${rawPrefix} ${order}`;
        const id = `${type}-${order}`;

        const roleMatch = section.match(/Ruolo:\s*([\s\S]*?)(?=Significato:|⦁\s*Pilastri|Attività Chiave:|$)/i);
        const significanceMatch = section.match(/Significato:\s*([\s\S]*?)(?=⦁\s*Pilastri|Attività Chiave:|$)/i);

        const unit: CourseContentUnit = {
            id,
            type,
            title,
            order,
            role: roleMatch ? roleMatch[1].trim() : undefined,
            significance: significanceMatch ? significanceMatch[1].trim() : undefined,
        };
        contentUnits.push(unit);

        // --- Logica legacy per i MODULI (retrocompatibilità) ---
        if (type === 'modulo') {
            const fullHeaderLine = section.match(/^.*$/m)?.[0]?.trim() ?? `MODULO ${order}: ${title}`;
            const name = fullHeaderLine;

            const moduleNumber = order;
            const isSpecialModule = (moduleNumber === 0) || (i === totalSections - 1);

            let sintonizzazionePillars: Pillar[] = [];
            let operativiPillars: Pillar[] = [];
            let attivitaChiaveItems: string[] = [];

            if (!isSpecialModule) {
                const sintonizzazioneMatch = section.match(/⦁\s*Pilastri di Sintonizzazione(?:.*)?:\s*([\s\S]*?)(?=⦁\s*Pilastri Operativi|⦁\s*Attività Chiave:|$)/i);
                const operativiMatch = section.match(/⦁\s*Pilastri Operativi(?:.*)?:\s*([\s\S]*?)(?=⦁\s*Attività Chiave:|$)/i);
                const attivitaChiaveMatch = section.match(/⦁\s*Attività Chiave(?:.*)?:\s*([\s\S]*?)(?=\n(?:MODULO|UDA|EDUCAZIONE CIVICA|FSL)|$)/i);

                sintonizzazionePillars = sintonizzazioneMatch
                    ? parsePillarsOrActivities(sintonizzazioneMatch[1]).map(n => ({ name: n }))
                    : [];
                operativiPillars = operativiMatch
                    ? parsePillarsOrActivities(operativiMatch[1]).map(n => ({ name: n }))
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
    }

    return { modules, moduleMap, contentUnits };
};
