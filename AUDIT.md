# Audit Codebase ADA — Punto Zero 2026-05-23

Audit completo eseguito il 2026-05-23. Tutti i problemi trovati sono stati risolti nella stessa sessione.
Questo file è il punto di riferimento per le sessioni future: descrive lo stato attuale verificato, non la storia dei bug.

---

## ✅ Stato Attuale — Tutto Risolto

### Bug critici (risolti)
| File | Problema | Fix |
|------|----------|-----|
| `MainApp.tsx` | `canonicalAutoLabels` confrontava `l.name` con se stesso → sistema lifecycle-label completamente rotto | `l.name === name` |
| `StrategicDashboardView.tsx` | Leggeva `teacherProfile` da `localStorage` invece di IndexedDB → date blocchi sempre `N/D` | Prop da `masterContext` |

### Dead code rimosso (−144 righe + fix aggiuntivi)
| Rimozione | File |
|-----------|------|
| `handleStartReview` — mai collegata all'UI | `MainApp.tsx` |
| `pendingValidationContent`, `isReplacingContent` in `BlockDetails` | `types.ts` + `usePlanning.ts` |
| Props `weekConversations`, `onSelectWeekConversation` | `PlanningView.tsx` + `MainApp.tsx` |
| 4 funzioni fonti (`addFonte`, `removeFonte`, `updateFonte`, `promoteFonteFromWebliografia`) — reimplementate localmente in PlanningView | `usePlanning.ts` |
| `webliografiaRilevata` useMemo — calcolato dentro BlockWorkspaceView, non qui | `PlanningView.tsx` |
| Parametri `addEvaluationToStudent`, `recordAttendanceForBlock` dalla firma di `usePlanning` + type alias `RecordAttendanceFunction`/`AddEvaluationFunction` + import `Evaluation` | `usePlanning.ts` + `MainApp.tsx` |
| `StartReviewPayload` + `\| StartReviewPayload` dall'union | `types.ts` |
| Import namespace `* as GeminiService` inutilizzato | `BlockWorkspaceView.tsx` |

### Label e inconsistenze corrette
| Problema | Fix |
|----------|-----|
| "Aggiungi al Master" → etichetta ambigua | "Aggiungi in Coda" (`usePlanning.ts`) |
| `themeSchema` definito inline in `generateThemeFromBlocks` (ricreato ad ogni call) | `weekThemeSchema` a livello modulo (`gemini.ts`) |
| `extractArgs` chiamato due volte sullo stesso args in `generateGroupSuggestions` | Assegnato a `args` una volta |
| `// @ts-nocheck` in `gemini.ts` — mascherava `any[]` | Rimosso; `fileParts`/`userParts` ora `Part[]` |
| Commenti WHAT in `gemini.ts` (JSDoc multi-riga, HELPER FUNCTION, note ovvie) | Rimossi/compressi a una riga |

---

## ✅ Codice Verificato — Nessun Problema

Questi file sono stati letti e analizzati: nessun problema trovato.

| File | Nota |
|------|------|
| `useConversations.ts` | Pattern `pendingSavesRef` (due vie) corretto — non toccare |
| `DocumentEditor.tsx` | Flush-on-unmount (`pendingContentRef`) presente — non toccare |
| `ModePills.tsx` | Pill inline, zero z-index, zero dropdown |
| `BlockWorkspaceView.tsx` | `activeTab` come prop da `PlanningView`, nessun tab bar interno |
| `services/db.ts` | Tutti gli store IndexedDB corretti, v4 include `blockFiles` |
| `useMasterContext.ts` | Tutti i settings su IndexedDB, nessun localStorage diretto |
| `Sidebar.tsx` | Struttura navigazione allineata al CLAUDE.md, accent line viola, no font-semibold attivo |
| `MessageView.tsx` | Badge "Trasferito"/"Aggiunto"/"Sostituito" corretto, compatibilità legacy `boolean` OK |
| `services/gemini.ts` | 14 funzioni esportate, tutte in uso; tipi corretti; schemi a livello modulo; no @ts-nocheck |

---

## 🔍 Cosa Monitorare nei Prossimi Sviluppi

Questi non sono bug ma pattern che tendono a degradare nel tempo:

- **Dead import namespace**: ogni volta che si rimuove una feature da un componente, verificare che l'import `* as Service` non resti orfano.
- **Schema FunctionDeclaration inline**: i nuovi schema in `gemini.ts` vanno sempre definiti a livello modulo, mai dentro il corpo della funzione.
- **`any[]` in gemini.ts**: usare `Part[]` dall'SDK. Non reintrodurre `@ts-nocheck`.
- **Firma di `usePlanning`**: il hook accetta solo `(updateConversation, showToast)`. Le funzioni studente (`addEvaluationToStudent`, `recordAttendanceForBlock`) si chiamano direttamente in `MainApp`.
- **`PlanningActionPayload` union**: ogni nuovo payload va implementato anche con un `case` nel switch di `usePlanning`. Un tipo senza handler crea la falsa impressione di funzionalità esistente.
- **localStorage in componenti**: tutti i settings passano per IndexedDB via `masterContext`. Nessun componente legge localStorage direttamente (il bug di `StrategicDashboardView` ha dimostrato l'effetto silenzioso).
