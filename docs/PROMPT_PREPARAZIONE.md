# Prompt chirurgici — Feature da implementare
> Ogni sezione è un prompt autonomo da incollare in Claude Code. Una volta implementata la feature, rimuovere la sezione e la voce corrispondente in `NOTE.md`.
> Claude legge CLAUDE.md e CLAUDE_PROTOCOL.md automaticamente — non serve ripetere le regole di stile.

---

## Bloom — Livello cognitivo sugli obiettivi

**Feature:** `bloomLevel` opzionale su `BlockDetails` — orienta il verbo d'azione dell'obiettivo generato da Ada nell'`ObjectiveSuggestionModal`.

**Riferimento in NOTE.md:** sezione "Progettazione del Corso → Livello Bloom sugli obiettivi didattici".

### Cosa aggiungere

**1. `types.ts` — nuovo tipo `BloomLevel` + campo su `BlockDetails`**

Aggiungere dopo i tipi `LessonType` / `TeachingMethodology`:

```ts
export type BloomLevel =
  | 'ricordare'
  | 'comprendere'
  | 'applicare'
  | 'analizzare'
  | 'valutare'
  | 'creare';
```

Aggiungere a `BlockDetails`:
```ts
bloomLevel?: BloomLevel;
```

**2. `constants.ts` — `BLOOM_LEVEL_LABELS`**

```ts
export const BLOOM_LEVEL_LABELS: Record<BloomLevel, string> = {
  ricordare:   'Ricordare',
  comprendere: 'Comprendere',
  applicare:   'Applicare',
  analizzare:  'Analizzare',
  valutare:    'Valutare',
  creare:      'Creare',
};
```

**3. `components/ObjectiveSuggestionModal.tsx` — aggiungere selettore livello Bloom**

Aggiungere uno stato locale `bloomLevel: BloomLevel | undefined` (default `undefined`).

Inserire prima del pulsante "Genera" una riga di pill selezionabili (una per livello, stile identico alle pill degli obiettivi — `text-[10px] font-mono`):

```
Livello cognitivo (opzionale):
[Ricordare] [Comprendere] [Applicare] [Analizzare] [Valutare] [Creare]
```

- Pill attiva: `bg-purple-500/20 text-purple-300 border border-purple-500/40 rounded-md px-2 py-0.5`
- Pill inattiva: `text-gray-500 hover:text-gray-300 rounded-md px-2 py-0.5`
- Clic su pill attiva → deseleziona (torna `undefined`)

Passare `bloomLevel` a `generateObjectiveSuggestions` (nuovo parametro opzionale).

**4. `services/gemini.ts` — aggiornare `generateObjectiveSuggestions`**

Aggiungere parametro opzionale `bloomLevel?: BloomLevel` alla firma (dopo i parametri esistenti).

Nel prompt interno, aggiungere condizionalmente:

```
${bloomLevel ? `\nIl livello cognitivo target è "${BLOOM_LEVEL_LABELS[bloomLevel]}" (tassonomia di Bloom). Usa verbi d'azione coerenti con questo livello nelle tre varianti.` : ''}
```

**5. `components/handlers/blockHandlers.ts` — aggiornare `handleUpdateBlockObjective` / nessun handler nuovo**

Non serve un handler dedicato per `bloomLevel` — è stato locale al modal, non viene salvato su DB. L'obiettivo generato (testo) viene già salvato tramite `onUpdateObjective` esistente.

### File da toccare (in ordine)
1. `types.ts` — Edit (BloomLevel + campo BlockDetails)
2. `constants.ts` — Edit (BLOOM_LEVEL_LABELS)
3. `services/gemini.ts` — Edit (parametro bloomLevel in generateObjectiveSuggestions)
4. `components/ObjectiveSuggestionModal.tsx` — Edit (stato + pill + passaggio parametro)

### Verifica post-implementazione
```bash
grep -n "BloomLevel\|bloomLevel" types.ts
grep -n "BLOOM_LEVEL_LABELS" constants.ts
grep -n "bloomLevel" services/gemini.ts components/ObjectiveSuggestionModal.tsx
```


*Prompt generati il 2026-06-04 — basati su stato codebase ADA a quella data.*
