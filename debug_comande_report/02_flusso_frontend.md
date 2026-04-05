# Flusso frontend — Sala e Cucina

Documentazione ricavata dal codice in `backend/public/sala/sala.js` e `backend/public/cucina/cucina.js`.

---

## 1. Quale componente apre il popup tavolo

- La funzione **`openTablePopup(tableNum)`** imposta `popupOpenTable`, aggiorna titolo/body del DOM (`#sala-popup`, `#sala-popup-title`, `#sala-popup-body`) e mostra backdrop/popup.
- Il popup viene richiamato da vari flussi: click sulla mappa tavoli (handler che chiama `openTablePopup`), e **dopo azioni interne** (es. `btn-course-add`, selezione corso) con **`openTablePopup(tableNum)`** per forzare re-render del contenuto corsi.
- Markup: `backend/public/sala/sala.html` — elementi `sala-popup`, `sala-popup-backdrop`, pulsanti `btn-course-start`, `btn-course-add`, attributi `data-select-course`, `data-act` (es. `next-course`).

---

## 2. Dove viene salvato il corso attivo (Sala)

- **Stato persistente locale:** oggetto globale **`courseDrafts`** serializzato in **`localStorage`** con chiave **`LS_COURSES`** (`rw_sala_course_drafts_v1`).
- Struttura per tavolo: `{ courses: [{ id, n, items: [] }], activeCourseId: <id interno> }`.
- Il **numero corso** mostrato (`Corso 1`, `Corso 2`, …) è **`c.n`**, non l’`id` UUID interno.

---

## 3. Come viene cambiato il corso attivo

- **`setActiveCourse(tableNum, courseId)`**: imposta `activeCourseId` se il `courseId` esiste nelle corse del tavolo, poi `saveCourseDrafts()`.
- **Nel popup:** click su `data-select-course` → `setActiveCourse` → **`openTablePopup(tableNum)`** (ricarica il popup).
- **`courseAdd(tableNum)`**: aggiunge un nuovo corso con `n = courses.length + 1`, imposta **`activeCourseId` al nuovo corso** (ultimo aggiunto diventa attivo).
- **`courseStart`**: se non ci sono corsi, crea corso 1; altrimenti garantisce un `activeCourseId` valido.

---

## 4. Come il menu sinistro sa dove inserire il piatto

- **`pushItemToActiveCourse(tableNum, item)`** usa **`getActiveCourse(tableNum)`**, che risolve il corso tramite **`activeCourseId`** nella bozza.
- Se non ci sono corsi, alert: premere Start nel popup.
- Ogni voce salvata nel corso include metadati (`courseId`, `courseIndex`, `courseLabel`) usati per la UI; l’API riceve **`course`** numerico da **`flattenCourseItemsForApi`**.

---

## 5. Cosa succede su “Aggiungi corso” (`btn-course-add`)

- Chiama **`courseAdd(tableNum)`** (nuovo corso, attivo = nuovo corso).
- Poi **`openTablePopup(tableNum)`** per aggiornare il popup **senza chiuderlo definitivamente** (ma il pattern “riapri popup” = refresh completo del body).

---

## 6. Cosa succede su “Invia comanda” (creazione ordine)

- Funzione **`handleCreateOrder()`**:
  1. Validazione tavolo, coperti, cameriere.
  2. **Prima dell’invio:** con commento esplicito nel codice, **riallinea la bozza al Corso 1** (`draft.activeCourseId = draft.courses[0].id`) se esistono corsi — così l’ultimo corso selezionato **non** resta attivo in sala prima dell’invio (mitiga confusione UI).
  3. **`itemsPayload = flattenCourseItemsForApi(tableNum)`** — tutti i corsi e tutti i piatti vengono appiattiti in un array con campo **`course`** (numero) per riga.
  4. **`activeCourseNum = 1`** fisso nel payload.
  5. **`POST /api/orders`** con body tipo:

```json
{
  "table": 1,
  "covers": 2,
  "area": "sala",
  "waiter": "...",
  "notes": "",
  "activeCourse": 1,
  "items": [
    { "name": "...", "qty": 1, "course": 1, "area": "...", ... },
    { "name": "...", "qty": 1, "course": 2, ... }
  ]
}
```

  6. Dopo successo: `clearCourseDraft`, reset `orderFlowMode`, `renderSelectedItems`, eventuali print job.

---

## 7. Dati inviati al backend (creazione)

- Vedi sopra: **`items`** con **`course`** per ogni riga; **`activeCourse: 1`** sempre in questa funzione.

---

## 8. Il corso attivo resta sull’ultimo selezionato?

- **Durante la compilazione della bozza:** sì, dopo `courseAdd` l’attivo è l’ultimo corso aggiunto; dopo selezione manuale, è il corso cliccato.
- **Immediatamente prima di `POST` create:** il codice **reimposta** `activeCourseId` al **primo corso** (vedi sezione 6). Quindi **non** si invia “l’ultimo corso come attivo” in creazione — il server riceve **`activeCourse: 1`**.

---

## 9. Reset automatico al primo corso prima dell’invio

- **Sì**, in **`handleCreateOrder`**: blocco che imposta `draft.activeCourseId` al primo corso della lista `draft.courses`.

---

## 10. Separazione: UI selezionata vs corso in cucina vs stato reale

| Livello | Cosa rappresenta |
|--------|-------------------|
| **Bozza sala** (`activeCourseId`) | Dove l’utente sta aggiungendo piatti; può essere corso 3 mentre altri corsi hanno già piatti. |
| **Server `order.activeCourse`** | “Marca corso” in marcia per KDS (un corso alla volta); aggiornato da **`PATCH`** marcia, non dalla sola aggiunta piatti in bozza dopo che l’ordine esiste. |
| **`item.course` su ogni riga** | Classificazione statica del piatto (primo/secondo/…); usata per calcolare `maxCourse` lato server. |
| **Stato ordine** (`status`) | `in_attesa`, `in_preparazione`, `pronto`, `servito`, ecc. La cucina **filtra** gli ordini con `status === servito` dalla vista. |

**Non** esiste una tabella separata “stato per corso” nel modello analizzato: il flusso multi-corso si affida a **`activeCourse` ordine** + **`course` su item** + **`status` ordine**.

---

## Cucina — comportamento rilevante

- **`fetchOrders`**: `GET /api/orders?active=true`.
- **`renderKdsColumns`**: esclude `chiuso`, `annullato`, **`servito`**. Quindi un ordine con status finale **`servito`** **scompare** dalla cucina.
- **`buildCourseBlocksHtml`**: usa **`order.activeCourse`** per classificare blocchi (`kds-course-active` / `past` / `future`).

---

## WebSocket / aggiornamenti

- Se presente, eventi tipo `rw:orders-update` aggiornano cache cucina; sala ha flussi `loadOrdersAndRender` / `applySalaOrdersFromServer` (dettaglio in `sala.js`).

---

## Riepilogo nomi chiave (Sala)

| Nome | Tipo | Descrizione |
|------|------|-------------|
| `courseDrafts` | `object` | Bozza per tavolo |
| `activeCourseId` | string (id corso locale) | Corso selezionato per inserimento piatti |
| `flattenCourseItemsForApi` | function | Produce array `items` con `course` numerico |
| `syncCourseDraftFromPrimaryOrder` | function | Allinea bozza da ordine “primario” sul server quando popup apre e c’è ordine attivo |
| `apiPatchActiveCourse` | function | PATCH marcia |
