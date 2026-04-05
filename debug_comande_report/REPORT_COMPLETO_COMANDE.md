# Report completo — Flusso comande multi-corso, popup tavolo, cucina, servito (MySQL)

**Repository:** ristoword  
**Ambito:** analisi statica del codice (nessuna modifica applicativa).  
**Cartella dettagli:** `debug_comande_report/` (file numerati `00`–`08`).

---

## 1. Sintesi esecutiva

Il flusso multi-corso è implementato con:

- **Righe ordine** con campo **`course`** (numero ≥ 1) per classificare il piatto.
- **Ordine** con campo **`activeCourse`** (“marca corso” / marcia) usato dalla cucina per evidenziare il blocco attivo.
- **Stato ordine** unico (`in_attesa`, `in_preparazione`, `pronto`, `servito`, …): **non** esiste una tabella di stato per singolo corso.

La transizione **Servito** in backend:

- Se **`activeCourse < maxCourse`** (dove `maxCourse` deriva dal massimo `item.course`) → lo stato resta / diventa **`in_attesa`** (comanda non “chiusa” come servizio completo).
- Se **`activeCourse >= maxCourse`** → stato **`servito`** (fine ciclo operativo cucina per questa comanda).

La **cucina** nasconde le comande con **`status === servito`**.

Punti di rottura probabili dopo MySQL o in produzione:

1. **`course` sulle righe** non persistito o sempre 1 → `maxCourse = 1` → primo servito chiude.
2. **`activeCourse`** avanzato o errato → KDS mostra “ultimo corso” acceso; servito interpretato come ultimo corso troppo presto.
3. **Nessun avanzamento automatico** di `activeCourse` su Servito: la **marcia** è dalla sala (`PATCH /active-course`).

---

## 2. File rilevanti

Vedi **`01_mappa_file_rilevanti.md`**. Sintesi:

| Area | File principale |
|------|-----------------|
| Sala UI | `backend/public/sala/sala.js` |
| Cucina UI | `backend/public/cucina/cucina.js` |
| API | `backend/src/routes/orders.routes.js`, `backend/src/controllers/orders.controller.js` |
| Business | `backend/src/service/orders.service.js` |
| MySQL | `backend/src/repositories/mysql/orders.repository.mysql.js` |
| DDL | `backend/db/schema.sql` |

---

## 3. Flusso frontend

Vedi **`02_flusso_frontend.md`**.

Punti chiave:

- **Popup tavolo:** `openTablePopup` + sync bozza da ordine primario se presente (`syncCourseDraftFromPrimaryOrder`).
- **Corso attivo locale:** `courseDrafts[table].activeCourseId` in `localStorage`.
- **Invio ordine:** `handleCreateOrder` → **`activeCourse: 1`** nel JSON + reset `activeCourseId` al corso 1; **`items`** contiene tutti i corsi con `course` per riga (`flattenCourseItemsForApi`).
- **Marcia:** azione `next-course` → `PATCH /api/orders/:id/active-course` con `activeCourse = cur + 1`.
- **Cucina:** filtra **`servito`**; evidenziazione blocchi con **`order.activeCourse`**.

---

## 4. Flusso backend

Vedi **`03_flusso_backend.md`**.

Punti chiave:

- **POST /** crea ordine con `deriveInitialActiveCourse`: con items → **`activeCourse = 1`**.
- **PATCH /:id/status** `servito` → `setStatus` con regola `ac` vs `maxCourse`.
- **PATCH /:id/active-course** → `setActiveCourse` con vincoli marcia (±1).
- **listActiveOrders** applica **`normalizeOrderActiveCourseForRead`** (clampa `activeCourse` a `[1, maxCourse]`).

---

## 5. Schema database

Vedi **`04_schema_database.md`**.

- Tabelle principali: **`orders`**, **`order_items`** (tenant `restaurant_id`).
- **`activeCourse`** tipicamente in **`orders.extra`** (JSON).
- **`course`** per riga tipicamente in **`order_items.extra`**.
- Nessuna tabella **stato per corso**.

---

## 6. Query debug

Vedi **`05_query_debug.sql`** — ultimi ordini, estrazione `activeCourse` / `course` da JSON, confronto `max_course` calcolato vs `activeCourse`.

---

## 7. Bug probabili

Vedi **`06_ipotesi_bug.md`** — ipotesi A–I con gravità e tracciamento alle 7 obbligatorie.

---

## 8. Dove si rompe il flusso (mappa causale)

| Sintomo | Percorso logico |
|---------|-----------------|
| Card cucina sparisce al primo servito con più corsi | `status` diventa **`servito`** perché **`maxCourse === 1`** (righe) o **`activeCourse >= maxCourse`** già all’inizio del servizio. |
| “Ultimo corso acceso” in cucina | **`order.activeCourse`** alto (marcia ripetuta, doppio PATCH, dato errato) o normalizzazione lettura; UI usa solo `activeCourse`. |
| Popup “costringe” a rientrare | Pattern **`openTablePopup`** dopo ogni cambio corso (refresh completo). |
| Dopo MySQL dati incoerenti | Verificare **`extra`** su ordini e righe (`course`, `activeCourse`). |

---

## 9. Cosa manca per un comportamento “ideale” (solo analisi)

- Stato **per corso** (preparazione/pronto/servito) se richiesto dal processo reale — **non** modellato nel DDL analizzato.
- Avanzamento **automatico** di `activeCourse` dopo servito (se desiderato) — **assente** in `setStatus`.
- Colonne dedicate `course` / `active_course` (invece di JSON) per query e integrità — **assenti** nel DDL canonico.

---

## 10. Conclusione tecnica (risposte dirette)

| Domanda | Risposta |
|---------|----------|
| **Perché la comanda sparisce dopo “Servito”?** | In cucina gli ordini con **`status === servito`** sono **esclusi** da `renderKdsColumns`. Lo stato diventa `servito` quando **`setStatus`** determina **`activeCourse >= maxCourse`** (e items non vuoti). Se `maxCourse` è 1 o `activeCourse` è già al massimo, sparisce al primo servito. |
| **Perché in cucina sembra “acceso” l’ultimo corso selezionato?** | La KDS evidenzia il blocco con **`cn === order.activeCourse`**. Se **`activeCourse`** sul server è pari all’ultimo corso (marcia portata fino in fondo, o valore errato), l’UI mostra l’ultimo come attivo. Alla **creazione** l’ordine parte con **`activeCourse: 1`**; non dipende dall’ultimo corso selezionato in bozza **al momento del POST** (reset esplicito). |
| **Dove viene deciso il corso attivo?** | **Server:** `order.activeCourse`, impostato in **`createOrder`** (default con items = 1) e aggiornato da **`setActiveCourse`** (marcia). **Client sala:** `activeCourseId` in bozza per **inserimento piatti**; sincronizzato dal server quando c’è ordine attivo. |
| **Dove viene chiuso l’ordine (lato servizio cucina)?** | Non nel senso “chiuso conto”: lo stato **`servito`** su ordine è impostato in **`orders.service.setStatus`** quando la logica servito/ultimo corso lo richiede; **`chiuso`** è un altro stato gestito altrove/cassa (lista esclusi in `listActiveOrders`). |
| **Esiste gestione sequenziale dei corsi?** | **Parziale:** sequenza logica tramite **`course` sulle righe** e **`activeCourse`** + regole marcia e servito. **Non** coda di stati per corso. |
| **Il problema è frontend, backend, database o mix?** | **Mix:** UX sala (popup/marcia), regole **`setStatus`/`setActiveCourse`**, e **persistenza** `course`/`activeCourse` in JSON MySQL. Un bug nei **`extra`** o `maxCourse` errato produce sintomi “solo backend/DB”; KDS è coerente col dato ricevuto. |

---

## Allegati interni al pacchetto

- `07_dump_codice_rilevante.md` — estratti commentati  
- `08_istruzioni_test.md` — Test 1–4  

---

*Fine report.*
