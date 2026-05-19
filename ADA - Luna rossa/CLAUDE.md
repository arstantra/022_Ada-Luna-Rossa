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

Configurato in `index.html` e nel Tailwind config:

| Classe Tailwind | Font        | Uso |
|-----------------|-------------|-----|
| `font-display`  | **Syne**    | Titoli espressivi, header di sezione |
| `font-sans`     | **DM Sans** | Corpo testo, default app |
| `font-mono`     | **DM Mono** | Label tecnici, codici, date, BL1/BL2 |
| `font-serif`    | **Lora**    | Editor documenti |

**Regola**: usare `font-display` per tutti i titoli principali (settimane, sezioni), `font-mono` per label codice/numero, `font-sans` per tutto il resto.

---

## Design System UI

- **Sfondo app**: `bg-[#0D1117]`
- **Card settimane**: `rounded-xl border border-gray-700/40 bg-gray-800/35`
- **Card blocchi**: `bg-gray-900/30 border border-gray-700/35 rounded-lg`
- **Week info box** (Settimana N + data + dots): `bg-gray-800/60 border border-gray-700/35 rounded-xl px-3.5 py-2.5`
- **Bottoni ghost**: `text-gray-500 hover:text-gray-300 rounded-md hover:bg-gray-800/60`
- **Bottone outline primario**: `border border-blue-500/25 text-blue-400 rounded-lg hover:bg-blue-500/8`
- **Accent line attivo in Sidebar**: `absolute left-0 w-0.5 h-5 rounded-r-full bg-purple-400/80`
- **Label sezione Sidebar**: `text-[9px] font-mono tracking-[0.18em] text-gray-500`
- **Label sezione contenuto**: `text-[9px] font-sans font-medium tracking-[0.14em] uppercase text-gray-500/80`

---

## File Chiave

```
components/
  MainApp.tsx              — orchestratore centrale, routing, tutti gli handler
  Sidebar.tsx              — navigazione, NavItem con disabled prop + accent line
  StrategicDashboardView.tsx — "Progettazione del Corso" (ex Visione d'Insieme)
  InAulaView.tsx           — vista lezione (archivio + in_corso)
  ChatView.tsx             — chat con Ada
  PlanningView.tsx         — laboratorio tattico settimanale
  
hooks/
  useConversations.ts      — stato conversazioni + updateConversation
  useMasterContext.ts      — contesto docente (disciplina, profilo, API key)
  usePlanning.ts           — logica pianificazione blocchi

services/
  db.ts                    — IndexedDB (idb)
  gemini.ts                — wrapper Gemini API

types.ts                   — tutti i tipi (fonte della verità)
constants.ts               — ADA_QUICK_CHAT_ID, chiavi localStorage, ecc.
```

---

## Modello Dati Essenziale

### `Conversation`
```ts
{ id, title, messages: Message[], weekPlan?: WeekPlan, labelIds?, studentId? }
```

### `WeekPlan`
```ts
{ weekNumber, dates, totalBlocks, theme, status, blocks: BlockDetails[], notes?, activeBlockIndex }
```

### `BlockDetails` (campi chiave)
```ts
{
  id, day, status: BlockStatus,        // 'normale'|'saltato'|'formazione scuola-lavoro'|'da definire'|'annullato'
  lessonState?: LessonState,           // 'progettata'|'in_corso'|'archiviata'
  objective?, module?, pillar?,
  lessonTitle?, lessonSyllabus?,       // pianificazione dettagliata
  contentBlocks?: ContentBlock[],      // popolato dopo validazione → stato "Completato"
  messages?: Message[],               // chat del blocco
  isLocked?: boolean
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

Colori: `da_fare`→rosso, `in_corso`→amber, `completato`→emerald, `speciale`→gray.

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

### Navigare a una view specifica
```ts
setView('lezione_in_corso'); // oppure 'archivio_lezioni', 'strategic_dashboard', ecc.
handleSelectConversation(convoId); // per selezionare una conversazione
```

---

## Navigazione / View

```
'lobby'              — schermata iniziale
'chat'               — ChatView (conversazione con Ada)
'planning'           — PlanningView (laboratorio tattico)
'strategic_dashboard'— StrategicDashboardView (Progettazione del Corso)
'lezione_in_corso'   — InAulaView mode='in_corso'
'archivio_lezioni'   — InAulaView mode='archivio'
'students'           — StudentRosterView
'student_profile'    — StudentProfileView
'classroom_trend'    — ClassroomTrendView
'founding_documents' — FoundingDocumentsView
'notebooklm'         — NotebookLMView
'toolkit'            — ToolkitView
'groups_archive'     — GroupsArchiveView
```

---

## Sidebar — Struttura Navigazione

```
[Logo ADA]
─ INSEGNA
  • Progettazione del Corso  (→ strategic_dashboard)
  • In Aula                  (→ archivio_lezioni)
  • Atelier Visivo           (DISABILITATO — badge "API" — attiva solo con API a pagamento)
─ RIFLETTI
  • Classe                   (→ classroom_trend)
  • Studenti                 (→ students)
─ ORGANIZZA
  • Documenti                (→ founding_documents)
  • Notebook                 (→ notebooklm)
  • Kit Didattico            (→ toolkit)
[Conversa con Ada]           — button gradient viola, apre ADA_QUICK_CHAT_ID
```

`NavItem` ha prop `disabled?: boolean` → mostra badge API, `pointer-events-none opacity-50`.

---

## Ciclo di Vita Lezione

```
progettata → in_corso → archiviata
```

- **Avvia Lezione** (`handleAvviaLezione`): setta `lessonState='in_corso'` sul blocco scelto, mette 'progettata' su eventuali altri blocchi in_corso, naviga a `lezione_in_corso`.
- **Chiudi Lezione** (`handleChiudiLezione`): setta `lessonState='archiviata'`, naviga a `archivio_lezioni`.
- Una sola lezione `in_corso` alla volta (garantito da `handleAvviaLezione`).

---

## Cosa NON fare

- Non usare `setConversations` direttamente per aggiornare — usare `updateConversation`.
- Non rimuovere `completionStatus` da `WeekPlan` nel tipo (è ancora nel type per retrocompatibilità DB), ma **non mostrarlo in UI** — lo stato è derivato automaticamente.
- Non aggiungere `font-mono` dove serve `font-display` — rispettare il sistema font.
- Non installare librerie extra senza verificare l'importmap in `index.html`.
- Atelier Visivo: mantenerlo visibile ma `disabled` — non rimuoverlo.

---

## Sessioni Precedenti — Lavoro già fatto

1. `lessonState: LessonState` aggiunto a `BlockDetails` in `types.ts`
2. Sidebar riscritta — nuova struttura, NavItem con accent line attivo, disabled prop
3. Chat unica fissa `ADA_QUICK_CHAT_ID` in MainApp
4. Avvia/Chiudi Lezione — handler completi in MainApp, InAulaView aggiornata
5. `StrategicDashboardView` — stato blocco automatico (dots BL1/BL2, badge espanso), rimosso toggle manuale `completionStatus`, rinominata "Progettazione del Corso"
6. UX refinement Sidebar + StrategicDashboardView — font-display, week info box, gerarchia visiva
7. Atelier Visivo disabilitato con badge API
