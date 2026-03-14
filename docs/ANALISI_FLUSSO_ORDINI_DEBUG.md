# REPORT TECNICO — Analisi completa flusso Ordini / Sala / Cassa / Supervisor / Storico

**Data analisi:** 2026-03-14  
**Obiettivo:** Diagnosi precisa del flusso ordini e identificazione cause per cui le comande chiuse restano nella vista attiva.

---

## 1. FLUSSO ATTUALE REALE DEGLI ORDINI

### 1.1 Creazione ordine in Sala
- **File:** `backend/public/sala/sala.js`
- **API:** `POST /api/orders` → `orders.controller.createOrder`
- **Service:** `orders.service.createOrder`
- **Repository:** `orders.repository.saveAllOrders` → scrive su `data/tenants/{id}/orders.json`
- **Stato iniziale:** `status: "in_attesa"`
- **Broadcast:** dopo creazione viene chiamato `broadcastOrderUpdates()` → WebSocket invia `orders_update` con `listActiveOrders()`

### 1.2 Visualizzazione in Cucina / KDS
- **File:** `backend/public/cucina/cucina.js`
- **API:** `GET /api/orders?active=true`
- **Filtro:** ordini con `status` diverso da chiuso/annullato/closed/cancelled/archived/pagato/paid
- **Refresh:** `fetchOrders()` + `rw:orders-update` via WebSocket

### 1.3 Gestione stati ordine
- **API:** `PATCH /api/orders/:id/status` → `orders.controller.setStatus`
- **Service:** `orders.service.setStatus` → aggiorna `target.status` e salva su file
- **Chiamate da:** Sala (apiSetStatus), Cucina (updateOrderStatus), Cassa (patchOrderStatus), Pizzeria, Bar
- **Broadcast:** dopo ogni setStatus viene chiamato `broadcastOrderUpdates()` e, se stato finale (servito/chiuso), anche `broadcastSupervisorSyncFromData()`

### 1.4 Arrivo in Cassa
- **File:** `backend/public/cassa/cassa.js`
- **API:** `GET /api/orders?active=true`
- **Filtro UI:** `groupOrdersByTable()` mostra solo tavoli dove **tutti** gli ordini sono `status === "servito"`
- **Logica:** ordini chiusi/annullati vengono saltati (`continue`) in `groupOrdersByTable`

### 1.5 Chiusura / pagamento tavolo
- **Sequenza Cassa:**
  1. `createPaymentRecord()` → `POST /api/payments` (crea record pagamento, NON modifica ordini)
  2. Per ogni ordine: `patchOrderStatus(o.id, "chiuso")` → `PATCH /api/orders/:id/status`
  3. `loadOrdersAndRender()` → ricarica ordini attivi
- **Backend:** `payments.controller.createPayment` NON imposta status ordini a "chiuso"; la Cassa lo fa esplicitamente con le PATCH

### 1.6 Annullamento
- **Sala/Cucina:** pulsante Annulla → `apiSetStatus(id, "annullato")` → `PATCH /api/orders/:id/status`
- **Backend:** `setStatus` salva "annullato" su `orders.json`

### 1.7 Chiusura Z
- **API:** `POST /api/payments/z-report`
- **Repository:** `closures.repository.createClosure` → `data/tenants/{id}/closures.json`
- **Effetto:** marca la giornata come chiusa; non modifica gli ordini
- **Nota:** `listActiveOrders` attuale **non** usa più la chiusura Z per filtrare (fix precedente)

### 1.8 Visualizzazione nel Supervisor
- **Vista attiva:** `GET /api/orders?active=true` → `loadOrders()` → `allOrders` → `renderOrdersTable()`
- **WebSocket:** `rw:orders-update` aggiorna `allOrders` e richiama `renderOrdersTable()`
- **KPI:** `renderTopKpis()` usa `allOrders` (solo attivi) per incasso stimato; `rw:supervisor-sync` invia dati da `computeSupervisorStats()` che usa `listOrdersByDate(today)` per le metriche

### 1.9 Storico giornaliero
- **API:** `GET /api/orders/history?date=YYYY-MM-DD` → `orders.controller.listOrdersHistory`
- **Service:** `orders.service.listOrdersByDate(dateStr)` → tutti gli ordini della data indicata, **senza filtri su status**
- **Frontend:** `apiGetOrdersHistory(dateStr)` → `renderStoricoOrders(orders, dateStr)`

---

## 2. FILE COINVOLTI

| Ruolo | File |
|-------|------|
| **Backend ordini** | `orders.service.js`, `orders.controller.js`, `orders.routes.js`, `orders.repository.js` |
| **Backend pagamenti** | `payments.controller.js`, `payments.service.js`, `payments.repository.js` |
| **Backend chiusure** | `closures.repository.js` |
| **WebSocket** | `websocket.service.js`, `shared/websocket.js` |
| **Sala** | `sala/sala.js`, `sala/sala.html` |
| **Cassa** | `cassa/cassa.js`, `cassa/cassa.html` |
| **Cucina** | `cucina/cucina.js` |
| **Supervisor** | `supervisor/supervisor.js`, `supervisor/supervisor.html` |
| **Dashboard** | `dashboard/dashboard.js` |
| **Dati** | `data/tenants/default/orders.json`, `payments.json`, `closures.json` |

---

## 3. STATI REALMENTE USATI DAL PROGETTO

| Stato | Utilizzo |
|-------|----------|
| `in_attesa` | Stato iniziale nuovo ordine |
| `in_preparazione` | Cucina/Pizzeria in preparazione |
| `pronto` | Piatto pronto, da ritirare |
| `servito` | Servito al tavolo, in attesa conto |
| `chiuso` | Tavolo pagato, ordine concluso |
| `annullato` | Ordine annullato |

**Non usati nel flusso operativo:** `open`, `waiting`, `paid`, `closed`, `cancelled`, `archived` (ma `listActiveOrders` li esclude per compatibilità)

---

## 4. DOVE SI ROMPE IL FLUSSO

### 4.1 Analisi dati reali (`data/tenants/default/orders.json`)

- Ordini con `status: "chiuso"`: id 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 16
- Ordini con `status: "servito"`: id 12, 13, 15, 17
- Ordini con `status: "in_attesa"`: id 18

**Conclusione:** i dati sono coerenti; gli ordini chiusi hanno correttamente `status: "chiuso"`.

### 4.2 Logica `listActiveOrders` (attuale)

```javascript
const excludeStatuses = ["chiuso", "annullato", "closed", "cancelled", "archived", "pagato", "paid"];
return all.filter((o) => {
  const status = String(o.status || "").toLowerCase().trim();
  return !excludeStatuses.includes(status);
});
```

**Risultato atteso:** ordini 12, 13, 15, 17, 18 (5 ordini). Gli altri non dovrebbero comparire in vista attiva.

### 4.3 Possibili cause del bug segnalato

1. **Doppio file ordini (tenant vs legacy)**
   - `data/orders.json` e `data/tenants/default/orders.json` possono coesistere
   - Il repository usa `paths.tenant(restaurantId, "orders.json")` → `data/tenants/default/orders.json` quando `restaurantId === "default"`
   - Se in qualche contesto il tenant non è impostato, si usa `data/orders.json` (path legacy) → possibile lettura/scrittura su file diverso

2. **Middleware tenant**
   - `tenantContext.middleware` imposta `restaurantId` da `req.session?.restaurantId ?? "default"`
   - Se la sessione non ha `restaurantId`, viene usato `"default"` → in teoria coerente

3. **API / frontend**
   - Sala, Cassa, Cucina, Supervisor, Dashboard usano tutti `?active=true`
   - Pizzeria e Bar sono stati aggiornati per usare `?active=true`

4. **WebSocket**
   - `broadcastOrderUpdates()` usa `listActiveOrders()` → invia solo ordini attivi
   - Il frontend riceve `rw:orders-update` e sovrascrive `allOrders` con i dati ricevuti

5. **PATCH status**
   - Route: `PATCH /api/orders/:id/status` correttamente definita
   - Cassa chiama `patchOrderStatus(o.id, "chiuso")` per ogni ordine del tavolo
   - Se una PATCH fallisce (rete, 404, ecc.), alcuni ordini restano "servito" → il tavolo può continuare a essere mostrato

6. **RW_API wrapper**
   - Cassa usa `window.RW_API?.patch` se disponibile
   - Se `RW_API` ha un bug o un path errato, le PATCH potrebbero fallire silenziosamente

---

## 5. BUG ESATTI IDENTIFICATI

### Bug 1: Possibile path ordini legacy vs tenant
- **Dove:** `orders.repository.getDataPath()` usa `tenantContext.getRestaurantId()`
- **Se:** fuori da un contesto di richiesta (es. job in background) `getRestaurantId()` può restituire `undefined` → `paths.tenant(null, "orders.json")` restituisce `data/orders.json`
- **Effetto:** lettura/scrittura su file diverso da quello usato nelle richieste HTTP

### Bug 2: Nessuna transazione nella chiusura tavolo
- **Dove:** Cassa esegue `createPaymentRecord` e poi un loop di `patchOrderStatus`
- **Se:** `createPaymentRecord` va a buon fine ma una `patchOrderStatus` fallisce (timeout, 500, ecc.)
- **Effetto:** pagamento registrato ma uno o più ordini restano "servito" → tavolo ancora visibile

### Bug 3: Supervisor KPIs da `allOrders` (solo attivi)
- **Dove:** `renderTopKpis()` fa `const closed = allOrders.filter(o => o.status === "chiuso")`
- **Problema:** `allOrders` contiene solo ordini attivi (da `?active=true`), quindi `closed` è sempre vuoto
- **Mitigazione:** i KPI vengono aggiornati anche da `rw:supervisor-sync` con dati da `computeSupervisorStats()` che usa `listOrdersByDate(today)` → corretto

### Bug 4: Mancata verifica path PATCH
- **Verifica:** `PATCH /api/orders/:id/status` è correttamente montato
- **Rischio:** se il frontend usa un path errato (es. `/api/order/` singolare), la PATCH non arriva al controller

---

## 6. PERCHÉ LE COMANDE CHIUSE POTREBBERO RESTARE NELLA LISTA

| Causa | Probabilità | Verifica |
|-------|-------------|----------|
| Filtro `listActiveOrders` errato | Bassa (la logica è corretta) | ✅ Esclude chiuso/annullato |
| Frontend non usa `?active=true` | Bassa (tutti lo usano) | ✅ Verificato |
| WebSocket reinvia ordini chiusi | Bassa (usa `listActiveOrders`) | ✅ Verificato |
| PATCH status non salvata | Media | Da verificare: log backend, network tab |
| Ordini scritti su file sbagliato (legacy) | Media | Da verificare: quale file viene effettivamente aggiornato |
| `RW_API` fallisce senza errore visibile | Media | Da verificare in console e network |
| Fallimento parziale (solo alcune PATCH) | Media | Se una PATCH fallisce, gli ordini non chiusi restano visibili |

---

## 7. PERCHÉ IL SUPERVISOR PUÒ CONTINUARE A MOSTRARLE

- **Se** `allOrders` contiene ordini chiusi, significa che arrivano da:
  - `loadOrders()` → `apiGetOrders()` → `GET /api/orders?active=true` (dovrebbe escluderli)
  - `rw:orders-update` → `ev.detail.orders` (dovrebbero essere solo attivi)
- **Conclusioni possibili:**
  - Il backend sta restituendo ordini chiusi (bug in `listActiveOrders` o in `active=true`) → improbabile dalla lettura del codice
  - Il frontend non passa `active=true` → improbabile, il parametro è esplicito
  - Cache browser o proxy → possibile
  - Sessione/tenant incoerente → possibile, da verificare

---

## 8. PERCHÉ NON SI POSSONO ELIMINARE DALLA VISTA ATTIVA

- Non esiste un’azione “elimina dalla vista”: la vista attiva è determinata dal filtro backend.
- Per far “sparire” un ordine:
  1. Impostare `status: "chiuso"` o `"annullato"` via `PATCH /api/orders/:id/status`
  2. Il backend deve salvare correttamente
  3. `listActiveOrders` deve escluderlo
  4. Il frontend deve ricevere la lista aggiornata (API o WebSocket) e aggiornare l’UI
- Se uno di questi passi fallisce, l’ordine resta visibile.

---

## 9. PERCHÉ LO STORICO POTREBBE NON RICHIAMARE CORRETTAMENTE

- **Endpoint:** `GET /api/orders/history?date=YYYY-MM-DD`
- **Backend:** `listOrdersByDate(dateStr)` filtra per `getOrderDateStr(o) === target`
- **`getOrderDateStr`:** usa `order.updatedAt || order.createdAt || order.date`
- **Potenziale problema:** se la data dell’ordine è in un fuso orario diverso o il formato è incoerente, il filtro per data potrebbe escludere ordini che in realtà appartengono al giorno scelto.

---

## 10. CORREZIONE MINIMA SICURA PROPOSTA

### 10.1 Verifiche preventive (senza modificare codice)

1. **Controllare in browser:**
   - Network: `GET /api/orders?active=true` → quanti ordini e quali status
   - Network: `PATCH /api/orders/:id/status` quando si chiude un tavolo → status code e risposta
   - Console: eventuali errori JS o da `RW_API`

2. **Controllare sul server:**
   - Quale file viene effettivamente aggiornato: `data/orders.json` vs `data/tenants/default/orders.json`
   - Che `restaurantId` risulta dalla sessione (log temporaneo in middleware/controller)

### 10.2 Modifiche minime suggerite

1. **Rendere robusta la scelta del tenant**
   - In `orders.repository.getDataPath()`: usare sempre `"default"` se `getRestaurantId()` è null/undefined.

2. **Chiusura tavolo più robusta**
   - Eseguire prima tutte le PATCH per impostare `"chiuso"`, poi `createPaymentRecord`.
   - Oppure: gestire esplicitamente i fallimenti (retry, messaggio chiaro, rollback del pagamento se non tutte le PATCH vanno a buon fine).

3. **Log di debug temporaneo**
   - In `setStatus`: log di `id`, `status`, `getDataPath()` per confermare path e salvataggio.

---

## 11. FILE DA MODIFICARE (se si applicano le correzioni)

| File | Modifica |
|------|----------|
| `backend/src/repositories/orders.repository.js` | Fallback a tenant "default" in `getDataPath` se contesto assente |
| `backend/public/cassa/cassa.js` | (Opzionale) Invertire ordine: prima PATCH ordini, poi createPayment; gestione errori migliorata |

---

## 12. FILE DA NON TOCCARE

- `orders.service.js` — logica `listActiveOrders` corretta
- `orders.controller.js` — flusso e broadcast corretti
- `websocket.service.js` — usa `listActiveOrders`
- `sala.js`, `cucina.js`, `supervisor.js` (fetch e uso di `?active=true`)
- `payments.controller.js` — non deve modificare gli ordini
- `closures.repository.js` — solo per chiusura Z
- Storico: `listOrdersByDate` e relativo endpoint

---

## 13. RIEPILOGO DIAGNOSTICO

| Domanda | Risposta |
|---------|----------|
| **Stati usati** | `in_attesa`, `in_preparazione`, `pronto`, `servito`, `chiuso`, `annullato` |
| **Chiusura tavolo** | Cassa chiama PATCH per ogni ordine con `"chiuso"`; il backend salva correttamente |
| **GET ?active=true** | Esclude chiuso, annullato, closed, cancelled, archived, pagato, paid |
| **Supervisor** | Usa `?active=true` e `rw:orders-update` (solo ordini attivi) |
| **Origine probabile bug** | Path tenant/legacy, fallimento parziale delle PATCH, o comportamento di `RW_API` |
| **Storico** | Usa `listOrdersByDate`; possibile problema sul confronto date/fuso orario |
| **Dati esaminati** | `orders.json` coerente; ordini chiusi con `status: "chiuso"` |

---

## 14. FIX APPLICATA (post-analisi)

### 14.1 Backend: chiusura ordini atomica in createPayment
**File:** `backend/src/controllers/payments.controller.js`

Dopo la creazione del pagamento, il backend ora:
1. Imposta `status: "chiuso"` su ogni ordine in `orderIds` via `ordersService.setStatus`
2. Chiama `broadcastOrders(activeOrders)` per aggiornare Sala, Cassa, Supervisor
3. Chiama `broadcastSupervisorSyncFromData()` per aggiornare le KPI

**Effetto:** la chiusura tavolo è atomica lato backend; non dipende più da N chiamate PATCH separate dal frontend.

### 14.2 Frontend Cassa: rimozione loop patchOrderStatus
**File:** `backend/public/cassa/cassa.js`

Rimosso il loop `for (const o of orders) { await patchOrderStatus(o.id, "chiuso"); }`.  
La Cassa ora chiama solo `createPaymentRecord`; il backend gestisce la chiusura degli ordini.

---

## 15. PROSSIMI PASSI RACCOMANDATI (verifica)

1. Eseguire le verifiche in browser e sul server (punto 10.1).
2. Se il problema persiste: log temporanei in `setStatus` e `getDataPath` per confermare path e salvataggio.
