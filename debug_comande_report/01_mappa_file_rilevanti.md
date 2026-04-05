# Mappa file rilevanti — comande multi-corso, popup tavolo, cucina, servito

Analisi statica sul codice presente in repository (nessuna modifica applicativa).

---

## Frontend — Sala (`backend/public/sala/sala.js`)

| Percorso | Perché è rilevante | Funzioni / componenti | Ruolo |
|----------|-------------------|-------------------------|--------|
| `backend/public/sala/sala.js` | File monolitico UI sala | `courseDrafts`, `LS_COURSES`, `ensureCourseDraft`, `courseStart`, `courseAdd`, `setActiveCourse`, `getActiveCourse`, `pushItemToActiveCourse`, `flattenCourseItemsForApi`, `openTablePopup`, `closeTablePopup`, `syncCourseDraftFromPrimaryOrder`, `hasPrimaryOpenOrderForCourses`, `getPrimaryOrderForTableFlow`, `apiPatchActiveCourse`, `handleCreateOrder`, `renderSelectedItems`, `loadOrdersAndRender`, `applySalaOrdersFromServer` | Bozza corsi per tavolo in **localStorage**; corso attivo = `activeCourseId`; invio ordine con `activeCourse: 1` e pin bozza al corso 1 prima dell’invio; marcia via `PATCH /api/orders/:id/active-course`; popup che richiude/riapre per aggiornare UI corsi. |
| `backend/public/sala/sala.html` | Markup popup | Elementi `sala-popup`, `btn-course-start`, `btn-course-add`, `data-select-course` | Contenitore popup tavolo e pulsanti corsi. |

*Ricerca concetti:* `activeCourseId`, `course`, `flattenCourseItemsForApi`, `next-course`, `marciaRequestInFlight`.

---

## Frontend — Cucina (`backend/public/cucina/cucina.js`)

| Percorso | Perché è rilevante | Funzioni | Ruolo |
|----------|-------------------|----------|--------|
| `backend/public/cucina/cucina.js` | KDS comande | `fetchOrders`, `updateOrderStatus`, `buildCourseBlocksHtml`, `createOrderCard`, `renderKdsColumns`, `loadAndRenderOrders` | Lista `GET /api/orders?active=true`; **filtra ordini con `status === servito`** (non mostrati); evidenziazione corso con `order.activeCourse` vs `item.course`; pulsante Servito → `PATCH` status `servito`. |

---

## Backend — API ordini

| Percorso | Perché è rilevante | Simboli | Ruolo |
|----------|-------------------|---------|--------|
| `backend/src/routes/orders.routes.js` | Mappa HTTP | `GET /`, `POST /`, `PATCH /:id/active-course`, `PATCH /:id/status` | Ingresso API ordini. |
| `backend/src/controllers/orders.controller.js` | Orchestrazione | `createOrder`, `setStatus`, `patchActiveCourse`, `listOrders`, `broadcastOrderUpdates` | Delega a `orders.service`; dopo create/status/active-course aggiorna WebSocket. |
| `backend/src/service/orders.service.js` | **Logica di business** | `createOrder`, `setStatus`, `setActiveCourse`, `listActiveOrders`, `normalizeOrderActiveCourseForRead`, `deriveInitialActiveCourse`, `getMaxCourseFromOrder` | Creazione con `activeCourse` iniziale; **servito**: se ultimo corso → status `servito`, altrimenti `in_attesa`; **marcia**: vincoli su incremento ±1; normalizzazione `activeCourse` in lettura. |

---

## Backend — Persistenza

| Percorso | Perché è rilevante | Ruolo |
|----------|-------------------|--------|
| `backend/src/repositories/orders.repository.js` | Facade | Smista JSON vs MySQL in base a configurazione. |
| `backend/src/repositories/mysql/orders.repository.mysql.js` | MySQL | `orders.extra` JSON per campi non colonnati (`activeCourse`, ecc.); `order_items.extra` per proprietà extra riga (`course`, …). |
| `backend/db/schema.sql` | Schema canonico | DDL `orders`, `order_items` (chiavi tenant `restaurant_id`). |

---

## Altri file utili

| Percorso | Motivo |
|----------|--------|
| `backend/.env` / variabili | `USE_MYSQL_DATABASE`, `DEBUG_ORDER_FLOW` (log normalizzazione `activeCourse`). |
| `backend/src/service/websocket.service.js` (se usato) | Broadcast aggiornamenti ordini dopo mutazioni. |

---

## Riepilogo keyword ↔ file principale

| Concetto | Dove |
|----------|------|
| Popup tavolo | `sala.js` — `openTablePopup`, `buildPopupOccupied`, handler `#sala-popup` |
| Corso attivo (client) | `courseDrafts[table].activeCourseId` |
| Corso attivo (server) | `order.activeCourse` in `orders` (extra JSON) |
| Invio comanda | `handleCreateOrder` → `POST /api/orders` |
| Marcia | `next-course` → `PATCH .../active-course` |
| Servito | `cucina.js` → `PATCH .../status` `{ status: "servito" }` → `orders.service.setStatus` |
| Ultimo corso evidenziato in cucina | `buildCourseBlocksHtml` — confronto `cn` con `order.activeCourse` |
