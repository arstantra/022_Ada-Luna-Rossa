# TASK: Refactor "Cosa / Come" — Tendine Pianificazione Blocchi

> Leggi questo file integralmente prima di toccare qualsiasi file.
> Leggi anche `CLAUDE.md` nella stessa cartella per il contesto architetturale completo del progetto.

---

## Contesto e motivazione

Nel cruscotto di progettazione (StrategicDashboardView) ogni blocco ha due tendine:
1. **Modulo** — il "cosa" si fa in quel blocco
2. **Tipologia** — il "come" si conduce la lezione

Il problema attuale: la tendina tipologia contiene `UDA` e `FSL` che **non sono modalità pedagogiche** (come) ma **strutture di contenuto del corso** (cosa). Vanno spostati nella tendina "cosa", insieme ai Moduli, all'Educazione Civica e ad altre strutture che il docente dichiara nel Progetto Didattico.

La distinzione architettonica da rispettare:
- **COSA** = contenuto/struttura del corso → dichiarato nel Progetto Didattico, parsato dinamicamente
- **COME** = modalità pedagogica di conduzione → vocabolario controllato stabile (5 voci)

FSL ha inoltre una doppia natura:
- **FSL come "cosa" di corso**: attività con tutta la classe dichiarata nel Progetto Didattico (es. liceo artistico che fa FSL in forma laboratoriale collettiva) → appare nella tendina "cosa"
- **FSL come flag di periodo**: alcuni blocchi sono il "periodo FSL" dell'anno, durante il quale alcuni studenti sono in stage mentre altri continuano. Questo è un badge visuale sul blocco, **ortogonale** allo stato e al contenuto. Non disabilita la pianificazione.

---

## Step 1 — Aggiornare `types.ts`

### 1a. Ridurre `LessonType` a sole modalità pedagogiche

```ts
// PRIMA
export type LessonType =
  | 'frontale_teorica' | 'frontale_operativa' | 'laboratorio'
  | 'verifica' | 'discussione' | 'uda' | 'fsl';

// DOPO
export type LessonType =
  | 'frontale_teorica' | 'frontale_operativa' | 'laboratorio'
  | 'verifica' | 'discussione';
```

### 1b. Aggiungere i nuovi tipi per le unità di contenuto

```ts
/** Tipo di unità di contenuto del corso — il "cosa" */
export type CourseContentType = 'modulo' | 'uda' | 'educazione_civica' | 'fsl';

/** Unità di contenuto parsata dal Progetto Didattico */
export interface CourseContentUnit {
  id: string;             // formato: `${type}-${order}`, es. "modulo-1", "uda-1"
  type: CourseContentType;
  title: string;          // testo dopo il prefisso, es. "Fondamenti del Design"
  order: number;          // posizione 1-based per tipo
  role?: string;          // da "Ruolo:" nel Progetto Didattico
  significance?: string;  // da "Significato:" nel Progetto Didattico
}
```

### 1c. Aggiornare `ParsedConstitution`

```ts
export interface ParsedConstitution {
  modules: ModuleDetails[];           // MANTENERE per retrocompatibilità
  moduleMap: Map<string, ModuleDetails>;
  contentUnits: CourseContentUnit[];  // NUOVO — lista flat per le tendine
}
```

### 1d. Aggiungere `isFslPeriod` a `BlockDetails`

Nel blocco esistente `BlockDetails`, aggiungere dopo `tipologia?`:

```ts
isFslPeriod?: boolean;  // flag periodo FSL: badge visuale, futuro tracciamento studenti
```

---

## Step 2 — Aggiornare `constants.ts`

### 2a. Rimuovere UDA e FSL da `LESSON_TYPE_LABELS`

```ts
// PRIMA
export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  frontale_teorica:   'Frontale teorica',
  frontale_operativa: 'Frontale operativa',
  laboratorio:        'Laboratorio',
  verifica:           'Verifica',
  discussione:        'Discussione',
  uda:                'UDA',
  fsl:                'FSL',
};

// DOPO
export const LESSON_TYPE_LABELS: Record<LessonType, string> = {
  frontale_teorica:   'Frontale teorica',
  frontale_operativa: 'Frontale operativa',
  laboratorio:        'Laboratorio',
  verifica:           'Verifica',
  discussione:        'Discussione',
};
```

### 2b. Aggiungere etichette per i tipi di contenuto (opzionale ma utile)

```ts
import type { CourseContentType } from './types';

export const COURSE_CONTENT_TYPE_LABELS: Record<CourseContentType, string> = {
  modulo:             'Modulo',
  uda:                'UDA',
  educazione_civica:  'Educazione Civica',
  fsl:                'FSL',
};
```

---

## Step 3 — Riscrivere `services/constitutionParser.ts`

Il parser attuale riconosce solo `MODULO N:`. Va esteso per riconoscere tutti i prefissi. La retrocompatibilità è garantita mantenendo `modules` e `moduleMap` nell'output.

### Formato Progetto Didattico da supportare

Il parser deve riconoscere queste intestazioni (case-insensitive, numero opzionale):

```
MODULO 0: Titolo
MODULO 1: Titolo
UDA 1: Titolo
UDA 2: Titolo
EDUCAZIONE CIVICA: Titolo
EDUCAZIONE CIVICA 1: Titolo
FSL: Titolo
FSL 1: Titolo
```

Per ciascuna sezione i campi opzionali `Ruolo:` e `Significato:` vanno parsati allo stesso modo di come avviene oggi per i moduli.

### Logica del nuovo parser

```
1. Dividere il testo in sezioni usando come delimitatore qualunque riga che inizia con
   uno dei prefissi riconosciuti (MODULO, UDA, EDUCAZIONE CIVICA, FSL)

2. Per ogni sezione:
   a. Determinare il tipo (CourseContentType)
   b. Estrarre il numero d'ordine (se presente) o usare il conteggio progressivo per tipo
   c. Estrarre il titolo (testo dopo i due punti)
   d. Estrarre role (da "Ruolo:") e significance (da "Significato:") se presenti
   e. Costruire l'id: `${type}-${order}`
   f. Costruire il CourseContentUnit

3. Per i MODULO, mantenere la logica legacy completa (pilastri, attività chiave)
   e popolare anche modules[] e moduleMap per retrocompatibilità

4. Restituire { modules, moduleMap, contentUnits }
   dove contentUnits è la lista flat di tutte le unità in ordine di apparizione
```

**Regex di riconoscimento sezione** (da usare nella split):
```
/^(MODULO|UDA|EDUCAZIONE CIVICA|FSL)\s*(\d+)?\s*:/im
```

---

## Step 4 — Grep e fix dei reference a `'uda'` e `'fsl'` come `LessonType`

Prima di procedere con i componenti, fare grep su tutta la codebase (escludendo `node_modules`):

```
grep -r "tipologia.*uda\|tipologia.*fsl\|'uda'\|'fsl'\|\"uda\"\|\"fsl\"" --include="*.ts" --include="*.tsx" .
```

Posti noti dove appaiono e come gestirli:

- **`StrategicDashboardView.tsx`** — radar chart che conta le tipologie per tipo: dopo il refactor, il radar dovrebbe contare le `contentUnits` per tipo invece delle tipologie. Valutare se il radar va aggiornato o temporaneamente lasciato con solo le 5 tipologie "come".
- **`GanttView.tsx`** (se esiste) — probabilmente usa `LessonType` per colorare le barre. Aggiornare di conseguenza.
- **Qualsiasi `switch` o `if` su `block.tipologia === 'uda'`** — rimuovere o migrare.
- **Dot di stato** — verificare che `getBlockDotColor` e `getBlockPlanningStatus` in `utils.ts` non riferiscano `fsl` come `LessonType`. Il colore sky per FSL ora dipenderà da `block.isFslPeriod`, non da `block.tipologia`.

---

## Step 5 — Aggiornare `StrategicDashboardView.tsx`

### 5a. Ricevere `contentUnits` come prop

Aggiungere alla prop `modules` (già esistente) una nuova prop:

```ts
contentUnits: CourseContentUnit[];  // parsati dal Progetto Didattico
```

In `MainApp.tsx`, dove viene chiamato `<StrategicDashboardView>`, passare `contentUnits` estratti da `parseConstitution(masterContext.constitution).contentUnits`.

### 5b. Prima tendina — "Cosa"

Sostituire la tendina modulo con una che mostra tutte le `contentUnits` raggruppate per tipo:

```tsx
<select
  value={block.module || ''}
  onChange={(e) => handleModuleChange(week.weekNumber, index, e.target.value)}
  onClick={(e) => e.stopPropagation()}
  onKeyDown={selectKeyDownHandler}
  disabled={isSpecialStatus || block.isLocked}
  className="w-full md:w-1/2 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed"
>
  <option value="" disabled>— unità didattica —</option>
  {(['modulo', 'uda', 'educazione_civica', 'fsl'] as CourseContentType[])
    .map(type => {
      const units = contentUnits.filter(u => u.type === type);
      if (units.length === 0) return null;
      return (
        <optgroup key={type} label={COURSE_CONTENT_TYPE_LABELS[type]}>
          {units.map(u => (
            <option key={u.id} value={u.title}>{u.title}</option>
          ))}
        </optgroup>
      );
    })}
</select>
```

Il valore salvato rimane `block.module` (stringa) — zero breaking change sul DB.

### 5c. Seconda tendina — "Come"

```tsx
<select
  value={block.tipologia || ''}
  onChange={(e) => onUpdateBlockTipologia(week.weekNumber, index, e.target.value as LessonType | '')}
  onClick={(e) => e.stopPropagation()}
  onKeyDown={selectKeyDownHandler}
  disabled={isSpecialStatus}
  className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-70 disabled:cursor-not-allowed flex-shrink-0"
>
  <option value="" disabled>— tipologia di lezione —</option>
  {(Object.entries(LESSON_TYPE_LABELS) as [LessonType, string][]).map(([key, label]) => (
    <option key={key} value={key}>{label}</option>
  ))}
</select>
```

### 5d. Badge FSL sul blocco

Nel punto dove vengono mostrati dot e badge del blocco (vicino a `BlockStateBadge`), aggiungere:

```tsx
{block.isFslPeriod && (
  <span className="text-[9px] font-mono text-sky-400/70 border border-sky-500/20 rounded px-1.5 py-0.5 flex-shrink-0">
    FSL
  </span>
)}
```

Il colore sky è coerente con il design system (era il colore FSL anche nella versione precedente).

### 5e. Toggle FSL period sul blocco

Aggiungere un piccolo controllo (checkbox o button) nell'accordion del blocco per attivare/disattivare `isFslPeriod`. Posizionarlo accanto al badge "Salta" o nella riga degli stati speciali. Handler in `MainApp.tsx`:

```ts
const handleToggleFslPeriod = (weekNumber: number, blockIndex: number, value: boolean) => {
  updateConversation(convoId, conv => {
    // aggiornare block.isFslPeriod nel weekPlan
    // pattern identico a onUpdateBlockTipologia
  });
};
```

Passare come prop `onToggleFslPeriod` a `StrategicDashboardView`.

---

## Step 6 — Aggiornare `gemini.ts` — prompt del Progetto Didattico

In `generateDocumentContent`, nella sezione che genera il Progetto Didattico (`docType === 'progetto_didattico'`), aggiornare il prompt per includere:

1. Indicazione del nuovo formato con `UDA N:`, `EDUCAZIONE CIVICA:`, `FSL:` oltre ai `MODULO N:`
2. Istruzione a includere solo le sezioni rilevanti per il profilo del docente
3. Esempio del formato atteso nell'istruzione al modello

Il prompt deve dire esplicitamente che:
- I prefissi `MODULO`, `UDA`, `EDUCAZIONE CIVICA`, `FSL` sono riconosciuti dal sistema
- Il numero dopo il prefisso è opzionale (ha senso per UDA e MODULO, meno per EDUCAZIONE CIVICA)
- I campi `Ruolo:` e `Significato:` sono opzionali ma utili
- Il parser legge esattamente questi prefissi — usarli consente ad Ada di proporli nelle tendine di pianificazione

---

## Step 7 — Verifica finale

Dopo le modifiche, verificare manualmente:

1. **Build pulita**: nessun errore TypeScript su `LessonType` — in particolare nei punti dove si usava `'uda'` o `'fsl'` come valore di `tipologia`
2. **Retrocompatibilità dati**: un blocco già salvato con `tipologia: 'uda'` non deve causare crash — la tendina mostrerà stringa vuota perché `'uda'` non è più nel `LessonType`, ma non deve rompere nulla
3. **Parsing**: con il Progetto Didattico di default (che ha solo `MODULO N:`), la tendina "cosa" mostra solo i moduli — comportamento identico al precedente
4. **Parsing esteso**: aggiungendo manualmente una riga `UDA 1: Test` nel Progetto Didattico, la tendina "cosa" mostra il gruppo UDA con la voce "Test"
5. **Badge FSL**: attivando `isFslPeriod` su un blocco, il badge sky appare senza alterare la pianificazione del blocco
6. **Tendina "come"**: mostra solo le 5 voci, senza UDA e FSL

---

## Note architetturali importanti (non derogare)

- **Non rimuovere `modules` e `moduleMap` da `ParsedConstitution`** — altri componenti li usano (radar chart, Gantt). Aggiungere `contentUnits` senza togliere il vecchio.
- **Non cambiare il valore salvato in `block.module`** — rimane una stringa libera. Le `contentUnits` popolano le opzioni ma il valore salvato è il titolo dell'unità.
- **Non aggiungere `isFslPeriod` a `BlockStatus`** — FSL period è ortogonale allo stato. Un blocco può essere `normale` + `isFslPeriod: true` allo stesso tempo.
- **Non mostrare il toggle FSL period in contesti diversi da `StrategicDashboardView`** — la gestione in aula e nella scheda studente è un upgrade futuro separato.
- **Rispettare le regole colore del design system**: il badge FSL usa `text-sky-400` e `border-sky-500/20` — coerente con il colore FSL precedente.
