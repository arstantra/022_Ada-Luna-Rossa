// scripts/build-demo-class.mjs
// Genera public/demo/classe-esempio.json: una classe 3B INTERAMENTE FITTIZIA per la demo di Ada.
// Gli studenti sono solo codici (S01…S22), scritti esplicitamente qui sotto: nessun nome, nessun dato reale.
// Uso: node scripts/build-demo-class.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

// ── PRNG deterministico (stesso file a ogni esecuzione) ──────────────────────
let seed = 20261005;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// ── Studenti: SOLO CODICI ────────────────────────────────────────────────────
const CODES = ['S01','S02','S03','S04','S05','S06','S07','S08','S09','S10','S11','S12','S13','S14','S15','S16','S17','S18','S19','S20','S21','S22'];

const PROFILES = {
  S04: { hasDSA: true, measures: ['Mappe concettuali', 'Font ad alta leggibilità', 'Sintesi vocale', 'Tempi aggiuntivi'], notes: 'Lavora molto bene a partire da esempi visivi.' },
  S09: { hasBES: true, measures: ['Consegne spezzate in passi', 'Lavoro in coppia con tutor'], otherMeasures: 'Consegne lette anche ad alta voce.', notes: 'Si attiva nei lavori pratici.' },
  S12: { hasBES: true, measures: ['Posto vicino alla lavagna', 'Riduzione delle consegne'] },
  S15: { hasPEI: true, measures: ['Obiettivi minimi', 'Prova differenziata', 'Supporto del docente di sostegno', 'Pause programmate'], notes: 'Ottima manualità, predilige attività con materiali concreti.' },
  S19: { hasDSA: true, measures: ['Calcolatrice', 'Formulari e schemi', 'Verifiche orali programmate', 'Valutazione del contenuto più che della forma'] },
  S02: { notes: 'Leadership naturale nei lavori di gruppo.' },
  S07: { notes: 'Curiosa, fa domande di approfondimento.' },
  S17: { notes: 'Tende a lavorare da sola: favorire i gruppi.' },
};

const students = CODES.map(code => ({
  id: `demo-${code.toLowerCase()}`,
  name: code,
  notes: PROFILES[code]?.notes ?? '',
  evaluations: [],
  ...(PROFILES[code]?.hasBES ? { hasBES: true } : {}),
  ...(PROFILES[code]?.hasDSA ? { hasDSA: true } : {}),
  ...(PROFILES[code]?.hasPEI ? { hasPEI: true } : {}),
  ...(PROFILES[code]?.measures ? { measures: PROFILES[code].measures } : {}),
  ...(PROFILES[code]?.otherMeasures ? { otherMeasures: PROFILES[code].otherMeasures } : {}),
}));
const byCode = Object.fromEntries(students.map(s => [s.name, s]));
const id = (code) => byCode[code].id;

// Stesso formato di buildCrewContext (components/CrewRosterCard.tsx)
const crewContext = [...students].sort((a, b) => a.name.localeCompare(b.name)).map(s => {
  let line = s.name;
  const flags = [s.hasBES && 'BES', s.hasDSA && 'DSA', s.hasPEI && 'PEI'].filter(Boolean);
  if (flags.length) line += ` [${flags.join(', ')}]`;
  const details = [];
  if (s.measures?.length) details.push(`Misure: ${s.measures.join('; ')}`);
  if (s.otherMeasures) details.push(`Altre misure: ${s.otherMeasures}`);
  if (s.notes) details.push(`Note: ${s.notes}`);
  if (details.length) line += ` — ${details.join(' | ')}`;
  return line;
}).join('\n');

// ── Documenti fondanti ───────────────────────────────────────────────────────
const progettazione = `MODULO 0: Orientamento
Ruolo: Accoglienza della classe 3B, presentazione del percorso, del laboratorio e delle regole di lavoro.
Significato: Il gruppo-classe diventa comunità di pratica; si attivano le prime competenze di osservazione.

MODULO 1: Fondamenti del Design
Ruolo: Linguaggi visivi, teoria del colore, tipografia e composizione.
Significato: Gli studenti costruiscono un vocabolario visivo condiviso e imparano a leggere gli oggetti con occhio critico.
⦁ Concetti Chiave: Osservazione consapevole; Analisi visiva; Storia del design
⦁ Competenze Operative: Teoria del colore; Tipografia; Composizione e layout
⦁ Attività Chiave: Autopsia dell'oggetto; Moodboard; Brief di progetto

MODULO 2: Processo Progettuale
Ruolo: Il metodo progettuale dalla ricerca al prototipo.
Significato: Gli studenti sperimentano un ciclo completo di design thinking.
⦁ Concetti Chiave: Design Thinking; Ricerca utente; Problem framing
⦁ Competenze Operative: Sketching; Prototipazione rapida; Presentazione del progetto
⦁ Attività Chiave: Mappa di empatia; Prototipo di carta; Pitch di progetto

UDA 1: Un oggetto per la scuola
Ruolo: Compito autentico di gruppo: progettare un piccolo oggetto utile per gli spazi comuni dell'istituto.
Significato: Mette insieme osservazione, metodo progettuale e comunicazione.

EDUCAZIONE CIVICA: Design e sostenibilità
Ruolo: Ciclo di vita dei prodotti e scelte responsabili dei materiali.

MODULO 3: Riflessione e Bilancio
Ruolo: Portfolio, autovalutazione e restituzione del percorso.
Significato: Gli studenti raccontano il proprio apprendimento.`;

const rules = `# Patto Formativo — Laboratorio di Design, 3B (classe fittizia)

## Ambiente di lavoro
- Il laboratorio è uno spazio condiviso: si lascia in ordine per chi viene dopo.
- Si lavora spesso in gruppo: ognuno ha un ruolo e lo dichiara.

## Valutazione
- **Processo (40%)**: quaderno di progetto, schizzi, revisioni.
- **Elaborati (40%)**: qualità tecnica e coerenza progettuale.
- **Partecipazione e collaborazione (20%)**.
- Le misure previste nei piani personalizzati si applicano a tutte le prove.

## Feedback e recupero
- Revisione settimanale dei lavori; ogni consegna può essere migliorata una volta.`;

const teacherProfile = `Nome: Docente Demo
Materia: Laboratorio di Design
Ruolo: Docente curricolare
Scuola: Liceo artistico (scuola fittizia)
Classe: 3B — classe fittizia di 22 studenti, identificati solo da codici
Ore: 3 blocchi da 2 ore a settimana (lunedì, mercoledì, venerdì)`;

// ── Calendario (La Rotta): 14 settimane da metà settembre 2026 ───────────────
const MONTHS = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const fmtWeek = (mondayIso) => { // come formatRouteWeekDates in utils.ts
  const m = new Date(mondayIso + 'T12:00:00Z'), s = new Date(addDays(mondayIso, 6) + 'T12:00:00Z');
  return m.getUTCMonth() === s.getUTCMonth()
    ? `${m.getUTCDate()}-${s.getUTCDate()} ${MONTHS[m.getUTCMonth()]}`
    : `${m.getUTCDate()} ${MONTHS[m.getUTCMonth()]} - ${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]}`;
};
const routeCalendar = Array.from({ length: 14 }, (_, i) => ({
  weekNumber: i + 1, mondayDate: addDays('2026-09-14', i * 7), activeBlocks: [1, 2, 3],
}));
const DAYS = ['Lunedì', 'Mercoledì', 'Venerdì'];

// ── Lezioni svolte (settimane 1-3) e settimana corrente (4) ──────────────────
const M0 = 'MODULO 0: Orientamento', M1 = 'MODULO 1: Fondamenti del Design';
const WEEKS = [
  { n: 1, theme: 'Benvenuti in laboratorio', blocks: [
    { module: M0, tipologia: 'discussione', metodologia: 'tradizionale', subject: 'Il laboratorio e le sue regole', title: 'Questa stanza è un attrezzo', objective: 'Conoscere spazi, strumenti e regole del laboratorio e condividere il patto formativo.',
      notes: 'Classe curiosa, buon clima. S02 e S07 hanno fatto molte domande sul programma. S17 silenziosa ma attenta. Patto formativo letto e discusso.',
      signals: [['S02','Interviene spesso e trascina i compagni','positivo'],['S07','Domande pertinenti sul percorso','positivo'],['S17','Poco coinvolta nella discussione','attenzione']], engagement: 'alto',
      classNotes: ['Clima positivo e collaborativo', 'Interesse per le attività pratiche'] },
    { module: M0, tipologia: 'laboratorio', metodologia: 'cooperative_learning', subject: 'Osservare un oggetto comune', title: 'Che cosa ci dice una sedia?', objective: 'Osservare e descrivere un oggetto quotidiano con un lessico tecnico di base.', groups: true,
      notes: 'Lavoro a gruppi sull\'osservazione di una sedia. Il gruppo di S15 ha prodotto il disegno più accurato. S09 ha lavorato bene in coppia con S02. Alcuni gruppi lenti nella consegna.',
      signals: [['S15','Disegno di osservazione molto accurato','positivo'],['S09','Buon lavoro in coppia','positivo']], engagement: 'medio',
      classNotes: ['Tempi di consegna da gestire meglio'] },
    { module: M0, tipologia: 'frontale_teorica', metodologia: 'tradizionale', subject: 'Che cos\'è il design', title: 'Tutto è progettato', objective: 'Riconoscere il design come processo e non solo come forma.',
      notes: 'Lezione frontale breve con immagini. Attenzione calata nella seconda ora. S12 ha chiesto di ripetere alcuni passaggi: verificare la posizione in aula.',
      signals: [['S12','Fatica a seguire la seconda parte','attenzione']], engagement: 'basso',
      classNotes: ['Ridurre la durata della parte frontale', 'Inserire una pausa attiva'] },
  ]},
  { n: 2, theme: 'Il colore racconta', blocks: [
    { module: M1, tipologia: 'frontale_operativa', metodologia: 'inquiry_based', subject: 'Cerchio cromatico e contrasti', title: 'Perché il rosso grida?', objective: 'Conoscere il cerchio cromatico e i principali contrasti di colore.',
      notes: 'Esercizio sul cerchio cromatico. S04 ha lavorato con la mappa fornita e ha completato tutto. S19 veloce nella parte pratica. S21 assente.',
      signals: [['S04','Ha completato l\'esercizio con la mappa','positivo'],['S19','Rapido e preciso nella parte pratica','positivo']], engagement: 'alto',
      classNotes: ['La mappa del cerchio cromatico è servita a molti'] },
    { module: M1, tipologia: 'laboratorio', metodologia: 'project_based', subject: 'Moodboard di colore', title: 'Una palette per un luogo', objective: 'Costruire una moodboard cromatica a partire da un luogo reale.', groups: true,
      notes: 'Moodboard a gruppi. Il gruppo 3 ha discusso molto senza produrre. S17 ha preso l\'iniziativa nel gruppo 4. S11 brillante nella scelta delle palette.',
      signals: [['S17','Iniziativa nel lavoro di gruppo','positivo'],['S11','Ottime scelte cromatiche','positivo']], engagement: 'medio',
      classNotes: ['Dare ruoli espliciti nei gruppi'] },
    { module: M1, tipologia: 'verifica', metodologia: 'tradizionale', subject: 'Prova pratica sul colore', title: 'Prova: tre contrasti', objective: 'Applicare tre contrasti di colore in una composizione.', evaluations: true,
      notes: 'Prova pratica. Applicate le misure previste: tempi aggiuntivi per S04, prova differenziata per S15, verifica orale per S19. Risultati complessivamente buoni.',
      signals: [['S15','Prova differenziata completata con autonomia','positivo']], engagement: 'alto',
      classNotes: ['Buoni risultati medi', 'Ripassare il contrasto di quantità'] },
  ]},
  { n: 3, theme: 'Le lettere hanno un carattere', blocks: [
    { module: M1, tipologia: 'frontale_teorica', metodologia: 'flipped_classroom', subject: 'Famiglie di caratteri', title: 'Graziato o bastoni?', objective: 'Distinguere le principali famiglie di caratteri e il loro uso.',
      notes: 'Flipped: video visto a casa da circa metà classe. Discussione vivace. S07 ha portato esempi di insegne del quartiere. S12 al primo banco, segue meglio.',
      signals: [['S07','Ha portato esempi reali di insegne','positivo'],['S12','Segue meglio dal primo banco','positivo']], engagement: 'medio',
      classNotes: ['Solo metà classe ha visto il video: prevedere un recupero in aula'] },
    { module: M1, tipologia: 'laboratorio', metodologia: 'design_thinking', subject: 'Un manifesto tipografico', title: 'Una parola, cento voci', objective: 'Progettare un manifesto tipografico usando contrasti di carattere e corpo.', groups: true,
      notes: 'Laboratorio sul manifesto. S15 molto motivata con i materiali di ritaglio. S09 si è bloccato sulla consegna lunga: spezzarla in passi ha funzionato. S20 in ritardo.',
      signals: [['S15','Molto motivata con i materiali concreti','positivo'],['S09','Si blocca sulle consegne lunghe','attenzione']], engagement: 'alto',
      classNotes: ['Le consegne in passi aiutano tutta la classe'] },
    { module: M1, tipologia: 'discussione', metodologia: 'debate', subject: 'Revisione dei manifesti', title: 'Critica costruttiva', objective: 'Dare e ricevere un feedback motivato sul lavoro dei compagni.',
      notes: 'Revisione a coppie dei manifesti. Feedback più maturi del previsto. S17 ha difeso bene il proprio lavoro. Qualcuno ancora generico nei commenti.',
      signals: [['S17','Argomenta con sicurezza il proprio lavoro','positivo']], engagement: 'medio',
      classNotes: ['Fornire una griglia di feedback'] },
  ]},
];

const conversations = [];
const weekStub = students.map(({ id, name, hasBES, hasDSA, hasPEI }) => ({ id, name, ...(hasBES ? { hasBES } : {}), ...(hasDSA ? { hasDSA } : {}), ...(hasPEI ? { hasPEI } : {}) }));

for (const w of WEEKS) {
  const monday = routeCalendar[w.n - 1].mondayDate;
  const blocks = w.blocks.map((b, i) => {
    const dateIso = addDays(monday, i * 2) + 'T10:00:00.000Z';
    // presenze: 0-2 assenti, 0-1 ritardi (deterministici)
    const absent = new Set();
    const nAbs = Math.floor(rnd() * 3);
    while (absent.size < nAbs) absent.add(pick(CODES));
    if (w.n === 2 && i === 0) absent.add('S21');
    const present = CODES.filter(c => !absent.has(c));
    const late = rnd() < 0.5 ? [pick(present)] : [];
    if (w.n === 3 && i === 1 && present.includes('S20')) late.push('S20');
    const block = {
      id: `demo-w${w.n}-b${i + 1}`,
      day: DAYS[i],
      status: 'normale',
      module: b.module,
      objective: b.objective,
      lessonSubject: b.subject,
      blockTitle: b.title,
      tipologia: b.tipologia,
      metodologia: b.metodologia,
      messages: [],
      lessonState: 'archiviata',
      isReviewed: true,
      presentStudentIds: present.map(id),
      lateStudentIds: [...new Set(late)].map(id),
      lessonNotes: b.notes,
      lessonNoteAnalysis: {
        engagementLevel: b.engagement,
        studentSignals: b.signals.map(([c, signal, type]) => ({ studentId: id(c), signal, type })),
        groupNotes: [],
        classNotes: b.classNotes,
        rawNotes: b.notes,
        analyzedAt: dateIso,
      },
    };
    if (b.groups) {
      const shuffled = [...present].sort(() => rnd() - 0.5);
      const groups = [];
      for (let g = 0; g * 4 < shuffled.length; g++) {
        groups.push({ name: `Gruppo ${g + 1}`, studentIds: shuffled.slice(g * 4, g * 4 + 4).map(id), justification: 'Gruppi eterogenei.', isComplete: true, completionDate: dateIso });
      }
      block.lessonGroups = groups;
      block.allocations = { type: 'group', data: { groups } };
    }
    if (b.evaluations) {
      const VALUES = ['6', '6.5', '7', '7', '7.5', '8', '8', '8.5', '9'];
      block.lessonEvaluations = present.map(c => ({
        id: `demo-ev-w${w.n}-${c}`, studentId: id(c), value: pick(VALUES), type: 'pratico',
        notes: c === 'S15' ? 'Prova differenziata' : c === 'S19' ? 'Integrata con verifica orale' : c === 'S04' ? 'Con tempi aggiuntivi' : '',
        date: dateIso,
      }));
    }
    // Diario di bordo (come recordAttendanceForBlock in useStudents.ts)
    for (const s of students) {
      s.evaluations.push({ date: dateIso, value: absent.has(s.name) ? 'Assente' : 'Presente', notes: `Blocco ${DAYS[i]}: ${b.objective}`, weekNumber: w.n, blockIndex: i, module: b.module });
    }
    return block;
  });
  conversations.push({
    id: `demo-conv-week-${w.n}`, title: `Settimana ${w.n}`, messages: [],
    weekPlan: { weekNumber: w.n, dates: fmtWeek(monday), totalBlocks: 3, theme: w.theme, status: 'completata', completionStatus: 'completed', students: weekStub, activeBlockIndex: 0, blocks },
  });
}

// Settimana 4 (corrente): progettazione avviata
conversations.push({
  id: 'demo-conv-week-4', title: 'Settimana 4', messages: [],
  weekPlan: {
    weekNumber: 4, dates: fmtWeek(routeCalendar[3].mondayDate), totalBlocks: 3, theme: 'Comporre lo spazio della pagina', status: 'in progettazione', students: weekStub, activeBlockIndex: 0,
    blocks: [
      { id: 'demo-w4-b1', day: 'Lunedì', status: 'normale', module: M1, tipologia: 'frontale_operativa', metodologia: 'inquiry_based', lessonSubject: 'Griglie e allineamenti', objective: 'Riconoscere e usare una griglia per organizzare una composizione.', blockTitle: 'La gabbia invisibile', lessonState: 'progettata', messages: [] },
      { id: 'demo-w4-b2', day: 'Mercoledì', status: 'normale', module: M1, tipologia: 'laboratorio', metodologia: 'cooperative_learning', lessonSubject: 'Impaginare un manifesto', objective: 'Applicare una griglia a un manifesto, a gruppi.', lessonState: 'progettata', messages: [] },
      { id: 'demo-w4-b3', day: 'Venerdì', status: 'da definire', messages: [] },
    ],
  },
});

const settings = [
  ['ada-constitution', progettazione],
  ['ada-crew-context', crewContext],
  ['ada-rules-context', rules],
  ['ada-teacher-profile', teacherProfile],
  ['ada-disciplina', 'Laboratorio di Design · 3B (demo)'],
  ['ada-route-context', routeCalendar.map(w => `Settimana ${w.weekNumber}: ${fmtWeek(w.mondayDate)} (3 blocchi)`).join('\n')],
  ['ada-route-calendar', JSON.stringify(routeCalendar)],
  ['ada-gemini-block-day-defaults', JSON.stringify({ 0: 'Lunedì', 1: 'Mercoledì', 2: 'Venerdì' })],
  ['ada-block-hour-defaults', JSON.stringify({ 0: 2, 1: 2, 2: 2 })],
  ['ada-course-materia', 'Laboratorio di Design'],
  ['ada-course-scuola', 'Liceo artistico (scuola fittizia)'],
  ['ada-course-anno', '2026/27'],
  ['ada-course-docente', 'Docente Demo'],
  ['ada-mode', 'balanced'],
].map(([key, value]) => ({ key, value }));

const backup = {
  version: 3,
  demo: true,
  description: 'Classe di esempio 3B — interamente fittizia. Studenti identificati solo da codici S01-S22.',
  timestamp: '2026-10-05T00:00:00.000Z',
  data: { conversations, labels: [], students, notebooks: [], toolkit_shortcuts: [], toolkit_categories: [], activities: [], settings },
};

mkdirSync(new URL('../public/demo/', import.meta.url), { recursive: true });
writeFileSync(new URL('../public/demo/classe-esempio.json', import.meta.url), JSON.stringify(backup, null, 1));
console.log(`OK: ${students.length} studenti, ${conversations.length} settimane → public/demo/classe-esempio.json`);
