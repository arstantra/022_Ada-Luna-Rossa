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

export const DEFAULT_CONSTITUTION = `MODULO 0: Orientamento
Ruolo: Modulo introduttivo per accogliere gli studenti e presentare il percorso formativo, il metodo di lavoro e gli strumenti del laboratorio.
Significato: È il momento in cui il gruppo-classe prende forma come comunità di pratica. Si stabiliscono le regole di convivenza, si esplorano le aspettative reciproche e si attivano le prime competenze progettuali.

MODULO 1: Fondamenti del Design
Ruolo: Introduzione ai principi fondamentali del design: storia, linguaggi visivi, teoria del colore, tipografia e composizione.
Significato: Gli studenti sviluppano un vocabolario visivo condiviso e imparano a "leggere" gli artefatti del mondo artificiale con occhio critico.
⦁ Pilastri di Sintonizzazione: Osservazione consapevole; Analisi visiva; Storia del design
⦁ Pilastri Operativi: Teoria del colore; Tipografia; Composizione e layout
⦁ Attività Chiave: Autopsia dell'oggetto; Moodboard; Brief di progetto

MODULO 2: Processo Progettuale
Ruolo: Apprendimento e applicazione del metodo progettuale: dalla ricerca all'ideazione, dal prototipo alla presentazione.
Significato: Gli studenti sperimentano l'intero ciclo del design thinking, dalla comprensione del problema alla soluzione comunicata con chiarezza.
⦁ Pilastri di Sintonizzazione: Design Thinking; Ricerca utente; Problem framing
⦁ Pilastri Operativi: Sketching e ideazione; Prototipazione rapida; Presentazione del progetto
⦁ Attività Chiave: Mappa di empatia; Prototipo carta; Pitch di progetto

MODULO 3: Progetto Integrato
Ruolo: Applicazione autonoma delle competenze acquisite in un progetto complesso e multidisciplinare, con consegna finale.
Significato: Il modulo conclusivo verifica la capacità degli studenti di gestire un processo progettuale in autonomia, integrando competenze tecniche, creative e comunicative.
⦁ Pilastri di Sintonizzazione: Autonomia progettuale; Pensiero sistemico; Autovalutazione
⦁ Pilastri Operativi: Project management; Documentazione del processo; Comunicazione del progetto
⦁ Attività Chiave: Portfolio; Esposizione finale; Peer review

MODULO 4: Riflessione e Bilancio
Ruolo: Modulo conclusivo dedicato alla valutazione del percorso, alla riflessione metacognitiva e alla proiezione verso il futuro.
Significato: Gli studenti guardano indietro con consapevolezza e in avanti con intenzione. È il momento della narrazione personale del proprio apprendimento.`;

export const DEFAULT_ROUTE_CONTEXT = `Settimana 1: 15-19 settembre 2025 (3 blocchi) - Accoglienza e presentazione del corso
Settimana 2: 22-26 settembre 2025 (3 blocchi) - Fondamenti: osservare e descrivere
Settimana 3: 29 settembre - 3 ottobre 2025 (3 blocchi) - Teoria del colore e linguaggi visivi
Settimana 4: 6-10 ottobre 2025 (3 blocchi) - Tipografia: leggere e progettare il testo
Settimana 5: 13-17 ottobre 2025 (3 blocchi) - Composizione e layout
Settimana 6: 20-24 ottobre 2025 (3 blocchi) - Autopsia dell'oggetto e analisi critica
Settimana 7: 3-7 novembre 2025 (3 blocchi) - Introduzione al Design Thinking
Settimana 8: 10-14 novembre 2025 (3 blocchi) - Ricerca utente e mappa di empatia
Settimana 9: 17-21 novembre 2025 (3 blocchi) - Ideazione e sketching
Settimana 10: 24-28 novembre 2025 (3 blocchi) - Prototipazione rapida
Settimana 11: 1-5 dicembre 2025 (3 blocchi) - Test e iterazione
Settimana 12: 8-12 dicembre 2025 (3 blocchi) - Presentazione e pitch
Settimana 13: 15-19 dicembre 2025 (3 blocchi) - Revisione e bilancio del primo periodo
Settimana 14: 12-16 gennaio 2026 (3 blocchi) - Avvio progetto integrato: brief e ricerca
Settimana 15: 19-23 gennaio 2026 (3 blocchi) - Progetto integrato: ideazione
Settimana 16: 26-30 gennaio 2026 (3 blocchi) - Progetto integrato: sviluppo
Settimana 17: 2-6 febbraio 2026 (3 blocchi) - Progetto integrato: prototipo
Settimana 18: 9-13 febbraio 2026 (3 blocchi) - Progetto integrato: comunicazione
Settimana 19: 23-27 febbraio 2026 (3 blocchi) - Progetto integrato: revisione finale
Settimana 20: 2-6 marzo 2026 (3 blocchi) - Esposizione e peer review
Settimana 21: 9-13 marzo 2026 (3 blocchi) - Portfolio e documentazione
Settimana 22: 16-20 marzo 2026 (3 blocchi) - Riflessione metacognitiva
Settimana 23: 23-27 marzo 2026 (3 blocchi) - Bilancio del percorso e autovalutazione`;

export const DEFAULT_CREW_CONTEXT = `[Sostituisci con i nomi reali delle tue studentesse/studenti, uno per riga]

Sofia Bianchi
Giulia Rossi
Martina Ferrari
Elena Conti
Alessia Ricci
Sara Lombardi
Valentina Greco
Chiara Romano
Federica Esposito
Alice Moretti
Laura Fontana
Emma De Luca
Giorgia Barbieri
Beatrice Gallo
Francesca Marini`;

export const DEFAULT_RULES_CONTEXT = `# Sistema di Valutazione — Laboratorio di Design

## Criteri di Valutazione

### 1. Qualità degli Elaborati (40%)
Valuta la qualità tecnica e concettuale dei lavori prodotti: coerenza progettuale, cura formale, originalità delle soluzioni e padronanza degli strumenti.

### 2. Partecipazione Attiva (20%)
Valuta il contributo durante le attività in aula: interventi, domande, disponibilità al confronto e capacità di alimentare la discussione collettiva.

### 3. Collaborazione (20%)
Valuta la capacità di lavorare in gruppo: ascolto attivo, rispetto dei ruoli, contributo al lavoro collettivo e gestione dei conflitti creativi.

### 4. Resilienza Creativa (20%)
Valuta la capacità di affrontare l'errore come risorsa: disponibilità a iterare, a cambiare prospettiva e a non fermarsi di fronte alle difficoltà progettuali.

## Scale di Valutazione Qualitativa
- **Punto di Forza** → competenza consolidata, elemento distintivo del profilo dello studente
- **Stabile** → competenza adeguata, in linea con le attese
- **Da Potenziare** → competenza in sviluppo, richiede attenzione e supporto mirato

## Note
La valutazione è prevalentemente formativa: accompagna il processo più che misurare il prodotto. Le osservazioni raccolte durante le lezioni alimentano il profilo individuale di ciascuno studente e guidano le scelte didattiche del docente.`;

export const DEFAULT_TEACHER_PROFILE = `Nome:
Materia:
Ruolo: `;


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