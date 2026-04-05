# Flusso backend — ordini, corsi, servito, marcia

Riferimento principale: `backend/src/service/orders.service.js`, `backend/src/controllers/orders.controller.js`, `backend/src/routes/orders.routes.js`.

---

## 1. Endpoint che creano l’ordine

- **`POST /api/orders`** → `OrdersController.createOrder` → **`ordersService.createOrder(req.body)`**.
- **`createOrder(payload)`**:
  - Genera `id`, timestamp.
  - Normalizza ogni item con **`normalizeItemCourse`** (campo **`course`** numerico ≥ 1, default 1).
  - **`activeCourse = deriveInitialActiveCourse(items, body.activeCourse)`**:
    - Se **ci sono item** → **`activeCourse` forzato a `1`** (commento: nuova comanda in cucina sempre corso 1 in marcia).
    - Se **non ci sono item** → usa `body.activeCourse` se valido, altrimenti 1.
  - **`status: "in_attesa"`**.
  - Salva tramite repository (`saveAllOrders` / equivalente MySQL).

---

## 2. Endpoint che “salvano” i corsi

- **Non** esiste un endpoint dedicato “salva corsi” separato dalla creazione ordine o dalla modifica righe.
- I **corsi** sono implicitamente **il campo `course` su ogni `order.items[]`** e **`order.activeCourse`** nel documento ordine.
- **MySQL:** `orders.extra` (JSON) contiene campi non in `ORDER_EXTRA_SKIP` (incl. `activeCourse`); in `order_items`, proprietà extra come `course` possono stare in **`order_items.extra`** (vedi `itemToDbRow` in `orders.repository.mysql.js`).

---

## 3. Endpoint che inviano in cucina

- L’**invio in cucina** nel modello attuale coincide con **creazione ordine** (`POST /api/orders`) e, lato UI, **stampa/routing** opzionale in `createOrder` dopo il save (`print.service`).
- Non c’è un flag separato `inviato_cucina` nel service analizzato: lo stato iniziale è **`in_attesa`**.

---

## 4. Endpoint che gestiscono “servito”

- **`PATCH /api/orders/:id/status`** con body `{ "status": "servito" }` → **`setStatus(id, status)`**.

---

## 5. Endpoint che chiudono la comanda

- **`PATCH /api/orders/:id/status`** con `status` in `chiuso` / stati finali (es. da cassa) — **non** analizzato in questo file solo in dettaglio; `listActiveOrders` **esclude** `chiuso`, `annullato`, `closed`, `cancelled`, `archived`, `pagato`, `paid`.

---

## 6. Concetti backend: corso attivo, prossimo corso, ultimo corso, ordine chiuso

| Concetto | Implementazione |
|----------|-----------------|
| **Corso attivo** | Campo **`order.activeCourse`** (numero intero ≥ 1). |
| **Ultimo corso** | **`getMaxCourseFromOrder(order)`**: massimo di `item.course` tra le righe (o 1 se assente). |
| **Prossimo corso** | Non è un campo DB: in sala si calcola `cur + 1` e si invia **`PATCH`** se `cur < maxC`. |
| **Ordine chiuso** | `status` in stati finali; `listActiveOrders` filtra alcuni di questi. |

---

## 7. Il click su “servito” chiude l’intero ordine?

- **Dipende** da `setStatus` quando `status === "servito"` (case-insensitive):
  - Se **`items.length > 0`**:
    - `maxCourse = max(items.map(i => Number(i.course) || 1))`
    - `ac = floor(activeCourse)` valido
    - **Se `ac < maxCourse`** → **`nextStatus = "in_attesa"`** (non è chiusura definitiva).
    - **Altrimenti** → **`nextStatus = "servito"`** (stato finale lato questa transizione).
  - **Nota:** il backend **non** incrementa `activeCourse` quando si preme servito; serve la **marcia** dalla sala per portare il corso evidenziato avanti.

---

## 8. Dopo “servito” cerca il prossimo corso non servito?

- **No** nel service: non c’è loop su corsi né aggiornamento automatico di `activeCourse` in `setStatus`.

---

## 9. Avanzamento automatico al corso successivo

- **Non** in `setStatus`.
- **Marcia:** **`PATCH /api/orders/:id/active-course`** → **`setActiveCourse(id, activeCourse)`**:
  - Valida `n >= 1`.
  - Cap a `maxC` se `n > maxC`.
  - **Vincoli “marcia”:** se `n > prev` allora deve essere **`prev + 1`** (o `1` in casi ammessi dal codice); altrimenti **400** con messaggio che vieta il salto di corsi.
  - Se `n < prev` vincoli simili (torna indietro di uno o reset a 1).

---

## 10. Logica multi-corso completa o parziale?

- **Parziale a livello dominio:** multi-corso = **`course` sulle righe** + **`activeCourse`** sull’ordine + regole **`servito`** vs **`maxCourse`**.
- **Manca** uno stato per-corso (es. tabella “corso 2 servito”): la decisione “ultimo corso servito” usa **`activeCourse` corrente** + **`maxCourse` dalle righe**.

---

## Query / condizioni critiche (`orders.service.js`)

**Servito (estratti logici):**

```javascript
if (String(status).toLowerCase() === "servito") {
  const items = [...];
  if (items.length > 0) {
    const maxCourse = Math.max(...items.map((i) => Number(i.course) || 1));
    let ac = target.activeCourse || 1;
    // normalizza ac ...
    if (ac < maxCourse) nextStatus = "in_attesa";
    else nextStatus = "servito";
  }
}
```

**Normalizzazione lettura:**

```javascript
function normalizeOrderActiveCourseForRead(order) {
  const maxC = getMaxCourseFromOrder(order);
  if (maxC == null) return order;
  let ac = Number(order.activeCourse);
  if (!Number.isFinite(ac) || ac < 1) ac = 1;
  if (ac > maxC) ac = maxC;
  return { ...order, activeCourse: ac };
}
```

---

## Controller — effetti collaterali su `servito` / `chiuso`

- `setStatus` invia broadcast ordini; se lo stato finale è **`servito`** o **`chiuso`**, può scattare inventory (`onOrderFinalized`) e `broadcastSupervisorSyncFromData`.

---

## Riepilogo file

| File | Funzione |
|------|----------|
| `orders.routes.js` | Definizione route |
| `orders.controller.js` | `createOrder`, `setStatus`, `patchActiveCourse` |
| `orders.service.js` | Regole business corsi / servito / marcia |
| `orders.repository.mysql.js` | Persistenza `orders` + `order_items` + JSON |
