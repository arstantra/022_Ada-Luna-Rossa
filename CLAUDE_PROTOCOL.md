# CLAUDE_PROTOCOL — Regole Operative + Strategia ADA

> Leggere dopo `CLAUDE.md`. Contiene: regole operative anti-troncamento, principi guida, agenda aperta.

---

## 1. Regola fondamentale — Edit vs Write

**MAI usare `Write` su file già esistenti.** `Write` riscrive il file intero e può troncare silenziosamente. `Edit` invia solo il frammento modificato.

| Operazione | Tool |
|---|---|
| Modificare file esistente | **`Edit`** sempre |
| Creare file nuovo < 200 righe | `Write` — ok |
| Creare file nuovo > 200 righe | `Write` + verifica `wc -l` subito dopo |

---

## 2. File a rischio troncamento (> 500 righe — solo `Edit`)

| File | Righe (2026-06-05) |
|---|---|
| `components/GanttView.tsx` | 1486 |
| `components/LessonPreparationTab.tsx` | 1285 |
| `services/gemini.ts` | 1243 |
| `components/InAulaView.tsx` | 973 |
| `components/StrategicDashboardView.tsx` | 867 |
| `components/FoundingDocumentsView.tsx` | 618 |
| `components/BlockWorkspaceView.tsx` | 614 |
| `components/MainApp.tsx` | 594 |
| `components/PlanningView.tsx` | 572 |
| `hooks/usePlanning.ts` | 458 |
| `components/handlers/blockHandlers_status.ts` | 302 |

Handler in `components/handlers/` (file multipli, 45–302 righe): sempre `Edit`, mai `Write` — sono file esistenti.

### Se si trova un file troncato
1. Non riscrivere con `Write` — peggiora il problema
2. Recuperare da git (GitHub Desktop → discard changes)
3. Riapplicare le modifiche con `Edit` su base pulita

### Bug ricorrente: coda duplicata in MainApp.tsx (Unterminated string literal)

**Sintomo**: build fallisce con `Unterminated string literal` nelle ultime righe del file — frammento JSX corotto che segue un secondo `export default MainApp;`.

**Causa**: un `Edit` che tocca la zona finale del file (ultimi ~20 righe) produce un duplicato parziale: il blocco `export default MainApp;` appare due volte, la seconda preceduta dal frammento di JSX che era il contesto `old_string`.

**Fix immediato**: leggere le ultime 30 righe del file, identificare il blocco duplicato, eliminarlo con `Edit`. La firma corretta è una sola occorrenza di `export default MainApp;` in cima ultime righe.

**Prevenzione**: dopo ogni `Edit` su `MainApp.tsx` che tocca le ultime 50 righe, verificare con `grep -n "export default MainApp" components/MainApp.tsx` — deve restituire esattamente **1 riga**. Se ne restituisce 2, eseguire subito il fix prima del commit.

---

## 3. Dove mettere file nuovi

- `components/handlers/` — handler estratti da MainApp (pattern `createXxxHandlers`, funzioni pure, no hook React)
- `hooks/` — logica con `useState`/`useEffect`
- `services/` — chiamate API o DB
- `components/` — JSX

---

---

## 4. Principi guida per decisioni future

1. **Non replicare Classroom.** Se Classroom lo fa bene, linkarlo. Ogni feature che duplica Classroom è spreco.
2. **Non progettare il curriculum.** Il libro di testo ha già i moduli. ADA li referenzia, non li ridisegna.
3. **La settimana è l'unità operativa.** Non il modulo (troppo lungo), non la singola lezione (troppo granulare). `WeekPlan → BlockDetails` è corretta e va preservata.
4. **Visivo prima che numerico.** Preferire radar, gantt, heatmap ai semplici numeri. I numeri nascondono, le forme rivelano.
5. **L'AI fa il lavoro cognitivo pesante.** Formazione gruppi, suggerimento differenziazione, analisi profilo classe — casi in cui l'AI aggiunge valore reale rispetto a un foglio Excel.
6. **Zero manutenzione sulle integrazioni.** Link profondi > API. Sempre.
7. **Separare calendario e contenuto.** Lo slot di calendario e il contenuto didattico sono due cose distinte. Le feature che li mescolano producono architetture fragili.
8. **Configurabile, non rigido.** Tipologie di lezione, dimensioni del radar, etichette: tutto deve adattarsi alla disciplina e allo stile del docente.
9. **No dropdown con posizionamento assoluto.** Il pattern approvato è sempre inline o pill — i dropdown hanno causato problemi cronici di z-index mai risolti.
10. **Il monitoraggio non è un registro voti.** È un cruscotto di temperatura: segnali, trend, equilibri. Non simulare un registro elettronico.

---

## 5. Feature futura — Coda dei contenuti

Quando si salta un blocco già pianificato, il contenuto si stacca dallo slot e finisce in una **coda** a livello di corso. Nessuno slittamento a cascata.

```
PRIMA: [L1 ✓] [L2 pianificata] [L3] [L4] [L5]
DOPO salta L2: [L1 ✓] [L2 saltata] [L3] [L4] [L5]
Coda: ⚠ "Contenuto L2 in sospeso — da collocare"
```

Il docente sceglie tra: **Rimanda** (prossimo blocco disponibile) · **Accorpa** (lezione doppia) · **Distribuisci su Classroom** · **Archivia** (resta nella storia, non ricollocato).

Implementazione: aggiungere `pendingContent?: DetachedLesson[]` su `Conversation`. Nessuna rinumerazione, nessuna logica ricorsiva.

---

## 6. Agenda aperta

### Implementato ✓
- [x] `tipologia` → 5 LessonType fissi, radar pentagono
- [x] `metodologia` → 13 TeachingMethodology, dropdown contestuale dal Progetto Didattico
- [x] `isFslPeriod` / `hasExternalExpert` / `isFuoriAula` — flag ortogonali con badge e campi testo
- [x] `blockTitle` + `TitleSuggestionModal` (3 varianti Diretto/Narrativo/Evocativo)
- [x] `ObjectiveSuggestionModal` (3 varianti Sintetico/Bilanciato/Articolato)
- [x] `classroomUrl` in `LessonPreparationTab`
- [x] `ContestoFisicoChart` in GanttView (fuori aula per modulo)

### Da fare
- [ ] `gemini.ts`: iniettare `metodologia` e `isFuoriAula`/`luogo` nel contesto AI dei blocchi (attualmente non passati al LLM)
- [ ] `ContestoFisicoChart`: incrocio metodologia x fuori aula
- [ ] Laboratorio di Preparazione Fasi A/B/C — spec in `docs/PROMPT_PREPARAZIONE.md`
- [ ] Dimensioni radar per studente: mappatura EQF vs dimensioni operative (partecipazione, autonomia, completamento, comprensione)
- [ ] Formato `DetachedLesson` e punto di ingresso UI per la coda contenuti (feature 5 — Coda dei contenuti)
- [ ] URL Classroom costruibili dai dati ADA (classe, compito, attività asincrona)
- [ ] Verifica sommativa in fase di progettazione (gap consapevole — ADA delega a Classroom via link)

---

*Ultima revisione: 2026-06-05*
