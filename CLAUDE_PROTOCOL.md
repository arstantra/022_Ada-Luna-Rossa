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

| File | Righe |
|---|---|
| `components/InAulaView.tsx` | ~988 |
| `services/gemini.ts` | ~863 |
| `components/StrategicDashboardView.tsx` | ~687 |
| `components/BlockWorkspaceView.tsx` | ~601 |
| `components/FoundingDocumentsView.tsx` | ~578 |
| `components/GanttView.tsx` | ~560 |
| `components/MainApp.tsx` | ~509 |
| `hooks/usePlanning.ts` | ~462 |
| `components/PlanningView.tsx` | ~482 |

Handler in `components/handlers/` (45–228 righe): sempre `Edit`, mai `Write` — sono file esistenti.

### Se si trova un file troncato
1. Non riscrivere con `Write` — peggiora il problema
2. Recuperare da git (GitHub Desktop → discard changes)
3. Riapplicare le modifiche con `Edit` su base pulita

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

- [ ] Dimensioni radar per studente: mappatura EQF vs dimensioni operative (partecipazione, autonomia, completamento, comprensione)
- [ ] Formato `DetachedLesson` e punto di ingresso UI per la coda contenuti
- [ ] URL Classroom costruibili dai dati ADA (classe, compito, attività asincrona)
- [ ] Livello "Modulo" leggero nel dato — contenitore blocchi per Gantt e radar
- [ ] Verifica sommativa in fase di progettazione (gap consapevole — ADA delega a Classroom via link)

---

*Ultima revisione: 2026-05-27*
