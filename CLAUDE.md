# ADA — Contesto di Progetto per Claude

> Leggi questo file all'inizio di ogni sessione. Contiene tutto il necessario per lavorare su ADA senza dover rileggere il codice da zero.

> ⚠️ **SUBITO DOPO questo file, leggi `CLAUDE_PROTOCOL.md`** — contiene le regole operative anti-troncamento. Ignorarle causa file troncati silenziosamente e spreco di token. È obbligatorio, non opzionale.

## Cos'è ADA

App React/TypeScript per insegnanti. Aiuta nella **pianificazione del corso**, nella **gestione della classe** e nel lavoro **in aula**, con un assistente AI (Gemini) integrato. Dominio: `ada.nuovadidattica.eu`. Utente: Andrea Poletti (`andrea.poletti@nuovadidattica.eu`).

---

## Stack Tecnico

- **React 19** + **TypeScript** (no build step in dev: ESM via importmap in `index.html`)
- **Vite** per il build finale
- **Tailwind CSS** via CDN (config estesa in `index.html`)
- **Gemini API** (`@google/genai`) per AI
- **IndexedDB** via `idb` per la persistenza (`services/db.ts`)
- **@dnd-kit** per drag & drop

---

## Sistema Font (CRITICO per UX)

| Classe Tailwind | Font        | Uso |
|-----------------|-------------|-----|
| `font-display`  | **Syne**    | Titoli espressivi, header di sezione, "Settimana N" |
| `font-sans`     | **DM Sans** | Corpo testo, default app |
| `font-mono`     | **DM Mono** | Label tecnici, codici, date, BL1/BL2, sezione sidebar |
| `font-serif`    | **Lora**    | Editor documenti |

**Regola**: `font-display` per titoli principali, `font-mono` per label codice/numero/sezione, `font-sans` per tutto il resto. Non mescolare mai `font-mono` dove serve `font-display`.

---

## Design System UI

### Sfondo e struttura
- **Sfondo app**: `bg-[#0D1117]`
- **Sidebar**: `bg-gray-900 border-r border-gray-600/40 shadow-[4px_0_24px_rgba(0,0,0,0.55)]`

### Card settimane (StrategicDashboardView)
- **Card settimana**: `rounded-xl border border-gray-600/55 bg-gray-800/55 hover:border-gray-500/70`
- **Pannello espanso settimana**: `border-t border-gray-600/50 bg-gray-800/70`
- **Card blocco interno**: `bg-gray-900/50 rounded-lg border border-gray-600/40`
- **Week info box** (Settimana N + data + dots): `bg-gray-800/60 border border-gray-700/35 rounded-xl px-3.5 py-2.5`

### Pulsanti
- **Primario filled** (es. "Progetta"): `bg-blue-600/80 text-white font-semibold rounded-lg hover:bg-blue-500 shadow-sm shadow-blue-900/40`
- **Outline AI** (es. "Suggerisci AI", pulsante AI blocco): `text-purple-400 border border-purple-500/25 rounded-lg hover:bg-purple-500/10 hover:border-purple-400/40`
- **Ghost**: `text-gray-300 hover:text-white rounded-md hover:bg-gray-800/60`
- **Outline distruttivo** (es. "Salta"): `text-red-400/70 border border-red-500/20 rounded-md hover:bg-red-500/15 hover:border-red-400/35`
- **Outline secondario** (es. "FSL"): `text-sky-400/70 border border-sky-500/20 rounded-md hover:bg-sky-500/15`

### Sidebar
- **Accent line attivo**: `absolute left-0 w-0.5 h-5 rounded-r-full bg-purple-400/80`
- **CollapsibleSectionLabel**: `text-[9px] font-mono tracking-[0.14em] uppercase text-gray-400/80` + chevron micro a destra — tutte le sezioni principali usano questo pattern
- **NavItem non-attivo**: `text-gray-300 hover:bg-gray-800/60 hover:text-white`
- **NavItem attivo**: `bg-gray-700/70 text-white` — **NON** `font-semibold`: l'accent line viola è l'unico indicatore, il grassetto è ridondante
- **CollapsibleSection** (sotto-sezioni con icona, es. "Laboratori e Strumenti"): stile diverso, ha icona + testo + chevron, usato solo per sotto-livelli

### Stato blocco — due sistemi paralleli, colori allineati

Esistono **due funzioni di derivazione stato** con granularità diversa ma colori canonici condivisi:

#### Sistema 1 — `getBlockProgressState` (StrategicDashboardView, 4 macrostati)
| Stato | Dot | Badge testo | Quando |
|-------|-----|-------------|--------|
| `da_fare` | `bg-slate-500` | `text-slate-400/80` | nessun obiettivo né messaggi |
| `in_corso` | `bg-amber-400` | `text-amber-400/80` | ha obiettivo/messaggi ma non contentBlocks |
| `completato` | `bg-emerald-500` | `text-emerald-400` | ha contentBlocks |
| `speciale` | `bg-gray-500` | `text-gray-500/80` | saltato · annullato (+ isFslPeriod aggiunge badge sky ortogonale) |

#### Sistema 2 — `getBlockDotColor` via `getBlockPlanningStatus` (PlanningView, 9 stati)
| Stato planning | Dot | Mappa a macrostato |
|----------------|-----|--------------------|
| `concluso` / `isReviewed` | `bg-emerald-500` | completato |
| `in_revisione` | `bg-emerald-500` | completato (ha contentBlocks, ma teacher ha mandato nuovo msg) |
| `in_progettazione` | `bg-amber-400` | in_corso |
| `da_progettare` + `block.status='da definire'` | `bg-amber-400` | in_corso (ha objective ma giorno non fissato) |
| `da_progettare` + `block.status='normale'` | `bg-slate-500` | da_fare (niente fatto ancora) |
| `da_definire` | `bg-slate-500` | da_fare (giorno non fissato, nessun contenuto) |
| `fsl` | `bg-sky-500` | speciale (distinto visivamente; in StrategicDashboard collassa in gray) |
| `saltato` / `annullato` / `sconosciuto` | `bg-gray-500` | speciale |

> **REGOLE COLORE CANONICHE** (non derogare):
> - verde completato → **`bg-emerald-500`** (MAI `bg-green-500`)
> - in lavorazione → **`bg-amber-400`**
> - non iniziato → **`bg-slate-500`**
> - speciale/neutro → **`bg-gray-500`** (MAI `bg-gray-600`)
> - `da_fare` usa slate/neutro, NON rosso — il rosso era ansiogeno per blocchi semplicemente non ancora iniziati
> - `da_definire` è slate (neutro), non rosso: il giorno non fissato è informazione, non errore
> - `in_revisione` è **emerald** (non amber): il blocco ha contentBlocks quindi a livello corso è "completato"

---

## File Chiave

```
components/
  MainApp.tsx                — orchestratore centrale (509 righe dopo split 2026-05-25): stato, hook, factory call (useMemo), render
  handlers/                  — handler estratti da MainApp.tsx (split 2026-05-25):
    blockHandlers.ts         — pianificazione blocchi: handleSetWeekTheme, handleUpdateBlockObjective, handleUpdateBlockTitle, handleGenerateStrategicSuggestions, handleGenerateBlockDetails, ecc.
    blockHandlers_status.ts  — stato blocco: handleUpdateBlockStatus, handleUpdateBlockTipologia, handleToggleFslPeriod, handleSaltaChoice + createApplyBlockStatus (helper)
    conversationHandlers.ts  — handleModeChange, handlePlanningModeChange, handleOpenConversaConAda, handleEvaluationMessage, ecc.
    messagingHandlers.ts     — handleSendMessage, handleGenerateImage, handleSendPlanningMessage
    lessonHandlers.ts        — handleAvviaLezione, handleChiudiLezione, handleRecordAttendanceForBlock, handleUpdateGroupsForBlock, handleAddActivity, ecc.
    blockNoteHandlers.ts     — handleSaveLessonNotes, handleDeleteLessonNotes, handleGenerateAnalysis, handleAddLinkForBlock, handleDeleteLinkForBlock, handleUpdateBlockCloudLink, handleUpdateBlockLinkedNotebooks, handleAddLessonMaterial, handleRemoveLessonMaterial, handleAutoSaveLessonNotes (silent, no toast), handleUpdateLiveAttendance, handleAddLessonEvaluation, handleRemoveLessonEvaluation, handleGenerateLessonNoteAnalysis
    contentHandlers.ts       — handleUpdateWeekPlan, handleExportContent, handleFormatBlocks
    dataHandlers.ts          — handleExportData, handleAttemptImport, handleConfirmRestore, handleExportCourseBook, ecc.
    uiHandlers.ts            — handleSelectStudent, handleNavigateToBlock, handleOpenAddNotebookModal
  Sidebar.tsx                — navigazione, NavItem + CollapsibleSectionLabel + CollapsibleSection + accent line
  StrategicDashboardView.tsx — "Progettazione del Corso": settimane (da routeCalendar), blocchi, progressStats; accordion blocco con selettore "Cosa" + "Come" + toggle isFslPeriod + campo "Obiettivo Didattico" (istituzionale, `block.objective`) + "Titolo" nell'header (`block.blockTitle`). Due pulsanti AI separati: ✦ nell'header → TitleSuggestionModal (Diretto/Narrativo/Evocativo); "Suggerisci obiettivo" nella sezione espansa → ObjectiveSuggestionModal (Sintetico/Bilanciato/Articolato). Il radar NON è più nell'header (spostato in GanttView — 2026-05-25).
  TitleSuggestionModal.tsx   — modal per generare titoli accattivanti del blocco (per gli studenti): tre varianti Diretto/Narrativo/Evocativo da `generateBlockTitleSuggestions`. Richiede `block.objective` compilato.
  ObjectiveSuggestionModal.tsx — modal per generare l'obiettivo didattico istituzionale: tre varianti Sintetico/Bilanciato/Articolato da `generateObjectiveSuggestions`. Richiede `block.module` selezionato.
  GanttView.tsx              — "Analisi del Corso" (rinominato da "Gantt del Corso" 2026-05-25): layout a due colonne — Gantt moduli/attività (flex-1, scroll orizzontale) + pannello Radar equilibrio didattico (w-72, destra). Su schermi stretti: flex-col (gantt sopra, radar sotto). Calcola radarData e idealRadarData direttamente dalle conversations.
  DidacticRadarChart.tsx     — componente panel del radar didattico (2026-05-25): pentagono fisso a 5 assi (ALL_TYPES — tutti i LessonType sempre visibili anche a 0); ideale = idealData se disponibile, altrimenti distribuzione uniforme 20% per tipo; score badge TVD verde/ambra/rosso; bar chart breakdown sotto il radar (indigo = attuale, sky = ideale). Non ha più la versione "compact" per l'header.
  InAulaView.tsx             — vista lezione unificata (view id: 'lezione'): tre tab Preparazione | In Corso | Archivio. Tab attivo di default segue lessonState. Il tab In Corso delega a LessonInCorsoTab; il tab Preparazione a LessonPreparationTab.
  LessonPreparationTab.tsx   — tab Preparazione: selector blocco, preview master content (collassabile), lista LessonMaterial + AddMaterialModal, sezione "Ada consiglia tool" collassabile (generateToolSuggestion). Default: blocco in_corso se presente.
  LessonInCorsoTab.tsx       — tab In Corso: banner lezione attiva, grid presenze P/R/A (salvataggio immediato), lista materiali attivi + form rapido, valutazioni (AddEvaluation form inline + lista), note libere (autosave 1.5s debounce + flush-on-unmount come DocumentEditor), analisi Ada delle note (generateLessonNoteAnalysis), CloseModal con opzione "Analizza prima di archiviare".
  ChatView.tsx               — chat con Ada
  PlanningView.tsx           — laboratorio tattico settimanale (vedi sezione dedicata)
  BlockWorkspaceView.tsx     — workspace per-blocco: laboratorio AI + contenuto master
  FoundingDocumentsView.tsx  — Documenti Fondanti (full-page): accordion di card collassabili (Profilo del Corso, Progetto Didattico, Patto Formativo, Equipaggio). Tutte partono chiuse. Ogni card ha header con titolo + badge stato + pulsante "Genera con ADA" (solo Progetto Didattico e Patto Formativo) + matita per abilitare editing. Nessun popup di conferma. Autosave via DocumentEditor (1.5s debounce). Genera con ADA carica il contenuto nell'editor ma NON salva finché il docente non modifica.
  AdaPersonalityView.tsx     — Personalità di Ada (full-page): singola card documento con header interno (titolo + badge stato + "Genera con ADA" + matita). Read-only di default; matita abilita editing. Autosave identico a FoundingDocumentsView. Dopo generazione, editing si abilita automaticamente per revisione prima del salvataggio.
  RouteView.tsx              — La Rotta (full-page): giorni predefiniti dei blocchi + calendario settimane con date lunedì→domenica e toggle blocchi
  ModePills.tsx              — pill inline selezione modalità (sostituisce il vecchio ModeSelector a dropdown)
  EditableField.tsx          — input inline con feedback salvataggio (bordo verde 1.5s)
  EditableTextarea.tsx       — textarea inline con feedback salvataggio (bordo verde 1.5s)

hooks/
  useConversations.ts        — stato conversazioni + updateConversation (NIENTE labelIds, NIENTE updateConversationLabels — rimossi)
  useMasterContext.ts        — contesto docente: systemInstruction, constitution, crewContext, rulesContext, teacherProfile, blockDayDefaults, routeCalendar, currentModeId
  usePlanning.ts             — logica pianificazione blocchi

services/
  db.ts                      — IndexedDB (idb)
  gemini.ts                  — wrapper Gemini API; include generateDocumentContent, generateToolSuggestion(question, masterSnippet?), generateLessonNoteAnalysis(notes, students), generateGroupSuggestionWithCriteria(students, criteria, groupSize) oltre alle funzioni storiche. VALID_LESSON_TYPES set (5 voci, senza uda/fsl).
  constitutionParser.ts      — parseConstitution(): splitta il Progetto Didattico in sezioni MODULO/UDA/EDUCAZIONE CIVICA/FSL, restituisce { modules, moduleMap, contentUnits: CourseContentUnit[] }. File CRITICO — importato da ConstitutionCacheContext.tsx.

types.ts                     — tutti i tipi (fonte della verità)
constants.ts                 — ADA_QUICK_CHAT_ID, MODES, chiavi localStorage, LOCAL_STORAGE_ROUTE_CALENDAR_KEY, LESSON_TYPE_LABELS (5 voci), COURSE_CONTENT_TYPE_LABELS, ecc.
utils.ts                     — getBlockPlanningStatus, getExactDateForBlock, routeCalendarToWeekInfos, formatRouteWeekDates
```

---

## PlanningView — Architettura Interna

### Header condizionale (Laboratorio vs Contenuto Master)

L'header di PlanningView ha **due modalità** a seconda del tab attivo:

**Tab Laboratorio** — header completo su tre righe:
1. Titolo: `ClipboardDocumentCheckIcon` + `"Settimana N: Tema"` in `font-display font-semibold` + controlli destra (search, CogIcon, X)
2. `BlockNavigator` (pillole blocco + toggle tab)
3. Riga obiettivo (collassabile se c'è `lessonTitle`, ghost se vuoto)

**Tab Contenuto Master** — unica barra compatta:
- Solo `BlockNavigator` con `extraRight={<XIcon />}` — niente titolo, niente obiettivo

### BlockNavigator (componente interno)
Riga compatta con due zone affiancate:
- **Pillole blocco** (sinistra): una per blocco, mostrano `B1 · lunedì 5 mag`, dot colorato per stato, pill attiva evidenziata `bg-gray-700`.
- **Toggle tab + extraRight** (destra): segmented control `Laboratorio | Contenuto Master` in `bg-gray-900/60 rounded-md`. La prop `extraRight?: React.ReactNode` permette di aggiungere elementi a destra del toggle (usata per il tasto X in Contenuto Master).

### Stato `activeWorkspaceTab`
Gestito in `PlanningView` (non in `BlockWorkspaceView`) e passato come prop `activeTab`. Questo permette al `BlockNavigator` di condividere il toggle tab con il workspace sottostante senza prop drilling aggiuntivo.

```tsx
// In PlanningView
const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<'laboratorio' | 'contenutoMaster'>('laboratorio');
// Passato a BlockNavigator.onTabChange e a BlockWorkspaceView.activeTab
```

### Pulsante X (chiudi scheda settimana)
- **Laboratorio**: nell'header principale accanto a CogIcon.
- **Contenuto Master**: dentro `BlockNavigator` come `extraRight`, unico elemento visibile oltre alle pillole.
- In MainApp: `onClose={() => setView('strategic_dashboard')}`.

### Props di PlanningView
```ts
interface PlanningViewProps {
  conversation: Conversation;
  onUpdateWeekPlan: ...;
  isLoading: boolean;
  onSendMessage: ...;
  onReEditBlock: ...;
  onClose: () => void;           // X per tornare a strategic_dashboard
  masterContext: ReturnType<typeof useMasterContext>;
  initialTab?: ...;
  onInitialTabConsumed?: ...;
  useGoogleSearch: boolean;
  onGoogleSearchChange: ...;
  onShowConfirmation: ...;
  currentModeId?: string;        // passato a BlockWorkspaceView
  onModeChange?: (modeId: string) => void; // usa handlePlanningModeChange
}
```

---

## BlockWorkspaceView — Architettura Interna

- **Nessun tab bar interno**: il controllo tab è nel `BlockNavigator` di `PlanningView`. `activeTab` è una prop.
- **Larghezza chat**: messaggi e footer input centrati a `max-w-3xl mx-auto`, coerente con `ChatView`.
- **ModePills nel footer** (solo tab Laboratorio): riga di pill sopra `ChatInput` quando `currentModeId` e `onModeChange` sono presenti.

```tsx
<footer className="flex-shrink-0 px-6 pb-5 pt-3 border-t border-gray-800/40 bg-gray-900/40 backdrop-blur-sm">
    <div className="max-w-3xl mx-auto">
        {currentModeId && onModeChange && (
            <div className="mb-2">
                <ModePills currentModeId={currentModeId} onModeChange={onModeChange} />
            </div>
        )}
        <ChatInput ... />
    </div>
</footer>
```

---

## Gestione del Corso — Pattern Documento (2026-05-23)

`FoundingDocumentsView` e `AdaPersonalityView` seguono lo stesso pattern coerente:

### Struttura card documento
```
┌─────────────────────────────────────────────────────┐
│ Titolo documento   ● compilato   [Genera con ADA] [✏] │  ← header cliccabile (accordion) o fisso
├─────────────────────────────────────────────────────┤
│ Descrizione breve (xs, gray-400)                    │
│ DocumentEditor (isEditable=isEditing, autosave 1.5s)│
└─────────────────────────────────────────────────────┘
```

### Stato per-card (FoundingDocumentsView usa `Record<string, DocCardState>`)
```ts
interface DocCardState {
    isOpen: boolean;        // accordion aperto/chiuso
    isEditing: boolean;     // editor attivo
    isGenerating: boolean;  // spinner "Genera con ADA"
    generatedContent: string | null; // override contenuto dopo generazione
}
```

### Comportamento "Genera con ADA"
- Disponibile solo per Progetto Didattico e Patto Formativo (in FoundingDocumentsView) e Personalità di Ada
- Richiede Profilo del Corso compilato — altrimenti pulsante disabilitato con tooltip esplicativo
- **Non salva nel DB** — carica il contenuto nell'editor, abilita l'editing, ma il salvataggio avviene solo quando il docente digita (autosave 1.5s)
- Tooltip contestuale: se c'è già testo → "Rigenera con ADA (sovrascrive il testo nell'editor, non ancora salvato)"

### Pulsante matita
- Classe attiva: `text-blue-400 bg-blue-500/15` + `rounded-md p-1.5`
- Classe inattiva: `text-gray-500 hover:text-gray-300 hover:bg-gray-700/50` + `rounded-md p-1.5`
- Nessun popup di conferma — toggle diretto

### Badge stato contenuto
- `● compilato` → `text-[10px] font-mono text-emerald-400/70`
- `○ vuoto` → `text-[10px] font-mono text-gray-500`

---

## Contesto Istituzionale — Card PTOF (2026-05-23)

Card speciale in `FoundingDocumentsView`, **visibile solo fuori dalla configurazione iniziale** (è opzionale). Appare in cima alla pagina preceduta da un separatore `text-[9px] font-mono uppercase` con label "Contesto istituzionale". I Documenti del Corso normali seguono sotto un secondo separatore "Documenti del corso".

### Scopo
Accogliere l'estratto del PTOF (e NIV/RAV) che il docente produce con NotebookLM e incollarci. Quando compilato, `ptofExtract` viene iniettato nel context di sistema di Ada con intestazione `# CONTESTO ISTITUZIONALE (PTOF):` — dopo `crewContext` e prima di `planningContext` nella `fullContext` di `gemini.ts`.

### Differenze rispetto alle card standard
- **Nessun "Genera con ADA"** — il contenuto viene estratto da NotebookLM manualmente
- **Campo URL notebook**: input `type="url"` salvato su `ptofNotebookUrl` con `onBlur`; se compilato compare pulsante "Apri notebook" (outline sky `text-sky-400/80 border-sky-500/20`)
- **Kit di estrazione NotebookLM**: pannello collassabile (`isKitOpen`) con 5 prompt pronti (array `KIT_PROMPTS` definito a livello di modulo, fuori dal componente). Ogni prompt ha etichetta `font-mono text-gray-500` e bottone copia con feedback ✓ emerald 2 secondi (`copiedPromptIndex`)
- `isEditing` parte `false` (read-only di default, matita per abilitare) — identico alle altre card

### DB keys nuove
```
LOCAL_STORAGE_PTOF_EXTRACT_KEY     = 'ada-ptof-extract'
LOCAL_STORAGE_PTOF_NOTEBOOK_URL_KEY = 'ada-ptof-notebook-url'
```
Entrambe gestite in `useMasterContext` come `ptofExtract` / `ptofNotebookUrl` con `handleSavePtofExtract` / `handleSavePtofNotebookUrl`.

---

## ModePills — Selettore modalità

`ModePills.tsx` è il selettore di modalità. **Nessun dropdown, nessun menu**: è una riga di pill cliccabili inline, senza posizionamento assoluto né z-index.

- **Pill attiva**: `mode.colorClasses.badge` (sfondo colorato + ring inset) + `cursor-default`
- **Pill inattiva**: solo testo `text-gray-600 hover:text-gray-400`, nessun bordo né sfondo
- **Dimensione**: `text-[10px] font-mono rounded-full px-2 py-0.5` — ultra-compatto
- **Posizione**: sopra `ChatInput` nel footer, sia in `ChatView` che in `BlockWorkspaceView` (Laboratorio)

### Due handler distinti in MainApp

| Handler | Dove usato | Comportamento |
|---------|-----------|---------------|
| `handleModeChange` | `ChatView` | Salva modalità + inietta messaggio di intro nell'array messaggi della conversazione |
| `handlePlanningModeChange` | `PlanningView` → `BlockWorkspaceView` | Salva modalità + mostra toast — **NON** inietta messaggi nei thread per-blocco |

Usare sempre `handlePlanningModeChange` per il Laboratorio. L'iniezione del messaggio di intro in un thread per-blocco contaminerebbe il contesto AI del blocco.

---

## Modello Dati Essenziale

### `WeekEntry` (La Rotta)
```ts
export interface WeekEntry {
    weekNumber: number;
    mondayDate: string;      // ISO string, es. "2025-09-15"
    activeBlocks: number[];  // 1-indexed, es. [1,2,3] oppure [1,3] se BL2 assente
}
```
Salvata su DB con chiave `LOCAL_STORAGE_ROUTE_CALENDAR_KEY = 'ada-route-calendar'` (JSON array). Gestita in `useMasterContext` come `routeCalendar: WeekEntry[]` con `handleSaveRouteCalendar`.

### `Conversation`
```ts
{ id, title, messages: Message[], weekPlan?: WeekPlan, studentId? }
// labelIds è stato RIMOSSO — niente etichette nell'app
```

### `WeekPlan`
```ts
{ weekNumber, dates, totalBlocks, theme, status, blocks: BlockDetails[], notes?, activeBlockIndex }
// completionStatus: ancora nel tipo per retrocompatibilità DB — NON mostrarlo in UI
```

### `BlockDetails` (campi chiave)
```ts
{
  id, day, status: BlockStatus,     // 'normale'|'saltato'|'da definire'|'annullato'
  tipologia?: LessonType,           // 'frontale_teorica'|'frontale_operativa'|'laboratorio'|'verifica'|'discussione' — SOLO modalità pedagogica ("come")
  isFslPeriod?: boolean,            // flag visivo ortogonale: badge sky "FSL" sul blocco, non altera status né tipologia
  lessonState?: LessonState,        // 'progettata'|'in_corso'|'archiviata'
  objective?,                       // Obiettivo didattico istituzionale (il "perché" formale, per documentazione)
  blockTitle?,                      // Titolo accattivante per gli studenti (generato da Ada, mostrato nell'header)
  module?,
  lessonTitle?, lessonSyllabus?,    // pianificazione dettagliata (usati nel Laboratorio, non più in StrategicDashboard)
  contentBlocks?: ContentBlock[],   // popolato dopo "Trasferisci al Master" → stato "completato"
  messages?: Message[],
  isLocked?: boolean,
  isReviewed?: boolean,             // override: forza dot emerald indipendentemente dallo stato
  reason?: string,                  // motivo per blocchi 'saltato'
  moduleId?: string,                // riferimento a CourseModule.id
  sectionId?: string,               // riferimento a ModuleSection.id
  // ── Campi IN AULA (aggiunti 2026-05-27, tutti opzionali → zero-migration DB) ──
  presentStudentIds?: string[],     // presenze: ID studenti presenti (include chi è in ritardo)
  lateStudentIds?: string[],        // presenze: ID studenti in ritardo (subset di presentStudentIds)
  lessonMaterials?: LessonMaterial[], // materiali preparati/usati nella lezione
  lessonEvaluations?: LessonEvaluation[], // valutazioni inserite in aula per singolo studente
  lessonNoteAnalysis?: LessonNoteAnalysis, // analisi strutturata Ada delle note libere
}
```

**Logica presenze P/A/R** (da `handleUpdateLiveAttendance`):
- **Presente (P)**: in `presentStudentIds`, NON in `lateStudentIds`
- **Ritardo (R)**: in ENTRAMBI `presentStudentIds` e `lateStudentIds`  
- **Assente (A)**: non in `presentStudentIds`

I due array separati consentono statistiche di presenza (contare R come presenti) e tracking separato dei ritardi.
`BlockStatus` = `'normale' | 'saltato' | 'da definire' | 'annullato'`.
`LessonType` = modalità pedagogica ("come"), **5 voci**: `frontale_teorica · frontale_operativa · laboratorio · verifica · discussione`. UDA e FSL sono stati rimossi — non sono modalità di conduzione della lezione.
`isFslPeriod` = flag ortogonale allo stato e alla tipologia: indica che il blocco è in un periodo FSL (badge `sky`), ma il blocco può avere qualsiasi status e qualsiasi tipologia.

### Stato automatico blocco (derivato, non salvato)
```ts
const getBlockProgressState = (block): 'da_fare'|'in_corso'|'completato'|'speciale' => {
  if (status === 'saltato' || status === 'annullato') return 'speciale';
  if (contentBlocks?.length > 0) return 'completato';
  if (objective?.trim() || module?.trim() || messages?.length > 0) return 'in_corso';
  return 'da_fare';
}
```

### Tipi "Cosa / Come" — separazione corso/didattica (2026-05-24)

La distinzione è architetturale: il **"cosa"** è la struttura del corso (modulo, UDA, EC, FSL definiti nel Progetto Didattico); il **"come"** è la modalità pedagogica di conduzione della lezione (frontale, laboratorio, ecc.).

```ts
// "Come" — modalità pedagogica (LessonType, 5 voci stabili)
type LessonType = 'frontale_teorica' | 'frontale_operativa' | 'laboratorio' | 'verifica' | 'discussione';

// "Cosa" — tipo struttura contenuto corso (CourseContentType, 4 voci)
type CourseContentType = 'modulo' | 'uda' | 'educazione_civica' | 'fsl';

// Unità di contenuto parsata dal Progetto Didattico
interface CourseContentUnit {
  id: string;              // es. "modulo-1", "uda-2", "fsl-1"
  type: CourseContentType;
  title: string;
  order: number;
  role?: string;
  significance?: string;
}

// ParsedConstitution (esteso)
interface ParsedConstitution {
  modules: ModuleDetails[];          // retrocompatibilità — solo i MODULI
  moduleMap: Map<string, ModuleDetails>;
  contentUnits: CourseContentUnit[]; // TUTTE le unità (moduli + UDA + EC + FSL)
}
```

`COURSE_CONTENT_TYPE_LABELS: Record<CourseContentType, string>` in `constants.ts`:
`{ modulo: 'Modulo', uda: 'UDA', educazione_civica: 'Educazione Civica', fsl: 'FSL' }`

In `StrategicDashboardView` l'accordion blocco ha questa struttura (2026-05-28):

**Header blocco (sempre visibile):**
- `EditableField` → mostra `block.blockTitle || block.objective` (fallback per dati pre-refactoring)
- Pulsante ✦ AI → apre `TitleSuggestionModal` (richiede `block.objective` compilato)

**Riga select (header, seconda riga):**
- **Cosa** (primo select): opzioni raggruppate per `CourseContentType` via `<optgroup>`. Placeholder: `— unità didattica —`
- **Come** (secondo select): `LessonType` 5 voci. Placeholder: `— tipologia di lezione —`
- **Toggle FSL**: button `text-sky-400` che imposta `isFslPeriod`

**Sezione espansa:**
- **Obiettivo Didattico** (`block.objective`): `EditableTextarea` + pulsante "Suggerisci obiettivo" → `ObjectiveSuggestionModal` (richiede `block.module`)
- NON mostrare più "Estratto dalla Costituzione" né "Idea / Prompt per Ada" — rimossi (2026-05-28). Il `block.lessonTitle` continua a essere salvato silenziosamente da `handleModuleChange` per il contesto Ada, ma non va esposto in UI.

Handler in `MainApp`:
- `handleUpdateBlockTipologia` — salva la `LessonType` selezionata (il "come")
- `handleUpdateBlockModule` — salva il titolo dell'unità didattica in `block.module` + estrae `block.lessonTitle` dal Progetto Didattico (contesto silenzioso per Ada)
- `handleUpdateBlockObjective` — salva l'obiettivo istituzionale in `block.objective`
- `handleUpdateBlockTitle` — salva il titolo accattivante in `block.blockTitle`
- `handleToggleFslPeriod` — imposta/rimuove `isFslPeriod` sul blocco

Migrazione one-shot (useEffect in MainApp): vecchio `tipologia: 'fsl'` → `isFslPeriod: true, tipologia: undefined`.

### Progresso globale (progressStats — calcolato in StrategicDashboardView)
```ts
// useMemo derivato da weekData, mostrato nell'header come dots + contatori
{ completate, inCorso, daFare, total }
// Una settimana è "completata" se tutti i suoi blocchi sono completato|speciale
```

---

## Pattern di Codice Fondamentali

### Aggiornare una conversazione (SEMPRE così, mai setConversations diretto)
```ts
updateConversation(convoId, conv => ({ ...conv, weekPlan: { ...conv.weekPlan, ... } }));
```

### Accedere alle conversazioni in callback (evita stale closure)
```ts
conversationsRef.current.forEach(c => { ... });
```

### Factory handlers — pattern di split da MainApp.tsx (2026-05-25)

Ogni file in `components/handlers/` esporta una funzione `createXxxHandlers(deps: XxxDeps)` che riceve le dipendenze come oggetto e restituisce un oggetto di handler. In `MainApp.tsx` si usa `useMemo` per istanziarla:

```ts
// In components/handlers/blockHandlers.ts
export function createBlockPlanningHandlers(deps: BlockPlanningDeps) {
  const { conversationsRef, updateConversation, ... } = deps;
  const handleSetWeekTheme = (...) => { ... };
  return { handleSetWeekTheme, ... };
}

// In MainApp.tsx
const { handleSetWeekTheme, ... } = useMemo(
  () => createBlockPlanningHandlers({ conversationsRef, updateConversation, ... }),
  [conversationsRef, updateConversation, ...]  // deps stabili
);
```

**Regole deps del useMemo:**
- I React state setter (`setIsLoading`, `setModalState`, ecc.) sono referenze stabili → **non** vanno nelle deps
- I React ref (`conversationsRef`, `latestRequestRef`, `pendingSaltaInfoRef`) sono stabili → **non** vanno nelle deps
- Valori di stato (`fileToImport`, `dataToRestore`, `studentForEvaluationImport`) che cambiano → **sì** nelle deps, perché `useMemo` deve ricreare la factory quando cambiano

**`setViewFn` — wrapper obbligatorio per setView:**
```ts
// setView ha un union type stretto ('lobby' | 'chat' | ...) incompatibile con string
// I factory handler accettano setView: (v: string) => void
const setViewFn = useCallback((v: string) => setView(v as any), []);
// Passato ai factory come: setView: setViewFn
```

**`handleSelectConversation` — definito in MainApp, passato come dep:**
```ts
// handleSelectConversation è una dipendenza di più factory (conversationHandlers,
// lessonHandlers, contentHandlers, uiHandlers). Deve essere definito PRIMA
// delle factory call che lo usano come dep.
const handleSelectConversation = useCallback((id: string) => {
  selectConversationHook(id);
  setViewFn('chat');
}, [selectConversationHook, setViewFn]);
```

**`pendingSaltaInfoRef` — ref sync per evitare stale closure in handleSaltaChoice:**
```ts
const pendingSaltaInfoRef = useRef<...>(null);
useEffect(() => { pendingSaltaInfoRef.current = pendingSaltaInfo; }, [pendingSaltaInfo]);
// Passato a createBlockStatusHandlers — il handler legge sempre il valore corrente
// senza che il useMemo debba ricrearsi ad ogni cambio di pendingSaltaInfo
```

### Chat fissa ADA
```ts
const ADA_QUICK_CHAT_ID = 'ada-quick-chat'; // ID fisso, non cambia mai
```

### EditableField / EditableTextarea — feedback salvataggio
Entrambi hanno stato `justSaved`: bordo verde `border-emerald-500/60` per 1.5s dopo ogni save, poi torna al normale. Il timer è pulito sull'unmount. Non toccare questo pattern.

### DocumentEditor — flush autosave all'unmount
`DocumentEditor.tsx` ha un autosave debounced (1.5s). Se l'utente cambia tab prima che il timer scada il contenuto va perso. Fix: `pendingContentRef` cattura ogni modifica; un `useEffect` cleanup chiama `onSaveRef.current(pending)` al momento dell'unmount. **Non rimuovere questo pattern** — era un bug reale: uscire dal tab Contenuto Master in meno di 1.5s perdeva l'ultima modifica.

```ts
// DocumentEditor.tsx — pattern flush-on-unmount
const pendingContentRef = useRef<string | null>(null);
const onSaveRef = useRef(onSave);
useEffect(() => { onSaveRef.current = onSave; }, [onSave]);
useEffect(() => {
    return () => {
        if (autosaveTimeoutRef.current) {
            clearTimeout(autosaveTimeoutRef.current);
            const pending = pendingContentRef.current;
            if (pending !== null && pending.trim() !== lastSavedContent.current.trim()) {
                onSaveRef.current(pending);
            }
        }
    };
}, []);
```

### Persistenza `updateConversation` — pattern a due vie (CRITICO)
React 18 con automatic batching **può saltare la valutazione eager del functional updater** di `useState` quando ci sono pending state updates (succede durante lo streaming AI). In questi casi la variabile catturata dentro il setter rimane `null` e `db.saveConversation` non viene mai chiamato.

**Non rimuovere o semplificare il pattern `pendingSavesRef` in `useConversations.ts`.**

Il pattern a due vie:
- **Via rapida**: React valuta l'updater eagerly → `updatedConvo` catturato → `db.saveConversation` chiamato subito
- **Via fallback**: React rimanda (pending lanes) → `updatedConvo` è `null` → `convoId` aggiunto a `pendingSavesRef` → `useEffect([conversations])` lo salva dopo il prossimo commit React

```ts
// useConversations.ts — due vie di salvataggio
const pendingSavesRef = useRef<Set<string>>(new Set());

useEffect(() => {
    if (pendingSavesRef.current.size === 0) return;
    const toSave = [...pendingSavesRef.current];
    pendingSavesRef.current.clear();
    toSave.forEach(convoId => {
        const convo = conversations.find(c => c.id === convoId);
        if (convo) db.saveConversation(convo).catch(err => console.error(err));
    });
}, [conversations]);
```

Questo bug causava la perdita silenziosa di tutto il contenuto aggiunto con "Aggiungi in Coda" e "Sostituisci Master" dopo refresh. "Trasferisci al Master" non ne risentiva perché ha un `await` prima della chiamata che svuota le pending lanes.

### Azioni pulsante Laboratorio — etichette correnti
| Label pulsante | `action` payload | Comportamento |
|----------------|-----------------|---------------|
| **Trasferisci al Master** | `validate_and_archive` | Crea header HTML + salva come primo `contentBlock` |
| **Aggiungi in Coda** | `add_validated_content_as_new_block` | Appende un nuovo `ContentBlock` ai precedenti |
| **Sostituisci Master** | `replace_entire_master_content` | Richiede conferma, poi sostituisce tutti i `contentBlocks` |

Il badge "Trasferito" in `MessageView.tsx` compare dopo l'uso di qualsiasi azione singola (es. "Trasferisci al Master"). Era "Validato" — aggiornato per coerenza con il nuovo label.

### React rules — tutti gli hook prima dei return condizionali
**Tutti** gli hook (`useState`, `useRef`, `useEffect`, `useMemo`, `useCallback`) devono stare **prima** di qualsiasi `return` condizionale nel componente. Violare questa regola causa errori runtime "rendered more hooks than previous render" / "rendered fewer hooks than during the previous render".

Questo vale anche per hook che referenziano `block`, `weekPlan` o altri dati ricevuti come prop. Se il tipo della prop è non-opzionale nella firma del componente, usare il valore direttamente senza optional chaining aggiuntivo — il guard condizionale (`if (!block) return`) rimane comunque dopo tutti gli hook.

### availableWeeks → routeCalendar (NON routeContext)
Le settimane visibili in `StrategicDashboardView` derivano da `routeCalendar` (strutturato), non dal legacy `routeContext` (testo libero).

```ts
// MainApp.tsx — CORRETTO
const availableWeeks = useMemo(
    () => routeCalendarToWeekInfos(masterContext.routeCalendar),
    [masterContext.routeCalendar]
);
```

`routeCalendarToWeekInfos` (in `utils.ts`) filtra le `WeekEntry` con `activeBlocks.length > 0` e mappa a `WeekRouteInfo[]`. Le date vengono formattate con `formatRouteWeekDates(mondayIso)` che produce "15-21 set" o "30 set – 6 ott" (cross-month), compatibile con il regex di `getExactDateForBlock`.

---

## Navigazione / View

```
'lobby'               — schermata iniziale
'chat'                — ChatView (conversazione con Ada)
'planning'            — PlanningView (laboratorio tattico)
'strategic_dashboard' — StrategicDashboardView (Progettazione del Corso)
'lezione'             — InAulaView unificata: tre tab Preparazione | In Corso | Archivio
                        (sostituisce 'lezione_in_corso' + 'archivio_lezioni' rimossi in Step 3 — 2026-05-27)
'students'            — StudentRosterView
'student_profile'     — StudentProfileView (include sezioni presenze/valutazioni/segnali Ada)
'classroom_trend'     — ClassroomTrendView (Andamento Aula: cruscotto qualitativo + sezione Monitoraggio Consuntivo)
'founding_documents'  — FoundingDocumentsView (Documenti Fondanti)
'la_rotta'            — RouteView (La Rotta — calendario settimane e giorni blocchi)
'ada_personality'     — AdaPersonalityView (Personalità di Ada — istruzioni di sistema)
'notebooklm'          — NotebookLMView
'toolkit'             — ToolkitView
'groups_archive'      — GroupsArchiveView (archivio + composer "Crea Nuovi Gruppi con Ada")
'gantt'               — GanttView (Analisi del Corso — Gantt + Radar equilibrio didattico)
```

---

## Sidebar — Struttura Navigazione Attuale

Tutte le sezioni principali usano `CollapsibleSectionLabel` (cliccabile, chevron, stile monospace) + `CollapsibleContent`. Stato default: CONTENUTI, IN AULA, MONITORAGGIO aperte; GESTIONE chiusa.

```
[Conversa con Ada]  — button gradient viola

▾ CONTENUTI DEL CORSO          (CollapsibleSectionLabel, default: aperta)
  • Progettazione del Corso        (→ strategic_dashboard)
  • Analisi del Corso              (→ gantt) ← Gantt moduli + pannello Radar equilibrio PROGETTO

▾ IN AULA                      (CollapsibleSectionLabel, default: aperta)
  • Lezione                        (→ lezione, badge verde se lezione in_corso attiva)
                                     Tab interni: Preparazione | In Corso | Archivio
  ▾ Laboratori e Strumenti         (CollapsibleSection con icona, sotto-livello)
      ↳ Toolkit                    (→ toolkit)
      ↳ I Miei Notebook            (→ notebooklm)
      ↳ Gruppi                     (→ groups_archive) ← composer Ada + archivio
      ↳ Atelier Visivo             (DISABILITATO — badge "API")

▾ MONITORAGGIO                 (CollapsibleSectionLabel, default: aperta)
  • Andamento Aula                 (→ classroom_trend) ← cruscotto qualitativo + consuntivo
  • Gruppi                         (→ groups_archive)
  • Studentesse                    (→ students / student_profile)

▾ GESTIONE DEL CORSO           (CollapsibleSectionLabel, default: chiusa)
  • Documenti Fondanti             (→ founding_documents)
  • La Rotta                       (→ la_rotta)
  • Personalità di Ada             (→ ada_personality)
  • Backup, API Key
```

> **Rimosso definitivamente**: widget Disciplina/Corso in sidebar, NavItem "Etichette", NavItem "Profilo Docente" (inglobato in Profilo del Corso nei Documenti Fondanti), NavItem separati "Lezione in Corso" e "Archivio Lezioni" (unificati in "Lezione" — Step 3 2026-05-27).

`NavItem` ha prop `disabled?: boolean` → badge "API", `opacity-30 cursor-not-allowed`.

---

## Ciclo di Vita Lezione

```
progettata → in_corso → archiviata
```

- **Avvia Lezione** (`handleAvviaLezione`): `lessonState='in_corso'` sul blocco, 'progettata' sugli altri eventuali in_corso, naviga a `'lezione'`.
- **Chiudi Lezione** (`handleChiudiLezione`): `lessonState='archiviata'`, naviga a `'lezione'` (tab Archivio si apre automaticamente).
- Una sola lezione `in_corso` alla volta.
- Il tab attivo di default in `InAulaView` segue `lessonState`: `progettata` → Preparazione, `in_corso` → In Corso, `archiviata` → Archivio.

---

## Cosa NON fare

- Non usare `setConversations` direttamente — usare `updateConversation`.
- Non rimuovere `completionStatus` da `WeekPlan` nel tipo — retrocompatibilità DB.
- Non usare `font-mono` dove serve `font-display` e viceversa.
- Non installare librerie extra senza verificare l'importmap in `index.html`.
- Atelier Visivo: mantenerlo visibile ma `disabled` — non rimuoverlo mai.
- Non usare **rosso** per lo stato `da_fare` — usare slate. Il rosso è riservato ad azioni distruttive (Salta) e messaggi di errore.
- Non aggiungere `rounded-full` ai pulsanti AI — il pattern stabilito è `rounded-lg` outline rettangolare.
- Non togliere il feedback `justSaved` da `EditableField`/`EditableTextarea` — è parte del contratto UX con l'utente (conferma che IndexedDB ha ricevuto il dato).
- Non aggiungere `font-semibold` al `NavItem` attivo — l'accent line viola è l'unico indicatore visivo.
- Non creare un secondo `CLAUDE.md` nella sottocartella — fonte di verità unica: `022_Ada Luna Rossa/CLAUDE.md`.
- Non usare `bg-green-500` nei dot stato — sempre `bg-emerald-500`.
- Non usare `bg-gray-600` nei dot stato speciale — sempre `bg-gray-500`.
- Non mettere `activeWorkspaceTab` dentro `BlockWorkspaceView` — lo stato è in `PlanningView` e passa come prop `activeTab`.
- Non usare `handleModeChange` nel Laboratorio — usare `handlePlanningModeChange` che non inietta messaggi di intro nei thread per-blocco.
- Non aggiungere un tab bar dentro `BlockWorkspaceView` — il toggle `Laboratorio | Contenuto Master` vive nel `BlockNavigator` di `PlanningView`.
- Non ricreare un componente `ModeSelector` a dropdown — il pattern approvato è `ModePills` (pill inline). Il dropdown ha causato problemi cronici di z-index e overflow che non sono stati mai risolti definitivamente.
- Non aggiungere il selettore modalità nell'header — le `ModePills` vivono **solo** nel footer sopra `ChatInput`, sia in `ChatView` che in `BlockWorkspaceView`.
- Non rimuovere `pendingSavesRef` e il relativo `useEffect` in `useConversations.ts` — il "codice ridondante" è il fallback per React 18 che salta eager eval durante lo streaming. Senza, le azioni "Aggiungi in Coda" e "Sostituisci Master" perdono il dato al refresh.
- Non togliere il flush-on-unmount (`pendingContentRef` + `useEffect` cleanup) da `DocumentEditor.tsx` — è l'unica garanzia che l'ultima modifica venga salvata quando l'utente cambia tab prima dei 1.5s di debounce.
- Non rinominare "Trasferisci al Master" in altro — era "Valida Contenuto" fino al 2026-05-22. Il nuovo nome riflette il flusso iterativo: si lavora nel Laboratorio, si trasferisce al Master quando si è pronti, non si "valida" definitivamente.
- Non aggiungere parametri a `usePlanning` oltre a `(updateConversation, showToast)` — la firma è stata semplificata (audit 2026-05-23). `addEvaluationToStudent` e `recordAttendanceForBlock` si chiamano direttamente in `MainApp`, non passano per il hook.
- Non aggiungere `StartReviewPayload` o un `case 'start_review'` nel switch di `usePlanning` — il tipo è stato rimosso (audit 2026-05-23). Il consuntivo si gestisce con un messaggio testuale normale, senza payload strutturato.
- Non aggiungere `// @ts-nocheck` a `services/gemini.ts` — rimosso nell'audit 2026-05-23. Usare `Part[]` dall'SDK (`@google/genai`) per tipizzare i part array.
- Non reintrodurre le Etichette (`labelIds`, `useLabels`, `LabelManagementModal`, `AssignLabelsModal`) — rimosse definitivamente (2026-05-23). La funzione era obsoleta.
- Non ripristinare il widget Disciplina/Corso nella Sidebar — rimosso (2026-05-23). Il profilo del corso è nei Documenti Fondanti.
- Non separare di nuovo "Profilo Docente" da "Profilo del Corso" — unificati in un unico documento, stessa chiave DB `ada-teacher-profile`.
- Non spostare La Rotta o Personalità di Ada dentro i Documenti Fondanti — sono view full-page separate con view id propri (`'la_rotta'`, `'ada_personality'`).
- Non aggiungere auto-save dopo la generazione con "Genera con ADA" — il contenuto generato carica nell'editor ma si salva solo quando il docente modifica (autosave 1.5s). Questo è intenzionale: il docente deve revisionare prima di salvare. Dopo la generazione l'editing si abilita automaticamente ma il DB non viene toccato finché non si digita qualcosa.
- Non riportare il pulsante "Genera con ADA" nell'header di pagina di FoundingDocumentsView o AdaPersonalityView — il suo posto è nell'header interno della card documento (2026-05-23). Stesso vale per il pulsante matita.
- Non usare tab/pannelli a schede in FoundingDocumentsView — il pattern approvato (2026-05-23) è accordion di card collassabili, ognuna con stato indipendente (isOpen, isEditing, isGenerating, generatedContent).
- Non rendere i documenti di Gestione del Corso sempre editabili — devono partire read-only e l'editing si abilita con la matita (pattern approvato 2026-05-23, sia FoundingDocumentsView che AdaPersonalityView).
- Non aggiungere popup di conferma prima di abilitare l'editing dei Documenti Fondanti — il vecchio ConfirmationModal è stato rimosso (2026-05-23). La matita abilita/disabilita editing direttamente.
- Non rinominare `LOCAL_STORAGE_ROUTE_CALENDAR_KEY` — è la chiave DB per il calendario de La Rotta. Cambiare la chiave perderebbe i dati esistenti degli utenti.
- Non aggiungere "Genera con ADA" alla card Contesto Istituzionale — il contenuto viene estratto da NotebookLM dal docente manualmente. Non è un documento generabile da Ada.
- Non mostrare la card Contesto Istituzionale (PTOF) in `isInitialSetup` — è opzionale e fuori dal flusso di onboarding.
- Non spostare `KIT_PROMPTS` dentro il componente — è un array costante definito a livello di modulo in `FoundingDocumentsView.tsx` per evitare ricreazione ad ogni render.
- Non tentare un'integrazione API con NotebookLM — non ha API pubblica. Il pattern approvato è: link al notebook + kit di prompt da copiare manualmente + incolla nell'editor.
- Non centralizzare l'autenticazione Google in un pannello dedicato — NotebookLM si apre nel browser (l'utente è già loggato con l'account scuola Workspace), la Gemini API key è statica, Google Classroom è una feature futura con OAuth separato. Un layer di astrazione finto creerebbe confusione senza semplificare nulla.
- Non usare `parseRouteContext` per derivare `availableWeeks` — la funzione legacy leggeva il testo libero `routeContext`. Usare `routeCalendarToWeekInfos(masterContext.routeCalendar)` che legge il calendario strutturato `WeekEntry[]`.
- Non usare `Write` sui file in `components/handlers/` — sono file esistenti, usare solo `Edit`. Tutti i file handler sono tra 45 e 228 righe e sono stati creati nel refactor 2026-05-25.
- Non usare `useState`, `useEffect`, `useCallback` o altri hook React dentro i file `components/handlers/` — sono funzioni pure factory, non componenti React. Ricevono le deps come argomenti e non possono invocare hook.
- Non passare `setView` direttamente ai factory handler — `setView` ha un union type stretto incompatibile con `(v: string) => void`. Usare sempre il wrapper `setViewFn = useCallback((v: string) => setView(v as any), [])` definito in MainApp.tsx.
- Non spostare `handleSelectConversation` dentro una factory — deve restare in MainApp.tsx come `useCallback` perché è una dipendenza di più factory (conversationHandlers, lessonHandlers, contentHandlers, uiHandlers) e deve esistere prima di esse.
- Non includere i React state setter (`setIsLoading`, `setModalState`, `setPendingSaltaInfo`, ecc.) nelle deps array dei `useMemo` factory — React garantisce che i setter siano referenze stabili, includerli è rumore inutile.
- Non includere i React ref (`conversationsRef`, `latestRequestRef`, `pendingSaltaInfoRef`) nelle deps array dei `useMemo` factory — le ref sono oggetti stabili per definizione.
- Non aggiungere `'formazione scuola-lavoro'` a `BlockStatus` — lo stato del blocco è `'normale' | 'saltato' | 'da definire' | 'annullato'`. FSL si gestisce con `isFslPeriod: boolean` (flag visivo) o come `CourseContentType` nel selettore "Cosa".
- Non aggiungere `uda` o `fsl` a `LessonType` — rimossi (2026-05-24). `LessonType` è il "come" (modalità pedagogica), non il "cosa" (struttura del corso). UDA e FSL sono `CourseContentType`, non tipologie di lezione.
- Non usare `isFslPeriod` per derivare lo stato di progressione del blocco — è un flag ortogonale, non altera `getBlockProgressState` né `getBlockPlanningStatus`.
- Non dimenticare le prop `contentUnits`, `onToggleFslPeriod` quando si passa props a `StrategicDashboardView` — servono per il selettore "Cosa" e il toggle FSL nell'accordion blocco.
- Non limitare il selettore tipologia a un solo componente — `tipologia` (il "come") è selezionabile sia in `StrategicDashboardView` (accordion blocco) che in `BlockWorkspaceView` / `PlanningView` (laboratorio). I due selettori usano lo stesso handler `handleUpdateBlockTipologia` in `MainApp`.
- Non riportare il radar (`DidacticRadarChart`) nell'header di `StrategicDashboardView` — è stato spostato in `GanttView` (2026-05-25) come pannello laterale dedicato. L'header di Progettazione mostra solo i KPI progressStats e i contenuti in sospeso.
- Non reintrodurre il guard `data.length < 3` in `DidacticRadarChart` — rimosso (2026-05-25). Il radar ora usa sempre tutti e 5 gli assi fissi (`ALL_TYPES`), così lo squilibrio è visibile anche con un solo tipo compilato.
- Non ridurre `DidacticRadarChart` alla versione compatta inline — il componente è ora dimensionato per il pannello laterale (`size=130, maxR=50`). Se serve una versione inline futura, creare un componente separato, non modificare questo.
- Non rimuovere il fallback a distribuzione uniforme in `DidacticRadarChart` — quando `idealData` è assente o vuoto, l'ideale è calcolato su 20% per tipo. Questo rende il radar immediatamente utile anche senza dati di modulo.
- Non spostare i `useMemo` `radarData` / `idealRadarData` fuori da `GanttView` in un file handler — li calcola direttamente dalle `conversations` come prop già disponibile. Non aggiungono deps esterne e non appartengono ai factory handler.
- Non rinominare "Analisi del Corso" in "Gantt del Corso" o simili — la view 'gantt' contiene ora sia il Gantt che il Radar, quindi il nome "Gantt del Corso" sarebbe riduttivo (rinominato 2026-05-25).
- Non usare view id `'lezione_in_corso'` o `'archivio_lezioni'` — sostituiti definitivamente da `'lezione'` (Step 3 — 2026-05-27). Qualsiasi `setView('lezione_in_corso')` o `setView('archivio_lezioni')` nel codice è un bug.
- Non ricostruire l'IIFE nel tab In Corso di `InAulaView` — il tab `in_corso` delega completamente a `<LessonInCorsoTab>`. L'IIFE è stato rimosso intenzionalmente.
- Non chiamare `handleSaveLessonNotes` per l'autosave durante la lezione — usare `handleAutoSaveLessonNotes` (silent, senza toast). `handleSaveLessonNotes` con toast è riservato al modal nell'archivio.
- Non usare `handleRecordAttendanceForBlock` (vecchio) per aggiornare le presenze live — usa `handleUpdateLiveAttendance` che gestisce anche `lateStudentIds`. Il vecchio handler aggiorna solo `presentStudentIds` e chiama `recordAttendanceForBlock` (hook per logbook studenti).
- Non confondere `presentStudentIds` con la presenza effettiva — un ritardatario è in **entrambi** `presentStudentIds` e `lateStudentIds`. "Assente" = non in `presentStudentIds`. Non invertire questa logica.
- Non aggiungere `generateGroupSuggestions` (vecchia firma, prende `objective: string`) alla UI del nuovo composer — usare `generateGroupSuggestionWithCriteria(students, criteria, groupSize)` che incorpora i 4 criteri di bilanciamento.
- Non passare `conversations` come prop obbligatoria a `StudentProfileView` — la prop è opzionale (`conversations?: Conversation[]`, default `[]`) per retrocompatibilità con i punti di chiamata che non la passano ancora.
- Non rimuovere la sezione "Monitoraggio Consuntivo" da `ClassroomTrendView` — è la sezione consuntiva usa dati strutturati (presenze, tipologie, engagement) e funziona autonomamente senza generazione AI. Il cruscotto qualitativo legacy (Termometro, Sismografo, Radar crescita, Mappa concetti, Diario di bordo) è stato rimosso definitivamente (2026-05-27).
- Non mettere il Radar consuntivo in `GanttView` — `GanttView` mostra il radar di **progetto** (cosa ho pianificato); `ClassroomTrendView` mostra il radar **consuntivo** (cosa ho effettivamente fatto). Non invertire i due contesti.
- Non aggiungere textarea di input o pulsanti di generazione AI in `ClassroomTrendView` — la sezione MONITORAGGIO è riservata ai cruscotti di sola lettura. Zero funzioni operative. (2026-05-27)
- Non aggiungere il composer "Crea Nuovi Gruppi" in `GroupsArchiveView` — rimosso definitivamente (2026-05-27). La creazione dei gruppi con Ada avviene in `LessonPreparationTab` (Lezione > Preparazione). L'archivio gruppi mostra i gruppi passati e i loro indicatori, senza funzioni operative.
- Non usare "Studentesse" come label — rinominato definitivamente in "Studenti" (2026-05-27). Aggiornare `StudentRosterView`, `Sidebar`, testi UI correlati.
- Non aggiungere `classroomUrl` in altri componenti oltre `LessonPreparationTab` — il campo `classroomUrl?: string` su `BlockDetails` viene salvato tramite `handleSaveClassroomUrl` in `blockNoteHandlers.ts` e mostrato nel tab Preparazione. Il campo si salva `onBlur` (no toast, nessun pulsante separato).
- Non aggiungere il link Classroom in `GroupsArchiveView` né in Toolkit — il punto di ingresso è esclusivamente `LessonPreparationTab`, contestuale alla preparazione della lezione.
- Non reintrodurre "Estratto dalla Costituzione" né "Idea / Prompt per Ada" nell'accordion blocco di `StrategicDashboardView` — rimossi definitivamente (2026-05-28). Il `block.lessonTitle` estratto dal Progetto Didattico vive come contesto silenzioso per Ada, non come campo UI.
- Non unificare `ObjectiveSuggestionModal` e `TitleSuggestionModal` in un unico componente — i due modal hanno scopi opposti (istituzionale vs. accattivante), prompt Gemini diversi e temperature diverse. Tenerli separati è architetturalmente corretto.
- Non usare `block.blockTitle` come base per `getBlockProgressState` — il titolo è un campo presentazione, non semantico. Lo stato dipende da `objective`, `module`, `messages` e `contentBlocks`.
- Non mostrare `block.objective` nell'header del blocco — dall'header si mostra `block.blockTitle || block.objective` (il titolo accattivante, con fallback per retrocompatibilità). L'obiettivo istituzionale vive solo nella sezione espansa.
- Non generare il titolo del blocco (`TitleSuggestionModal`) se `block.objective` è vuoto — il titolo deve essere radicato nell'obiettivo pedagogico, non essere marketing vuoto. Il guard è obbligatorio.
- Non dimenticare `onUpdateBlockTitle` quando si passa props a `StrategicDashboardView` — aggiunta (2026-05-28) insieme a `onUpdateBlockObjective`.
