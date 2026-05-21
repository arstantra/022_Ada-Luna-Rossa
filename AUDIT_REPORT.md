# Audit Report — ADA Codebase
Data: 2026-05-21

---

## 1. File eliminati

| File | Motivazione |
|------|-------------|
| `components/ModeSelector.tsx` | Zero import nel progetto. Conteneva solo `export { default } from './ModePills'` — alias retrocompatibilità mai referenziato. |
| `desktop.ini` | File di sistema Windows — nessuna rilevanza per il progetto. |

---

## 2. Icone / import inutilizzati rimossi

### Icons.tsx — 6 icone eliminate (zero utilizzi)

| Icona | Note |
|-------|------|
| `BotIcon` | 0 occorrenze fuori da Icons.tsx |
| `CodeIcon` | 0 occorrenze |
| `ArrowRightIcon` | 0 occorrenze |
| `CommandLineIcon` | 0 occorrenze |
| `FileTextIcon` | 0 occorrenze |
| `CalendarIcon` | Importata in `PlanningView.tsx` ma mai usata come JSX; rimossa anche dall'import |

### PlanningView.tsx — import inutilizzato
- Rimosso `CalendarIcon` dalla riga import (unica occorrenza era l'import stesso)

### BlockWorkspaceView.tsx — import inutilizzato
- Rimosso `Message` dai type import (non referenziato nel file)

### PlanningView.tsx — prop inutilizzata
- Rimossa prop `students: Student[]` da `PlanningViewProps`: dichiarata nell'interfaccia ma non destructurata né usata nel corpo del componente
- Rimossa la corrispondente `students={students}` nel JSX di `MainApp.tsx:1415`

### Tipi/costanti/funzioni in types.ts, utils.ts, constants.ts
Nessuna eliminazione necessaria: tutti gli export sono referenziati nel codebase.
- I tipi payload (`UpdateBlockDayPayload`, `ArchiveSimpleStatePayload`, ecc.) sono membri della union `PlanningActionPayload` e gestiti via `switch (action.payload.action)` in `usePlanning.ts`.
- `WeekPlanStatus` è usato come tipo di `WeekPlan.status` dentro `types.ts`.
- Tutte le funzioni di `utils.ts` hanno almeno un riferimento esterno verificato.
- Tutte le costanti di `constants.ts` sono importate da almeno un file.

---

## 3. Violazioni design system corrette

### 3a. Colori dot stato
| File | Riga | Violazione | Correzione |
|------|------|------------|------------|
| `components/ConceptMap.tsx` | 70 | `bg-green-500` (dot legenda "Compreso") | → `bg-emerald-500` |

**Non corretti (contesto diverso, non dot stato):**
- `InAulaView.tsx:443` — `bg-green-500` in badge "Lezione aperta/chiusa": contesto UI distinto (badge condizionale, non dot blocco)
- `ParticipationThermometer.tsx:29` — `bg-green-500` in barra presenza %: colore di chart/progress bar, non dot stato blocco

### 3b. Font
Nessuna violazione trovata. I font `font-display`, `font-sans`, `font-mono`, `font-serif` sono tutti usati nel contesto corretto.

### 3c. Pulsanti
Nessuna violazione `rounded-full` su pulsanti AI trovata (l'unico `rounded-full` con `purple` è un div decorativo in `LobbyView.tsx`).
`NavItem` attivo correttamente senza `font-semibold` — il `font-semibold` in `Sidebar.tsx:217` è sul bottone "Conversa con Ada" (stile fisso, non condizionale sull'active state).

### 3d. Sfondo app
`index.html` usa correttamente `bg-[#0D1117]` sul `<body>`. ✓

---

## 4. Fix TypeScript

| File | Riga (circa) | Vecchio tipo | Nuovo tipo |
|------|--------------|--------------|------------|
| `ConfirmationModal.tsx` | 4 | `interface ConfirmationModalProps` (non esportata) | `export interface ConfirmationModalProps` |
| `Sidebar.tsx` | 13 | `type ActiveView` (locale) | `export type ActiveView` |
| `MainApp.tsx` | 2 | Commento stale `// Fix: Corrected a typo...` | Rimosso |
| `MainApp.tsx` | 3 | import types | Aggiunto `GroundingSource` all'import da `../types` |
| `MainApp.tsx` | import | — | Aggiunto `import type { ActiveView } from './Sidebar'` |
| `MainApp.tsx` | import | — | Aggiunto `import type { ConfirmationModalProps } from './ConfirmationModal'` |
| `MainApp.tsx` | 112 | `useState<any \| null>(null)` | `useState<Omit<ConfirmationModalProps, 'isOpen' \| 'onClose'> \| null>(null)` |
| `MainApp.tsx` | 1351 | `useMemo(() => {...})` (tipo inferito come string) | `useMemo((): ActiveView => {...})` |
| `MainApp.tsx` | 1374 | `activeView={currentView as any}` | `activeView={currentView}` |
| `MainApp.tsx` | 611 | `finalSources: any[]` | `finalSources: GroundingSource[]` |
| `MessageView.tsx` | 25 | `actionPayload?: any` | `actionPayload?: PlanningActionPayload` |
| `MessageView.tsx` | 26 | `onShowConfirmation?: (props: any) => void` | `onShowConfirmation?: (props: Omit<ConfirmationModalProps, 'isOpen' \| 'onClose'>) => void` |
| `PlanningView.tsx` | 107 | `onSendMessage: (...actionPayload?: any)` | `onSendMessage: (...actionPayload?: PlanningActionPayload)` |
| `PlanningView.tsx` | 116 | `onShowConfirmation: (props: any) => void` | `onShowConfirmation: (props: Omit<ConfirmationModalProps, 'isOpen' \| 'onClose'>) => void` |
| `BlockWorkspaceView.tsx` | 21 | `onShowConfirmation: (props: any) => void` | `onShowConfirmation: (props: Omit<ConfirmationModalProps, 'isOpen' \| 'onClose'>) => void` |
| `hooks/usePlanning.ts` | 19 | `masterContext: any` | `masterContext: ReturnType<typeof useMasterContext>` |
| `DocumentEditor.tsx` | 92 | `(item: any)` nel drag handler | `(item: DataTransferItem)` (+ rimosso `typeof item.type === 'string'` ridondante) |

**`any` rimasti intenzionali (non modificati):**
- `hooks/useConversations.ts`, `useLabels.ts`, `useNotebooks.ts`, `useStudents.ts`, `useToolkitShortcuts.ts`: pattern `filter((x: any): x is T =>)` su dati parsed da localStorage — `any` corretto al boundary JSON
- `services/db.ts:99,102`: `value: any` nel settings store — necessario per un generico key-value store
- `services/gemini.ts`: `call.args as any` × 7 — casts necessari perché il Gemini SDK tipizza `FunctionCall.args` come opaque object

---

## 5. Fix React

### 5a. Violazione critica Rules of Hooks — `PlanningView.tsx`
**Problema:** 9 hook (`useMemo` × 3, `useCallback` × 4, `useEffect` × 2) dichiarati dopo due `return` condizionali (`if (!weekPlan) return null` e `if (!Array.isArray(weekPlan.blocks)...) return <error>`), violando la regola che i hook devono essere chiamati nello stesso ordine a ogni render.

**Fix:** Tutti i 9 hook spostati prima del primo `return` condizionale. Aggiornati per gestire `weekPlan === undefined` con optional chaining:
- `activeBlock = useMemo(() => weekPlan?.blocks[weekPlan.activeBlockIndex], ...)`
- `handleBlockSelect` controlla `if (weekPlan && ...)` prima di agire
- `useEffect` per scroll usa `activeBlock?.id` invece di `activeBlock.id`
- I due `return` condizionali ora compaiono dopo tutti i hook, con commento `// --- Conditional returns after all hooks ---`

### 5b. Stale closure — `MainApp.tsx`
Nessuna violazione trovata: i callback che accedono a `conversations` usano già `conversationsRef.current`. ✓

### 5c. `updateConversation` vs `setConversations`
Gli usi di `setConversations` in `MainApp.tsx` sono tutti legittimi:
- Aggiunta di nuove conversazioni all'array (non modifiche a conversazioni esistenti)
- Aggiornamento batch di tutte le conversazioni (sincronizzazione etichette, rimozione etichetta)

### 5d. Cleanup `setTimeout` — aggiunto in 7 file

| File | Contesto |
|------|---------|
| `BlockWorkspaceView.tsx` | `useEffect` scroll auto-bottom (100ms) |
| `ChatView.tsx` | `useEffect` scroll auto-bottom (100ms) |
| `ImportEvaluationModal.tsx` | `useEffect` focus su textarea (100ms) |
| `LessonNotesModal.tsx` | `useEffect` focus su textarea (100ms) |
| `InAulaView.tsx` | `useEffect` focus su input (100ms) |
| `PasswordPromptModal.tsx` | `useEffect` focus su input (100ms) |

### 5e. Key prop nelle liste
Nessun caso critico trovato. I `.map()` con JSX visibili nel codice usano ID stabili come key.

---

## 6. Integrità dati / IndexedDB

### 6a. Schema DB
Nessuna discrepanza trovata tra i tipi in `types.ts` e le operazioni in `services/db.ts`.

### 6b. `completionStatus` in `WeekPlan`
Confermato: campo presente nel tipo (retrocompatibilità DB, con commento esplicativo) ma non renderizzato in nessun componente TSX. ✓

### 6c. `ADA_QUICK_CHAT_ID`
Nessun hardcoding della stringa `'ada-quick-chat'` trovato fuori da `constants.ts`. ✓

---

## 7. Verifica `index.html` e importmap

| Libreria importmap | Utilizzata? |
|--------------------|-------------|
| `react` | ✓ |
| `react-dom/` | ✓ |
| `react/` | ✓ |
| `@google/genai` | ✓ (`services/gemini.ts`) |
| `marked` | ✓ (`DocumentEditor.tsx`, `utils.ts`, `hooks/usePlanning.ts`) |
| `turndown` | ✓ (`MainApp.tsx`, `services/gemini.ts`, `utils.ts`) |
| `idb` | ✓ (`services/db.ts`) |
| `crypto-js` | ✓ (`MainApp.tsx`) |
| `@dnd-kit/core` | ✓ (`ToolkitView.tsx`) |
| `@dnd-kit/sortable` | ✓ (`ShortcutCard.tsx`, `ToolkitView.tsx`) |
| `@dnd-kit/utilities` | ✓ (`ShortcutCard.tsx`, `ToolkitView.tsx`) |

Font Google Fonts e config Tailwind:
| Classe Tailwind | Font | Stato |
|-----------------|------|-------|
| `font-sans` | DM Sans | ✓ |
| `font-display` | Syne | ✓ |
| `font-mono` | DM Mono | ✓ |
| `font-serif` | Lora | ✓ |

---

## 8. Problemi segnalati senza correzione automatica

| # | File | Problema | Azione richiesta |
|---|------|---------|-----------------|
| 1 | `services/gemini.ts:98` | `masterContext: any` — il servizio riceve il masterContext come `any` per evitare un import hook-in-service | Estrarre un'interfaccia `MasterContextData` in `types.ts` e usarla come tipo esplicito |
| 2 | `services/gemini.ts:210,211,247,382,472,520,562,602` | `call.args as any` × 7 — Gemini SDK non espone tipi precisi per i function call args | Accettabile as-is o creare response type per ogni tool function call |
| 3 | `components/DocumentEditor.tsx:68` | `setTimeout(() => setSaveStatus('saved'), 500)` dentro il callback autosave (non in `useEffect`): mancante di cleanup | Basso rischio (500ms, set-state innocuo in React 18+). Fix possibile: aggiungere ref per tracciare e cancellare il timer |
| 4 | `components/MessageView.tsx:38` | `setTimeout(() => setCopied(false), 2000)` dentro `handleCopy` (useCallback, non useEffect): set-state potenzialmente su componente smontato entro 2s | Basso rischio in React 18+. Fix: aggiungere `isMountedRef` o spostare in un useEffect con dipendenza |

---

## 9. Stato finale

**Riepilogo interventi:**
- **2 file eliminati** (ModeSelector.tsx, desktop.ini)
- **6 icone rimosse** da Icons.tsx (BotIcon, CodeIcon, ArrowRightIcon, CommandLineIcon, FileTextIcon, CalendarIcon)
- **1 prop inutilizzata rimossa** (PlanningView `students`)
- **1 import inutilizzato rimosso** (PlanningView `CalendarIcon`, BlockWorkspaceView `Message`)
- **1 violazione colore corretta** (ConceptMap `bg-green-500` → `bg-emerald-500`)
- **1 violazione React hooks critica corretta** (PlanningView: 9 hook ora prima dei return condizionali)
- **7 useEffect con setTimeout ora hanno cleanup** (`return () => clearTimeout(timer)`)
- **10+ usi di `any` tipizzati** correttamente (inclusi `confirmationProps`, `currentView`, `finalSources`, `masterContext` in usePlanning, tutte le prop `onShowConfirmation` e `onSendMessage`, `DataTransferItem`)
- **2 tipi esportati** per consentire il typing cross-file (ConfirmationModalProps, ActiveView)
- **4 problemi aperti** che richiedono decisione umana (tutti a basso rischio runtime)

**Salute del codebase:** buona. La violazione critica React hooks in PlanningView era il problema più grave (potenziale "rendered more hooks than previous render" se weekPlan diventava undefined dopo un render con dati validi). Tutti i `any` eliminabili senza refactoring architetturale sono stati tipizzati. Il codebase è ora pulito da file morti, import inutilizzati e zavorra di debug.
