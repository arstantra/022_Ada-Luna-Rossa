# Audit Codebase ADA — 2026-05-23

Audit completo di tutti i file sorgente. Ogni voce indica file, riga e gravità.

---

## 🔴 BUG CRITICI

### 1. `canonicalAutoLabels` — confronto stringa con se stessa (MainApp.tsx:163)

```ts
// SBAGLIATO — compara l.name con l.name: sempre true → `find` restituisce sempre labels[0]
const canonicalAutoLabels = autoLabelNames.map(name =>
    labels.find(l => l.name.toLowerCase() === l.name.toLowerCase())
).filter((l): l is Label => !!l);

// CORRETTO
const canonicalAutoLabels = autoLabelNames.map(name =>
    labels.find(l => l.name.toLowerCase() === name.toLowerCase())
).filter((l): l is Label => !!l);
```

**Effetto:** tutte e tre le etichette auto (`In Progettazione`, `Progettazione Completata`, `Svolta`) vengono mappate alla **prima etichetta** presente nell'array `labels`. Se quella prima etichetta non corrisponde al `targetLabelName` cercato, `canonicalTargetLabel` risulta `null` e nessuna etichetta auto viene applicata alle conversazioni. Il sistema di lifecycle-label è di fatto rotto per la maggior parte degli utenti.

**Fix immediato:** sostituire `l.name.toLowerCase()` con `name.toLowerCase()` nella `find`.

---

### 2. `StrategicDashboardView` legge `teacherProfile` da `localStorage` (StrategicDashboardView.tsx:41-43)

```ts
useEffect(() => {
    const profile = localStorage.getItem('ada-teacher-profile');
    if (profile) setTeacherProfile(profile);
}, []);
```

**Effetto:** l'app usa IndexedDB come storage primario (`db.saveSetting`). Se il profilo docente è stato salvato **solo** su IndexedDB (tutti gli utenti dalla migrazione in poi), `localStorage.getItem` restituisce `null` → `teacherProfile` resta stringa vuota → `getExactDateForBlock` non riesce a calcolare l'anno scolastico → le date delle pill blocco mostrano `N/D` invece della data corretta.

**Fix:** passare `teacherProfile` come prop da `MainApp`/`masterContext` invece di leggerlo da localStorage (esattamente come fanno tutti gli altri componenti).

---

## 🟡 DEAD CODE — Da rimuovere

### 3. `handleStartReview` mai collegata all'UI (MainApp.tsx:835-839)

```ts
const handleStartReview = useCallback((conversationId: string) => {
    handleSelectConversation(conversationId);
    handleSendPlanningMessage("Avvia consuntivo", undefined, { action: 'start_review' });
    showToast("Flusso di consuntivo avviato.", "info");
}, [handleSelectConversation, handleSendPlanningMessage, showToast]);
```

La funzione è definita ma non passata a nessun componente figlio come prop. Nessun bottone nell'UI la attiva. L'unica traccia è questa definizione.

**Nota aggiuntiva:** se venisse ripristinata avrebbe una race condition — `handleSelectConversation` aggiorna `activeConversationId` in modo asincrono, ma `handleSendPlanningMessage` usa `activeConversation` dalla closure che è ancora il vecchio valore.

**Fix:** rimuovere la funzione, oppure implementarla correttamente usando `conversationsRef.current` invece di `activeConversation`.

---

### 4. `pendingValidationContent` e `isReplacingContent` in `BlockDetails` (types.ts:148-149)

```ts
pendingValidationContent?: string;
isReplacingContent?: boolean;
```

Questi campi sono **solo resettati** in `handleReEditBlock` (`usePlanning.ts:453-454`) ma non vengono mai impostati a valori significativi da nessuna parte nel codebase. Sono relitti di una versione precedente del flusso di validazione.

**Fix:** rimuovere i due campi da `types.ts` e le relative righe di reset in `usePlanning.ts`.

---

### 5. `weekConversations` e `onSelectWeekConversation` — props mai usate (PlanningView.tsx:52-53)

```ts
weekConversations?: Conversation[];
onSelectWeekConversation?: (id: string) => void;
```

Entrambe le props sono dichiarate nell'interfaccia, distrutterate nella firma del componente e passate da `MainApp.tsx:1430`, ma non sono mai **usate** nel corpo di `PlanningView`. Non vengono passate a nessun sottocomponente né usate in calcoli.

**Fix:** rimuovere le props dall'interfaccia, dalla firma, e dal punto di chiamata in `MainApp`.

---

### 6. `addFonte`, `removeFonte`, `updateFonte`, `promoteFonteFromWebliografia` in `usePlanning.ts` (righe 469-570)

Queste quattro funzioni sono esportate da `usePlanning` ma **non sono mai importate né usate in `MainApp.tsx`**. `PlanningView` reimplementa localmente tutta la logica delle fonti tramite `handleUpdateBlockDetails`.

**Fix:** rimuovere le quattro funzioni da `usePlanning.ts` e dall'oggetto `return`. La logica è già correttamente gestita in `PlanningView`.

---

### 7. `webliografiaRilevata` in `PlanningView` — useMemo inutilizzato (PlanningView.tsx:179-186)

```ts
const webliografiaRilevata = useMemo(() => {
    if (!activeBlock?.messages) return [];
    const uris = new Set<string>();
    activeBlock.messages.forEach(msg => {
        msg.sources?.forEach(s => { if (s.uri) uris.add(s.uri); });
    });
    return Array.from(uris);
}, [activeBlock?.messages]);
```

Il valore calcolato non viene passato a `BlockWorkspaceView` né usato altrove in `PlanningView`. La stessa computazione avviene **dentro `BlockWorkspaceView`** (righe 60-67) dove viene effettivamente usata per `FontiDrawer`.

**Fix:** rimuovere il `useMemo` da `PlanningView`.

---

## 🟠 INCONSISTENZE LABEL

### 8. "Aggiungi al Master" vs "Aggiungi in Coda" (usePlanning.ts:397)

```ts
// Codice attuale
{ label: "Aggiungi al Master", payload: { action: 'add_validated_content_as_new_block', ... } },

// CLAUDE.md (fonte di verità)
// Label atteso: "Aggiungi in Coda"
```

Il label mostrato nel pulsante non corrisponde alla documentazione in CLAUDE.md. La label "Aggiungi al Master" è ambigua rispetto a "Trasferisci al Master" (che fa un'azione diversa). "Aggiungi in Coda" è più chiaro: aggiunge un nuovo `ContentBlock` in coda ai precedenti.

**Fix:** cambiare `"Aggiungi al Master"` in `"Aggiungi in Coda"` in `usePlanning.ts:397`.

---

## 🔵 AMBIGUITÀ DI DESIGN / ATTENZIONE

### 9. `StartReviewPayload` — tipo senza handler dedicato (types.ts + usePlanning.ts)

Il tipo `StartReviewPayload = { action: 'start_review' }` è definito in `types.ts` e incluso in `PlanningActionPayload`, ma il `switch` in `usePlanning.ts` non ha un `case 'start_review'`. Quando triggerata (solo da `handleStartReview` che è dead code, vedi punto 3), cade al flusso AI con il testo "Avvia consuntivo" come messaggio utente.

Questo potrebbe essere intenzionale (l'AI gestisce il consuntivo), ma il tipo esplicito fa credere che ci sia un handler dedicato. Se si vuole mantenere il flusso AI, il tipo `StartReviewPayload` può essere rimosso e la review può essere triggerata semplicemente mandando un messaggio testuale.

---

### 10. `ModeSelector.tsx` — riferimento in CLAUDE.md ma file non esiste

CLAUDE.md dice: `ModeSelector.tsx — alias vuoto → re-exporta ModePills per retrocompatibilità`. Il file non esiste nel filesystem. Se non ci sono import di `ModeSelector` nel codebase, il riferimento in CLAUDE.md è obsoleto.

**Verifica:** nessun `import.*ModeSelector` trovato nei sorgenti — il file è stato correttamente rimosso. Aggiornare CLAUDE.md rimuovendo il riferimento a `ModeSelector.tsx`.

---

### 11. `students` prop assente in `PlanningViewProps` ma passata tramite messaggi

`PlanningView` non riceve `students` come prop diretta. Gli studenti sono passati a `processPlanningMessage` in `MainApp.tsx:719` tramite i `PlanningMessageParams`. Questa è la scelta corretta (evita prop drilling), ma vale la pena documentarlo per chiarezza.

---

## 📋 RIEPILOGO AZIONI

| Priorità | File | Azione | Stato |
|----------|------|--------|-------|
| 🔴 Critica | `MainApp.tsx:164` | Fix confronto `l.name` → `name` in `canonicalAutoLabels` | ✅ Fixato |
| 🔴 Critica | `StrategicDashboardView.tsx:41-43` | Sostituire `localStorage.getItem` con prop da `masterContext` | ✅ Fixato |
| 🟡 Alta | `usePlanning.ts:397` | Rinominare "Aggiungi al Master" → "Aggiungi in Coda" | ✅ Fixato |
| 🟡 Alta | `MainApp.tsx:835-839` | Rimuovere `handleStartReview` (dead code) | ✅ Rimosso |
| 🟡 Alta | `types.ts:148-149` | Rimuovere `pendingValidationContent` e `isReplacingContent` | ✅ Rimosso |
| 🟡 Alta | `PlanningView.tsx:52-53` | Rimuovere `weekConversations` e `onSelectWeekConversation` | ✅ Rimosso |
| 🟡 Alta | `usePlanning.ts:469-570` | Rimuovere le 4 funzioni fonti esportate ma non usate | ✅ Rimosso |
| 🟡 Alta | `PlanningView.tsx:179-186` | Rimuovere `webliografiaRilevata` useMemo inutilizzato | ✅ Rimosso |
| 🔵 Bassa | `CLAUDE.md` | Rimuovere riferimento a `ModeSelector.tsx` | ✅ Aggiornato |
| 🔵 Bassa | `CLAUDE.md` | Aggiornare `PlanningViewProps` (rimosso `students`) | ✅ Aggiornato |
| 🔵 Pendente | `usePlanning.ts` | Rimuovere parametri `addEvaluationToStudent`/`recordAttendanceForBlock` mai usati | ⏳ Prossima sessione |
| 🔵 Bassa | `types.ts` | Valutare rimozione `StartReviewPayload` | ⏳ Prossima sessione |

---

---

## 🟡 TROVATO DOPO IL FIX — Pulizia residua

### 12. `addEvaluationToStudent` e `recordAttendanceForBlock` — parametri mai chiamati in `usePlanning` (usePlanning.ts:76, 431)

Questi due parametri del hook sono presenti nella firma e nella dependency array di `processPlanningMessage`, ma **non vengono mai chiamati** nel corpo del hook. Erano probabilmente usati da un vecchio case `start_review` poi rimosso.

**Fix (basso rischio):** rimuovere i due parametri dalla firma di `usePlanning`, aggiornare il sito di chiamata in `MainApp.tsx:87`, e ripulire i type alias `RecordAttendanceFunction`/`AddEvaluationFunction` nelle prime righe del file.

---

## 🟠 Audit `services/gemini.ts` — 2026-05-23

### Fix applicati

| Priorità | Descrizione | Riga | Stato |
|----------|-------------|------|-------|
| 🔴 | Rimosso `// @ts-nocheck` + aggiunto `Part` all'import SDK | 1-2 | ✅ |
| 🟡 | `fileParts: any[]` → `Part[]` in `buildFontiContext` | 46 | ✅ |
| 🟡 | `userParts: any[]` → `Part[]` in `streamChatResponse` | 215 | ✅ |
| 🟡 | Import `* as GeminiService` inutilizzato rimosso da `BlockWorkspaceView.tsx` | BWV:9 | ✅ |
| 🟠 | `extractArgs` doppia chiamata → assegnato a `args` in `generateGroupSuggestions` | 307-308 | ✅ |
| 🟠 | `themeSchema` inline → `weekThemeSchema` a livello modulo | 537→523 | ✅ |
| 🔵 | JSDoc multi-riga su `extractArgs` → una riga | 11-18 | ✅ |
| 🔵 | Commenti COSA rimossi/accorciati (buildFontiContext, HELPER, userParts, fontiText) | vari | ✅ |

---

## ✅ Codice verificato — Nessun problema trovato

- `useConversations.ts` — pattern `pendingSavesRef` corretto e documentato
- `DocumentEditor.tsx` — flush-on-unmount presente e funzionante
- `ModePills.tsx` — implementazione corretta, zero z-index
- `BlockWorkspaceView.tsx` — `activeTab` come prop da `PlanningView`, no tab bar interno
- `services/db.ts` — tutti gli store IndexedDB corretti, v4 include `blockFiles`
- `useMasterContext.ts` — tutti i settings su IndexedDB, nessun localStorage diretto
- `Sidebar.tsx` — struttura navigazione allineata al CLAUDE.md, accent line viola, no font-semibold sui NavItem attivi
- `MessageView.tsx` — badge "Trasferito"/"Aggiunto"/"Sostituito" corretto, compatibilità legacy `boolean` OK
- `services/gemini.ts` — tutte le funzioni esportate in uso, tipi corretti, schema a livello modulo
