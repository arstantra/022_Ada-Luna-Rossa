# ADA — Steps di Implementazione

> Istruzioni tecniche per Claude Code. Da eseguire in ordine sequenziale.
> Prima di iniziare qualsiasi step: leggi `CLAUDE.md` e `ADA_VISIONE_FONDANTE.md`.
> Esegui un solo step per sessione. Non anticipare step successivi.

---

## Come usare questo documento

Apri Claude Code e inizia ogni sessione con:

```
Leggi CLAUDE.md e ADA_VISIONE_FONDANTE.md, poi esegui lo Step N di ADA_STEPS_IMPLEMENTAZIONE.md
```

---

## Step 1 — Fondamenta del tipo `LessonType` ✅ COMPLETATO (2026-05-23)

**Obiettivo**: introdurre il tipo `LessonType` e il campo `tipologia` su `BlockDetails`. Nessuna UI, nessuna migrazione — solo le fondamenta nel tipo dati. Rischio zero.

**File da toccare**: `types.ts`, `constants.ts`

### Istruzioni

**In `types.ts`:**

1. Aggiungere il tipo `LessonType` come union string:
```ts
export type LessonType =
  | 'frontale_teorica'
  | 'frontale_operativa'
  | 'laboratorio'
  | 'verifica'
  | 'discussione'
  | 'uda'
  | 'fsl';
```

2. Aggiungere il campo `tipologia` a `BlockDetails`, opzionale per retrocompatibilità:
```ts
tipologia?: LessonType;
```

Il campo `pillar?: string` rimane per ora — verrà rimosso nello Step 2.

**In `constants.ts`:**

3. Aggiungere le label leggibili per ogni tipologia:
```ts
export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  frontale_teorica:    'Frontale teorica',
  frontale_operativa:  'Frontale operativa',
  laboratorio:         'Laboratorio',
  verifica:            'Verifica',
  discussione:         'Discussione',
  uda:                 'UDA',
  fsl:                 'FSL',
};
```

### Verifica
- Il progetto compila senza errori TypeScript
- Nessun comportamento dell'app cambia — lo step è puramente additivo

---

## Step 2 — FSL da stato a tipologia + rimozione Pilastri ✅ COMPLETATO (2026-05-23)

**Obiettivo**: rimuovere `'formazione scuola-lavoro'` da `BlockStatus`, rimuovere il campo `pillar`, aggiornare tutta la logica che dipende da questi due elementi. È il refactoring più trasversale — va eseguito in un colpo solo e verificato con attenzione.

**File da toccare**: `types.ts`, `utils.ts`, `constants.ts`, `components/StrategicDashboardView.tsx`, `components/MainApp.tsx`, `components/Sidebar.tsx`, `components/PlanningView.tsx`, `components/BlockWorkspaceView.tsx` — e qualsiasi altro file che contiene la stringa `'formazione scuola-lavoro'` o `pillar`. **Fare prima un grep completo** per trovare tutte le occorrenze prima di modificare.

### Istruzioni

**In `types.ts`:**

1. Rimuovere `'formazione scuola-lavoro'` da `BlockStatus`:
```ts
// PRIMA
export type BlockStatus = 'normale' | 'saltato' | 'formazione scuola-lavoro' | 'da definire' | 'annullato';

// DOPO
export type BlockStatus = 'normale' | 'saltato' | 'da definire' | 'annullato';
```

2. Rimuovere il campo `pillar?: string` da `BlockDetails`.

**In `utils.ts`:**

3. In `getBlockPlanningStatus`: rimuovere qualsiasi ramo che controlla `block.status === 'formazione scuola-lavoro'`. I blocchi FSL ora hanno `status: 'normale'` e `tipologia: 'fsl'` — trattarli come blocchi normali nel calcolo dello stato.

4. Se esiste logica che usa `block.pillar`, rimuoverla.

**In `components/StrategicDashboardView.tsx`:**

5. In `getBlockProgressState`: rimuovere `'formazione scuola-lavoro'` dal ramo `speciale`. Un blocco con `tipologia: 'fsl'` non è automaticamente "speciale" — è un blocco normale con una tipologia particolare.

**In tutti gli altri file:**

6. Cercare e rimuovere ogni riferimento a `'formazione scuola-lavoro'` (pulsanti, badge, condizioni, label).
7. Cercare e rimuovere ogni riferimento a `block.pillar` o `pillar` come campo.

**Migrazione dati esistenti (IndexedDB):**

8. In `services/db.ts` o in `MainApp.tsx` al caricamento iniziale, aggiungere una migrazione one-shot: per ogni blocco con `status === 'formazione scuola-lavoro'`, impostare `status = 'normale'` e `tipologia = 'fsl'`. Usare il pattern `updateConversation` — mai `setConversations` diretto.

```ts
// Esempio di migrazione al boot in MainApp.tsx
conversations.forEach(conv => {
  if (!conv.weekPlan) return;
  const hasFsl = conv.weekPlan.blocks.some(b => (b.status as string) === 'formazione scuola-lavoro');
  if (!hasFsl) return;
  updateConversation(conv.id, c => ({
    ...c,
    weekPlan: c.weekPlan ? {
      ...c.weekPlan,
      blocks: c.weekPlan.blocks.map(b =>
        (b.status as string) === 'formazione scuola-lavoro'
          ? { ...b, status: 'normale' as BlockStatus, tipologia: 'fsl' as LessonType }
          : b
      )
    } : undefined
  }));
});
```

### Verifica
- Nessun errore TypeScript
- I blocchi precedentemente FSL appaiono nell'app senza crash
- Il dot colore dei blocchi FSL non è più `bg-sky-500` (quel colore era riservato allo stato FSL — ora FSL è una tipologia, non uno stato, quindi non ha più un colore dot dedicato salvo scelta esplicita)
- Nessun pulsante o badge "FSL" appare ancora come azione separata

---

## Step 3 — UI Tipologia di lezione ✅ COMPLETATO (2026-05-23)

**Obiettivo**: rendere visibile e modificabile la `tipologia` in `BlockWorkspaceView`. Aggiungere un selettore compatto, rimuovere qualsiasi residuo UI di Pilastri e FSL come azione separata.

**File da toccare**: `components/BlockWorkspaceView.tsx`, `components/PlanningView.tsx`, eventuali componenti di visualizzazione blocco in `StrategicDashboardView.tsx`

### Istruzioni

1. **Creare un componente `TipologiaSelector`** (inline in `BlockWorkspaceView.tsx` o file separato `components/TipologiaSelector.tsx`):
   - Una riga di pill cliccabili, una per tipologia
   - Stile coerente con `ModePills`: ultra-compatto, `text-[10px] font-mono rounded-full px-2 py-0.5`
   - Pill attiva: colore leggero che distingue la tipologia (usare classi Tailwind esistenti — non inventare nuovi colori)
   - Pill inattiva: `text-gray-600 hover:text-gray-400`
   - Al clic: chiama `onUpdateBlock` con il nuovo valore `tipologia`

2. **Posizionamento**: nella sezione header del blocco in `BlockWorkspaceView`, vicino al campo obiettivo — non nel footer, non nei ModePills.

3. **Mostrare la tipologia** anche nella card blocco in `StrategicDashboardView` come piccola label `font-mono` se `tipologia` è valorizzata, in modo neutro (testo grigio, nessun colore aggiuntivo).

4. **Rimuovere** qualsiasi campo `pillar` rimasto nell'UI (input, label, visualizzazione).

### Regole di stile da rispettare
- `font-mono` per le label tipologia — segue il pattern delle sezioni sidebar e dei label tecnici
- Nessun `rounded-full` sui pulsanti di azione — ma le pill tipologia sono pill informative, quindi `rounded-full` è corretto
- Non aggiungere un colore dot dedicato per ogni tipologia nella StrategicDashboard — il dot rimane quello dello stato del blocco (emerald/amber/slate/gray)

### Verifica
- Si può selezionare la tipologia di un blocco e il dato viene salvato su IndexedDB
- Cambiare blocco e tornare: la tipologia è persistita
- Nessun crash se `tipologia` è `undefined` (campo opzionale)

---

## Step 4 — Coda dei contenuti (workflow "Salta lezione") ✅ COMPLETATO (2026-05-23)

**Obiettivo**: quando si salta un blocco che ha già contenuto pianificato, il contenuto non va perso ma finisce in una coda. Il docente decide cosa farne.

**File da toccare**: `types.ts`, `components/MainApp.tsx`, `components/StrategicDashboardView.tsx`, `services/db.ts` (solo per verifica schema)

### Istruzioni

**In `types.ts`:**

1. Aggiungere il tipo `DetachedLesson`:
```ts
export interface DetachedLesson {
  id: string;                      // uuid generato al momento del distacco
  sourceBlockId: string;
  sourceWeekNumber: number;
  sourceDay: string;               // es. "lunedì 3 marzo"
  objective?: string;
  lessonTitle?: string;
  lessonSyllabus?: string;
  messages?: Message[];
  contentBlocks?: ContentBlock[];
  detachedAt: string;              // ISO date string
}
```

2. Aggiungere `pendingContent?: DetachedLesson[]` a `Conversation`.

**In `components/MainApp.tsx`:**

3. Aggiornare il handler "salta lezione" (`handleSaltaLezione` o equivalente). La logica diventa:

```
SE il blocco ha contenuto (objective || lessonTitle || messages?.length > 0 || contentBlocks?.length > 0):
  → mostrare modal di decisione con 4 opzioni
  → in base alla scelta:
     RIMANDA: creare DetachedLesson, aggiungerla a conversation.pendingContent
     ACCORPA: trovare il blocco successivo nella stessa settimana o settimana dopo,
              copiare il contenuto in quel blocco (merge), non creare DetachedLesson
     DISTRIBUISCI: creare DetachedLesson con flag `distribuita: true`,
                   aggiungerla a pendingContent (il link Classroom è step futuro)
     ARCHIVIA: creare DetachedLesson con flag `archiviata: true`,
               aggiungerla a pendingContent (non richiede azione futura)
ALTRIMENTI (blocco vuoto):
  → saltare direttamente senza modal
```

4. Il modal di decisione può usare il sistema `onShowConfirmation` già esistente in MainApp, oppure essere un componente dedicato — valutare cosa è più semplice con l'architettura esistente.

**In `components/StrategicDashboardView.tsx`:**

5. Aggiungere un indicatore visivo nell'header quando `conversation.pendingContent?.length > 0`:
   - Un piccolo badge o avviso: "N contenuti in sospeso"
   - Cliccabile per aprire una lista semplice dei contenuti in coda con le azioni (collocare / archiviare)

### Critico: usare sempre `updateConversation`
Mai modificare `conversations` direttamente. Ogni aggiornamento passa da `updateConversation(id, conv => ({...conv, pendingContent: [...]}))`.

### Verifica
- Saltare un blocco vuoto: nessun modal, blocco marcato saltato
- Saltare un blocco con obiettivo compilato: appare il modal con le 4 opzioni
- Scegliere "Archivia": il blocco è saltato, il contenuto appare nella coda
- Scegliere "Accorpa": il blocco è saltato, il blocco successivo mostra il contenuto aggiunto
- Refresh della pagina: i contenuti in coda sono persistiti

---

## Step 5 — Gantt dei moduli ✅ COMPLETATO (2026-05-23)

**Obiettivo**: nuova view che mostra l'anno scolastico come timeline orizzontale, con i moduli come barre e i blocchi come punti. Navigazione dalla sidebar.

**File da toccare**: `components/GanttView.tsx` (nuovo), `components/Sidebar.tsx`, `components/MainApp.tsx`, `types.ts` (solo se servono tipi nuovi)

### Istruzioni

**Struttura dati da derivare:**

Il Gantt si costruisce a partire dalle `Conversation` esistenti. Ogni `WeekPlan` ha `weekNumber` e `blocks` con `module` (testo). Raggruppare i blocchi per valore del campo `module` → ogni gruppo unico diventa una barra.

```ts
// Struttura derivata per il Gantt
interface GanttModule {
  name: string;              // valore di block.module
  blocks: {
    weekNumber: number;
    day: string;
    status: BlockStatus;
    tipologia?: LessonType;
    lessonTitle?: string;
  }[];
  firstWeek: number;
  lastWeek: number;
}
```

**Rendering:**

- Layout: SVG o `div` con posizionamento percentuale — non usare librerie esterne (non sono nell'importmap)
- Asse X: numeri di settimana da 1 a N (N = settimana massima trovata nei dati)
- Ogni modulo: riga orizzontale con barra colorata da `firstWeek` a `lastWeek`
- Ogni blocco: punto sovrapposto alla barra, colorato per stato (stesso sistema di colori di `getBlockProgressState`: emerald/amber/slate/gray)
- Settimana corrente: linea verticale evidenziata
- Blocchi saltati: punto con stile diverso (bordo tratteggiato o colore ghost)
- Se `module` è vuoto su un blocco, raggrupparlo in una barra "Senza modulo"

**Navigazione:**

Aggiungere in `Sidebar.tsx` sotto "Progettazione del Corso" una voce "Gantt del Corso" (→ view `'gantt'`). Aggiungere il case in `MainApp.tsx`.

**Stile generale:**

- Sfondo `bg-[#0D1117]` coerente con il resto dell'app
- Testo moduli: `font-display` per i nomi, `font-mono` per i numeri settimana
- Nessuna libreria esterna

### Verifica
- La view si apre senza crash anche con zero dati
- Con dati reali i moduli appaiono come barre orizzontali nelle settimane corrette
- La linea della settimana corrente è posizionata correttamente
- Cliccando su un punto/blocco nel Gantt: navigare alla settimana corrispondente in StrategicDashboardView (facoltativo in questo step, ma desiderabile)

### Scelte implementative (2026-05-23)
- **Dot aggregati per settimana**: un solo dot per settimana per modulo (aggrega N blocchi), dimensione leggermente maggiore se N > 1. Evita sovrapposizioni irrisolvibili con il layout percentuale.
- **Posizionamento**: 100% CSS con `position: absolute` e `left` percentuale sul contenitore timeline. Nessuna SVG, nessuna libreria.
- **`GanttHeader` estratto** come componente separato (definito prima di `GanttView`) per riutilizzarlo nell'empty state senza duplicare JSX.
- **Navigazione week → StrategicDashboard**: `onNavigateToWeek` al momento naviga a `strategic_dashboard` senza scroll automatico alla settimana (scroll nella dashboard è step futuro opzionale).
- **`CalendarDaysIcon`** usata nel NavItem sidebar (già presente in `Icons.tsx`, stessa usata in "Giorni Predefiniti" — contesto di sezione diverso, nessuna ambiguità).

---

## Step 6 — Radar equilibrio didattico

**Obiettivo**: visualizzazione radar (spider chart) della distribuzione delle tipologie di lezione, integrata nella `StrategicDashboardView`. Aiuta il docente a vedere se il corso o un modulo è bilanciato tra teoria, pratica e procedura.

**File da toccare**: `components/StrategicDashboardView.tsx`, eventualmente un nuovo `components/DidacticRadarChart.tsx`

### Istruzioni

**Dati:**

Contare i blocchi per `tipologia` nel contesto corrente (tutto il corso, o filtrati per modulo se selezionato). Le tipologie senza blocchi hanno valore 0.

```ts
// Struttura dati per il radar
type RadarData = { tipologia: LessonType; label: string; count: number }[];
```

**Rendering SVG:**

Implementare il radar come SVG puro — nessuna libreria esterna.

- N assi (uno per tipologia presente), distribuiti uniformemente in cerchio
- Scala: il valore massimo tra tutte le tipologie = raggio massimo
- Poligono colorato con area semitrasparente (`fill-opacity: 0.2`)
- Punti sugli assi con il count numerico
- Label `font-mono text-[10px]` per ogni asse

**Posizionamento:**

Aggiungere il radar nell'header della `StrategicDashboardView`, accanto alle `progressStats` esistenti (dots + contatori). Dimensione compatta — non deve dominare la schermata, è uno strumento a colpo d'occhio.

**Comportamento con dati insufficienti:**

Se meno di 3 tipologie sono valorizzate nel corso, non mostrare il radar (non ha senso con 1-2 assi). Mostrare invece una micro-label `font-mono text-gray-500 text-[10px]` "Aggiungi tipologie per vedere il radar".

**Stile:**

- Colore poligono: `#818cf8` (indigo-400 in tonalità ADA) con opacità ridotta
- Assi: `stroke: rgba(255,255,255,0.15)`
- Background cerchi concentrici: `stroke: rgba(255,255,255,0.05)`

### Verifica
- Con blocchi tipizzati il radar appare e ha la forma corretta
- Con meno di 3 tipologie: nessun crash, messaggio informativo
- Con 0 tipologie valorizzate: nessun radar, nessun crash
- Il radar si aggiorna in tempo reale quando si cambia la tipologia di un blocco

---

## Note generali per tutti gli step

- **Mai usare `setConversations` direttamente** — sempre `updateConversation`
- **Tutti gli hook prima dei return condizionali** — regola React da non violare mai
- **Non installare librerie esterne** — verificare l'importmap in `index.html` prima di qualsiasi import
- **Colori stato canonici**: completato → `bg-emerald-500`, in_corso → `bg-amber-400`, da_fare → `bg-slate-500`, speciale → `bg-gray-500`
- **Font**: titoli → `font-display`, label tecnici/numeri → `font-mono`, corpo → `font-sans`
- **Dopo ogni step**: verificare che le funzionalità esistenti non siano rotte prima di dichiarare lo step completato

---

*Aggiornare questo documento dopo ogni step completato, annotando eventuali scelte implementative rilevanti prese durante l'esecuzione.*
