# ADA — Visione Fondante e Architettura Strategica

> Documento di riferimento per lo sviluppo. Aggiornato in modo incrementale man mano che la visione si approfondisce.
> Ultima revisione: 2026-05-23

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

## 4. Il sistema di monitoraggio: tre livelli, visivo, non valutativo

ADA non replica il sistema di valutazione di Classroom. Lo **completa** con un cruscotto a tre livelli basato su segnali visivi, non su voti.

### Livello 1 — Aula
Cruscotto termico della classe. Non giudizi: *segnali diagnostici*.
- Distribuzione partecipazione
- Temperatura di comprensione percepita
- Completamento attività
- Strumento per il docente, non per lo studente

Corrisponde alla **verifica di aula anonima** dello schema pedagogico: rileva lacune diffuse per riorientare la didattica in corso d'opera, senza condizionare gli studenti con il voto.

### Livello 2 — Gruppo
**Formazione dei gruppi assistita dall'AI** — questa è l'innovazione più originale di ADA, non esistente in nessun tool mainstream.

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
Il ciclo completo:
```
ADA osserva il profilo  →  suggerisce materiale differenziato  →  docente distribuisce
                                                                          ↓
                                                               Classroom riceve via link
```

---

## 5. Integrazione con Classroom: link contestuali, non API

**La scelta è deliberata**: nessuna integrazione API con Classroom.

Motivazioni:
- Google ha modificato i permessi delle API Classroom più volte
- Richiede verifica app, token in scadenza, manutenzione onerosa
- Per un'app monoutente o piccola community il rapporto costo/beneficio è sfavorevole

**Soluzione**: link contestuali profondi. ADA costruisce l'URL preciso di Classroom per la classe, il compito o l'attività corrente. Il docente fa un clic e atterra esattamente dove deve.

È integrazione senza integrazione — zero manutenzione, massima utilità pratica.

---

## 6. Nodi aperti e terminologia da definire

### 6.1 Il quarto contesto: trovare il nome italiano

Il contenuto del quarto contesto (disciplina, documenti fondanti, profilo docente, personalità di Ada, etichette, backup, API key) è l'insieme dei parametri che definiscono il contesto entro cui ADA opera. Non è "gestione del corso" in senso pedagogico — è la cornice.

Candidati:
- **Cornice** — metaforico, descrive il ruolo (la cornice entro cui tutto funziona)
- **Fondamenta** — riprende "documenti fondanti", ha coerenza interna
- **Profilo del Corso** — descrittivo, neutro
- **Impostazioni** — tecnico, forse troppo informatico

*Da decidere prima della prossima iterazione UI.*

### 6.2 I Pilastri: rinominare o eliminare?

"Pilastro" non è un termine del lessico pedagogico riconosciuto. Probabilmente nacque come tentativo di aggiungere struttura curricolare (competenze trasversali, assi tematici) a livello di blocco-lezione.

Possibilità:
- **Eliminare**: se era ridondante con `module` e `objective`
- **Rinominare in "Traguardo"**: termine delle Indicazioni Nazionali italiane
- **Rinominare in "Competenza chiave"**: lessico EQF

*Prima di decidere: recuperare casi d'uso reali — cosa veniva scritto nel campo "pilastro" in pratica?*

### 6.3 Verifica sommativa

Manca un luogo in ADA dove il docente pianifichi la verifica finale di un modulo **in fase di progettazione** (non a posteriori). Nello schema EQF la verifica si progetta insieme agli obiettivi, non dopo.

Questo non è urgente — ADA può delegare la parte valutativa a Classroom via link — ma è un gap consapevole da tenere presente.

---

## 7. Principi guida per le decisioni future

1. **Non replicare Classroom.** Se Classroom lo fa bene, linkarlo. Ogni feature che duplica Classroom è spreco.

2. **Non progettare il curriculum.** Il libro di testo ha già i moduli. ADA li referenzia, non li ridisegna.

3. **La settimana è l'unità operativa.** Non il modulo (troppo lungo), non la lezione (troppo granulare). La struttura WeekPlan → BlockDetails è corretta e va preservata.

4. **Visivo prima che numerico.** Nel monitoraggio preferire sempre rappresentazioni visive (radar, heatmap, distribuzione) ai semplici numeri. I numeri nascondono, le forme rivelano.

5. **L'AI fa il lavoro cognitivo pesante.** Formazione gruppi, suggerimento differenziazione, analisi del profilo classe — questi sono i casi in cui l'AI aggiunge valore reale rispetto a un foglio Excel.

6. **Zero manutenzione sulle integrazioni.** Link profondi > API. Sempre.

---

## 8. Domande ancora aperte (agenda per le prossime sessioni)

- [ ] Decidere il nome definitivo del quarto contesto
- [ ] Chiarire il destino dei "Pilastri" (eliminare / rinominare / riposizionare)
- [ ] Definire le dimensioni del radar chart per studente (mappatura EQF vs dimensioni operative)
- [ ] Progettare il flusso di formazione gruppi AI: quali dati in input, quale formato dell'output
- [ ] Stabilire quali URL di Classroom sono costruibili a partire dai dati ADA già disponibili
- [ ] Valutare se introdurre un livello "Modulo" leggero nel dato (non un'entità da progettare, ma un contenitore che raggruppa blocchi correlati per la visualizzazione)

---

*Documento vivo — aggiornare ad ogni sessione di riflessione architetturale.*
