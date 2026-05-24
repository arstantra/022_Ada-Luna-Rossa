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

## Step 5B — Riorganizzazione UX "Gestione del Corso" ✅ COMPLETATO (2026-05-23)

**Obiettivo**: pulizia e riorganizzazione completa della sezione Gestione del Corso. Nessuna funzionalità tecnica nuova — solo miglioramento della struttura, denominazioni, e modalità di editing dei documenti.

### Modifiche apportate

**Documenti Fondanti (`FoundingDocumentsView.tsx`)**
- Rinominati: Costituzione → "Progetto Didattico", Le Regole → "Patto Formativo"
- Aggiunto: "Profilo del Corso" (unifica ex-Disciplina + ex-Profilo Docente, stessa chiave DB `ada-teacher-profile`)
- Ordine tab: Profilo del Corso → Progetto Didattico → Patto Formativo → L'Equipaggio
- Modalità editor: da `mode="markdown"` a `mode="html"` (WYSIWYG, incolla da Word)
- Aggiunto pulsante **"Genera con ADA"** (viola outline) per Progetto Didattico e Patto Formativo — legge Profilo del Corso, genera con Gemini, carica nell'editor per revisione (non auto-salva)

**La Rotta (`RouteView.tsx` — nuova view)**
- Estratta dai Documenti Fondanti, diventa view full-page (`'la_rotta'`)
- Sezione 1: giorni predefiniti per ciascun blocco (BL1–BL6 → giorno settimana)
- Sezione 2: calendario settimane con data lunedì (domenica calcolata auto), toggle blocchi attivi
- Salvataggio in DB: `WeekEntry[]` con chiave `LOCAL_STORAGE_ROUTE_CALENDAR_KEY = 'ada-route-calendar'`

**Personalità di Ada (`AdaPersonalityView.tsx` — nuova view)**
- Da modal a view full-page (`'ada_personality'`)
- Editor HTML `DocumentEditor` sempre editabile
- Aggiunto pulsante **"Genera con ADA"** — genera istruzioni di sistema basate sul Profilo del Corso

**Etichette — rimozione completa**
- Rimossi: `useLabels.ts`, `LabelManagementModal.tsx`, `AssignLabelsModal.tsx`, `AUTO_LABELS` useEffect in MainApp
- Rimosso `labelIds` da tipo `Conversation` e da `useConversations.ts`
- File fisici lasciati come dead code (bash non ha permessi di scrittura su quei path)

**Sidebar**
- Rimosso widget Disciplina/Corso
- "Personalità di Ada" diventa NavItem → `'ada_personality'`
- "La Rotta" diventa NavItem → `'la_rotta'`
- Rimossi NavItem "Etichette" e "Profilo Docente"

**`services/gemini.ts`**
- Aggiunto `generateDocumentContent(docType: 'costituzione'|'regole'|'personalita', teacherProfile)` — funzione di generazione documenti con prompt specifici per tipo

### Note implementative
- La chiave DB `ada-teacher-profile` rimane invariata — nessuna migrazione dati
- `routeContext` (testo libero de La Rotta) ancora in DB per retrocompatibilità, ma non più mostrato in UI
- In initial setup mode, `handleGenerateWithAda` aggiorna sia `generatedContentMap` che lo stato locale (`localConstitution`/`localRules`) per garantire che `handleFinishSetup` salvi il contenuto generato anche se il docente non fa modifiche

---

## Step 6 — Radar equilibrio didattico ✅ COMPLETATO (2026-05-24)

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

### Scelte implementative (2026-05-24)
- **Componente separato** `components/DidacticRadarChart.tsx` — esportato per riutilizzo nello Step 9 (doppio poligono ideale/pianificato)
- **Dimensione SVG**: 48×48 px core + padding dinamico per i count label (viewBox esteso), rende ~62×62px totali — si integra nell'header senza dominarlo
- **Count label**: posizionati sulla punta di ogni asse (oltre il `maxR`), font-size 5, colore `rgba(165,180,252,0.9)` (indigo chiaro)
- **Label tipologie**: non nel SVG (troppo piccolo), bensì nel `title` HTML dell'elemento wrapper — tooltip nativo al hover
- **Blocchi esclusi dal conteggio**: `saltato` e `annullato` — il radar riflette solo le lezioni pianificate o già svolte
- **Zona B3** nell'header: separatore + `DidacticRadarChart`, visibile solo se `radarData.length > 0`
- **Meno di 3 tipologie**: la componente restituisce la micro-label `"Aggiungi tipologie per vedere il radar"` inline nel flex header

---

## Step 7 — Modulo come entità strutturata ✅ COMPLETATO (2026-05-24)

**Obiettivo**: trasformare il campo `module?: string` (semplice testo libero) in una vera entità `Module` con `id`, titolo, sezioni e tipologie previste. Questo è il prerequisito per la ragnatela avanzata (Step 9) e per le label potenziate sui blocchi. Il campo `module` rimane per retrocompatibilità DB.

**Contesto di progettazione**: i Moduli sono definiti nel Profilo del Corso (documento libero). Ada legge quel documento — già presente nel contesto di sistema come `teacherProfile` — e ne estrae la struttura on-demand, quando il docente assegna un modulo a un blocco. Il risultato confermato viene salvato come `modules[]` sulla `Conversation`.

**File da toccare**: `types.ts`, `constants.ts`, `services/gemini.ts`, `components/BlockWorkspaceView.tsx`, `components/StrategicDashboardView.tsx`

### ⚠️ Non fare

- **Non modificare `active` / `activeBlocks` in `RouteView.tsx`** — è la logica di calendario de La Rotta, già calibrata correttamente. L'inizializzazione `activeBlocks: Array.from({ length: totalBlocks }, (_, i) => i + 1)` non va toccata.
- Non rimuovere `module?: string` da `BlockDetails` — serve per retrocompatibilità con i dati esistenti in IndexedDB.
- Non fare parsing eager al salvataggio del Profilo del Corso — il parsing avviene on-demand, non in automatico.
- Non auto-salvare il risultato del parsing senza conferma del docente — stesso principio di "Genera con ADA".

### Istruzioni

**In `types.ts`:**

1. Aggiungere i nuovi tipi:
```ts
export interface ModuleSection {
  id: string;               // uuid
  title: string;            // es. "Marco Aurelio e la filosofia stoica"
  lessonType: LessonType;   // tipo previsto per questa sezione
  estimatedBlocks: number;  // stima blocchi necessari
}

export interface CourseModule {
  id: string;               // uuid
  order: number;            // 1-based, per ordinamento
  title: string;            // es. "Modulo 1 — Roma Imperiale"
  sections: ModuleSection[];
  estimatedBlocks: number;  // somma o valore indipendente
  pillar?: string;          // eventuale asse/pilastro di riferimento (testo libero)
}
```

> Usare `CourseModule` (non `Module`) per evitare conflitti con il tipo nativo `Module` di TypeScript/JavaScript.

2. Aggiungere a `BlockDetails`:
```ts
moduleId?: string;     // riferimento a CourseModule.id
sectionId?: string;    // riferimento a ModuleSection.id
// Il campo module?: string rimane per retrocompatibilità
```

3. Aggiungere a `Conversation`:
```ts
modules?: CourseModule[];   // estratti dal Profilo del Corso, confermati dal docente
```

**In `services/gemini.ts`:**

4. Aggiungere la funzione `extractModulesFromProfile`:
```ts
export async function extractModulesFromProfile(
  teacherProfile: string,
  apiKey: string
): Promise<CourseModule[]>
```
- Invia al modello Gemini un prompt strutturato che chiede di estrarre i moduli dal testo del Profilo del Corso
- Il prompt deve richiedere output JSON con schema `CourseModule[]`
- Usare `response_mime_type: 'application/json'` nella config di generazione per forzare JSON pulito
- In caso di errore di parsing JSON, restituire array vuoto (non throw)

**In `components/BlockWorkspaceView.tsx`:**

5. Aggiungere un selettore modulo nell'header del blocco (sotto il `TipologiaSelector` già esistente):
   - Se `conversation.modules` è vuoto o assente: mostrare un pulsante `"Estrai moduli dal Profilo"` (outline sky, piccolo) che chiama `extractModulesFromProfile` e mostra i risultati in un pannello di conferma prima di salvare
   - Se `conversation.modules` è popolato: mostrare un dropdown compatto con i titoli dei moduli — al click imposta `block.moduleId`
   - Dopo aver selezionato il modulo: mostrare un secondo selettore per la `sectionId` (le sezioni di quel modulo)
   - Il blocco eredita `tipologia` dalla sezione selezionata — ma il docente può sovrascriverla con `TipologiaSelector`

6. **Label potenziata nel blocco** (visualizzazione, non editing): mostrare sotto il titolo lezione tre pill compatti:
   - Modulo: `font-mono text-[9px]` colore sky — es. `M1 Roma Imperiale`
   - Sezione: `font-mono text-[9px]` colore gray — es. `§ Filosofia stoica`
   - Tipologia: già esistente da Step 3

**In `components/StrategicDashboardView.tsx`:**

7. Nell'accordion della settimana, se un blocco ha `moduleId`, mostrare la label modulo (`M1`, `M2`…) accanto al titolo lezione — `font-mono text-[9px] text-sky-400/60`. Non aggiungere altri elementi: la card blocco deve rimanere compatta.

### Pattern di salvataggio moduli estratti
```ts
// Dopo conferma del docente nel pannello di preview
updateConversation(conv.id, c => ({
  ...c,
  modules: extractedModules   // array CourseModule[] confermato
}));
```

### Verifica
- Estrarre moduli da un Profilo del Corso compilato: la funzione ritorna un array con struttura corretta
- Assegnare un modulo e una sezione a un blocco: i valori persistono dopo refresh
- Blocco senza `moduleId`: nessun crash, nessuna label modulo mostrata
- Il campo `module?: string` esistente non interferisce con la nuova logica
- TypeScript compila senza errori

### Scelte implementative (2026-05-24)
- **`extractModulesFromProfile`** usa `responseMimeType: 'application/json'` nel config Gemini — JSON pulito senza markdown wrapper. In caso di parse error o array non valido: ritorna `[]` silenziosamente (no throw).
- **Preview inline** in `BlockWorkspaceView`: pannello collassabile che appare dopo l'estrazione, prima del salvataggio. Mostra M1/M2 + conteggio sezioni. "Conferma" salva via `onSaveModules`, "Annulla" azzera la preview.
- **Selettori a `<select>` nativi**: modulo e sezione come `<select>` trasparenti (stile `bg-transparent border-none`) — compatti, accessibili, senza z-index issues.
- **Pill assegnazione**: quando modulo/sezione sono assegnati, vengono mostrati come pill testo con `×` per rimuovere l'assegnazione.
- **Eredità tipologia**: quando si seleziona una sezione che ha `lessonType`, questo viene ereditato da `block.tipologia` SOLO se il blocco non aveva già una tipologia assegnata manualmente — il docente può sempre sovrascrivere con `TipologiaSelector`.
- **Label M1 in StrategicDashboard**: mostrata solo se `block.moduleId` è presente e la settimana ha `modules` con il corrispondente id. Colore `text-sky-400/60`, `font-mono text-[9px]`.
- **`weekData` esteso**: ora include `modules: CourseModule[]` per ogni settimana, derivato da `convo?.modules`. StrategicDashboardView non riceve `modules` come prop — li ricava dalle conversazioni già disponibili.
- **Catena prop**: `MainApp` → `onSaveModules={handleSaveConversationModules}` → `PlanningView` → `BlockWorkspaceView`. `handleSaveConversationModules` usa `activeConversationId` (la settimana correntemente aperta).
- **Nessuna migrazione dati**: i blocchi esistenti con `module?: string` non vengono toccati — `moduleId`/`sectionId` sono nuovi campi addizionali.

---

## Step 8 — Attività con timeline (il canale rigido) ✅ COMPLETATO

**Obiettivo**: introdurre le `Activity` — entità autonome lanciate da un blocco con scadenza in numero di blocchi. Sono il "canale rigido" del sistema: una volta lanciate, la scadenza non cambia nemmeno se la sequenza delle lezioni cambia. L'asse temporale è in blocchi, non in date.

**Contesto di progettazione**: le attività sono il contratto pubblico con gli studenti ("consegna tassativa"). Vivono in parallelo alla sequenza didattica — non dentro i blocchi ma sopra di essi, come un secondo livello. Nella `StrategicDashboardView` ogni blocco mostra quali attività sono in corso o in scadenza, ma non le contiene.

**File da toccare**: `types.ts`, `components/BlockWorkspaceView.tsx`, `components/StrategicDashboardView.tsx`, `components/GanttView.tsx`

### ⚠️ Non fare

- **Non modificare `active` / `activeBlocks` in `RouteView.tsx`** — vedi Step 7.
- Non misurare la scadenza in date di calendario — sempre in numero di blocchi dal lancio. Se un blocco salta, il conteggio si sposta automaticamente.
- Non mettere le attività dentro `BlockDetails` — sono entità a livello `Conversation`, non di blocco. Il blocco le *lancia*, non le *contiene*.
- Non usare `setConversations` direttamente — sempre `updateConversation`.

### Istruzioni

**In `types.ts`:**

1. Aggiungere il tipo `Activity`:
```ts
export type ActivityType =
  | 'ricerca'
  | 'audiovisivo'
  | 'produzione_scritta'
  | 'progetto'
  | 'altro';

export type ActivityStatus =
  | 'in_corso'       // lanciata, scadenza non ancora raggiunta
  | 'in_scadenza'    // mancano ≤ 1 blocco alla scadenza
  | 'consegnata'     // docente ha marcato come consegnata
  | 'scaduta';       // scadenza superata senza consegna

export interface Activity {
  id: string;                      // uuid
  title: string;                   // es. "Terme di Caracalla — da Roma ad oggi"
  type: ActivityType;
  launchBlockId: string;           // id del BlockDetails da cui è stata lanciata
  launchWeekNumber: number;        // settimana di lancio
  launchBlockIndex: number;        // indice blocco nella settimana (0-based)
  dueInBlocks: number;             // scadenza: N blocchi dopo il lancio
  moduleId?: string;               // opzionale: modulo di riferimento
  description?: string;            // istruzioni per gli studenti
  status: ActivityStatus;
  deliveredAt?: string;            // ISO date, se consegnata
}
```

2. Aggiungere a `Conversation`:
```ts
activities?: Activity[];
```

**In `components/BlockWorkspaceView.tsx`:**

3. Aggiungere un pulsante `"↗ Lancia attività"` nel footer del tab Laboratorio (accanto a "Trasferisci al Master"):
   - Stile: outline rose/pink — `text-rose-400/70 border border-rose-500/20 rounded-lg hover:bg-rose-500/10`
   - Al click: aprire un form inline compatto (non modal) con:
     - Campo `title` (testo libero)
     - Selezione `type` (pill radio, stile `TipologiaSelector`)
     - Campo `dueInBlocks` (input numerico, min 1, max 20)
     - Campo `description` opzionale (textarea 2 righe)
   - Al salvataggio: creare `Activity` e aggiungerla a `conversation.activities` via `updateConversation`

**In `components/StrategicDashboardView.tsx`:**

4. Per ogni blocco, calcolare le attività in corso o in scadenza in quel blocco:
```ts
// Derivato da conversation.activities
// Un'attività è "su questo blocco" se:
// blocco rientra nell'intervallo [launchBlockIndex, launchBlockIndex + dueInBlocks]
// calcolato linearizzando la sequenza blocchi su tutte le settimane
```

5. Mostrare sotto il titolo lezione di ogni blocco una riga opzionale con le attività attive:
   - Ogni attività: dot `bg-rose-500` + titolo troncato `text-[9px] font-mono text-rose-300/70`
   - Se è il blocco di lancio: `↗` davanti
   - Se è il blocco di scadenza: `⚑` davanti, colore `text-amber-400`
   - Massimo 2 attività mostrate inline; se di più, badge `+N`

**In `components/GanttView.tsx`:**

6. Aggiungere una sezione "Attività" separata sotto la sezione moduli esistente:
   - Stessa griglia orizzontale (asse X = settimane)
   - Ogni attività: barra da `launchWeekNumber` a settimana di scadenza calcolata
   - Colore barra: rosa/rose per `in_corso`, amber per `in_scadenza`, emerald per `consegnata`, gray per `scaduta`
   - Il punto di lancio è più scuro (filled), il resto semitrasparente
   - Cliccando sulla barra: pannello laterale con dettagli attività + pulsante "Segna consegnata"

### Calcolo settimana di scadenza
```ts
// Linearizzare la sequenza blocchi considerando routeCalendar
// Trovare il blocco N-esimo dopo il lancio, risalire alla sua settimana
function getActivityDueWeek(
  activity: Activity,
  routeCalendar: WeekEntry[]
): number { ... }
```

### Verifica
- Lanciare un'attività da un blocco: appare nella lista `conversation.activities`, persiste dopo refresh
- L'attività compare come overlay nel blocco di lancio e nei blocchi intermedi in `StrategicDashboardView`
- Nel `GanttView` l'attività appare come barra nella sezione dedicata
- Marcare un'attività come consegnata: il colore nella barra cambia a emerald
- Con zero attività: nessun crash, nessuna sezione vuota mostrata nel Gantt

### Scelte implementative (2026-05-24)
- **`ActivityType` e `ActivityStatus`** in `types.ts`, `activities?: Activity[]` aggiunto a `Conversation`.
- **`ACTIVITY_TYPE_LABELS`** in `constants.ts` (stesso pattern di `LESSON_TYPE_LABELS`).
- **Form inline** in `BlockWorkspaceView` footer: compare sopra `ChatInput` al click di "↗ Lancia attività". Coesiste con `ModePills` nella stessa riga quando il form è chiuso. Nessun modale.
- **Catena prop**: `MainApp.handleAddActivity` → `PlanningView.onAddActivity` → `PlanningView.handleAddActivity` (arricchisce con launchWeekNumber/launchBlockId/launchBlockIndex) → `BlockWorkspaceView.onAddActivity` (riceve title/type/dueInBlocks/description).
- **`handleMarkActivityDelivered`** in MainApp: cerca la conversazione che contiene l'attività e aggiorna `status: 'consegnata'` + `deliveredAt`.
- **StrategicDashboardView**: `allActivities` raccoglie da tutte le conversazioni; `globalOffsetMap` mappa weekNumber → offset blocco globale; per ogni blocco computa `blockActivities` (attività il cui intervallo [launchGlobal, dueGlobal] include il blocco). Overlay inline nella card blocco, max 2 + badge `+N`. Prefisso `↗` per blocco di lancio, `⚑` per blocco di scadenza.
- **GanttView**: `weekBlockCounts` da `conv.weekPlan.blocks.length`; `getActivityDueWeek` conta blocchi in avanti fino a esaurire `dueInBlocks`. Sezione "Attività" separata sotto i moduli. Barra da `launchWeekNumber` a `dueWeek`. Pannello dettaglio in fondo con "✓ Segna consegnata". Nessun pannello se zero attività.
- **Status derivato al display**: `getEffectiveActivityStatus` computa in_scadenza/scaduta a runtime dal currentWeek vs dueWeek — non serve aggiornamento background del DB.

---

## Step 9 — Ragnatela avanzata (doppio poligono ideale vs pianificato) ✅ COMPLETATO

**Obiettivo**: evolvere il radar del Step 6 da mono-poligono a doppio poligono. Il poligono tratteggiato rappresenta la distribuzione *ideale* derivata dalla struttura dei `CourseModule` (Step 7). Il poligono pieno rappresenta la distribuzione *pianificata* derivata dai blocchi tipizzati. Il docente vede la divergenza e riequilibra.

**Prerequisito**: Step 6 (radar base) e Step 7 (moduli come entità) devono essere completati.

**File da toccare**: `components/StrategicDashboardView.tsx` (o `components/DidacticRadarChart.tsx` se estratto in Step 6)

### ⚠️ Non fare

- **Non modificare `active` / `activeBlocks` in `RouteView.tsx`** — vedi Step 7.
- Non richiedere input manuale per la distribuzione ideale — è interamente derivata da `conversation.modules[].sections[].lessonType` + `estimatedBlocks`.
- Non mostrare il radar se `conversation.modules` è vuoto — in quel caso mostrare solo il mono-poligono del Step 6 (degradazione graceful).
- Non usare librerie esterne per il rendering SVG — rimane SVG puro come in Step 6.

### Istruzioni

**Calcolo distribuzione ideale** (da `CourseModule[]`):
```ts
function getIdealDistribution(modules: CourseModule[]): Record<LessonType, number> {
  const counts: Record<LessonType, number> = { /* zero per tutti i tipi */ };
  modules.forEach(mod =>
    mod.sections.forEach(sec => {
      counts[sec.lessonType] = (counts[sec.lessonType] || 0) + sec.estimatedBlocks;
    })
  );
  return counts;
}
```

**Calcolo distribuzione pianificata** (già presente dal Step 6, conta i blocchi per `tipologia`).

**Score di equilibrio**:
```ts
// Confronta le proporzioni (non i valori assoluti)
// score = 1 - media delle differenze assolute percentuali
// score 1.0 = perfetto allineamento, 0 = massima divergenza
function computeBalanceScore(
  ideal: Record<LessonType, number>,
  planned: Record<LessonType, number>
): number { ... }
```

**Rendering SVG — due poligoni**:
- **Poligono ideale** (tratteggiato): `stroke="#38bdf8"` con `stroke-dasharray="4,2"`, `fill` semitrasparente `#38bdf810`
- **Poligono pianificato** (pieno): `stroke="#818cf8"` solido, `fill="#818cf820"`
- Entrambi normalizzati sullo stesso asse (il massimo tra i due set di valori)
- Legenda compatta sotto il radar: quadratino tratteggiato = "Profilo corso", quadratino pieno = "Pianificato"

**Score di equilibrio** — visualizzazione:
- Badge accanto al radar: `font-mono text-[10px]`
- `≥ 80%` → `text-emerald-400` — "Ben bilanciato"
- `55–79%` → `text-amber-400` — "Da riequilibrare"
- `< 55%` → `text-rose-400` — "Sbilanciato"

**Degradazione graceful**:
- `modules` assente o vuoto: mostrare solo il poligono pianificato (comportamento Step 6), nessun score, nessuna legenda
- Meno di 3 tipologie pianificate: nessun radar, messaggio `"Aggiungi tipologie per vedere il radar"` — identico al Step 6
- `modules` presenti ma nessuna sezione tipizzata: trattare come assente

### Verifica
- Con moduli estratti e blocchi tipizzati: entrambi i poligoni visibili e distinti
- Modifica una tipologia in un blocco: il poligono pianificato si aggiorna in tempo reale
- Score riflette correttamente la divergenza tra ideale e pianificato
- Con `modules` vuoto: radar mono-poligono, nessun crash, nessuna legenda doppia
- TypeScript compila senza errori

### Note di implementazione (2026-05-24)

**File modificati**: `components/DidacticRadarChart.tsx` (riscrittura completa) + `components/StrategicDashboardView.tsx` (aggiunta `idealRadarData` useMemo + passaggio prop)

**Scelte implementative**:
- `computeBalanceScore` usa TVD (Total Variation Distance): `score = 1 - Σ|p_i - q_i| / 2`. Confronta proporzioni, non valori assoluti.
- Unione dei tipologi: i tipologi del pianificato vengono prima, poi eventuali tipologie extra dell'ideale — garantisce che le assi del radar riflettano prima la realtà pianificata.
- Entrambi i poligoni normalizzati sullo stesso `maxCount = Math.max(...plannedCounts, ...idealCounts, 1)`.
- SVG in modalità doppia: `vbH = vbW + 14 = 82` (vs 68 in mono). Legenda in SVG su due righe (y=53 e y=59), entro il viewBox.
- Degradazione graceful: `data.length === 0 → null`; `data.length < 3 → testo`; `idealData` assente/vuoto → comportamento Step 6 (solo poligono pieno, nessuna legenda, nessun score).
- `idealData` passato come `undefined` quando `idealRadarData.length === 0` — evita di mostrare la legenda con un poligono ideale degenere.

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
