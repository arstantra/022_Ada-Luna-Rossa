# ADA — Visione Fondante e Architettura Strategica

> Documento di riferimento per lo sviluppo. Aggiornato in modo incrementale man mano che la visione si approfondisce.
> Ultima revisione: 2026-05-24

---

## 1. Cos'è ADA (e cosa non è)

ADA non è un LMS. Non è un curriculum designer. È il **layer operativo intermedio** che manca al docente italiano.

Il docente nel 2026 ha già due strumenti:

| Strumento | Cosa fa | Limite |
|---|---|---|
| **Libro di testo** (digitale o cartaceo) | Struttura il curriculum in moduli, capitoli, obiettivi EQF | Non è operativo: non ti dice cosa fare lunedì |
| **Google Classroom** | Gestisce compiti, consegne, griglie di valutazione, feedback | Non pianifica: non sa dove sei nell'anno, non forma gruppi, non visualizza il profilo della classe |

**ADA abita il vuoto tra i due.**

```
[LIBRO DI TESTO]          [ADA]                      [CLASSROOM]
Struttura curricolare  →  Layer operativo         →  LMS / Grading
Moduli, obiettivi EQF     Pianificazione sett.        Compiti, consegne
                          Calendario lezioni            Griglie valutazione
                          Monitoraggio visivo      ←→  Link contestuali
                          Formazione gruppi AI
                          Materiali differenziati
```

ADA è il **cervello operativo del docente**: non dove si studia il curriculum, non dove si gestiscono i voti, ma dove si *dirige* la classe, settimana per settimana, con intelligenza aumentata.

---

## 2. Il nucleo irrinunciabile: la pianificazione settimanale

ADA nasce sulle **settimane** perché la settimana è l'unità operativa reale del docente — non il modulo (unità curricolare, troppo lunga), non la singola lezione (troppo granulare per pianificare l'anno).

La struttura `WeekPlan → BlockDetails` riflette esattamente questo: ogni settimana contiene uno o più blocchi-lezione, ognuno con titolo, obiettivo, data. Il risultato è un **calendario lezione per lezione dall'inizio alla fine dell'anno scolastico** — qualcosa che non esiste in nessun altro strumento.

### Il Modulo come riferimento, non come entità da progettare

Il campo `module` su `BlockDetails` non è un'entità orfana: è un **puntatore al libro di testo**. Il docente non progetta il modulo in ADA — il modulo esiste già nel manuale. In ADA dice: "questa settimana facciamo la seconda parte del Modulo 3."

La domanda operativa che ADA risponde è:
> *"Ok, ho il libro strutturato e ho Classroom per le consegne. Ma settimana per settimana, blocco per blocco, come organizzo il mio anno? Che parte del modulo faccio lunedì? A che punto siamo?"*

---

## 3. Il sistema a 4 contesti

Il sistema a 4 contesti riflette il **workflow del docente**, non la struttura del curriculum. Questo è intenzionale e corretto.

| Contesto | Cosa fa davvero | Termine definitivo |
|---|---|---|
| Contenuti | Pianificazione operativa del corso, settimana per settimana | **Progettazione** |
| In Aula | Esecuzione e gestione della lezione in tempo reale | **In Aula** |
| Monitoraggio | Lettura visiva del profilo classe/gruppo/studente | **Monitoraggio** |
| Gestione del Corso | Parametri di contesto entro cui ADA opera | **da definire** *(Cornice / Fondamenta — vedi §6)* |

### Cosa non è questo sistema

Non mappa Chi/Cosa/Come/Perché dello schema EQF — quello è un framework curricolare. Il sistema a 4 contesti è un framework operativo. I due piani sono complementari, non in competizione.

---

## 4. Tipologia di lezione (ex Pilastri)

### Origine e problema del termine originale

"Pilastro" nacque come classificazione della modalità didattica nel laboratorio di design della terza liceo — corso strutturato in modo atipico con tre tipi di lezione:

- **Pilastro di sintonizzazione** → lezione frontale teorica ("vi racconto il mondo")
- **Pilastro operativo** → lezione frontale procedurale ("vi mostro come si fa")
- **Laboratorio** → attività pratica guidata ("ora fate voi")

Un modello coerente per quel contesto specifico, ma con tre problemi:

1. **Il nome "Pilastro" è opaco** — non comunica nulla a chi non conosce quella storia
2. **È una soluzione di un corso diventata architettura globale** — non scala ad altre discipline
3. **È rigida** — tre tipologie fisse, non configurabili per disciplina o stile

### La soluzione: Tipologia di lezione, flessibile e configurabile

Il concetto rimane valido — sapere in fase di pianificazione se una lezione è teoria, procedura o pratica è utile per bilanciare il corso e guidare l'AI. Il nome e la struttura cambiano.

**Tipologia di lezione** è il "come" — la modalità pedagogica di conduzione della lezione. Valori di default (5 voci stabili):

| Tipologia | Descrizione |
|---|---|
| Frontale teorica | Trasmissione diretta di conoscenze |
| Frontale operativa | Dimostrazione di procedure e tecniche |
| Laboratorio | Attività pratica guidata, sperimentazione |
| Verifica | Valutazione formativa o sommativa |
| Discussione | Dialogo strutturato, debate, confronto |

I valori sono personalizzabili: per il corso di design tornano Sintonizzazione / Operativa / Laboratorio — ma come configurazione di *quel* corso, non come architettura globale.

**Nota**: UDA e FSL non sono tipologie di lezione — sono strutture di contenuto del corso *(vedi §4.1)*.

### Il "cosa" — struttura del contenuto

Separato dalla tipologia ("come"), il campo "cosa" identifica l'unità didattica del Progetto Didattico a cui il blocco si riferisce. Valori riconosciuti dal parser:

| Tipo | Prefisso nel Progetto Didattico | Descrizione |
|---|---|---|
| Modulo | `MODULO N:` | Unità curricolare principale |
| UDA | `UDA N:` | Unità di Apprendimento multidisciplinare |
| Educazione Civica | `EDUCAZIONE CIVICA:` | Blocchi dedicati all'educazione civica |
| FSL | `FSL N:` | Formazione Scuola Lavoro *(vedi §4.1)* |

Questi quattro tipi sono parsati da `constitutionParser.ts` e resi disponibili come `CourseContentUnit[]` via `ConstitutionCacheContext`.

### 4.1 FSL: da tipologia a flag ortogonale + CourseContentType (2026-05-24)

FSL (Formazione Scuola Lavoro) ha attraversato due fasi architetturali:

1. **Prima**: stato speciale del blocco (`status: 'formazione scuola-lavoro'`) — sbagliato perché mescolava calendari e contenuto.
2. **Poi**: tipologia di lezione (`tipologia: 'fsl'`) — ancora sbagliato perché FSL non è una *modalità pedagogica*, è una struttura istituzionale del periodo.

**Architettura attuale** — tre assi ortogonali:

| Asse | Campo | Valori | Descrizione |
|---|---|---|---|
| **Stato** | `status: BlockStatus` | `normale · saltato · da definire · annullato` | Cosa è successo allo slot di calendario |
| **Tipologia** ("come") | `tipologia?: LessonType` | `frontale_teorica · frontale_operativa · laboratorio · verifica · discussione` | Modalità pedagogica di conduzione |
| **Unità didattica** ("cosa") | `module?: string` | titolo dell'unità dal Progetto Didattico | A quale contenuto si riferisce il blocco |
| **Flag FSL** | `isFslPeriod?: boolean` | `true / undefined` | Badge visivo sky ortogonale agli altri tre |

Un blocco FSL può essere saltato, avere qualsiasi tipologia, riferirsi a qualsiasi unità didattica. `isFslPeriod` non altera né lo stato né la tipologia — è esclusivamente informazione istituzionale e visiva.

FSL come **struttura del corso** esiste nel Progetto Didattico con prefisso `FSL N:` ed è parsato come `CourseContentUnit { type: 'fsl' }` dal `constitutionParser`. Appare nel selettore "Cosa" dell'accordion blocco.

---

## 5. Workflow "Salta lezione" e la coda dei contenuti

### Il problema architetturale sottostante

In ADA lo **slot di calendario** (lunedì 3 marzo) e il **contenuto della lezione** (obiettivo, titolo, materiale) sono la stessa cosa — il blocco li contiene entrambi. Finché tutto va liscio funziona. Quando una lezione salta, i due concetti devono potersi separare.

La soluzione sbagliata è lo slittamento automatico a cascata: se il Modulo 1 ha 5 lezioni pianificate e si salta la L2, far diventare L3→L2, L4→L3, L5→L4 richiede logica ricorsiva, rompe blocchi già elaborati e può spingere contenuti fuori dall'anno scolastico.

### La soluzione: la coda dei contenuti

Quando si salta un blocco già pianificato, il contenuto **si stacca dallo slot** e finisce in una piccola **coda** a livello di corso. I blocchi successivi rimangono dove sono — nessuno slittamento.

```
PRIMA del salto:
[L1 ✓] [L2 pianificata] [L3 pianificata] [L4 pianificata] [L5 pianificata]

DOPO aver saltato L2:
[L1 ✓] [L2 saltata] [L3 pianificata] [L4 pianificata] [L5 pianificata]

Coda contenuti: ⚠ "Contenuto L2 in sospeso — da collocare"
```

La coda è visibile nella vista del corso. ADA suggerisce automaticamente il prossimo blocco disponibile come destinazione, ma non esegue da sola. Il docente sceglie tra quattro opzioni:

| Opzione | Comportamento |
|---|---|
| **Rimanda** | Il contenuto va al prossimo blocco disponibile (confermato dal docente) |
| **Accorpa** | Si unisce al blocco successivo, che diventa visivamente una "lezione doppia" |
| **Distribuisci su Classroom** | ADA costruisce il link per inviarlo come attività asincrona |
| **Archivia** | Il contenuto resta nella storia del blocco saltato, accessibile ma non ricollocato |

Se il blocco saltato era ancora vuoto (non pianificato), nessun punto di decisione — si marca saltato e si va avanti.

### Implementazione leggera

Aggiungere `pendingContent?: DetachedLesson[]` sulla `Conversation`. Una `DetachedLesson` è il contenuto del blocco saltato (obiettivo, titolo, materiale) senza slot di calendario. Nessuna rinumerazione, nessuna catena di aggiornamenti, nessuna logica ricorsiva.

---

## 6. Strumenti visivi di pianificazione

### 6.1 Gantt dei moduli

Vista temporale dell'intero anno scolastico. Complementare alla vista settimana/blocco — quella è chirurgica (il dettaglio), il Gantt è strategico (il quadro d'insieme).

- **Asse orizzontale**: settimane dall'inizio alla fine dell'anno
- **Barre orizzontali**: un modulo per barra, colorato per distinguerlo
- **Punti/segmenti nella barra**: i singoli blocchi-lezione
- **Settimana corrente**: evidenziata
- **Buchi nella barra**: lezioni saltate, visibili a colpo d'occhio

Funzione principale: accorgersi quando un modulo sta sforando, quando ci sono settimane non pianificate, o quando due moduli si sovrappongono più del previsto. È uno strumento di **controllo della coerenza temporale**.

### 6.2 Radar dell'equilibrio didattico

Applicato al corso o al singolo modulo — non alla singola lezione. Le dimensioni sono le tipologie di lezione configurate per quel corso.

Esempio per il laboratorio di design:
```
         Teoria
           ▲
    ______/|\______
   /       |       \
Laboratorio ─── Procedura
```

Funzione: il docente vede a colpo d'occhio se il modulo è sbilanciato (troppa teoria, poca pratica) e può riorientare la pianificazione delle settimane successive.

La stessa forma radar usata nel monitoraggio studenti (§7) e nella pianificazione crea coerenza visiva tra i due contesti — un solo tipo di grafico, due scopi diversi.

---

## 7. Il sistema di monitoraggio: tre livelli, visivo, non valutativo

ADA non replica il sistema di valutazione di Classroom. Lo **completa** con un cruscotto a tre livelli basato su segnali visivi, non su voti.

### Livello 1 — Aula
Cruscotto termico della classe. Non giudizi: *segnali diagnostici*.
- Distribuzione partecipazione
- Temperatura di comprensione percepita
- Completamento attività
- Strumento per il docente, non per lo studente

Corrisponde alla **verifica di aula anonima** dello schema pedagogico: rileva lacune diffuse per riorientare la didattica in corso d'opera, senza condizionare gli studenti con il voto.

### Livello 2 — Gruppo
**Formazione dei gruppi assistita dall'AI** — innovazione non presente in nessun tool mainstream.

Obiettivo: formare gruppi bilanciati su criteri multipli simultanei:
- Abilità eterogenee (per favorire peer learning)
- Affinità relazionale (per evitare conflitti)
- Distribuzione di profili (evitare che tutti i "trainers" finiscano insieme)

Il docente chiede: "formiamo i gruppi per questa attività" — ADA propone, il docente aggiusta.

### Livello 3 — Individuale
**Diagramma ragnatela (radar chart) per studente.**

Non un numero: un profilo visivo multidimensionale. Le dimensioni mappano la triade EQF (sa / sa fare / sa essere) o dimensioni operative (partecipazione, autonomia, completamento, comprensione).

Il vantaggio del radar rispetto al voto medio: uno studente con 7 piatto è completamente diverso da uno con 9-9-9-4-4 che ha un gap specifico. Il profilo visivo coglie squilibri che una media nasconde.

### Distribuzione differenziata
```
ADA osserva il profilo  →  suggerisce materiale differenziato  →  docente distribuisce
                                                                          ↓
                                                               Classroom riceve via link
```

---

## 8. Integrazione con Classroom: link contestuali, non API

**La scelta è deliberata**: nessuna integrazione API con Classroom.

Motivazioni:
- Google ha modificato i permessi delle API Classroom più volte
- Richiede verifica app, token in scadenza, manutenzione onerosa
- Per un'app monoutente o piccola community il rapporto costo/beneficio è sfavorevole

**Soluzione**: link contestuali profondi. ADA costruisce l'URL preciso di Classroom per la classe, il compito o l'attività corrente. Il docente fa un clic e atterra esattamente dove deve.

È integrazione senza integrazione — zero manutenzione, massima utilità pratica.

---

## 9. Nodi aperti e terminologia da definire

### 9.1 Il quarto contesto ✓ RISOLTO

**Nome definitivo: "Gestione del Corso"** — adottato in sidebar, view id `founding_documents` / `la_rotta` / `ada_personality` raggruppate sotto questa etichetta. La sezione è collassata di default nella sidebar.

### 9.2 Verifica sommativa

Manca un luogo in ADA dove il docente pianifichi la verifica finale di un modulo **in fase di progettazione** (non a posteriori). Nello schema EQF la verifica si progetta insieme agli obiettivi, non dopo.

Non urgente — ADA delega la parte valutativa a Classroom via link — ma è un gap consapevole da tenere presente.

---

## 10. Principi guida per le decisioni future

1. **Non replicare Classroom.** Se Classroom lo fa bene, linkarlo. Ogni feature che duplica Classroom è spreco.

2. **Non progettare il curriculum.** Il libro di testo ha già i moduli. ADA li referenzia, non li ridisegna.

3. **La settimana è l'unità operativa.** Non il modulo (troppo lungo), non la lezione (troppo granulare). La struttura WeekPlan → BlockDetails è corretta e va preservata.

4. **Visivo prima che numerico.** Nel monitoraggio e nella pianificazione preferire sempre rappresentazioni visive (radar, gantt, heatmap) ai semplici numeri. I numeri nascondono, le forme rivelano.

5. **L'AI fa il lavoro cognitivo pesante.** Formazione gruppi, suggerimento differenziazione, analisi profilo classe — questi sono i casi in cui l'AI aggiunge valore reale rispetto a un foglio Excel.

6. **Zero manutenzione sulle integrazioni.** Link profondi > API. Sempre.

7. **Separare calendario e contenuto.** Lo slot di calendario (giorno/settimana) e il contenuto didattico (obiettivo, materiale) sono due cose distinte. Le feature che li mescolano producono architetture fragili.

8. **Configurabile, non rigido.** Le tipologie di lezione, le dimensioni del radar, le etichette: tutto deve adattarsi alla disciplina e allo stile del docente, non imporre un modello unico.

---

## 11. Domande ancora aperte (agenda per le prossime sessioni)

> Risolte e rimosse: nome quarto contesto (→ "Gestione del Corso"); tipologie di lezione di default (→ `LESSON_TYPE_LABELS` in `constants.ts`, `tipologia` su `BlockDetails`); separazione "cosa/come" e ruolo di FSL (→ §4.1, refactor 2026-05-24: `LessonType` 5 voci, `CourseContentType` 4 voci, `isFslPeriod` flag ortogonale).

- [ ] Definire le dimensioni del radar chart per studente (mappatura EQF vs dimensioni operative)
- [ ] Progettare il flusso di formazione gruppi AI: quali dati in input, quale formato dell'output
- [ ] Stabilire quali URL di Classroom sono costruibili a partire dai dati ADA già disponibili
- [ ] Valutare se introdurre un livello "Modulo" leggero nel dato (contenitore che raggruppa blocchi correlati per il Gantt e il radar didattico)
- [ ] Definire il formato della `DetachedLesson` nella coda contenuti e il punto di ingresso UI per gestirla

---

*Documento vivo — aggiornare ad ogni sessione di riflessione architetturale.*
