# Audit Report — ADA Luna Rossa
Data: 2026-05-24

---

## 1. File Eliminati

Nessun file eliminato direttamente (vedi sezione 6 per i motivi).

Il file `desktop.ini` (file di sistema Windows, riga 1: `[.ShellClassInfo]`) richiede autorizzazione PowerShell/shell non disponibile in questo audit — eliminazione manuale richiesta:
```
C:\...\022_Ada Luna Rossa\desktop.ini
```

---

## 2. Icone / Tipi / Costanti / Funzioni Rimosse

### 2a. Icone rimosse da `components/Icons.tsx`

| Icona | Motivo |
|-------|--------|
| `TagIcon` (riga 113-118) | Zero utilizzi nel progetto. Rimossa. |

### 2b. Import inutilizzati rimossi

| File | Import rimosso | Motivo |
|------|---------------|--------|
| `components/MainApp.tsx` (riga 55) | `import GroupWorkSummary from './GroupWorkSummary'` | Componente mai usato nel file (solo in `InAulaView.tsx`) |

### 2c. Tipi non rimossi (volutamente)

Tutti i tipi in `types.ts` risultano referenziati. Nessuna rimozione eseguita.

In particolare, confermati come attivi:
- `CourseContentType`, `CourseContentUnit`, `ParsedConstitution.contentUnits` — usati in `constitutionParser.ts`, `StrategicDashboardView.tsx`, `constants.ts`
- `BlockDetails.isFslPeriod` — usato in `StrategicDashboardView.tsx`, `usePlanning.ts`, `gemini.ts`
- `completionStatus` in `WeekPlan` — mantenuto per retrocompatibilità DB, non renderizzato in UI (conforme alla spec)

### 2d. Costanti e funzioni

| Costante/Funzione | File | Stato |
|-------------------|------|-------|
| `APP_CONFIG.PASSWORD` | `config.ts` | **Zero import nel codebase.** Potenziale dead code. Non eliminato (credenziale potenzialmente intenzionale — richiede decisione umana) |
| `AUTO_LABELS` | `constants.ts` | Usato solo in `hooks/useLabels.ts` (file orfano) — dead code transitivo |
| `LABEL_COLORS` | `constants.ts` | Usato solo in file orfani (`LabelManagementModal`, `AssignLabelsModal`) — dead code transitivo |
| `parseRouteContext` | `utils.ts` | Non importato da nessun file attivo — dead code (usava il vecchio `routeContext` testuale) |
| `LOCAL_STORAGE_ROUTE_KEY` | `constants.ts` | Ancora usato in `useMasterContext.ts` per compatibilità DB — mantenuto |

`parseRouteContext` in `utils.ts` è esportata ma non importata da nessun file attivo del progetto. Non rimossa (è una funzione di parsing autonoma senza side effects; potrebbe servire per tool esterni). Segnalata come dead code.

---

## 3. Violazioni Design System Corrette

### 3a. Colori stato dot — `bg-green-500`

| File | Riga | Correzione |
|------|------|-----------|
| `components/InAulaView.tsx` | 440 | `bg-green-500` → `bg-emerald-600` (badge "Apri Lezione") |
| `components/ParticipationThermometer.tsx` | 29 | `bg-green-500` → `bg-emerald-500` (barra presenza > 80%) |

### 3b. Colori dot stato — `bg-gray-600` nei dot

Nessuna violazione trovata. Tutte le occorrenze di `bg-gray-600` nel progetto sono separatori UI, pulsanti generici o hover state — non dot di stato blocco. I dot speciali usano già `bg-gray-500`.

### 3c. Font

Nessuna violazione trovata. Il sistema font è coerente:
- `font-display` su titoli principali (ChatView, PlanningView, GanttView, StrategicDashboardView, AppHeader)
- `font-mono` su label tecnici, date, sezioni sidebar (conforme alla spec)
- `font-sans` implicito sul corpo testo

### 3d. Pulsanti AI con `rounded-full`

Nessuna violazione trovata. I pulsanti AI outline usano `rounded-lg` come da spec. Le uniche `rounded-full` sono su:
- Pill `ModePills` (corretto per design — pill hanno esplicitamente `rounded-full` nella spec)
- Icone circolari (X, close button) — non pulsanti AI
- Dot di stato e decorazioni grafiche

### 3e. NavItem attivo con `font-semibold`

Nessuna violazione. `Sidebar.tsx` riga 129: NavItem attivo usa solo `bg-gray-700/70 text-white` senza `font-semibold`.

### 3f. Sfondo app

Conforme. `index.html` riga 261: `<body class="bg-[#0D1117]">`. Nessuna variante non standard trovata.

---

## 4. Fix TypeScript

### 4a. `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`

Nessuna occorrenza trovata. Il codebase è pulito.

### 4b. `any` espliciti

I seguenti usi di `any` sono stati mantenuti perché sono tutti pattern di validazione runtime su dati provenienti da IndexedDB (dati deserializzati da JSON che potrebbero essere malformati):

| File | Riga | Contesto |
|------|------|---------|
| `hooks/useConversations.ts` | 43 | `filter((c: any): c is Conversation` — runtime guard |
| `hooks/useLabels.ts` | 20 | `filter((l: any): c is Label` — runtime guard (file orfano) |
| `hooks/useToolkitShortcuts.ts` | 19 | `filter((s: any): c is ToolkitShortcut` — runtime guard |
| `hooks/useNotebooks.ts` | 14 | `filter((n: any): c is Notebook` — runtime guard |
| `hooks/useStudents.ts` | 21 | `(s: any): s is Student` — runtime guard |
| `services/db.ts` | 103, 106, 122 | Signature `getAllSettings` e `putPromises` — accettabile per le API generiche IndexedDB |

Pattern accettabile — è la forma idiomatica TypeScript per type guard su dati deserializzati.

### 4c. Tipi opzionali vs undefined

Nessuna violazione critica trovata. I file principali usano `?.` in modo coerente su `block`, `weekPlan` e `conversation`.

### 4d. `BlockStatus` — consistenza

`BlockStatus = 'normale' | 'saltato' | 'da definire' | 'annullato'` in `types.ts`.
`getBlockProgressState` in `StrategicDashboardView.tsx` e `getBlockPlanningStatus` in `utils.ts` gestiscono esattamente questi 4 valori. Coerente.

---

## 5. Fix React

### 5a. Hooks prima dei return condizionali

Verifica eseguita su tutti i componenti principali:
- `BlockWorkspaceView.tsx` — tutti gli hook prima di qualsiasi return condizionale ✓
- `PlanningView.tsx` — commento esplicito `// --- Conditional returns after all hooks ---` a riga 266 ✓
- `InAulaView.tsx` — hook dichiarati all'inizio del componente ✓
- `StrategicDashboardView.tsx` — struttura corretta ✓

Nessuna violazione trovata.

### 5b. Stale closure nei callback

I callback in `MainApp.tsx` che accedono a conversazioni usano `conversationsRef.current` (es. riga 622, 197). Pattern corretto.

I 3 usi diretti di `setConversations` in `MainApp.tsx` (righe 197, 630, 1053) sono **creazione** di nuove conversazioni, non aggiornamenti — non violano la regola "usare `updateConversation`".

### 5c. `updateConversation` vs `setConversations`

Nessuna violazione del pattern. Gli usi di `setConversations` fuori da `useConversations.ts` sono tutti casi legittimi di creazione diretta.

### 5d. Cleanup degli effect con setTimeout

Verifica eseguita:
- `Toast.tsx` — clearTimeout nel return ✓
- `ChatView.tsx` — clearTimeout nel return ✓
- `BlockWorkspaceView.tsx` — clearTimeout nel return ✓
- `StudentProfileView.tsx` — clearTimeout nel return ✓
- `GroupWorkSummary.tsx` — clearTimeout nel return ✓
- `InAulaView.tsx` — clearTimeout nel return ✓
- `MainApp.tsx` (planningTimeoutId) — clearTimeout in `finally` block ✓

I `setTimeout` in callback imperativi (MessageView.tsx copy feedback, FoundingDocumentsView.tsx copy prompt) non richiedono cleanup useEffect.

### 5e. Key prop nelle liste

| File | Riga | Correzione |
|------|------|-----------|
| `components/InAulaView.tsx` | 357 | `key={index}` → `key={\`artifact-${artifact}-${index}\`}` |

`MessageView.tsx` riga 83 (`key={index}` su immagini generate): l'array di immagini è immutabile per il messaggio a cui appartiene — non riordinabile. Lasciato invariato.

`BlockDayDefaultsModal.tsx` riga 67 (`key={index}` su blocchi): file orfano — non corretto.

---

## 6. Problemi Segnalati Senza Correzione Automatica

Questi elementi richiedono decisione umana:

### 6a. File `desktop.ini` da eliminare manualmente
```
C:\...\022_Ada Luna Rossa\desktop.ini
```
File di sistema Windows (OneDrive icon info). Non contiene codice. Eliminare con:
```powershell
Remove-Item -Path "...\desktop.ini" -Force
```

### 6b. File orfani (già documentati in CLAUDE.md)

Questi file esistono nel progetto ma non sono importati da nessun file attivo. La specifica CLAUDE.md li nomina esplicitamente come dead code e ordina di non eliminarli con `rm`. Confermati come orfani:

| File | Note |
|------|------|
| `components/LabelManagementModal.tsx` | Feature Etichette rimossa |
| `components/AssignLabelsModal.tsx` | Feature Etichette rimossa |
| `components/BlockDayDefaultsModal.tsx` | Superseded da RouteView |
| `components/MasterContextModal.tsx` | Zero import nel progetto |
| `hooks/useLabels.ts` | Feature Etichette rimossa |

### 6c. `APP_CONFIG` in `config.ts`

`export const APP_CONFIG = { PASSWORD: 'Pupazzo.001' }` — non importato da nessun file del progetto. Potenziale credenziale hardcoded. Valutare se:
- Eliminare il file `config.ts` (se la password non è più usata)
- O usarlo nel codice di backup (`PasswordPromptModal`) invece di raccogliere la password dall'utente

### 6d. `parseRouteContext` in `utils.ts`

Funzione esportata ma non importata da nessun file attivo. Era usata per il vecchio `routeContext` testuale. Candidata alla rimozione (ma non eliminata perché potenzialmente usata da script/tool esterni non analizzati).

### 6e. `AUTO_LABELS` e `LABEL_COLORS` in `constants.ts`

Usati solo dai file orfani della feature Etichette. Dead code transitivo. Se i file orfani venissero eliminati, anche queste costanti diventerebbero eliminabili.

### 6f. Import `GroupWorkSummary` doppio in MainApp.tsx

Corretto in questo audit (rimosso l'import inutilizzato alla riga 55). Il componente rimane attivo e usato da `InAulaView.tsx`.

### 6g. `metadata.json`

File di configurazione AI Studio (`requestFramePermissions`, `majorCapabilities`). Non referenziato nel codice TypeScript ma potenzialmente necessario per la piattaforma di deployment. Non eliminato.

### 6h. `TASK_cosa_come_refactor.md`

File di task documentazione presente nella root del progetto. Non è codice, non impatta il runtime. Da valutare se mantenere o archiviare.

---

## 7. Importmap e Font (Fase 8)

### Librerie importmap — tutte usate

| Libreria | Usata in |
|----------|---------|
| `react`, `react-dom` | Tutti i componenti |
| `@google/genai` | `services/gemini.ts` |
| `marked` | `utils.ts` (generateCourseBookHtml, generateExportContent) |
| `turndown` | `utils.ts` + `components/handlers/contentHandlers.ts` *(post-split 2026-05-25)* |
| `idb` | `services/db.ts` |
| `crypto-js` | `components/handlers/dataHandlers.ts` *(post-split 2026-05-25)* |
| `@dnd-kit/core` | `components/ToolkitView.tsx` |
| `@dnd-kit/sortable` | `components/ToolkitView.tsx` |
| `@dnd-kit/utilities` | `components/ToolkitView.tsx`, `components/ShortcutCard.tsx` |

### Font Google Fonts — corrispondenza Tailwind

| Font caricato | Classe Tailwind | Mapping in `index.html` | Stato |
|--------------|-----------------|------------------------|-------|
| `Syne` | `font-display` | `display: ['Syne', 'sans-serif']` | ✓ |
| `DM Sans` | `font-sans` | `sans: ['DM Sans', 'sans-serif']` | ✓ |
| `DM Mono` | `font-mono` | `mono: ['DM Mono', 'monospace']` | ✓ |
| `Lora` | `font-serif` | `serif: ['Lora', 'serif']` | ✓ |

Tutti i font corrispondono correttamente.

---

## 8. Stato Finale — Stima Qualitativa della Salute del Codebase

**Salute generale: BUONA (7.5/10)**

### Punti di forza
- Architettura chiara e ben documentata in CLAUDE.md
- Separazione netta tra tipi, hook, servizi e componenti
- Pattern critici (`pendingSavesRef`, flush-on-unmount, stale closure) già presenti e documentati
- Nessun `@ts-ignore`, nessun `@ts-nocheck`, nessun console.log di debug
- Sistema di stato blocco coerente (due sistemi paralleli con colori canonici allineati)
- Import map e font 100% in ordine

### Aree di miglioramento (non bloccanti)
1. **File orfani documentati ma presenti** — 5 file nella lista CLAUDE.md, non eliminati per policy. Occupano ~1.5K righe di codice morto.
2. **`parseRouteContext` in utils.ts** — funzione legacy non più usata dall'app
3. **`APP_CONFIG` in config.ts** — costante con password hardcoded, non referenziata
4. **Dead code transitivo** (`AUTO_LABELS`, `LABEL_COLORS`) — sopravvivono per i file orfani della feature Etichette

### Modifiche applicate in questo audit
1. Rimosso import inutilizzato `GroupWorkSummary` da `MainApp.tsx`
2. Rimossa icona `TagIcon` da `Icons.tsx` (zero utilizzi)
3. Corretto `bg-green-500` → `bg-emerald-600` in `InAulaView.tsx` (badge "Apri Lezione")
4. Corretto `bg-green-500` → `bg-emerald-500` in `ParticipationThermometer.tsx`
5. Migliorato `key={index}` → `key={\`artifact-${artifact}-${index}\`}` in `InAulaView.tsx`
