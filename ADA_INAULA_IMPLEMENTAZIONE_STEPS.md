# ADA — Piano di Implementazione IN AULA e MONITORAGGIO

> Piano step-by-step per Claude Code.
> Leggi prima `CLAUDE.md` e `ADA_INAULA_ARCHITETTURA.md`.
> Ogni step è indipendente e deployabile. Sequenza consigliata dall'alto verso il basso.
> Aggiornato: 2026-05-27

---

## STEP 1 — Modello Dati: nuovi tipi in types.ts

**Obiettivo**: aggiungere i tipi necessari senza rompere nulla di esistente.

**File**: `types.ts`

**Aggiunte:**

```typescript
// Materiale preparato per una lezione
export interface LessonMaterial {
  id: string;
  title: string;
  url: string;                  // link a Drive, Canva, Gamma, YouTube, ecc.
  type: 'slide' | 'video' | 'pdf' | 'paper' | 'ricerca' | 'stampa' | 'altro';
  notes?: string;
  targetAudience: 'classe' | 'gruppo' | 'studente';
  targetId?: string;            // groupId o studentId se non 'classe'
  addedAt: string;              // ISO timestamp
}

// Valutazione inserita manualmente in aula
export interface LessonEvaluation {
  id: string;
  studentId: string;
  value: string;                // numerico o descrittivo, sempre stringa
  type: 'orale' | 'scritto' | 'pratico' | 'formativo' | 'altro';
  notes?: string;
  date: string;                 // ISO
}

// Analisi strutturata estratta da Ada dalle note libere
export interface LessonNoteAnalysis {
  engagementLevel: 'basso' | 'medio' | 'alto';
  studentSignals: Array<{
    studentId: string;
    signal: string;
    type: 'positivo' | 'attenzione';
  }>;
  groupNotes: Array<{ groupId?: string; note: string }>;
  classNotes: string[];
  rawNotes: string;             // testo originale del docente (già in block.lessonNotes, ridondante ma utile per storico analisi)
  analyzedAt: string;
}
```

**Aggiunto a BlockDetails** (campi opzionali, retrocompatibile):
```typescript
lessonMaterials?: LessonMaterial[];
lessonEvaluations?: LessonEvaluation[];
lessonNoteAnalysis?: LessonNoteAnalysis;
lessonGroups?: StudentGroup[];  // composizione gruppi specifica per questa lezione
```

**Nota**: `lessonNotes` (stringa testo libero) probabilmente esiste già come `teacherNotes` o simile — verificare prima di aggiungere un duplicato.

**Test**: nessun test da scrivere, solo verifica TypeScript build.

---

## STEP 2 — Riorganizzazione Sidebar: Laboratori e Strumenti → IN AULA

**Obiettivo**: spostare il sotto-menu "Laboratori e Strumenti" dalla sezione CONTENUTI a IN AULA. Nessuna modifica funzionale, solo riposizionamento visivo.

**File**: `components/Sidebar.tsx`

**Cosa fare:**
1. Trovare il `CollapsibleSection` "Laboratori e Strumenti" dentro la sezione CONTENUTI DEL CORSO
2. Tagliarlo
3. Incollarlo dentro la sezione IN AULA, dopo i NavItem esistenti
4. Verificare che le prop (stato aperto/chiuso, toggle) siano corrette nel nuovo contesto

**Nessuna modifica a:**
- `ToolkitView.tsx`
- `NotebookLMView.tsx`
- Costanti o tipi

**Nota visiva**: nel nuovo posizionamento, "Laboratori e Strumenti" viene subito dopo il NavItem "Lezione" (la view unificata che verrà in Step 3).

---

## STEP 3 — InAulaView: unificazione in tre tab

**Obiettivo**: unificare `lezione_in_corso` e `archivio_lezioni` in un'unica view `InAulaView` con tre tab: **Preparazione | In Corso | Archivio**.

**File principali:**
- `components/InAulaView.tsx` — refactor principale
- `components/MainApp.tsx` — aggiornare i view ID e la navigazione

**Struttura tab:**

```tsx
type InAulaTab = 'preparazione' | 'in_corso' | 'archivio';
```

**Logica tab di default:**
```typescript
const defaultTab = (block: BlockDetails | null): InAulaTab => {
  if (!block) return 'archivio';
  if (block.lessonState === 'in_corso') return 'in_corso';
  if (block.lessonState === 'archiviata') return 'archivio';
  return 'preparazione'; // 'progettata' o undefined
};
```

**View ID in MainApp:**
- Sostituire `'lezione_in_corso'` e `'archivio_lezioni'` con `'lezione'`
- Passare `initialTab?: InAulaTab` come prop per navigazione diretta
- Aggiornare tutti i `setView('lezione_in_corso')` e `setView('archivio_lezioni')` in MainApp + handler files

**Tab Archivio** (sposta la logica esistente di archivio_lezioni qui):
- Lista blocchi archiviati
- Card riassuntiva: data · tipologia · tema · presenze summary
- Pulsante "Riapri lezione" con modal di conferma
- Pulsante "Vai al blocco" → `setView('planning')`

**Non implementare ancora** il contenuto dei tab Preparazione e In Corso (Step 4 e 5) — solo lo scaffolding del tab container.

---

## STEP 4 — Tab Preparazione: materiali e formato

**Obiettivo**: implementare il tab Preparazione in InAulaView.

**File**: `components/InAulaView.tsx` (o estrarre `LessonPreparationTab.tsx`)

**Sezioni UI:**

### Sezione "Formato e Materiali"
```
┌─────────────────────────────────────────────┐
│ Master Content (read-only preview)           │  ← collassabile, da block.contentBlocks
│                                             │
│ [+ Aggiungi materiale]                      │
│                                             │
│ card: [icona tipo] Titolo          [🔗][🗑]  │
│       target: Classe               URL ↗    │
│       note: ...                             │
└─────────────────────────────────────────────┘
```

**Modal "Aggiungi materiale":**
- Campo: Titolo (required)
- Campo: URL (required, type="url")
- Select: Tipo (slide/video/pdf/paper/ricerca/stampa/altro)
- Select: Target (Classe / Gruppo specifico / Studente specifico)
- Campo: Note (opzionale)

**Ada consiglia tool** (sezione collassabile):
- Textarea: "Cosa vuoi fare con questo materiale?"
- Pulsante "Chiedi ad Ada" → `generateResponse` con prompt + master content snippet
- Risposta Ada: testo breve + eventuali link al Toolkit

**Handler da aggiungere in `handlers/blockNoteHandlers.ts`** (o nuovo `handlers/lessonMaterialHandlers.ts`):
- `handleAddLessonMaterial(blockId, weekNumber, material: Omit<LessonMaterial, 'id' | 'addedAt'>)`
- `handleRemoveLessonMaterial(blockId, weekNumber, materialId)`
- `handleUpdateLessonMaterial(blockId, weekNumber, materialId, updates)`

---

## STEP 5 — Tab In Corso: presenze, note, valutazioni

**Obiettivo**: completare il tab In Corso con tutte le funzionalità di gestione lezione attiva.

**File**: `components/InAulaView.tsx` (o `LessonInCorsoTab.tsx`)

### Sezione Presenze
- Grid studenti: avatar/iniziali + nome + toggle P/A/R (presente/assente/ritardo)
- Salvataggio immediato (no debounce) su click toggle
- Handler: `handleRecordAttendanceForBlock` (già esiste, verificare firma)
- Contatore rapido: "19/22 presenti"

### Sezione Materiali attivi (dal Tab Preparazione)
- Lista card compatta dei `lessonMaterials` con link diretto
- Possibilità di aggiungere link al volo (form inline semplificato)

### Sezione Valutazioni
- Per ogni studente: pulsante [+ Voto] → apre form inline
- Form: valore (input testo) · tipo (select) · note (opzionale)
- Lista valutazioni già inserite per questo blocco
- Handler da aggiungere: `handleAddLessonEvaluation`, `handleRemoveLessonEvaluation`

### Sezione Note libere
- Textarea `className="font-serif"` (Lora, coerente con DocumentEditor)
- Autosave 1.5s debounce (stesso pattern DocumentEditor)
- Pulsante "Analizza con Ada" → chiama Gemini con le note
  - Ada estrae: engagement, segnali studenti, note generali
  - Risultato salvato in `block.lessonNoteAnalysis`
  - Risultato mostrato in un pannello collassabile sotto la textarea
- Analisi automatica opzionale alla chiusura della lezione (modal: "Vuoi che Ada analizzi le note prima di archiviare?")

### Pulsante "Chiudi Lezione"
- Conferma (modal): "Vuoi archiviare questa lezione?"
- Opzione checkbox: "Analizza le note con Ada prima di archiviare"
- `handleChiudiLezione` (già esiste) + eventuale `handleGenerateAnalysis` prima

---

## STEP 6 — Gestione Gruppi: selettore criteri e Ada

**Obiettivo**: potenziare la funzione gruppi con selettore criteri di bilanciamento e suggerimento Ada.

**File**: `components/GroupsArchiveView.tsx` (o nuovo `components/GroupManagerModal.tsx`)

**Selettore criteri** (multi-select, chip/badge cliccabili):
```
[Livello competenza ✓]  [Stile apprendimento]  [Dinamiche relazionali]  [Mix casuale]
```

**Flusso:**
1. Docente imposta N persone per gruppo + seleziona criteri
2. Pulsante "Suggerisci con Ada"
3. Ada riceve: lista studenti con attributi (livello, stile, eventuali note), N, criteri
4. Ada risponde con composizione JSON dei gruppi
5. UI renderizza i gruppi proposti come card modificabili (drag & drop studenti tra gruppi)
6. Pulsante "Salva composizione" → `handleUpdateGroupsForBlock` (già esiste)

**Dati studente usati da Ada per il bilanciamento:**
- `student.level` o campo equivalente
- `student.learningStyle` (se esiste)
- `student.notes` / `student.characteristics` (già esiste come campo libero)
- Storico gruppi precedenti (per evitare sempre le stesse coppie)

**Nuovi handler** (in `handlers/lessonHandlers.ts`):
- `handleGenerateGroupSuggestion(weekNumber, blockIndex, criteria, groupSize)`

---

## STEP 7 — Monitoraggio: Andamento Aula con Gantt e Radar consuntivi

**Obiettivo**: trasformare `ClassroomTrendView` in un vero cruscotto con Gantt e Radar consuntivi sovrapposti al progetto.

**File**: `components/ClassroomTrendView.tsx`

**Layout a due colonne** (analogo a GanttView):
- Colonna sinistra (flex-1): Gantt consuntivo + Heatmap presenze + Trend engagement
- Colonna destra (w-72): Radar consuntivo vs progetto

### Gantt consuntivo
- Stessa logica di `GanttView.tsx` ma colora i blocchi in base a **cosa è stato effettivamente fatto** (tipologia usata, non pianificata)
- Overlay semitrasparente con la pianificazione originale
- Legenda: pianificato / effettivo / non tenuto

### Radar consuntivo
- Usa `DidacticRadarChart` già esistente
- `data` = tipologie dalle lezioni archiviate (consuntivo)
- `idealData` = tipologie pianificate (progetto)
- Badge TVD confronta progetto vs consuntivo

### Heatmap presenze
- Griglia: studenti (righe) × blocchi/settimane (colonne)
- Colore: verde pieno = presente, rosso = assente, giallo = ritardo
- Aggregato: % presenza per studente (ultima colonna) e per lezione (ultima riga)

### Indice engagement
- Grafico a linee nel tempo
- Valori: derivati da `block.lessonNoteAnalysis.engagementLevel` (basso=1, medio=2, alto=3)
- Media mobile su 3 lezioni

### Alert
- Lista automatica di segnali: studenti con >2 assenze consecutive, calo engagement, segnali Ada ripetuti

---

## STEP 8 — Monitoraggio: Studenti individuali e Gruppi

**Obiettivo**: completare il monitoraggio con viste per studente e per gruppo.

### Studente individuale (StudentProfileView potenziato)
**File**: `components/StudentProfileView.tsx`

Aggiungere sezioni:
- **Presenze**: barra percentuale + lista date assenze
- **Valutazioni**: timeline cronologica con tipo e valore
- **Segnali Ada**: lista di `studentSignals` dalle analisi note, con data lezione di provenienza
- **Trend**: mini grafico engagement nel tempo (da note Ada)

### Monitoraggio Gruppi
**File**: nuovo `components/GroupsTrendView.tsx` o integrare in `GroupsArchiveView.tsx`

- Storico composizioni: lista gruppi usati per lezione
- Per ogni composizione: lista studenti + eventuali note docente sul funzionamento
- Pattern: Ada identifica studenti che lavorano bene insieme e combinazioni problematiche

---

## Note trasversali per tutti gli step

### Handlers
- Tutti i nuovi handler seguono il pattern factory in `components/handlers/`
- Nessun hook React nei file handler
- Passare sempre `setViewFn` (non `setView` diretto) se serve navigazione

### DB
- Tutti i nuovi campi di `BlockDetails` sono opzionali → nessuna migrazione necessaria
- IndexedDB serializza/deserializza automaticamente tramite `idb`

### Gemini calls
- Le nuove chiamate AI (analisi note, suggerimento gruppi, consiglia tool) usano `generateResponse` da `services/gemini.ts`
- Costruire prompt contestuali con i dati del blocco + profilo docente + lista studenti
- Gestire `isLoading` tramite `setIsLoading` (già disponibile in MainApp)

### Design
- Seguire rigorosamente il design system in `CLAUDE.md`
- Nessun rosso per stati informativi
- Card materiali: stile analogo alle card Toolkit esistenti
- Presenze: toggle compatti, non form complessi
- Non usare `rounded-full` sui pulsanti AI
