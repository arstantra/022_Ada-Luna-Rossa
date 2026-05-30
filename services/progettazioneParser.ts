// services/progettazioneParser.ts
import type { Pillar, ModuleDetails, ParsedProgettazione, CourseContentType, CourseContentUnit, TeachingMethodology } from '../types';

// ── Parser metodologie didattiche ────────────────────────────────────────────

/**
 * Keyword multi-parola per ogni metodologia.
 * Scelta conservativa: solo frasi esplicite e riconoscibili,
 * per evitare falsi positivi con parole comuni italiane.
 */
const METHODOLOGY_KEYWORDS: Record<TeachingMethodology, string[]> = {
  tradizionale:         ['tradizionale', 'lezione magistrale', 'ex cathedra'],
  flipped_classroom:    ['flipped classroom', 'flipped class', 'classe capovolta', 'lezione capovolta'],
  project_based:        ['project based learning', 'project-based learning', 'apprendimento per progetti', 'project based'],
  problem_based:        ['problem based learning', 'problem-based learning', 'apprendimento per problemi', 'problem based'],
  cooperative_learning: ['cooperative learning', 'apprendimento cooperativo', 'cooperative'],
  peer_teaching:        ['peer teaching', 'peer tutoring', 'tutoraggio tra pari', 'insegnamento tra pari'],
  debate:               ['debate strutturato', 'structured debate', 'dibattito strutturato'],
  design_thinking:      ['design thinking', 'human centered design', 'human-centered design'],
  gamification:         ['gamification', 'gamificazione', 'game based learning', 'game-based learning'],
  studio_di_caso:       ['studio di caso', 'case study', 'caso di studio'],
  inquiry_based:        ['inquiry based learning', 'inquiry-based learning', 'ricerca-azione', 'scoperta guidata', 'inquiry based'],
  role_playing:         ['role playing', 'role-playing', 'gioco di ruolo'],
  jigsaw:               ['jigsaw', 'gruppi esperti', 'puzzle cooperativo'],
};

/**
 * Scansiona il testo del Progetto Didattico alla ricerca di metodologie esplicite.
 * Restituisce le metodologie trovate in ordine di prima occorrenza nel testo,
 * senza duplicati. `tradizionale` non viene mai aggiunto automaticamente —
 * è il default UI quando la lista è vuota.
 */
export const parseMethodologiesFromText = (text: string): TeachingMethodology[] => {
  if (!text.trim()) return [];
  const normalized = text.toLowerCase();
  const found: TeachingMethodology[] = [];

  for (const [methodology, keywords] of Object.entries(METHODOLOGY_KEYWORDS) as [TeachingMethodology, string[]][]) {
    if (methodology === 'tradizionale') continue; // non auto-detect: è il default UI
    const firstIndex = keywords.reduce((min, kw) => {
      const idx = normalized.indexOf(kw.toLowerCase());
      return idx !== -1 && idx < min ? idx : min;
    }, Infinity);
    if (firstIndex !== Infinity) {
      found.push([methodology, firstIndex] as unknown as TeachingMethodology);
    }
  }

  // Ordina per prima occorrenza nel testo, poi estrae solo la metodologia
  return (found as unknown as [TeachingMethodology, number][])
    .sort((a, b) => a[1] - b[1])
    .map(([m]) => m);
};

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
 * preservando le newline tra blocchi. Il progettazioneParser usa regex sui prefissi
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

export const parseProgettazione = (progettazioneText: string): ParsedProgettazione => {
    // Normalizza: se il testo è HTML (dall'editor), estraiamo il testo piano
    // in modo che le regex sui prefissi MODULO/UDA/ecc. funzionino correttamente.
    progettazioneText = stripHtmlToText(progettazioneText);
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
    const allSections = progettazioneText
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

        const roleMatch = section.match(/Ruolo:\s*([\s\S]*?)(?=Significato:|⦁\s*Concetti Chiave|⦁\s*Competenze Operative|⦁\s*Attività Chiave:|$)/i);
        const significanceMatch = section.match(/Significato:\s*([\s\S]*?)(?=⦁\s*Concetti Chiave|⦁\s*Competenze Operative|⦁\s*Attività Chiave:|$)/i);

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
                const concettiChiaveMatch = section.match(/⦁\s*Concetti Chiave(?:.*)?:\s*([\s\S]*?)(?=⦁\s*Competenze Operative|⦁\s*Attività Chiave:|$)/i);
                const competenzeMatch = section.match(/⦁\s*Competenze Operative(?:.*)?:\s*([\s\S]*?)(?=⦁\s*Attività Chiave:|$)/i);
                const attivitaChiaveMatch = section.match(/⦁\s*Attività Chiave(?:.*)?:\s*([\s\S]*?)(?=\n(?:MODULO|UDA|EDUCAZIONE CIVICA|FSL)|$)/i);

                sintonizzazionePillars = concettiChiaveMatch
                    ? parsePillarsOrActivities(concettiChiaveMatch[1]).map(n => ({ name: n }))
                    : [];
                operativiPillars = competenzeMatch
                    ? parsePillarsOrActivities(competenzeMatch[1]).map(n => ({ name: n }))
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

    const parsedMethodologies = parseMethodologiesFromText(progettazioneText);

    return { modules, moduleMap, contentUnits, parsedMethodologies };
};
