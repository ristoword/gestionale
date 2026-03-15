# QR Table Ordering – Deliverables

## 1. Created and Modified Files

### Created
| File | Description |
|------|-------------|
| `backend/public/qr-tables/qr-tables.html` | QR management admin page |
| `backend/public/qr-tables/qr-tables.css` | Styles for QR management page |
| `backend/public/qr-tables/qr-tables.js` | Client logic: list tables, render QR previews, print actions |
| `QR-ORDERING-DELIVERABLES.md` | This document |

### Modified
| File | Change |
|------|--------|
| `backend/public/dashboard/dashboard.html` | Added side menu entry "QR Tavoli" |
| `backend/src/middleware/requirePageAuth.middleware.js` | Added `/qr-tables/qr-tables.html` to protected paths |
| `backend/src/app.js` | Added ROLES_QR (includes supervisor) for `/api/qr` routes |
| `backend/src/middleware/requireSetup.middleware.js` | Added `/api/menu/active` to SKIP_PATHS |
| `backend/src/middleware/requireLicense.middleware.js` | Added `/api/menu/active` to SKIP_PATHS |

### Existing (unchanged, verified)
| File | Role |
|------|------|
| `backend/public/qr/index.html` | Customer-facing menu page (served for `/qr` and `/qr/:table`) |
| `backend/public/qr/qr.js` | Customer logic: menu, cart, order submission |
| `backend/public/qr/qr.css` | Customer page styles |
| `backend/src/controllers/qr.controller.js` | listTables, getTableById, getTablePrint, getAllPrint |
| `backend/src/routes/qr.routes.js` | API routes for QR tables |
| `backend/src/repositories/qr-tables.repository.js` | Table list from setup `numTables` + optional overrides |

---

## 2. Side Menu Entry

**Text:** `QR Tavoli`  
**Link:** `/qr-tables/qr-tables.html`  
**Location:** Between "Magazzino" and "Catering" in the dashboard sidebar

---

## 3. Customer QR Page Route / URL

**URL format:** `/qr/:tableId`

**Examples:**
- `https://your-domain.com/qr/1` – Tavolo 1
- `https://your-domain.com/qr/12` – Tavolo 12

**Behavior:**
- Same `index.html` is served for `/qr` and `/qr/:table`.
- `qr.js` parses the table ID from the path with `/qr/(\d+)/`.
- Without a table ID (`/qr`), the page shows a generic message and disables ordering.

---

## 4. Example Table QR Payload

**Table object (from API):**
```json
{
  "id": 1,
  "tableId": "1",
  "label": "Tavolo 1",
  "qrData": null,
  "createdAt": null,
  "updatedAt": null
}
```

**QR code URL:**
```
https://your-domain.com/qr/1
```

**Order payload (customer → POST /api/qr/orders):**
```json
{
  "table": 1,
  "area": "sala",
  "waiter": "QR",
  "covers": null,
  "notes": "QR Order – Allergie glutine",
  "items": [
    {
      "name": "Spaghetti alla carbonara",
      "qty": 2,
      "price": 12.00,
      "area": "cucina",
      "category": "Primi",
      "type": "piatto",
      "notes": ""
    }
  ]
}
```

---

## 5. End-to-End Flow

```
1. STAFF generates QR
   - Staff logs in → Dashboard → QR Tavoli
   - Sees list of tables (from setup numTables)
   - Each table has QR preview, customer URL, "Stampa" button
   - "Stampa tutti i QR" prints all table cards in a grid

2. CUSTOMER scans QR
   - Customer scans QR on table → opens /qr/:tableId (e.g. /qr/5)
   - Page loads without login (public)
   - Table ID is read from URL and bound to the session

3. CUSTOMER orders
   - Menu loads from GET /api/menu/active (active menu items)
   - Customer browses categories, adds items to cart
   - "Invia ordine" sends POST /api/qr/orders with table + items
   - Uses same OrdersController.createOrder as Sala

4. ORDER enters operational flow
   - Order is saved with table, waiter "QR", area "sala"
   - WebSocket broadcast updates Sala/Cucina/Bar
   - Print jobs routed by department (cucina, bar, pizzeria)
   - Staff sees order in Sala, Cucina, etc.
```

---

## 6. API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/qr/tables` | yes | List all tables for QR |
| GET | `/api/qr/tables/:id` | yes | Get single table |
| GET | `/api/qr/tables/:id/print` | yes | HTML print view for one QR card |
| GET | `/api/qr/tables/print-all` | yes | HTML print view for all QR cards |
| POST | `/api/qr/orders` | no | Create order (customer) |
| GET | `/api/menu/active` | no | Active menu items (customer) |

---

## 7. Validation Rules

- Each QR links to exactly one table (id 1..numTables).
- Scanning a QR opens `/qr/:tableId` with the correct table.
- Customer page does not require staff login.
- Admin QR management page requires auth (owner, sala, cucina, cassa, supervisor).
- QR flow reuses existing orders and menu; it does not alter Sala/Cucina/Cassa flows.
