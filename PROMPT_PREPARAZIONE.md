# Prompt chirurgici — Laboratorio di Preparazione Lezione
> Tre fasi sequenziali. Ogni prompt è autonomo e va incollato in Claude Code dopo aver completato il precedente.
> Claude Code legge CLAUDE.md e CLAUDE_PROTOCOL.md automaticamente — non serve ripetere le regole di stile.

---

## FASE A — Laboratorio di Produzione Materiali

**Obiettivo:** trasformare le fonti sulla scrivania (master content + materiali esistenti) in materiali pronti per la lezione, usando Ada come "interrogatore NotebookLM" che produce brief per tool esterni oppure contenuto diretto.

### Cosa aggiungere

**1. `types.ts` — estendere `LessonMaterial`**

Aggiungere due campi opzionali a `LessonMaterial`:

```ts
outputTool?: 'canva' | 'powerpoint' | 'ada_diretta' | 'gemini_immagini' | 'firefly' | 'altro';
productionBrief?: string;  // brief/outline generato da Ada per il tool esterno, oppure testo completo se ada_diretta
```

**2. `services/gemini.ts` — nuova funzione `generateMaterialBrief`**

Aggiungere dopo `generateToolSuggestion` (riga ~910):

```ts
export const generateMaterialBrief = async (
    sourceContent: string,       // estratto dal master o da un materiale esistente
    materialType: LessonMaterial['type'],  // 'slide' | 'video' | 'pdf' | 'stampa' | ecc.
    outputTool: string,          // es. "Canva", "PowerPoint", "testo diretto"
    targetAudience: string,      // "classe intera" | "gruppo X" | "studente Y"
    teacherInstruction: string,  // istruzione libera del docente, es. "focus su..."
    systemInstruction: string
): Promise<string>
```

Il prompt interno ad Ada deve:
- Analizzare `sourceContent` come farebbe NotebookLM con le fonti
- Produrre un output diverso per ogni `outputTool`:
  - **Canva / PowerPoint**: struttura slide (titolo, punti per slide, note speaker)
  - **ada_diretta**: testo completo pronto (scheda, testo da imparare, istruzioni attività)
  - **gemini_immagini / firefly**: prompt visivo dettagliato in italiano + inglese
  - **altro**: brief generico strutturato
- Tenere conto di `targetAudience` (livello, contesto)

**3. `components/MaterialProductionModal.tsx` — nuovo file**

Modal che si apre quando il docente clicca "✦ Produci con Ada" accanto a un materiale nella lista.

Struttura UI (tutto inline, no z-index assoluti):

```
┌──────────────────────────────────────────────────┐
│ ✦ Produci materiale da questa fonte              │
├──────────────────────────────────────────────────┤
│ Fonte selezionata: [nome materiale / "Master"]   │
│                                                  │
│ Tipo output:  [slide] [testo] [scheda] [prompt]  │  ← pill orizzontali, LessonMaterial.type
│ Tool:         [Canva] [PowerPoint] [Ada diretta] │  ← pill orizzontali, outputTool
│               [Gemini img] [Firefly] [Altro]     │
│                                                  │
│ Per: [Classe intera ▼]  (dropdown: classe/gruppo/studente) │
│                                                  │
│ Istruzione aggiuntiva (opzionale):               │
│ [textarea ghost — es. "max 6 slide, stile semplice"] │
│                                                  │
│           [Annulla]  [✦ Genera brief]            │
└──────────────────────────────────────────────────┘
```

Dopo la generazione, il modal mostra il brief/testo in un'area copiabile con pulsante "Copia" e pulsante "Salva sul materiale" che chiama `onSaveBrief(materialId, brief, outputTool)`.

Stile: segue il design system ADA (bg-gray-900, bordi gray-700/50, pill rounded-lg outline come pulsanti AI).

**4. `components/LessonPreparationTab.tsx` — modifiche (solo `Edit`, file da 864 righe)**

- Aggiungere `onSaveMaterialBrief: (convoId: string, blockIndex: number, materialId: string, brief: string, outputTool: LessonMaterial['outputTool']) => void` alle props
- Dopo ogni materiale nella lista, aggiungere un piccolo pulsante `✦` (testo `text-purple-400`, bordo `border-purple-500/25`, `rounded-lg`, dimensione compatta `text-[11px] px-2 py-0.5`) che apre `MaterialProductionModal` con quella fonte pre-selezionata
- Aggiungere anche un pulsante "✦ Produci da Master" nella sezione preview master content, che apre il modal con il master come fonte
- Se `material.productionBrief` esiste, mostrare sotto il titolo del materiale una riga compatta (`text-[11px] text-gray-400 truncate`) con badge tool (`outputTool`) e pulsante matita per riaprire il modal

**5. `components/handlers/blockNoteHandlers.ts` — aggiungere `handleSaveMaterialBrief`**

Segue il pattern `createBlockNoteHandlers`. Aggiorna `lessonMaterials` trovando il materiale per `materialId` e settando `productionBrief` e `outputTool`.

### File da toccare (in ordine)
1. `types.ts` — Edit (aggiungere 2 campi a LessonMaterial)
2. `services/gemini.ts` — Edit (aggiungere generateMaterialBrief dopo riga ~930)
3. `components/MaterialProductionModal.tsx` — Write nuovo file
4. `components/handlers/blockNoteHandlers.ts` — Edit (aggiungere handleSaveMaterialBrief)
5. `components/MainApp.tsx` — Edit (wiring handler + prop a LessonPreparationTab)
6. `components/LessonPreparationTab.tsx` — Edit (pulsanti + modal + badge)

### Verifica post-implementazione
```bash
grep -n "productionBrief\|outputTool\|MaterialProductionModal" components/LessonPreparationTab.tsx
grep -n "generateMaterialBrief" services/gemini.ts
grep -n "export default MainApp" components/MainApp.tsx  # deve restituire esattamente 1 riga
```

---

## FASE B — Consegne Intelligenti per Gruppi e Studenti

**Prerequisito:** Fase A completata.

**Obiettivo:** Ada legge i profili degli studenti, crea gruppi bilanciati (inclusi "gruppi da 1" per consegne individuali), e suggerisce quale materiale/variante assegnare a ciascun gruppo in base alle caratteristiche degli studenti.

### Cosa aggiungere

**1. `types.ts` — nuovo tipo `LessonAssignment`**

```ts
export interface LessonAssignment {
    id: string;
    groupId: string;           // GroupDefinition.id oppure studentId (se gruppo da 1)
    groupLabel: string;        // es. "Gruppo A" o "Mario R." (per individuali)
    isIndividual: boolean;     // true se groupSize === 1
    materialIds: string[];     // LessonMaterial.id assegnati
    rationale: string;         // motivazione Ada ("assegno questa scheda perché...")
    distributionChannel?: LessonAssignmentChannel; // compilato in Fase C
}

export type LessonAssignmentChannel = 'classroom' | 'stampa' | 'qr_code' | 'padlet' | 'drive_link' | 'verbale';

export const LESSON_ASSIGNMENT_CHANNEL_LABELS: Record<LessonAssignmentChannel, string> = {
    classroom: 'Google Classroom',
    stampa: 'Fotocopia / Stampa',
    qr_code: 'QR Code',
    padlet: 'Padlet',
    drive_link: 'Link Drive',
    verbale: 'Consegna verbale',
};
```

Aggiungere a `BlockDetails`:
```ts
lessonAssignments?: LessonAssignment[];
```

**2. `services/gemini.ts` — nuova funzione `generateAssignmentPlan`**

```ts
export const generateAssignmentPlan = async (
    groups: GroupDefinition[],           // gruppi già creati (inclusi da 1)
    materials: LessonMaterial[],         // materiali disponibili con productionBrief
    students: Student[],                 // profili completi studenti
    blockObjective: string,              // obiettivo didattico del blocco
    systemInstruction: string
): Promise<LessonAssignment[]>
```

Il prompt interno ad Ada deve:
- Per ogni gruppo, leggere le caratteristiche degli studenti che lo compongono (livello, note BES/DSA, punti di forza, segnali recenti)
- Selezionare da `materials` quelli più adatti al gruppo (anche più di uno)
- Produrre una `rationale` sintetica (1-2 frasi) per ogni assegnazione
- Restituire JSON strutturato come array di `LessonAssignment`

**3. `components/AssignmentPlanSection.tsx` — nuovo componente**

Sezione dentro `LessonPreparationTab` (non un modal separato — rimane inline nella pagina). Si apre con un titolo `CollapsibleSectionLabel`-style: `PIANO CONSEGNE`.

Struttura UI:

```
▾ PIANO CONSEGNE

  Dimensione gruppi: [1] [2] [3] [4]   ← pill selezionabili (default: ultimo usato)
  
  [✦ Crea gruppi e assegna materiali]   ← un solo pulsante, fa tutto

  ── dopo la generazione ──

  ┌─ Gruppo A — Mario R., Sara C. ──────────────────┐
  │ 📄 Scheda testo  🎞 Slide 3-5                   │
  │ "Assegno la scheda perché Mario ha BES           │
  │  lettura e Sara ha già visto il concetto"        │
  └──────────────────────────────────────────────────┘
  ┌─ Solo — Luca B. ────────────────────────────────┐  ← gruppo da 1
  │ 📄 Testo approfondimento                        │
  │ "Luca lavora meglio in autonomia, livello alto"  │
  └──────────────────────────────────────────────────┘
```

Ogni card gruppo ha icona del canale (aggiunta in Fase C, per ora placeholder vuoto).

**4. `components/handlers/blockNoteHandlers.ts` — aggiungere `handleSaveAssignmentPlan`**

Aggiorna `lessonAssignments` su `BlockDetails`. Segue il pattern esistente degli handler.

**5. `components/LessonPreparationTab.tsx` — modifiche (solo `Edit`)**

- Aggiungere `students` alle props (già disponibile in `InAulaView`, passarlo giù)
- Aggiungere `onSaveAssignmentPlan: (convoId, blockIndex, assignments) => void`
- Montare `<AssignmentPlanSection>` dopo la sezione materiali

### File da toccare (in ordine)
1. `types.ts` — Edit (LessonAssignment, LessonAssignmentChannel, BlockDetails)
2. `services/gemini.ts` — Edit (generateAssignmentPlan)
3. `components/AssignmentPlanSection.tsx` — Write nuovo file
4. `components/handlers/blockNoteHandlers.ts` — Edit (handleSaveAssignmentPlan)
5. `components/MainApp.tsx` — Edit (wiring + prop a LessonPreparationTab)
6. `components/LessonPreparationTab.tsx` — Edit (props + montare AssignmentPlanSection)
7. `components/InAulaView.tsx` — Edit (passare `students` a LessonPreparationTab — file da 988 righe, usare solo Edit, toccare minimamente)

### Verifica post-implementazione
```bash
grep -n "lessonAssignments\|AssignmentPlanSection\|generateAssignmentPlan" components/LessonPreparationTab.tsx
grep -n "export default MainApp" components/MainApp.tsx  # deve restituire esattamente 1 riga
wc -l components/InAulaView.tsx  # verificare che il file non sia cresciuto oltre il ragionevole
```

---

## FASE C — Distribuzione: Canali e Piano Finale

**Prerequisito:** Fase B completata, `LessonAssignment` e `LessonAssignmentChannel` già in types.ts.

**Obiettivo:** per ogni assegnazione gruppo/studente, il docente sceglie il canale di distribuzione. Ada mostra un "piano di distribuzione" leggibile e copiabile, pronto per l'aula.

### Cosa aggiungere

**1. `components/AssignmentPlanSection.tsx` — modifiche (solo `Edit`)**

Aggiungere a ogni card gruppo un selettore di canale inline:

```
┌─ Gruppo A — Mario R., Sara C. ──────────────────────┐
│ 📄 Scheda testo  🎞 Slide 3-5                       │
│ "Assegno la scheda perché..."                        │
│                                                      │
│ Distribuisci via:                                    │
│ [Classroom] [Stampa] [QR] [Padlet] [Drive] [Verbale] │  ← pill, una sola selezionabile
└──────────────────────────────────────────────────────┘
```

Stile pill canale:
- Attivo: `bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded-md`
- Inattivo: `text-gray-500 hover:text-gray-300 rounded-md`
- Dimensione: `text-[10px] font-mono px-2 py-0.5`

Quando il canale selezionato è `classroom`, mostrare sotto la pill (se `classroomUrl` è compilato) un link "Apri Classroom →" (`text-sky-400/70 text-[11px]`). Se non compilato, mostrare nota `text-gray-500 text-[10px]`: "Aggiungi URL Classroom in questa pagina per attivare il link diretto."

**2. Piano di distribuzione riepilogativo**

Dopo tutte le card, aggiungere un blocco "Piano Lezione" collassabile (`isDistributionPlanOpen`):

```
▾ PIANO LEZIONE  [Copia testo]

  Gruppo A (Mario R., Sara C.) → Classroom
    • Scheda testo + Slide 3-5

  Solo (Luca B.) → Stampa
    • Testo approfondimento

  Classe intera → Verbale
    • Slide introduttive (proiettate)
```

Il testo copiabile è plain text, non HTML. Il pulsante "Copia testo" usa il pattern `copiedIndex` già usato in `FoundingDocumentsView` (feedback ✓ emerald 2 secondi).

**3. `components/handlers/blockNoteHandlers.ts` — aggiungere `handleUpdateAssignmentChannel`**

```ts
handleUpdateAssignmentChannel: (convoId, blockIndex, assignmentId, channel) => void
```

Aggiorna `distributionChannel` sul singolo `LessonAssignment` senza toccare il resto del piano.

**4. `components/LessonPreparationTab.tsx` — aggiungere prop e wiring (solo `Edit`)**

Aggiungere `onUpdateAssignmentChannel` alle props e passarla ad `AssignmentPlanSection`.

**5. `components/MainApp.tsx` — wiring `handleUpdateAssignmentChannel` (solo `Edit`)**

Seguire il pattern factory esistente in `blockNoteHandlers`.

### Note di implementazione critiche

- **Non usare dropdown con posizionamento assoluto** per i canali — le pill inline sono il pattern approvato (CLAUDE_PROTOCOL principio 9).
- **Non duplicare la logica Classroom** — se `classroomUrl` è già compilato nel blocco, linkarlo. Non creare un secondo campo URL.
- **Il piano di distribuzione è sola lettura** — non è modificabile inline, solo copiabile. Le modifiche avvengono sulle singole card gruppo.
- **`handleUpdateAssignmentChannel` deve usare `updateConversation` tramite functional updater** — non `setConversations` diretto. Seguire il pattern in `blockNoteHandlers.ts`.

### File da toccare (in ordine)
1. `components/AssignmentPlanSection.tsx` — Edit (pill canali + piano riepilogativo)
2. `components/handlers/blockNoteHandlers.ts` — Edit (handleUpdateAssignmentChannel)
3. `components/MainApp.tsx` — Edit (wiring)
4. `components/LessonPreparationTab.tsx` — Edit (prop aggiuntiva)

### Verifica post-implementazione
```bash
grep -n "distributionChannel\|handleUpdateAssignmentChannel" components/AssignmentPlanSection.tsx
grep -n "export default MainApp" components/MainApp.tsx  # deve restituire esattamente 1 riga
# Nessun dropdown assoluto:
grep -n "absolute\|z-\[" components/AssignmentPlanSection.tsx  # deve restituire 0 righe
```

---

*Prompt generati il 2026-06-04 — basati su stato codebase ADA a quella data.*
