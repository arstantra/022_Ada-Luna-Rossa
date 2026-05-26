# ADA — Architettura IN AULA e MONITORAGGIO

> Documento di riferimento per sviluppo e manutenzione.
> Leggi insieme a `CLAUDE.md` e `ADA_INAULA_IMPLEMENTAZIONE_STEPS.md`.
> Aggiornato: 2026-05-27

---

## Contesto: il flusso completo del docente

```
GESTIONE DEL CORSO → PROGETTAZIONE → [PREPARAZIONE] → IN CORSO → ARCHIVIO → MONITORAGGIO
```

| Fase | Cosa si fa | Dove vive |
|------|-----------|-----------|
| Gestione del Corso | Profilo docente, La Rotta, studenti, Personalità Ada | FoundingDocumentsView, RouteView, AdaPersonalityView |
| Progettazione | COSA (struttura contenuto) + COME (tipologia pedagogica), master content | StrategicDashboardView, PlanningView/BlockWorkspaceView |
| **Preparazione** | COME nel dettaglio: formato materiali, scelta tool, composizione gruppi | **Tab dentro InAulaView** ← NUOVO |
| In Corso | Presenze, materiali attivi, note libere, valutazioni | InAulaView (tab In Corso) |
| Archivio | Storico lezioni archiviate, consultazione, riapertura | InAulaView (tab Archivio) |
| Monitoraggio | Dashboard consuntiva: trend aula, gruppi, studenti | MonitoraggioView (Andamento Aula, Gruppi, Studentesse) |

---

## Sezione IN AULA — Struttura View

### InAulaView — tre tab con ciclo di vita

`InAulaView` ha tre tab che seguono il ciclo di vita del blocco lezione:

```
┌─────────────────────────────────────────────────────────┐
│  [Preparazione]  [In Corso]  [Archivio]                  │
├─────────────────────────────────────────────────────────┤
│  contenuto del tab attivo                               │
└─────────────────────────────────────────────────────────┘
```

**Tab attivo di default** segue `lessonState`:
- `progettata` → apre su **Preparazione**
- `in_corso` → apre su **In Corso** (Preparazione accessibile ma secondario)
- `archiviata` → apre su **Archivio**

---

### Tab 1: Preparazione

**Scopo**: sviluppare il COME nel dettaglio, partendo dal master content.

**Sezioni interne:**

#### 1a — Formato materiali
- Punto di partenza: `contentBlocks` del blocco (master content, il "cosa" già sviluppato in Progettazione)
- L'insegnante decide il formato di delivery:
  - 📐 Slide (Canva, Gamma, Google Slides, PowerPoint…)
  - 🎬 Video (con tool esterno)
  - 📄 Paper / dispensa da studiare
  - 🔍 Traccia di ricerca / progetto
  - 🖨 Materiale da stampare e distribuire
- Ada consiglia il tool più adatto in base al contenuto del master

#### 1b — Repository materiali lezione
- Lista di `LessonMaterial` (vedi modello dati sotto)
- Ogni materiale è: titolo + URL (Drive, Canva, ecc.) + tipo + note opzionali
- Opzione: indirizzare il materiale a tutta la classe, a un gruppo specifico, o a uno studente specifico (differenziazione)
- **No contenuto nativo nel DB** — solo link + metadati. Drive è il repository principale.

#### 1c — Composizione gruppi
- Accesso alla funzione GroupManagement
- Imposta N persone per gruppo
- Ada suggerisce composizione bilanciata con **selettore criteri**:
  - Livello di competenza
  - Stile di apprendimento
  - Dinamiche relazionali (segnalate dal docente)
  - Mix casuale
- Modifica manuale post-suggerimento
- Salva come `lessonGroups` sul blocco

---

### Tab 2: In Corso

**Sezioni interne:**

#### 2a — Registro presenze
- Lista studenti della classe con toggle presente/assente/in ritardo
- Salva su `block.attendance` (già esiste parzialmente in `handleRecordAttendanceForBlock`)

#### 2b — Materiali attivi
- Mostra i materiali preparati nel Tab 1 come card cliccabili
- Click apre l'URL nel browser
- Possibilità di aggiungere materiali al volo (link rapido)

#### 2c — Valutazioni
- Inserimento manuale voti/osservazioni per studente
- Non necessariamente da Classroom — anche voti orali, osservazioni formative
- Struttura: `studentId`, `value` (numerica o descrittiva), `type` ('orale'|'scritto'|'pratico'|'formativo'), `notes`

#### 2d — Note libere docente
- Campo textarea ampio e libero
- Ada (su richiesta o automaticamente alla chiusura) estrae:
  - Livello di engagement percepito
  - Segnali individuali su studenti
  - Osservazioni sui gruppi
  - Imprevisti / criticità
- Il testo grezzo e l'analisi strutturata vengono entrambi salvati

---

### Tab 3: Archivio

- Lista di tutti i blocchi con `lessonState === 'archiviata'`, ordinati per data
- Card riassuntiva: data · tipologia · tema · presenze summary · note snippet
- Azione: "Riapri lezione" → torna a `in_corso` (con conferma)
- Azione: "Vai al blocco" → naviga in StrategicDashboard/PlanningView

---

## Sezione LABORATORI E STRUMENTI

**Spostata da CONTENUTI DEL CORSO → IN AULA** (appartiene al fare, non al progettare).

### Struttura

#### 🧰 Toolkit
- Card link organizzate per argomento/categoria (già esiste in `ToolkitView`)
- Le card sono semplici link a strumenti esterni
- Categorie suggerite: AI (Gemini, Copilot…), Presentazioni, Produttività Microsoft, Video, Ricerca, Disciplinari
- Aggiungere link: registro elettronico, libro digitale adottato, risorse istituzionali

#### 📓 I Miei Notebook (NotebookLM)
- Gallery card dei notebook dell'insegnante (già esiste in `NotebookLMView`)
- Ogni card: titolo notebook + link diretto a notebooklm.google.com
- Kit di estrazione prompt (già implementato per PTOF)

#### 🎓 Google Classroom
- Link diretto al corso su Classroom
- Salvato in `courseClassroomUrl` (o simile) nei dati del profilo corso
- Pulsante "Apri Classroom" (stile outline sky, come il pattern dei link esterni)

#### 👥 Gestione Gruppi
- Funzione per impostare composizione gruppi (già esiste in `GroupsArchiveView`)
- Integrata anche in Tab 1 Preparazione — qui è la vista archivio/storico
- Storico composizioni per lezione → utile per Monitoraggio Gruppi

#### 🤖 Ada consiglia il tool
- Piccolo assistente contestuale
- Input: descrizione di cosa si vuole fare con il master content
- Output: suggerimento tool + link rapido nel Toolkit

---

## Modello Dati — aggiunte a BlockDetails

```typescript
// Aggiunto a BlockDetails in types.ts

interface LessonMaterial {
  id: string;
  title: string;
  url: string;                  // Drive, Canva, Gamma, YouTube, ecc.
  type: 'slide' | 'video' | 'pdf' | 'paper' | 'ricerca' | 'stampa' | 'altro';
  notes?: string;               // note opzionali del docente
  targetAudience: 'classe' | 'gruppo' | 'studente';
  targetId?: string;            // groupId o studentId se targetAudience !== 'classe'
  addedAt: string;              // ISO timestamp
}

interface LessonEvaluation {
  id: string;
  studentId: string;
  value: string | number;       // es. "7" o "ottimo" — flessibile
  type: 'orale' | 'scritto' | 'pratico' | 'formativo' | 'altro';
  notes?: string;
  date: string;                 // ISO
}

interface LessonNoteAnalysis {
  engagementLevel: 'basso' | 'medio' | 'alto';
  studentSignals: Array<{ studentId: string; signal: string; type: 'positivo' | 'attenzione' }>;
  groupNotes: Array<{ groupId?: string; note: string }>;
  classNotes: string[];         // osservazioni generali
  rawNotes: string;             // testo originale del docente
  analyzedAt: string;
}

// Aggiunte a BlockDetails
lessonMaterials?: LessonMaterial[];
lessonEvaluations?: LessonEvaluation[];
lessonNoteAnalysis?: LessonNoteAnalysis;
lessonGroups?: StudentGroup[];  // composizione gruppi per questa lezione specifica
```

---

## Sezione MONITORAGGIO — Dashboard Consuntiva

### Filosofia
Il monitoraggio non è un registro voti. È un **cruscotto di temperatura** che mostra trend, segnali, equilibri. I dati arrivano da: presenze, valutazioni inserite, analisi note Ada.

### Andamento Aula
- **Gantt consuntivo** vs Gantt di progetto: cosa è stato effettivamente fatto vs pianificato
- **Radar equilibrio didattico consuntivo** vs Radar di progetto: tipologie di lezione usate vs pianificate
- Heatmap presenze: griglia settimane × studenti, colore per % presenza
- Indice di engagement: aggregato dalle analisi note Ada, trend nel tempo
- Alert: studenti con segnali ripetuti di attenzione

### Andamento Gruppi
- Storico composizioni: quali studenti hanno lavorato insieme, quante volte
- Efficacia percepita (dal campo note del docente, analizzato da Ada)
- Suggerimenti Ada per la prossima composizione basati sullo storico

### Andamento Studentesse/Studenti
- Profilo individuale: presenze % · valutazioni trend · segnali Ada nel tempo
- Vista comparativa: posizionamento rispetto alla media classe (senza ranking esplicito)
- Flag di attenzione personalizzati (es. "3 assenze consecutive", "calo engagement")
- Collegamento con `StudentProfileView` esistente

### Dati → Monitoraggio (pipeline)

```
Presenze (per blocco)          ┐
Valutazioni manuali            ├──→ DB (IndexedDB) ──→ MonitoraggioView
Note docente → Ada analisi     ┘                       (aggregazione in useMemo)
```

Non serve un backend separato: tutto vive in IndexedDB, i dashboard calcolano i trend in `useMemo` al momento del render, come già fa `StrategicDashboardView` con `progressStats`.

---

## Sidebar — Struttura Aggiornata

```
[Conversa con Ada]  — button gradient viola

▾ CONTENUTI DEL CORSO
  • Progettazione del Corso    (→ strategic_dashboard)
  • Analisi del Corso          (→ gantt) ← Gantt + Radar di PROGETTO

▾ IN AULA                      ← RIORGANIZZATA
  • Lezione                    (→ in_aula: tab Preparazione | In Corso | Archivio)
  ▾ Laboratori e Strumenti     ← SPOSTATO QUI da Contenuti
      ↳ Toolkit                (→ toolkit)
      ↳ I Miei Notebook        (→ notebooklm)
      ↳ Classroom              (link esterno)
      ↳ Gruppi                 (→ groups_archive)

▾ MONITORAGGIO
  • Andamento Aula             (→ classroom_trend) ← POTENZIATO: Gantt+Radar consuntivi
  • Gruppi                     (→ groups_archive o monitoraggio_gruppi)
  • Studentesse                (→ students / student_profile)

▾ GESTIONE DEL CORSO
  • Documenti Fondanti         (→ founding_documents)
  • La Rotta                   (→ la_rotta)
  • Personalità di Ada         (→ ada_personality)
  • Backup, API Key
```

**Nota importante su Gantt e Radar:**
- In CONTENUTI → "Analisi del Corso": Gantt e Radar sono **di PROGETTO** (cosa ho pianificato)
- In MONITORAGGIO → "Andamento Aula": Gantt e Radar sono **CONSUNTIVI** (cosa ho effettivamente fatto), con confronto sovrapposto progetto vs reale

---

## View ID aggiornati / nuovi

| View | ID | Note |
|------|----|------|
| InAulaView unificata | `'lezione'` | Sostituisce `'lezione_in_corso'` + `'archivio_lezioni'`, tab interno gestisce il sub-stato |
| Archivio lezioni | Tab interno a `'lezione'` | Non più view separata |
| Monitoraggio aula | `'classroom_trend'` | Esistente, da potenziare con Gantt+Radar consuntivi |
| Monitoraggio gruppi | `'monitoraggio_gruppi'` | Nuovo, o unificato con `'groups_archive'` |

---

## Regole di Design da rispettare in IN AULA

- **Materiali**: card con icona tipo + titolo + link esterno + badge targetAudience. Stile coerente con Toolkit.
- **Presenze**: toggle semplice per studente, non un form complesso. Salvataggio immediato.
- **Note libere**: textarea full-width con debounce autosave (stesso pattern di DocumentEditor). Ada analizza su richiesta o alla chiusura.
- **Valutazioni**: input inline per studente, tipo selezionabile, campo notes opzionale. Non simulare un registro elettronico.
- **Gruppi**: visualizzati come card colorate con lista nomi. Il numero di gruppi si deriva da (N studenti / persone per gruppo).
- **Ada consiglia tool**: risposta testuale breve, non un wizard complesso. Una frase + link nel Toolkit.
