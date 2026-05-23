# ADA — Contesto di Progetto per Claude

> Leggi questo file all'inizio di ogni sessione. Contiene tutto il necessario per lavorare su ADA senza dover rileggere il codice da zero.

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
| `speciale` | `bg-gray-500` | `text-gray-500/80` | saltato · fsl · annullato |

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
  MainApp.tsx                — orchestratore centrale, routing, tutti gli handler
  Sidebar.tsx                — navigazione, NavItem + CollapsibleSectionLabel + CollapsibleSection + accent line
  StrategicDashboardView.tsx — "Progettazione del Corso": settimane, blocchi, progressStats
  InAulaView.tsx             — vista lezione (archivio + in_corso)
  ChatView.tsx               — chat con Ada
  PlanningView.tsx           — laboratorio tattico settimanale (vedi sezione dedicata)
  BlockWorkspaceView.tsx     — workspace per-blocco: laboratorio AI + contenuto master
  FoundingDocumentsView.tsx  — Documenti Fondanti (full-page): Profilo del Corso, Progetto Didattico, Patto Formativo, Equipaggio — tutti in modalità html con DocumentEditor; pulsante "Genera con ADA" per Progetto Didattico e Patto Formativo
  AdaPersonalityView.tsx     — Personalità di Ada (full-page): editor html delle istruzioni di sistema con pulsante "Genera con ADA"
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
  gemini.ts                  — wrapper Gemini API; include generateDocumentContent(docType, teacherProfile) per generare Progetto Didattico, Patto Formativo, Personalità di Ada a partire dal Profilo del Corso

types.ts                     — tutti i tipi (fonte della verità)
constants.ts                 — ADA_QUICK_CHAT_ID, MODES, chiavi localStorage, LOCAL_STORAGE_ROUTE_CALENDAR_KEY, ecc.
utils.ts                     — getBlockPlanningStatus, getExactDateForBlock, ecc.
```

> **File orfani (non importati, non rimuovere con rm — solo dead code):**
> `LabelManagementModal.tsx`, `AssignLabelsModal.tsx`, `BlockDayDefaultsModal.tsx`, `MasterContextModal.tsx`, `hooks/useLabels.ts`

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
  id, day, status: BlockStatus,     // 'normale'|'saltato'|'formazione scuola-lavoro'|'da definire'|'annullato'
  lessonState?: LessonState,        // 'progettata'|'in_corso'|'archiviata'
  objective?, module?, pillar?,
  lessonTitle?, lessonSyllabus?,    // pianificazione dettagliata
  contentBlocks?: ContentBlock[],   // popolato dopo "Trasferisci al Master" → stato "completato"
  messages?: Message[],
  isLocked?: boolean,
  isReviewed?: boolean,             // override: forza dot emerald indipendentemente dallo stato
  reason?: string                   // motivo per blocchi 'saltato'
}
```

### Stato automatico blocco (derivato, non salvato)
```ts
const getBlockProgressState = (block): 'da_fare'|'in_corso'|'completato'|'speciale' => {
  if (status === 'saltato'|'formazione scuola-lavoro'|'annullato') return 'speciale';
  if (contentBlocks?.length > 0) return 'completato';
  if (objective?.trim() || module?.trim() || messages?.length > 0) return 'in_corso';
  return 'da_fare';
}
```

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

---

## Navigazione / View

```
'lobby'               — schermata iniziale
'chat'                — ChatView (conversazione con Ada)
'planning'            — PlanningView (laboratorio tattico)
'strategic_dashboard' — StrategicDashboardView (Progettazione del Corso)
'lezione_in_corso'    — InAulaView mode='in_corso'
'archivio_lezioni'    — InAulaView mode='archivio'
'students'            — StudentRosterView
'student_profile'     — StudentProfileView
'classroom_trend'     — ClassroomTrendView
'founding_documents'  — FoundingDocumentsView (Documenti Fondanti)
'la_rotta'            — RouteView (La Rotta — calendario settimane e giorni blocchi)
'ada_personality'     — AdaPersonalityView (Personalità di Ada — istruzioni di sistema)
'notebooklm'          — NotebookLMView
'toolkit'             — ToolkitView
'groups_archive'      — GroupsArchiveView
'gantt'               — GanttView (Gantt del Corso)
```

---

## Sidebar — Struttura Navigazione Attuale

Tutte le sezioni principali usano `CollapsibleSectionLabel` (cliccabile, chevron, stile monospace) + `CollapsibleContent`. Stato default: CONTENUTI, IN AULA, MONITORAGGIO aperte; GESTIONE chiusa.

```
[Conversa con Ada]  — button gradient viola (nessun sottotitolo disciplina — rimosso)

▾ CONTENUTI DEL CORSO          (CollapsibleSectionLabel, default: aperta)
  • Progettazione del Corso        (→ strategic_dashboard)
  • Gantt del Corso                (→ gantt)
  • Laboratori e Strumenti ▾       (CollapsibleSection con icona, sotto-livello)
      ↳ Toolkit                    (→ toolkit)
      ↳ Atelier Visivo             (DISABILITATO — badge "API")

▾ IN AULA                      (CollapsibleSectionLabel, default: aperta)
  • Lezione in Corso               (→ lezione_in_corso, badge verde se attiva)
  • Archivio Lezioni               (→ archivio_lezioni)
  • I Miei Notebook                (→ notebooklm)

▾ MONITORAGGIO                 (CollapsibleSectionLabel, default: aperta)
  • Andamento Aula                 (→ classroom_trend)
  • Gruppi                         (→ groups_archive)
  • Studentesse                    (→ students / student_profile)

▾ GESTIONE DEL CORSO           (CollapsibleSectionLabel, default: chiusa)
  • Documenti Fondanti             (→ founding_documents)
  • La Rotta                       (→ la_rotta)
  • Personalità di Ada             (→ ada_personality)
  • Backup, API Key
```

> **Rimosso definitivamente**: widget Disciplina/Corso in sidebar, NavItem "Etichette", NavItem "Profilo Docente" (inglobato in Profilo del Corso nei Documenti Fondanti).

`NavItem` ha prop `disabled?: boolean` → badge "API", `opacity-30 cursor-not-allowed`.

---

## Ciclo di Vita Lezione

```
progettata → in_corso → archiviata
```

- **Avvia Lezione** (`handleAvviaLezione`): `lessonState='in_corso'` sul blocco, 'progettata' sugli altri eventuali in_corso, naviga a `lezione_in_corso`.
- **Chiudi Lezione** (`handleChiudiLezione`): `lessonState='archiviata'`, naviga a `archivio_lezioni`.
- Una sola lezione `in_corso` alla volta.

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
- Non aggiungere auto-save dopo la generazione con "Genera con ADA" — il contenuto generato carica nell'editor ma si salva solo quando il docente modifica (autosave) o esplicitamente. Questo è intenzionale: il docente deve revisionare prima di salvare.
- Non rinominare `LOCAL_STORAGE_ROUTE_CALENDAR_KEY` — è la chiave DB per il calendario de La Rotta. Cambiare la chiave perderebbe i dati esistenti degli utenti.
