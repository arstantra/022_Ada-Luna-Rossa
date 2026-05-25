# Prompt — Audit Completo Codebase ADA

> Copia questo prompt integralmente in una nuova sessione Claude Code nella root del progetto (`022_Ada Luna Rossa/`). L'agente deve avere accesso a tutti i file del progetto.

---

## Contesto

Stai facendo un **audit tecnico approfondito** del progetto ADA, un'app React 19 + TypeScript per insegnanti. L'obiettivo è produrre codice pulito, consistente e privo di zavorra. Leggi prima `CLAUDE.md` per capire l'architettura e le regole del design system, poi procedi con i controlli elencati sotto.

**NON proporre modifiche: eseguile direttamente.** Alla fine produci un report riepilogativo di tutto ciò che hai trovato e fatto.

---

## Fase 1 — Mappatura utilizzi (read-only, nessuna modifica)

Prima di toccare qualsiasi cosa, costruisci la mappa completa degli import/export:

1. Per ogni file in `components/`, `hooks/`, `services/`, `contexts/`, elenca quante volte è importato dagli altri file del progetto. Usa `grep -r` ricorsivo.
2. Identifica i file con **zero import** dall'esterno (candidati all'eliminazione).
3. Identifica le **funzioni e i tipi esportati ma mai usati** dentro `types.ts`, `utils.ts`, `constants.ts`, `config.ts`, `logos.ts`.
4. In `Icons.tsx`: elenca ogni icona esportata e verifica quante volte ciascuna è usata nel resto del progetto. Annota quelle con zero utilizzi.

---

## Fase 2 — Pulizia file morti

### 2a. File da verificare per eliminazione
Controlla uno per uno questi file sospetti e **cancellali se non sono mai importati** da nessuna altra parte del progetto:

- `components/ModeSelector.tsx` — dovrebbe essere solo un re-export alias di `ModePills`. Se `ModePills` è usato direttamente ovunque, questo file è morto.
- `components/AppHeader.tsx` — verifica se è montato in `MainApp.tsx` o `App.tsx`.
- `components/AppFooter.tsx` — stessa verifica.
- `components/ConceptMap.tsx` — verifica se è montato da qualche view o modale.
- `components/ShortcutCard.tsx` — verifica se usato in `ToolkitView.tsx` o altrove.
- `components/AchievementChart.tsx` — verifica se montato in `StudentProfileView.tsx` o `ClassroomTrendView.tsx`.
- `components/RadarChart.tsx` — stessa verifica.
- `components/EnergySeismograph.tsx` — stessa verifica.
- `components/ParticipationThermometer.tsx` — stessa verifica.
- `components/GroupWorkSummary.tsx` — verifica se montato in `InAulaView.tsx` o `GroupsArchiveView.tsx`.
- `components/StudentSheetHeader.tsx` — verifica se montato in `StudentProfileView.tsx`.
- `components/EditorToolbar.tsx` — verifica se usato in `DocumentEditor.tsx`.
- `components/ImageGenerationModal.tsx` — verifica se aperto da qualche handler in `MainApp.tsx`.
- `components/ImportEvaluationModal.tsx` — stessa verifica.
- `components/ObjectiveSuggestionModal.tsx` — stessa verifica.
- `components/ManageNotesModal.tsx` — stessa verifica.
- `components/LessonNotesModal.tsx` — stessa verifica.
- `components/ManageNotebookLinksModal.tsx` — stessa verifica.
- `components/BlockDayDefaultsModal.tsx` — stessa verifica.
- `components/PasswordPromptModal.tsx` — stessa verifica.
- `contexts/ConstitutionCacheContext.tsx` — verifica se il context è consumato da qualche componente.
- `services/constitutionParser.ts` — **ATTENZIONE**: questo file è CRITICO e non va eliminato. È importato da `ConstitutionCacheContext.tsx` e usato ovunque si leggano le unità del Progetto Didattico. Verificane gli import come controllo di salute, ma non proporre l'eliminazione.
- `logos.ts` — verifica se importato da qualche file.
- `metadata.json` — verifica se letto da qualche file o solo documentazione.
- `desktop.ini` — file di sistema Windows, cancellalo senza verifica.

### 2b. Icone morte in `Icons.tsx`
Rimuovi le icone esportate da `Icons.tsx` che non sono mai usate nel progetto (zero occorrenze in grep). Mantieni solo quelle con almeno un utilizzo.

### 2c. Tipi morti in `types.ts`
Identifica interfacce, type alias o enum esportati ma mai referenziati altrove. Rimuovili o — se sembrano intenzionalmente reserved — aggiungici un commento `// reserved`.

**ATTENZIONE — tipi introdotti nel refactor 2026-05-24, NON eliminare:**
- `CourseContentType` — union type per il "cosa" (modulo/uda/educazione_civica/fsl)
- `CourseContentUnit` — interfaccia unità didattica parsata dal Progetto Didattico
- `ParsedConstitution.contentUnits: CourseContentUnit[]` — campo aggiunto a `ParsedConstitution`
- `BlockDetails.isFslPeriod?: boolean` — flag visivo ortogonale

Questi tipi sono intenzionali e usati da `constitutionParser.ts`, `ConstitutionCacheContext.tsx`, `StrategicDashboardView.tsx`, `MainApp.tsx`.

### 2d. Costanti e funzioni morte in `utils.ts`, `constants.ts`, `config.ts`
Rimuovi le esportazioni non referenziate. Se una funzione sembra intenzionalmente mantenuta per uso futuro, aggiungi un commento esplicito.

**ATTENZIONE — costante introdotta nel refactor 2026-05-24, NON eliminare:**
- `COURSE_CONTENT_TYPE_LABELS: Record<CourseContentType, string>` in `constants.ts` — usata in `StrategicDashboardView.tsx` per le label del selettore "Cosa".

---

## Fase 3 — Consistenza Design System

Controlla ogni file `.tsx` contro le regole in `CLAUDE.md`. Correggi direttamente ogni violazione trovata.

### 3a. Colori stato dot
Cerca e correggi:
- `bg-green-500` → deve essere `bg-emerald-500`
- `bg-gray-600` nei dot stato → deve essere `bg-gray-500`
- Qualsiasi altro colore non canonico nei dot (es. `bg-teal-`, `bg-lime-`, ecc.)

### 3b. Font
Cerca e correggi:
- `font-mono` usato su titoli o header di sezione → deve essere `font-display`
- `font-display` usato su label tecnici, date, codici, sezioni sidebar → deve essere `font-mono`
- `font-serif` usato fuori da `DocumentEditor` → segnala ma non modificare senza conferma

### 3c. Pulsanti
Cerca e correggi:
- Pulsanti AI con `rounded-full` → deve essere `rounded-lg`
- `NavItem` attivo con `font-semibold` → rimuovi il grassetto
- Pulsanti primari che usano colori non canonici (es. `bg-blue-500` senza `/80`, o varianti non presenti in `CLAUDE.md`)

### 3d. Sfondo app
Verifica che il root wrapper usi `bg-[#0D1117]` e non varianti come `bg-gray-950` o `bg-zinc-900`.

---

## Fase 4 — Integrità TypeScript

### 4a. `// @ts-ignore` e `// @ts-expect-error`
Elenca tutte le occorrenze. Per ognuna: spiega perché c'è, e se è possibile rimuoverla correggendo il tipo, fallo.

### 4b. `any` espliciti
Cerca `as any`, `: any`, `<any>`. Per ogni occorrenza valuta se può essere sostituita con un tipo preciso. Sostituisci dove possibile senza modificare la logica runtime.

### 4c. Tipi opzionali vs undefined
Verifica che i campi opzionali in `BlockDetails`, `WeekPlan`, `Conversation` siano trattati con optional chaining (`?.`) coerentemente nei componenti, senza accessi diretti non protetti che potrebbero causare runtime errors.

### 4d. Consistenza `BlockStatus`
Il tipo `BlockStatus` in `types.ts` deve contenere esattamente i valori usati in `getBlockProgressState` e `getBlockPlanningStatus`. Verifica che non ci siano valori usati nel codice ma non dichiarati nel tipo, o viceversa.

---

## Fase 5 — Integrità React

### 5a. Hooks prima dei return condizionali
Cerca pattern dove un `useEffect`, `useState`, `useMemo`, `useCallback` compare **dopo** un `return` condizionale nel body di un componente. Questo è un errore React (Rules of Hooks). Correggi spostando gli hook prima del primo return condizionale.

### 5b. Stale closure nei callback
Nei handler di `MainApp.tsx` che accedono a `conversations`, verifica che usino `conversationsRef.current` e non la variabile `conversations` direttamente (per evitare stale closure). Correggi le occorrenze non conformi.

### 5c. `updateConversation` vs `setConversations`
Cerca usi diretti di `setConversations` al di fuori di `useConversations.ts`. Se trovati, refactora per usare `updateConversation`.

### 5d. Cleanup degli effect
Verifica che i `useEffect` con `setTimeout` o `setInterval` abbiano il cleanup (`return () => clearTimeout(...)` / `clearInterval(...)`). Mancanza di cleanup causa memory leak. Aggiungi dove mancante.

### 5e. Key prop nelle liste
Cerca array `.map()` che rendono JSX senza `key` prop esplicita, o con `key={index}` (antipattern se la lista è riordinabile). Segnala nel report; correggi solo i casi evidentemente sbagliati (key stabile disponibile).

---

## Fase 6 — Integrità Dati / IndexedDB

### 6a. Schema DB in `services/db.ts`
Verifica che tutti i campi di `BlockDetails`, `WeekPlan`, `Conversation` presenti in `types.ts` siano gestiti correttamente nelle operazioni di lettura/scrittura del DB. Segnala campi aggiunti al tipo ma non salvati, o campi salvati ma rimossi dal tipo.

### 6b. `completionStatus` in `WeekPlan`
Deve essere presente nel tipo ma **non mostrato in UI** (retrocompatibilità DB). Verifica che non venga renderizzato in nessun componente.

### 6c. `ADA_QUICK_CHAT_ID`
Deve essere definito in `constants.ts` come `'ada-quick-chat'`. Cerca hardcoding della stringa `'ada-quick-chat'` nei file che non importano la costante, e sostituisci con l'import.

---

## Fase 7 — Pulizia codice morto interno ai file

Per ogni file `.tsx` e `.ts`, rimuovi:
- Variabili dichiarate ma mai lette
- Funzioni definite ma mai chiamate (locali al file, non esportate)
- Import inutilizzati
- Blocchi `console.log` / `console.warn` di debug (tieni solo `console.error` intenzionali)
- Commenti `// TODO` e `// FIXME` datati senza action owner — elencali nel report, poi cancellali

---

## Fase 8 — Verifica `index.html` e importmap

- Verifica che tutte le librerie nell'importmap siano effettivamente usate nel codice (`@google/genai`, `idb`, `@dnd-kit/*`, ecc.). Rimuovi voci non usate.
- Verifica che i font Google Fonts caricati (`Syne`, `DM Sans`, `DM Mono`, `Lora`) corrispondano esattamente alle classi Tailwind usate nel codice (`font-display`, `font-sans`, `font-mono`, `font-serif`).
- Verifica che la config Tailwind estesa in `index.html` mappi correttamente ogni `fontFamily` al font giusto.

---

## Output atteso

Alla fine dell'audit produci un file `AUDIT_REPORT.md` nella root del progetto con:

1. **File eliminati** — lista con motivazione
2. **Icone/tipi/costanti/funzioni rimosse** — lista per file
3. **Violazioni design system corrette** — lista per categoria (colori, font, pulsanti)
4. **Fix TypeScript** — lista delle correzioni
5. **Fix React** — lista delle correzioni
6. **Problemi segnalati senza correzione automatica** — richiedono decisione umana
7. **Stato finale** — stima qualitativa della salute del codebase (es. "6 file eliminati, 0 any rimasti, 3 problemi aperti")

Ogni voce del report deve citare il file e la riga (dove applicabile).

---

# Prompt — Split di MainApp.tsx in moduli handler

> Usa questo prompt in una sessione **Claude Code (CLI)** nella root del progetto (`022_Ada Luna Rossa/`).
> NON eseguire in Cowork: lo split richiede verifica del build TypeScript dopo ogni step.
> Leggi prima `CLAUDE.md` e `CLAUDE_PROTOCOL.md`.

---

## Contesto

`components/MainApp.tsx` è il componente orchestratore dell'app ADA. Attualmente ha **1619 righe e 56 handler** definiti come `useCallback`. Questa dimensione lo rende il file più a rischio troncamento dell'intero progetto — ogni modifica sostanziale rischia di corrompere il file silenziosamente.

L'obiettivo è estrarre i 56 handler in file separati nella cartella `handlers/`, lasciando `MainApp.tsx` con solo: dichiarazioni di stato, hook, routing/navigazione, e il render del componente.

---

## Regola di sicurezza fondamentale (NON derogare)

**Non riscrivere mai `MainApp.tsx` con il tool `Write`.** Qualsiasi modifica a file esistenti usa solo `Edit`. I file nuovi in `handlers/` possono usare `Write` ma solo se < 200 righe ciascuno — altrimenti spezzarli ulteriormente. Dopo ogni `Write` su un file nuovo, eseguire `wc -l <file>` per verificare che non sia troncato.

---

## Struttura target

Creare la cartella `components/handlers/` con questi file:

### `handlers/blockHandlers.ts`
Handler relativi ai blocchi-lezione (obiettivi, modulo, stato, tipologia, FSL, salto):
- `handleSetWeekTheme`
- `handleUpdateWeekTheme`
- `handleUpdateBlockObjective`
- `handleGenerateStrategicSuggestions`
- `handleUpdateStrategicData`
- `handleGenerateBlockDetails`
- `handleUpdateWeekDetails`
- `handleUpdateBlockDetails`
- `handleUpdateBlockModule`
- `handleUpdateBlockStatus`
- `handleUpdateBlockTipologia`
- `handleToggleFslPeriod`
- `handleSaltaChoice`

### `handlers/conversationHandlers.ts`
Handler relativi alle conversazioni e ai messaggi:
- `handleSelectConversation`
- `handleOpenConversaConAda`
- `handleStartPlanningForWeek`
- `handleEvaluationMessage`
- `handleSendMessage`
- `handleSendPlanningMessage`
- `handleModeChange`
- `handlePlanningModeChange`
- `handleNewConversationClick`
- `handleSaveConversationModules`

### `handlers/lessonHandlers.ts`
Handler relativi al ciclo vita lezione e all'aula:
- `handleAvviaLezione`
- `handleChiudiLezione`
- `handleRecordAttendanceForBlock`
- `handleUpdateGroupsForBlock`
- `handleUpdateGroupNotesForBlock`
- `handleSaveGroupsForBlock`
- `handleAddActivity`
- `handleMarkActivityDelivered`
- `handleUpdateBlockInConversation`
- `handleReEditBlock`

### `handlers/contentHandlers.ts`
Handler relativi al contenuto master, export e generazione immagini:
- `handleExportContent`
- `handleFormatBlocks`
- `handleGenerateImage`
- `handleUpdateWeekPlan`

### `handlers/uiHandlers.ts`
Handler di navigazione UI e studenti:
- `handleSelectStudent`
- `handleNavigateToBlock`
- `handleOpenAddNotebookModal`

---

## Procedura step-by-step (da seguire in questo ordine)

### Step 0 — Analisi
Leggi integralmente `MainApp.tsx` con `Read`. Poi esegui:
```bash
wc -l components/MainApp.tsx
grep -n "const handle" components/MainApp.tsx
```
Conferma che i 56 handler corrispondono alla lista sopra. Se ci sono discrepanze, adatta la struttura target.

### Step 1 — Crea la cartella handlers
```bash
mkdir -p components/handlers
```

### Step 2 — Crea i file handler uno alla volta
Per ogni file in `handlers/`:
1. Identifica gli handler da spostare leggendo le righe corrispondenti in `MainApp.tsx`
2. Crea il nuovo file con `Write` — includi tutti gli import necessari in cima
3. Verifica immediatamente con `wc -l components/handlers/<file>.ts` che il conteggio sia plausibile
4. Esegui `npx tsc --noEmit` per verificare che TypeScript non abbia errori di tipo nel nuovo file

### Step 3 — Rimuovi gli handler da MainApp.tsx
Per ogni gruppo di handler spostato:
1. Usa `Edit` (NON `Write`) per rimuovere il corpo dell'handler da `MainApp.tsx`
2. Mantieni solo una riga di import che rimanda al file handler
3. Dopo ogni Edit, esegui `wc -l components/MainApp.tsx` — il numero deve scendere progressivamente

### Step 4 — Aggiorna gli import in MainApp.tsx
Con `Edit`, aggiungi in cima a `MainApp.tsx` gli import dai nuovi file:
```typescript
import { createBlockHandlers } from './handlers/blockHandlers';
import { createConversationHandlers } from './handlers/conversationHandlers';
// ecc.
```

### Step 5 — Verifica finale
```bash
npx tsc --noEmit
npm run build
wc -l components/MainApp.tsx
```
`MainApp.tsx` deve essere < 350 righe dopo lo split. Il build deve passare senza errori.

---

## Pattern di firma per i file handler

Ogni file handler deve esportare una factory function che riceve le dipendenze necessarie e restituisce un oggetto con gli handler:

```typescript
// Esempio: handlers/blockHandlers.ts
import type { WeekRouteInfo, BlockDetails, BlockStatus, LessonType } from '../../types';
import type { UpdateConversationFn } from '../MainApp'; // o dal tipo corretto

interface BlockHandlerDeps {
  updateConversation: UpdateConversationFn;
  conversationsRef: React.MutableRefObject<Conversation[]>;
  showToast: (msg: string, type?: string) => void;
  // ... altri parametri necessari
}

export function createBlockHandlers(deps: BlockHandlerDeps) {
  const { updateConversation, conversationsRef, showToast } = deps;

  const handleUpdateBlockObjective = (weekNumber: number, blockIndex: number, objective: string) => {
    // ... logica
  };

  return {
    handleUpdateBlockObjective,
    // ... altri handler
  };
}
```

In `MainApp.tsx` si usa così:
```typescript
const blockHandlers = createBlockHandlers({
  updateConversation,
  conversationsRef,
  showToast,
  // ...
});
const { handleUpdateBlockObjective, ... } = blockHandlers;
```

---

## Nota finale

Se durante lo split un file handler supera le 200 righe, spezzarlo ulteriormente (es. `blockHandlers.ts` → `blockHandlers_planning.ts` + `blockHandlers_status.ts`). La priorità è **mai file > 300 righe** — è il limite oltre il quale il rischio troncamento aumenta significativamente.
