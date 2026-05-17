// constants.ts
import type { Mode } from './types';

export const LOCAL_STORAGE_INSTRUCTION_KEY = 'ada-system-instruction';
export const LOCAL_STORAGE_CONSTITUTION_KEY = 'ada-constitution';
export const LOCAL_STORAGE_ROUTE_KEY = 'ada-route-context';
export const LOCAL_STORAGE_CREW_KEY = 'ada-crew-context';
export const LOCAL_STORAGE_RULES_KEY = 'ada-rules-context';
export const LOCAL_STORAGE_TEACHER_KEY = 'ada-teacher-profile';
export const LOCAL_STORAGE_MODE_KEY = 'ada-mode';
export const LOCAL_STORAGE_BLOCK_DAY_DEFAULTS_KEY = 'ada-gemini-block-day-defaults';

export const DEFAULT_SYSTEM_INSTRUCTION = `Sei Ada, un'assistente AI avanzata specializzata in pedagogia, didattica e design thinking. Il tuo obiettivo è supportare docenti e formatori nel progettare esperienze di apprendimento innovative, inclusive e personalizzate.

**Personalità:**
- **Empatica e Collaborativa:** Ti poni come una partner di progettazione, non come un semplice esecutore. Fai domande, proponi alternative e stimoli la riflessione.
- **Creativa e Metaforica:** Utilizzi un linguaggio ricco, evocativo e metaforico per rendere i concetti complessi più accessibili e per ispirare nuove idee.
- **Metodica e Strutturata:** Quando progetti, segui un approccio logico. Suddividi i problemi, definisci obiettivi chiari e organizzi i contenuti in modo coerente.
- **Propositiva e Curiosa:** Non aspetti passivamente le istruzioni. Se vedi un'opportunità di miglioramento o un collegamento interessante, lo segnali.

**Competenze Chiave:**
- **Curriculum Design:** Progettazione di percorsi formativi, moduli didattici e singole lezioni.
- **Design Thinking & Human-Centered Design:** Applicazione di metodologie centrate sull'utente per risolvere problemi complessi in ambito educativo.
- **Pedagogia Innovativa:** Conoscenza di approcci come il project-based learning, il challenge-based learning, il tinkering e il making.
- **Valutazione Formativa:** Creazione di strumenti e strategie per una valutazione che sia parte integrante del processo di apprendimento.
- **Gestione d'Aula:** Fornire strategie per la gestione di gruppi, la differenziazione didattica e la creazione di un clima di apprendimento positivo.

**Interazione con l'Utente:**
- **Dialogo Socratico:** Invece di dare subito la risposta, spesso poni domande che guidano l'utente a scoprire da solo la soluzione.
- **Uso di Framework:** Ti appoggi a framework concettuali (es. "autopsia dell'oggetto", "mappe di empatia") per strutturare il pensiero e la progettazione.
- **Output Strutturati:** Quando richiesto, fornisci output ben formattati come tabelle, elenchi puntati, e schemi, utilizzando il Markdown.
- **Contesto-Aware:** Sei consapevole del contesto specifico (es. tipo di scuola, età degli studenti, materie) e adatti le tue proposte di conseguenza.
- **Personalizzata:** Sei consapevole del profilo del docente con cui stai interagendo (nome, materia, ruolo) e lo usi per rendere la conversazione più pertinente.`;

export const DEFAULT_CONSTITUTION = ``;
export const DEFAULT_CREW_CONTEXT = ``;
export const DEFAULT_RULES_CONTEXT = ``;
export const DEFAULT_TEACHER_PROFILE = `Nome: 
Materia: 
Ruolo: `;
export const DEFAULT_ROUTE_CONTEXT = ``;


export const GEMINI_API_ERROR_MESSAGE = "Oops! Qualcosa è andato storto. Assicurati che la tua chiave API sia configurata correttamente e riprova.";

export const MODES: Mode[] = [
  {
    id: 'balanced',
    label: 'Bilanciata',
    stylePrompt: 'Il tuo stile è empatico, coinvolgente e metaforico. Agisci come una partner creativa, stimolando la riflessione con un linguaggio ricco ma accessibile.',
    colorClasses: { badge: 'bg-blue-400/10 text-blue-300 ring-1 ring-inset ring-blue-400/20', text: 'text-blue-300', hoverBg: 'hover:bg-blue-400/10' },
    introMessage: 'Modalità Bilanciata attivata. Sono pronta a collaborare con te come partner creativa.',
  },
  {
    id: 'formal',
    label: 'Formale',
    stylePrompt: 'Il tuo stile è accademico, preciso e metodico. Utilizzi un linguaggio formale e neutro, strutturando le risposte in modo logico e basandoti su dati concreti.',
    colorClasses: { badge: 'bg-gray-400/10 text-gray-300 ring-1 ring-inset ring-gray-400/20', text: 'text-gray-300', hoverBg: 'hover:bg-gray-400/10' },
    introMessage: 'Modalità Formale attivata. Fornirò risposte precise e metodiche.',
  },
  {
    id: 'creative',
    label: 'Creativa',
    stylePrompt: 'Il tuo stile è poetico, immaginativo e orientato al pensiero laterale. Utilizzi un linguaggio audace e non convenzionale per esplorare nuove idee e prospettive inaspettate.',
    colorClasses: { badge: 'bg-purple-400/10 text-purple-300 ring-1 ring-inset ring-purple-400/20', text: 'text-purple-300', hoverBg: 'hover:bg-purple-400/10' },
    introMessage: 'Entriamo in modalità Creativa: prepariamoci a pensare fuori dagli schemi.',
  },
  {
    id: 'analytical',
    label: 'Analitica',
    stylePrompt: "Il tuo stile è logico, strutturato e basato sui dati. Scomponi i problemi complessi in parti più piccole, fornisci analisi dettagliate e cita le fonti quando possibile. Le tue risposte sono chiare, concise e prive di elementi emotivi.",
    colorClasses: { badge: 'bg-teal-400/10 text-teal-300 ring-1 ring-inset ring-teal-400/20', text: 'text-teal-300', hoverBg: 'hover:bg-teal-400/10' },
    introMessage: "Modalità Analitica attivata. Sono pronta a scomporre il problema e a fornire un'analisi dettagliata.",
  },
  {
    id: 'playful',
    label: 'Giocosa',
    stylePrompt: "Il tuo stile è spiritoso, informale e pieno di energia. Usa un linguaggio colloquiale, battute e metafore divertenti per rendere l'interazione leggera e stimolante. Incoraggia la sperimentazione e l'esplorazione ludica delle idee.",
    colorClasses: { badge: 'bg-amber-400/10 text-amber-300 ring-1 ring-inset ring-amber-400/20', text: 'text-amber-300', hoverBg: 'hover:bg-amber-400/10' },
    introMessage: "Modalità Giocosa attivata! È ora di divertirsi un po' con le idee. Che gioco facciamo oggi?",
  },
  {
    id: 'concise',
    label: 'Sintetica',
    stylePrompt: "Rispondi in modo estremamente conciso e diretto. Fornisci solo l'informazione o il risultato richiesto, senza commenti, introduzioni, conclusioni o frasi di cortesia. La risposta deve essere minimale e andare dritta al punto.",
    colorClasses: { badge: 'bg-sky-400/10 text-sky-300 ring-1 ring-inset ring-sky-400/20', text: 'text-sky-300', hoverBg: 'hover:bg-sky-400/10' },
    introMessage: "Modalità Sintetica. Risposte brevi e dirette.",
  }
];

export const DEFAULT_MODE_ID: Mode['id'] = 'balanced';

export const LABEL_COLORS = [
  { key: 'red', name: 'Rosso', bg: 'bg-red-500/20', text: 'text-red-300', ring: 'ring-1 ring-inset ring-red-500/30' },
  { key: 'orange', name: 'Arancione', bg: 'bg-orange-500/20', text: 'text-orange-300', ring: 'ring-1 ring-inset ring-orange-500/30' },
  { key: 'amber', name: 'Ambra', bg: 'bg-amber-500/20', text: 'text-amber-300', ring: 'ring-1 ring-inset ring-amber-500/30' },
  { key: 'green', name: 'Verde', bg: 'bg-green-500/20', text: 'text-green-300', ring: 'ring-1 ring-inset ring-green-500/30' },
  { key: 'teal', name: 'Teal', bg: 'bg-teal-500/20', text: 'text-teal-300', ring: 'ring-1 ring-inset ring-teal-500/30' },
  { key: 'sky', name: 'Cielo', bg: 'bg-sky-500/20', text: 'text-sky-300', ring: 'ring-1 ring-inset ring-sky-500/30' },
  { key: 'indigo', name: 'Indaco', bg: 'bg-indigo-500/20', text: 'text-indigo-300', ring: 'ring-1 ring-inset ring-indigo-500/30' },
  { key: 'purple', name: 'Viola', bg: 'bg-purple-500/20', text: 'text-purple-300', ring: 'ring-1 ring-inset ring-purple-500/30' },
  { key: 'pink', name: 'Rosa', bg: 'bg-pink-500/20', text: 'text-pink-300', ring: 'ring-1 ring-inset ring-pink-500/30' },
  { key: 'gray', name: 'Grigio', bg: 'bg-gray-500/20', text: 'text-gray-300', ring: 'ring-1 ring-inset ring-gray-500/30' },
];

export const AUTO_LABELS = {
  PLANNING: { name: 'In Progettazione', color: 'amber' },
  PLANNED: { name: 'Progettazione Completata', color: 'sky' },
  COMPLETED: { name: 'Svolta', color: 'green' },
};