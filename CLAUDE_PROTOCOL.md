# CLAUDE_PROTOCOL — Regole Operative Anti-Troncamento

> **LEGGERE PRIMA DI QUALSIASI OPERAZIONE SUI FILE.**
> Questo file previene il problema più costoso del progetto: file troncati silenziosamente che consumano token in correzioni ripetute.

---

## 1. La regola numero uno (non derogabile)

**MAI usare il tool `Write` su file già esistenti.**

Il tool `Write` riscrive il file intero in un unico stream. Se il file è lungo, il contenuto viene tagliato silenziosamente senza errori. Il tool `Edit` invia solo il frammento modificato e non può troncare nulla per definizione.

| Operazione | Tool corretto |
|------------|--------------|
| Modificare un file esistente | **`Edit`** sempre |
| Creare un file nuovo (< 200 righe) | `Write` — ok |
| Creare un file nuovo (> 200 righe) | `Write` + verifica immediata con `wc -l` |

---

## 2. Soglie di rischio per dimensione file

| Righe | Rischio | Regola |
|-------|---------|--------|
| < 200 | Basso | `Write` accettabile per file nuovi |
| 200–500 | Medio | Solo `Edit` su file esistenti. Verifica `wc -l` dopo ogni `Write` su nuovo file |
| > 500 | Alto | Mai `Write`. Solo `Edit`. Se serve un rewrite strutturale, **spezzare prima il file** in unità più piccole, poi modificare |

### File ADA attualmente ad alto rischio (> 500 righe)

| File | Righe | Note |
|------|-------|------|
| `components/MainApp.tsx` | ~509 | ✅ Split completato 2026-05-25 — solo stato, hook, factory call, render |
| `services/gemini.ts` | 863 | Monolitico ma stabile — modificare solo con `Edit` |
| `components/InAulaView.tsx` | 988 | Solo `Edit` |
| `components/StrategicDashboardView.tsx` | 731 | Solo `Edit` |
| `components/BlockWorkspaceView.tsx` | 601 | Solo `Edit` |
| `components/FoundingDocumentsView.tsx` | 578 | Solo `Edit` |
| `components/GanttView.tsx` | 510 | Solo `Edit` |
| `components/PlanningView.tsx` | 482 | Solo `Edit` |
| `hooks/usePlanning.ts` | 462 | Solo `Edit` |

### File handler (nuovi — da `components/handlers/`)

| File | Righe | Soglia |
|------|-------|--------|
| `blockHandlers_status.ts` | 228 | Medio — solo `Edit` |
| `blockHandlers.ts` | 181 | Medio — solo `Edit` |
| `lessonHandlers.ts` | 203 | Medio — solo `Edit` |
| `messagingHandlers.ts` | 211 | Medio — solo `Edit` |
| `dataHandlers.ts` | 201 | Medio — solo `Edit` |
| `contentHandlers.ts` | 169 | Basso/Medio |
| `conversationHandlers.ts` | 119 | Basso |
| `blockNoteHandlers.ts` | 123 | Basso |
| `uiHandlers.ts` | 45 | Basso |

---

## 3. Procedura per modifiche a file esistenti

### Per ogni task che modifica un file esistente:

1. **Leggi il file prima** con `Read` (obbligatorio — il tool `Edit` richiede che il file sia stato letto)
2. **Usa `Edit` con `old_string` univoco** — includere abbastanza contesto (3–5 righe) per garantire unicità
3. **Non concatenare mai più di 3–4 `Edit` sullo stesso file senza verificare** che il file sia integro
4. **Per modifiche grandi** (> 50 righe da cambiare): spezzare in più `Edit` sequenziali, non in un unico blocco

### Verifica post-modifica (per file critici)

Dopo modifiche sostanziali a file > 500 righe, eseguire:
```bash
wc -l <percorso-file>
```
Il numero deve essere plausibile rispetto al numero di righe prima della modifica.

---

## 4. Checklist inizio sessione

Prima di iniziare qualsiasi task tecnico su ADA, leggere nell'ordine:

1. `CLAUDE.md` — architettura, design system, pattern di codice, regole "NON fare"
2. `CLAUDE_PROTOCOL.md` — questo file (regole operative anti-troncamento)
3. `ADA_VISIONE_FONDANTE.md` — solo se il task tocca architettura o nuove feature

Opzionale (solo se rilevante):
- `AUDIT_REPORT.md` — stato del codebase dopo l'ultimo audit (2026-05-24)
- `AUDIT_PROMPT.md` — prompt per lanciare un nuovo audit completo
- `REFACTOR_REPORT_2026-05-25.md` — documentazione tecnica dello split di MainApp.tsx in 9 factory handler

---

## 5. Split MainApp.tsx — COMPLETATO (2026-05-25)

`MainApp.tsx` è stato ridotto da **1619 a 509 righe** estraendo 56 handler in 9 file dedicati dentro `components/handlers/`. `tsc --noEmit` → EXIT:0 dopo il refactor.

### Struttura risultante

```
components/
  MainApp.tsx                  — 509 righe: stato, hook, factory call (useMemo), render
  handlers/
    blockHandlers.ts           — handler pianificazione blocchi (objective, theme, strategic data)
    blockHandlers_status.ts    — stato blocco, tipologia, FSL, salta/accorpa + createApplyBlockStatus
    conversationHandlers.ts    — mode, valutazione, openConversaConAda, startPlanningForWeek
    messagingHandlers.ts       — sendMessage, generateImage, sendPlanningMessage
    lessonHandlers.ts          — avvia/chiudi lezione, attendance, groups, artifacts, activities
    blockNoteHandlers.ts       — note lezione, analisi Ada, link, cloud link, notebook collegati
    contentHandlers.ts         — export contenuto, format blocks multi-blocco, updateWeekPlan
    dataHandlers.ts            — backup AES, import/restore, importEvaluation, exportCourseBook
    uiHandlers.ts              — selectStudent, navigateToBlock, openAddNotebookModal
```

### Pattern usato: factory function + useMemo

Ogni file `handlers/*.ts` esporta `createXxxHandlers(deps: XxxDeps)`. In `MainApp.tsx`:
```typescript
const { handler1, handler2 } = useMemo(
  () => createXxxHandlers({ dep1, dep2, ... }),
  [dep1, dep2, ...]
);
```
I React state setter (setIsLoading, setModalState, ecc.) sono referenze stabili → **non** vanno nelle deps del `useMemo`.

### Regola per future modifiche ai file handler

**Usare solo `Edit`** — i file handler sono tutti tra 45 e 228 righe, soglia medio/basso, ma sono già stati creati (non nuovi). Non riscrivere con `Write`.

---

## 6. Regole per file nuovi in questo progetto

- I file nuovi vanno in `components/handlers/` se contengono handler estratti da MainApp.tsx
- I file nuovi vanno in `hooks/` se contengono logica con `useState`/`useEffect`
- I file nuovi vanno in `services/` se contengono chiamate a API o DB
- I file nuovi vanno in `components/` se contengono JSX
- **Non creare file `.md` aggiuntivi** nella root senza aggiornare questo protocollo
- I file in `components/handlers/` usano il pattern `export function createXxxHandlers(deps: XxxDeps) { ... }` — non usare classi né hook React all'interno (sono funzioni pure, non componenti)

---

## 7. Cosa fare se si trova un file troncato

1. **Non riscrivere con `Write`** — questo peggiora il problema
2. **Recuperare dal git** (GitHub Desktop → discard changes sul file troncato)
3. **Riapplicare le modifiche necessarie con `Edit`** su base pulita
4. Se il file non è in git (nuovo), ricostruirlo pezzo per pezzo con `Write` su blocchi < 200 righe

---

*Ultima revisione: 2026-05-25 — Split MainApp.tsx completato*
