# Schema database — ordini e righe

Fonti: `backend/db/schema.sql`, `backend/src/repositories/mysql/orders.repository.mysql.js`.

---

## Tabella `orders`

| Colonna | Tipo (schema) | Note |
|---------|----------------|------|
| `restaurant_id` | `VARCHAR(64)` | Parte della PK composta (tenant) |
| `id` | `BIGINT` | ID ordine |
| `table_num` | `INT` | Numero tavolo |
| `covers` | `INT` | Coperti |
| `area` | `VARCHAR(64)` | Reparto |
| `waiter` | `VARCHAR(255)` | Cameriere |
| `notes` | `TEXT` | Note |
| `status` | `VARCHAR(64)` | Stato ordine (`in_attesa`, `in_preparazione`, `pronto`, `servito`, `chiuso`, …) |
| `created_at` | `DATETIME(3)` | |
| `updated_at` | `DATETIME(3)` | |
| `extra` | `JSON` | Campi aggiuntivi del modello applicativo (vedi sotto) |

**Primary key:** `(restaurant_id, id)`  
**Indici:** `idx_orders_status`, `idx_orders_created`  
**FK:** `restaurant_id` → `restaurants(id)`

### Campi tipici nel JSON `orders.extra` (non colonnati)

Il repository MySQL costruisce `extra` per tutto ciò che non è in `ORDER_EXTRA_SKIP` (in `buildOrderExtraForDb`): esclusi esplicitamente `id`, `table`, `covers`, `area`, `waiter`, `notes`, `status`, `createdAt`, `updatedAt`, `items`.

Quindi possono essere persistiti in **`extra`** (esempi dal codice):

- **`activeCourse`** — numero corso “in marcia” (non c’è colonna dedicata).
- **`inventoryProcessedAt`** e altri metadati.

**Non esiste** nel DDL una colonna dedicata `numero_corso` o `progressivo_corso` a livello ordine: il concetto è in **`extra`** + **`status`**.

---

## Tabella `order_items`

| Colonna | Tipo (schema) | Note |
|---------|----------------|------|
| `id` | `BIGINT AUTO_INCREMENT` | PK riga |
| `restaurant_id` | `VARCHAR(64)` | Tenant |
| `order_id` | `BIGINT` | FK verso ordine |
| `line_index` | `INT` | Ordine riga |
| `name`, `qty`, `area`, `category`, `type`, `notes` | Vari | Campi normalizzati |
| `extra` | `JSON` | Campi aggiuntivi della riga |

**FK:** `(restaurant_id, order_id)` → `orders`.

### Campo `course` sulle righe

In `itemToDbRow`, proprietà della riga oltre a `name`, `qty`, `area`, `category`, `type`, `notes` finiscono in **`extra`** come JSON. Quindi **`course`** (numero corso del piatto) è tipicamente in **`order_items.extra`**, non in una colonna dedicata.

---

## Presenza / assenza campi richiesti dal report

| Campo richiesto | Dove si trova (se presente) |
|-----------------|-----------------------------|
| `numero_corso` | **Non** come colonna dedicata; equivalente: **`course`** in JSON riga o logica su `item.course` in memoria applicativa. |
| `stato` | `orders.status` (stato **ordine**, non per singolo corso). |
| `attivo` | **Non** come colonna standard in questo schema per corsi. |
| `ordine_id` | `order_items.order_id` (+ `restaurant_id`). |
| `tavolo_id` | `orders.table_num` (numero tavolo, non UUID tavolo). |
| `inviato_cucina` | **Non** nel DDL analizzato; flusso = `status` iniziale `in_attesa`. |
| `servito` | **Non** boolean separato: stato testuale `orders.status === 'servito'`. |
| `progressivo_corso` | **Non** come colonna; `activeCourse` in `orders.extra`. |

---

## Tabelle non presenti per “stato per corso”

Nel DDL `schema.sql` analizzato **non** compaiono tabelle tipo `order_courses` o `kitchen_course_status`. Il multi-corso è modellato **solo** tramite righe con `course` + `activeCourse` sull’ordine.

---

## Note su `schema.sql` vs runtime

Il file `schema.sql` dichiara in testa che è **canonico per bootstrap** e che il runtime JSON legacy potrebbe differire; con **`USE_MYSQL_DATABASE=true`** il repository MySQL mappa l’oggetto ordine come descritto.

---

## Indici utili per debug

- `idx_orders_status (restaurant_id, status)` — filtri per stato.
- `idx_orders_created` — ordini recenti.
- `idx_order_items_order` — righe per ordine.
