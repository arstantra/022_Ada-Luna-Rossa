# NOTE — Feature da implementare

## Drive

- [ ] **Integrazione diretta Google Drive** (connector MCP): permettere di sfogliare e selezionare file direttamente dal Drive senza dover incollare i link manualmente. Attualmente si incolla il link alla cartella/file e si usa il pulsante "Apri Drive" come accesso rapido.

## Materiali

- [ ] **Libreria master attività**: creare un archivio centralizzato di tutti i master delle attività generati, consultabile e riutilizzabile da qualsiasi blocco in Preparazione. Al momento le attività vivono dentro i singoli blocchi senza un repository autonomo.

## Gestione del Corso

- [ ] **URL Drive del corso in Documenti Fondanti / Gestione Corso**: il campo URL cartella Drive del corso è attualmente memorizzato nel tab Preparazione (localStorage `ada-course-drive-url`). Valutare se spostarlo/duplicarlo nella sezione Gestione del Corso per una configurazione più consapevole.

## In Aula — futuro

- [ ] **Caricamento diretto file Drive in Materiali di Lezione**: invece di incollare URL, permettere il pick diretto di PDF/PPTX/immagini dal Drive tramite connector.

## Laboratorio di Preparazione — in sviluppo

Spec completa (Fasi A, B, C) in `docs/PROMPT_PREPARAZIONE.md`.

## Verifiche e Attività in Preparazione *(post Fase C)*

- [ ] **Verifiche formative in Preparazione**: progettare e associare verifiche al blocco già nella fase di preparazione (non solo durante la lezione). Gap consapevole: ADA delega l'esecuzione a Classroom via link, non duplica il registro voti. Valutare se collocare in `LessonPreparationTab` o come sezione separata in Progettazione.
- [ ] **Attività strutturate in Preparazione**: possibilità di creare attività (già esiste `Activity` in `BlockDetails`) direttamente dal piano consegne, associandole a un gruppo/studente. Al momento le attività si lanciano solo dal tab "Laboratorio" in PlanningView.

## Canali di distribuzione — altri possibili *(da valutare)*

- [ ] **QR code generato da ADA**: a partire da un URL (Drive link, Padlet, Classroom) generare un QR code stampabile inline. Nessuna API esterna necessaria — libreria `qrcode` pura JS/Canvas.
- [ ] **Moodle / LMS scolastico**: canale opzionale se la scuola usa Moodle. Pattern: link diretto + istruzioni per il docente. Zero integrazione API (principio "zero manutenzione sulle integrazioni").
