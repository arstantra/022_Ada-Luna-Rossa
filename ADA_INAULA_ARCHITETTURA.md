# ADA — Architettura IN AULA e MONITORAGGIO

> Documento di riferimento per sviluppo e manutenzione.
> Leggi insieme a `CLAUDE.md`.
> Aggiornato: 2026-05-27 (implementazione completata)

---

## Flusso completo del docente

```
GESTIONE DEL CORSO → PROGETTAZIONE → PREPARAZIONE → IN CORSO → ARCHIVIO → MONITORAGGIO
```

| Fase | Cosa si fa | Dove vive |
|------|-----------|-----------|
| Gestione del Corso | Profilo docente, La Rotta, studenti, Personalità Ada | FoundingDocumentsView, RouteView, AdaPersonalityView |
| Progettazione | COSA (struttura contenuto) + COME (tipologia pedagogica), master content | StrategicDashboardView, PlanningView / BlockWorkspaceView |
| Preparazione | COME nel dettaglio: formato materiali, composizione gruppi | Tab Preparazione in InAulaView (`LessonPreparationTab`) |
| In Corso | Presenze, materiali attivi, valutazioni, note libere + analisi Ada | Tab In Corso in InAulaView (`LessonInCorsoTab`) |
| Archivio | Storico lezioni archiviate, consultazione, riapertura | Tab Archivio in InAulaView |
| Monitoraggio | Dashboard consuntiva: trend aula, gruppi, studenti | ClassroomTrendView, GroupsArchiveView, StudentProfileView |

---

## Sezione IN AULA — Struttura View

### View ID

| View | ID | Note |
|------|----|------|
| InAulaView (unificata) | `'lezione'` | Unico view ID per Preparazione + In Corso + Archivio |

`InAulaView` riceve `initialTab?: 'preparazione' | 'in_corso' | 'archivio'` e seleziona il tab di default in base a `lessonState`:
- blocco con `lessonState === 'progettata'` → tab **Preparazione**
- blocco con `lessonState === 'in_corso'` → tab **In Corso**
- blocco con `lessonState === 'archiviata'` o nessun blocco attivo → tab **Archivio**

### File componente

```
components/
  InAulaView.tsx          — orchestratore: header blocco attivo, selettore blocco, router tab
  LessonPreparationTab.tsx — Tab 1 (Preparazione)
  LessonInCorsoTab.tsx    — Tab 2 (In Corso)
  (archivio inline)       — Tab 3 è inline in InAulaView (lista blocchi archiviati)
```

### Props di InAulaView

```typescript
interface InAulaViewProps {
  conversations: Conversation[];
  students: Student[];
  onAvviaLezione: (convoId: string, blockIndex: number) => void;
  onChiudiLezione: (convoId: string, blockIndex: number) => void;
  onAddMaterial: (convoId: string, blockIndex: number, material: Omit<LessonMaterial, 'id' | 'addedAt'>) => void;
  onRemoveMaterial: (convoId: string, blockIndex: number, materialId: string) => void;
  onSetAttendance: (convoId: string, blockIndex: number, presentIds: string[], lateIds: string[]) => void;
  onAddEvaluation: (convoId: string, blockIndex: number, evaluation: Omit<LessonEvaluation, 'id' | 'date'>) => void;
  onRemoveEvaluation: (convoId: string, blockIndex: number, evaluationId: string) => void;
  onAutoSaveNotes: (convoId: string, blockIndex: number, notes: string) => void;
  onGenerateLessonNoteAnalysis: (convoId: string, blockIndex: number) => Promise<void>;
  analysisLoadingBlockId: string | null;
  showToast: (msg: string, type?: string) => void;
  initialTab?: 'preparazione' | 'in_corso' | 'archivio';
}
```

---

## Tab 1: Preparazione (`LessonPreparationTab`)

**Scopo**: sviluppare il COME nel dettaglio, partendo dal master content.

### Sezioni interne

#### 1a — Repository materiali lezione
- Lista di `LessonMaterial` salvati su `block.lessonMaterials`
- Ogni materiale: titolo + URL (Drive, Canva, ecc.) + tipo + note opzionali + targetAudience
- `targetAudience: 'classe' | 'gruppo' | 'studente'` con `targetId?` per differenziazione
- **No contenuto nativo nel DB** — solo link + metadati. Drive è il repository principale.
- Click sul link: apre URL in nuova scheda
- Aggiunta rapida: mini form inline (titolo, URL, tipo, note)

#### 1b — Composizione gruppi
- Imposta N persone per gruppo → salva come `block.lessonGroups`
- Ada suggerisce composizione bilanciata con selettore criteri (vedi GroupsArchiveView)
- Modifica manuale post-suggerimento (drag o selezione da lista studenti)

#### Props di LessonPreparationTab

```typescript
interface LessonPreparationTabProps {
  conversations: Conversation[];
  students: Student[];
  onAddMaterial: (convoId: string, blockIndex: number, material: Omit<LessonMaterial, 'id' | 'addedAt'>) => void;
  onRemoveMaterial: (convoId: string, blockIndex: number, materialId: string) => void;
  onAvviaLezione: (convoId: string, blockIndex: number) => void;
  showToast: (msg: string, type?: string) => void;
}
```

---

## Tab 2: In Corso (`LessonInCorsoTab`)

**Scopo**: conduzione della lezione — presenze, materiali attivi, valutazioni, note.

### Sezioni interne

#### 2a — Registro presenze
- Lista studenti con tre stati: **Presente (P)**, **In Ritardo (R)**, **Assente (A)**
- Logica P/A/R con due array paralleli:
  - `presentStudentIds`: tutti presenti (include i ritardatari)
  - `lateStudentIds`: subset dei presenti che sono in ritardo
  - R = in entrambi gli array; P = solo in `presentStudentIds`; A = in nessuno
- Toggle ciclico per ogni studente; salvataggio immediato via `onSetAttendance`

#### 2b — Materiali attivi
- Mostra i materiali da `block.lessonMaterials` come card cliccabili
- Click apre l'URL nel browser
- Aggiunta rapida di link al volo (senza passare per la Preparazione)

#### 2c — Valutazioni
- Inserimento per studente: valore (testo libero o numero), tipo, note
- Non replica un registro elettronico — cattura voti orali, osservazioni formative, ecc.
- Struttura: `LessonEvaluation` con `studentId`, `value`, `type`, `notes`, `date`

#### 2d — Note libere + analisi Ada
- Textarea full-width con autosave debounced (1.5s, stesso pattern di DocumentEditor)
  - Autosave silenzioso via `onAutoSaveNotes` (nessun toast)
- Pulsante "Analizza con Ada": chiama `onGenerateLessonNoteAnalysis`
  - Produce `LessonNoteAnalysis` con `engagementLevel`, `studentSignals`, `groupNotes`, `classNotes`
  - Il risultato viene mostrato inline sotto il campo note
- Pulsante "Chiudi Lezione": invoca `onChiudiLezione`, imposta `lessonState = 'archiviata'`

#### Props di LessonInCorsoTab

```typescript
interface LessonInCorsoTabProps {
  conversations: Conversation[];
  students: Student[];
  onSetAttendance: (convoId: string, blockIndex: number, presentIds: string[], lateIds: string[]) => void;
  onAddEvaluation: (convoId: string, blockIndex: number, evaluation: Omit<LessonEvaluation, 'id' | 'date'>) => void;
  onRemoveEvaluation: (convoId: string, blockIndex: number, evaluationId: string) => void;
  onAutoSaveNotes: (convoId: string, blockIndex: number, notes: string) => void;
  onGenerateLessonNoteAnalysis: (convoId: string, blockIndex: number) => Promise<void>;
  analysisLoadingBlockId: string | null;
  onAddMaterial: (convoId: string, blockIndex: number, material: Omit<LessonMaterial, 'id' | 'addedAt'>) => void;
  onChiudiLezione: (convoId: string, blockIndex: number) => void;
  showToast: (msg: string, type?: string) => void;
}
```

---

## Tab 3: Archivio (inline in InAulaView)

- Lista di tutti i blocchi con `lessonState === 'archiviata'`, ordinati per data
- Card riassuntiva: data · tipologia · tema · presenze summary · note snippet
- Azione: "Riapri lezione" → torna a `in_corso` (con conferma)
- Azione: "Vai al blocco" → naviga in StrategicDashboard / PlanningView

---

## Modello Dati — aggiunte a BlockDetails (in `types.ts`)

```typescript
interface LessonMaterial {
  id: string;
  title: string;
  url: string;                  // Drive, Canva, Gamma, YouTube, ecc.
  type: 'slide' | 'video' | 'pdf' | 'paper' | 'ricerca' | 'stampa' | 'altro';
  notes?: string;
  targetAudience: 'classe' | 'gruppo' | 'studente';
  targetId?: string;            // groupId o studentId se targetAudience !== 'classe'
  addedAt: string;              // ISO timestamp
}

interface LessonEvaluation {
  id: string;
  studentId: string;
  value: string | number;       // es. "7" o "ottimo" — flessibile
  type: 'orale' | 'scritto' | 'pratico' | 'formativo' | 'altro';
  notes?: string;
  date: string;                 // ISO
}

interface LessonNoteAnalysis {
  engagementLevel: 'basso' | 'medio' | 'alto';
  studentSignals: Array<{ studentId: string; signal: string; type: 'positivo' | 'attenzione' }>;
  groupNotes: Array<{ groupId?: string; note: string }>;
  classNotes: string[];         // osservazioni generali
  rawNotes: string;             // testo originale del docente
  analyzedAt: string;
}

// Nuovi campi in BlockDetails
lessonMaterials?: LessonMaterial[];
lessonEvaluations?: LessonEvaluation[];
lessonNoteAnalysis?: LessonNoteAnalysis;
lessonGroups?: StudentGroup[];  // composizione gruppi per questa lezione specifica
presentStudentIds?: string[];   // tutti presenti (include ritardatari)
lateStudentIds?: string[];      // subset: solo i ritardatari
lessonNotes?: string;           // note libere del docente (raw)
```

---

## Handler — `blockNoteHandlers.ts`

Tutti gli handler IN AULA vivono in `components/handlers/blockNoteHandlers.ts`, esportati via `createBlockNoteHandlers(deps)`:

| Handler | Comportamento |
|---------|---------------|
| `handleSaveLessonNotes` | Salva note docente + mostra toast |
| `handleAutoSaveLessonNotes` | Salva note docente silenziosamente (no toast) |
| `handleDeleteLessonNotes` | Cancella le note del blocco |
| `handleGenerateAnalysis` | Genera `LessonNoteAnalysis` da note testuali (Gemini) |
| `handleGenerateLessonNoteAnalysis` | Wrapper async con stato loading per `analysisLoadingBlockId` |
| `handleAddLinkForBlock` | Aggiunge un link ai `lessonMaterials` del blocco |
| `handleDeleteLinkForBlock` | Rimuove un link dai `lessonMaterials` |
| `handleAddLessonMaterial` | Aggiunge un `LessonMaterial` completo |
| `handleRemoveLessonMaterial` | Rimuove un materiale per ID |
| `handleUpdateBlockCloudLink` | Aggiorna il `cloudLink` del blocco |
| `handleUpdateBlockLinkedNotebooks` | Aggiorna i notebook collegati |
| `handleUpdateLiveAttendance` | Salva `presentStudentIds` + `lateStudentIds` |
| `handleAddLessonEvaluation` | Aggiunge una `LessonEvaluation` al blocco |
| `handleRemoveLessonEvaluation` | Rimuove una valutazione per ID |

---

## Sezione MONITORAGGIO

### Filosofia
Il monitoraggio non è un registro voti. È un **cruscotto di temperatura** che mostra trend, segnali, equilibri. I dati arrivano da: presenze, valutazioni inserite, analisi note Ada. Tutto vive in IndexedDB; i dashboard calcolano i trend in `useMemo` al momento del render.

---

### Andamento Aula (`ClassroomTrendView`)

**Sezione "Monitoraggio Consuntivo"** (collapsibile, aperta di default):

#### Heatmap presenze
- Max 12 blocchi recenti archiviati (ordine cronologico)
- Griglia: studenti × blocchi, ogni cella `inline-flex w-5 h-5 rounded`
  - `bg-emerald-500/70` = Presente (P)
  - `bg-amber-400/70` = In Ritardo (R)
  - `bg-gray-700` = Assente (A)
- % presenza per studente (colonna destra) + % presenti per blocco (riga header)

#### Bar chart engagement
- Trend dalle `lessonNoteAnalysis.engagementLevel` degli ultimi blocchi archiviati
- Tre colori: `bg-emerald-500` (alto) · `bg-amber-400` (medio) · `bg-red-500/60` (basso)

#### Radar consuntivo
- Componente `DidacticRadarChart` nel pannello destro
- `data={consuntivoRadarData}` — calcolato dai blocchi **archiviati** (cosa è stato effettivamente fatto)
- `idealData={progettoRadarData}` — calcolato da **tutti** i blocchi pianificati (cosa si era pianificato)
- Mostra squilibrio progetto vs reale

#### Alert
- Assenze consecutive ≥ 2 per studente
- Segnali Ada `type === 'attenzione'` ripetuti ≥ 2 per studente
- Engagement basso nelle ultime 3 lezioni
- Stile: lista `bg-amber-900/20 border-amber-500/20`, testo `text-amber-300`

#### useMemo calcolati in ClassroomTrendView

```typescript
archivedBlocks     // flat list con presenze + tipologia + engagement + adaSignals
consuntivoRadarData // RadarDataPoint[] dai blocchi archiviati
progettoRadarData   // RadarDataPoint[] da tutti i blocchi pianificati
attendanceAlerts    // string[] con messaggi alert
```

---

### Gestione Gruppi (`GroupsArchiveView`)

**Pannello "Crea Nuovi Gruppi"** (collassabile):

- Selettore blocco: tutte le conversazioni, blocchi non archiviati e non saltati
- Dimensione gruppo (default 3)
- Criteri selezionabili (multi-select, default: Livello competenza):

| Criterio | Comportamento |
|----------|---------------|
| Livello competenza | Ada bilancia livelli (dal campo `notes` dello studente) |
| Stile apprendimento | Ada considera gli stili di apprendimento dichiarati |
| Dinamiche relazionali | Ada considera le note relazionali / BES / DSA |
| Mix casuale | Fisher-Yates locale — nessuna chiamata Gemini |

- **Shortcut "Mix casuale"**: se è l'unico criterio selezionato, la funzione `handleGenerateGroups` usa Fisher-Yates locale senza chiamare Gemini API
- **Tutti gli altri criteri**: chiama `generateGroupSuggestionWithCriteria(students, criteria, groupSize)` in `services/gemini.ts` che usa `groupSuggestionSchema` (function calling)
- Modifica manuale dei gruppi proposti (rimuovi studente, riassegna)
- "Salva Gruppi" → `handleUpdateGroupsForBlock` salva `lessonGroups` sul blocco

#### Funzione Gemini aggiunta

```typescript
// services/gemini.ts
export const generateGroupSuggestionWithCriteria = async (
    students: Student[],
    criteria: string[],
    groupSize: number
): Promise<GroupDefinition[]>
```

Usa `groupSuggestionSchema` (già esistente), prompt arricchito con descrizione criteri, `thinkingBudget: 0`.

---

### Profilo Studentessa (`StudentProfileView`)

**Nuova sezione** sotto il contenuto esistente (3 colonne su schermi larghi, impilate su stretti):

#### Colonna 1 — Presenze
- Stats: totale lezioni archiviate · presenti (P+R) · in ritardo · assenti
- Barra % (verde ≥ 80%, amber ≥ 60%, rosso < 60%)
- Lista date assenze

#### Colonna 2 — Valutazioni in Aula
- Lista cronologica di `LessonEvaluation` dove `studentId === student.id`
- Per ogni valutazione: settimana · valore · tipo (badge mono) · note

#### Colonna 3 — Segnali Ada
- Lista di `LessonNoteAnalysis.studentSignals` dove `studentId === student.id`
- Ordinate per `analyzedAt` discendente
- `type === 'positivo'` → `text-emerald-400`; `type === 'attenzione'` → `text-amber-400`

**Prop aggiunta:**
```typescript
conversations?: Conversation[]   // optional, default []
```

#### useMemo calcolati in StudentProfileView

```typescript
presenzaStats      // { total, present, late, absent, absenceDates, pct }
lessonEvaluations  // LessonEvaluation[] filtrate per studentId, ordinate per date asc
adaSignals         // studentSignals[] filtrate per studentId, ordinate per analyzedAt desc
```

---

## Regole di Design

- **Materiali**: card con icona tipo + titolo + link esterno + badge targetAudience. Stile coerente con Toolkit.
- **Presenze**: toggle semplice per studente, non un form complesso. Salvataggio immediato. P/A/R con due array separati (`presentStudentIds`, `lateStudentIds`).
- **Note libere**: textarea full-width con debounce autosave 1.5s (identico a DocumentEditor). Autosave silenzioso via `handleAutoSaveLessonNotes` (no toast). Analisi su richiesta via `handleGenerateLessonNoteAnalysis`.
- **Valutazioni**: input inline per studente, tipo selezionabile, campo notes opzionale. Non simulare un registro elettronico.
- **Gruppi**: visualizzati come card colorate con lista nomi. Il numero di gruppi si deriva da `Math.ceil(N studenti / persone per gruppo)`.
- **Heatmap**: celle `inline-flex` (non `inline-block`) per supportare `items-center justify-center`.
- **Radar consuntivo**: usa `consuntivoRadarData` come `data` e `progettoRadarData` come `idealData` — non invertire i due dataset.
- **Alert**: sempre amber (non rosso) — sono segnali da valutare, non errori. Rosso è riservato ad azioni distruttive.
