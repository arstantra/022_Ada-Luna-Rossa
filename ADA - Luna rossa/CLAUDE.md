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
- **Label sezione**: `text-[9px] font-mono tracking-[0.14em] uppercase text-gray-400/80`
- **NavItem non-attivo**: `text-gray-300 hover:bg-gray-800/60 hover:text-white`
- **NavItem attivo**: `bg-gray-700/70 text-white font-semibold`
- **Label sezione contenuto**: `text-[9px] font-sans font-medium tracking-[0.14em] uppercase text-gray-500/80`

### Stato blocco — colori (DOT_CONFIG / BADGE_CONFIG)
| Stato | Dot | Badge testo |
|-------|-----|-------------|
| `da_fare` | `bg-slate-500` | `text-slate-400` — neutro, non allarmante |
| `in_corso` | `bg-amber-400` | `text-amber-400` |
| `completato` | `bg-emerald-500` | `text-emerald-400` |
| `speciale` | `bg-gray-500` | `text-gray-500` |

> **IMPORTANTE**: `da_fare` usa **slate/neutro**, NON rosso. Il rosso era ansiogeno per blocchi semplicemente non ancora iniziati.

---

## File Chiave

```
components/
  MainApp.tsx                — orchestratore centrale, routing, tutti gli handler
  Sidebar.tsx                — navigazione, NavItem + CollapsibleSection + accent line
  StrategicDashboardView.tsx — "Progettazione del Corso": settimane, blocchi, progressStats
  InAulaView.tsx             — vista lezione (archivio + in_corso)
  ChatView.tsx               — chat con Ada
  PlanningView.tsx           — laboratorio tattico settimanale
  EditableField.tsx          — input inline con feedback salvataggio (bordo verde 1.5s)
  EditableTextarea.tsx       — textarea inline con feedback salvataggio (bordo verde 1.5s)

hooks/
  useConversations.ts        — stato conversazioni + updateConversation
  useMasterContext.ts        — contesto docente (disciplina, profilo, API key)
  usePlanning.ts             — logica pianificazione blocchi

services/
  db.ts                      — IndexedDB (idb)
  gemini.ts                  — wrapper Gemini API

types.ts                     — tutti i tipi (fonte della verità)
constants.ts                 — ADA_QUICK_CHAT_ID, chiavi localStorage, ecc.
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
// completionStatus: ancora nel tipo per retrocompatibilità DB — NON mostrarlo in UI
```

### `BlockDetails` (campi chiave)
```ts
{
  id, day, status: BlockStatus,     // 'normale'|'saltato'|'formazione scuola-lavoro'|'da definire'|'annullato'
  lessonState?: LessonState,        // 'progettata'|'in_corso'|'archiviata'
  objective?, module?, pillar?,
  lessonTitle?, lessonSyllabus?,    // pianificazione dettagliata
  contentBlocks?: ContentBlock[],   // popolato dopo validazione → stato "completato"
  messages?: Message[],
  isLocked?: boolean,
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
'founding_documents'  — FoundingDocumentsView
'notebooklm'          — NotebookLMView
'toolkit'             — ToolkitView
'groups_archive'      — GroupsArchiveView
```

---

## Sidebar — Struttura Navigazione Attuale

```
[Conversa con Ada]  — button gradient viola, mostra disciplina come sottotitolo font-mono
─ CONTENUTI DEL CORSO
  • Progettazione del Corso        (→ strategic_dashboard)
  • Laboratori e Strumenti ▾       (CollapsibleSection)
      ↳ Toolkit                    (→ toolkit)
      ↳ Atelier Visivo             (DISABILITATO — badge "API")
─ IN AULA
  • Lezione in Corso               (→ lezione_in_corso, badge verde se attiva)
  • Archivio Lezioni               (→ archivio_lezioni)
  • I Miei Notebook                (→ notebooklm)
─ MONITORAGGIO
  • Andamento Aula                 (→ classroom_trend)
  • Gruppi                         (→ groups_archive)
  • Studentesse                    (→ students / student_profile)
─ Gestione del Corso ▾             (CollapsibleSection, in fondo)
    ↳ Disciplina, Documenti Fondanti, Profilo Docente,
      Personalità di Ada, Etichette, Backup, API Key
```

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
