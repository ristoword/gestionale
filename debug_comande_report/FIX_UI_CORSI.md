# FIX UI corsi sala (solo frontend)

## Cosa è stato aggiunto

### `sala.html`
- Card **Corsi ordine**: testo che spiega che tutte le portate sono nel pannello, clic per attivare corso, **+ Corso** per nuove portate, nessun popup per cambiare corso.
- Sezione **Ordine** sotto il menù: hint che rimanda al pannello corsi (niente duplicazione elenco piatti).
- Cache bust `sala.js?v=20260403`.

### `sala.css`
- **`.sala-courses-toolbar`**: barra con pulsante **+ Corso**.
- **`.sala-course-card`** / **`.is-active`**: card per ogni corso; bordo rosso e ombra per il corso **attivo**.
- **`.sala-course-card-head`**: intestazione cliccabile (selezione corso attivo).
- **`.sala-course-active-pill`**: badge “Attivo”.
- **`.sala-course-card-body`**, **`.sala-course-dish-row`**, **`.sala-course-dish-empty`**: elenco piatti per corso e stato vuoto.
- **`.sala-selected-hint`**: testo guida sotto il menù.

### `sala.js`
- **`renderMainCoursePanel()`** (riscrittura):
  - Con tavolo impostato e **nessuna comanda sul server**: crea automaticamente almeno **Corso 1** (`courseStart`), senza popup.
  - Per **ogni** corso: card con **numero**, **stato server** opzionale (`serverStatus` da `order.courseStates`), **badge Attivo**, **lista piatti** con nome, qty, note, pulsante **Rimuovi**.
  - Clic sull’**intestazione** del corso → `setActiveCourse` (stesso flusso di prima).
  - **Delegazione eventi**: rimozione riga tramite `[data-sala-remove-item]` (senza attivare il cambio corso).
  - Toolbar **+ Corso** (`#btn-sala-course-add`) → `courseAdd` come prima.
- **`renderSelectedItems()`**: chiama sempre **`renderMainCoursePanel()`** prima; il box `#selected-items` contiene solo un breve hint (elenco non duplicato).
- Stessi dati di prima: `courseDrafts`, `items[]` per corso, `syncCourseDraftFromPrimaryOrder` per ordini già inviati (`items[].course`, `courseStates` in lettura).

## Come funziona la nuova UI

1. Imposti il **tavolo** (campo o azione dalla mappa): se non c’è ancora una comanda sul server, viene creato **automaticamente** il Corso 1.
2. Vedi **tutti i corsi** in verticale, ciascuno con i propri piatti.
3. Il corso **attivo** per l’inserimento è evidenziato (bordo rosso + pill “Attivo”).
4. **Clic** sull’intestazione di un altro corso → diventa attivo; dal menù/fuori menù i piatti vanno lì.
5. **+ Corso** aggiunge una nuova portata (stesso comportamento di prima).
6. **Rimuovi** toglie una riga dalla bozza locale del corso indicato.
7. **Invio comanda** invariato: `flattenCourseItemsForApi` + `handleCreateOrder` senza modifiche backend.

## Limiti

- Il **popup tavolo** resta per altre azioni (riserva, conto, marcia, ecc.); per **corsi e piatti** non è necessario.
- Ordini già sul server: la bozza è **sincronizzata** come prima; stati corso mostrati se presenti in risposta API.
