# Hardware & Auto-Print Routing – Deliverables

## 1. Created and Modified Files

### Backend – Created
- `backend/src/repositories/devices.repository.js` – Device CRUD, department, type, connection
- `backend/src/repositories/print-routes.repository.js` – Routing rules (eventType + department → deviceId)
- `backend/src/repositories/print-jobs.repository.js` – Print job queue, status, retry
- `backend/src/service/print.service.js` – Routing logic, submitJob, submitOrderTickets, testPrint
- `backend/src/controllers/devices.controller.js`
- `backend/src/controllers/print-routes.controller.js`
- `backend/src/controllers/print-jobs.controller.js`
- `backend/src/routes/devices.routes.js`
- `backend/src/routes/print-routes.routes.js`
- `backend/src/routes/print-jobs.routes.js`

### Backend – Modified
- `backend/src/app.js` – Mount devices, print-routes, print-jobs routes
- `backend/src/controllers/orders.controller.js` – Call submitOrderTickets after createOrder
- `backend/src/service/onboarding.service.js` – Added devices.json, print-routes.json, print-jobs.json
- `backend/src/utils/tenantMigration.js` – Same
- `backend/src/controllers/setup.controller.js` – Same
- `backend/src/middleware/requirePageAuth.middleware.js` – Added hardware.html

### Frontend – Created
- `backend/public/hardware/hardware.html` – Devices, routes, jobs UI
- `backend/public/hardware/hardware.js`
- `backend/public/hardware/hardware.css`

### Frontend – Modified
- `backend/public/dashboard/dashboard.html` – Link to Hardware / Stampa
- `backend/public/sala/sala.js` – Handle _printJobs after order creation, open print view (manual fallback)

### Data Files (tenant-specific)
- `backend/data/tenants/{tenantId}/devices.json`
- `backend/data/tenants/{tenantId}/print-routes.json`
- `backend/data/tenants/{tenantId}/print-jobs.json`

---

## 2. UI Areas Added

### Hardware page (`/hardware/hardware.html`)
- **Devices tab**: Create/edit device, list devices, test print, activate/deactivate, set default
- **Print routes tab**: Map eventType + department → device, add/delete routes
- **Job monitor tab**: List jobs by status (queued, sent, failed, printed), retry failed jobs

### Dashboard
- New nav item: "Hardware / Stampa"

### Sala
- After order creation: if print jobs exist, opens print view for manual/browser print; warnings logged if no route

---

## 3. Example Device Payload

```json
{
  "name": "Stampante Cucina 1",
  "type": "kitchen_printer",
  "department": "cucina",
  "connectionType": "network",
  "ipAddress": "192.168.1.10",
  "port": 9100,
  "isDefault": true,
  "isActive": true,
  "notes": "Termica 80mm"
}
```

---

## 4. Example Print Route Payload

```json
{
  "eventType": "order_ticket_kitchen",
  "department": "cucina",
  "deviceId": "dev_xxx"
}
```

---

## 5. Example Print Job Payload

**Request (POST /api/print-jobs):**
```json
{
  "eventType": "order_ticket_kitchen",
  "department": "cucina",
  "documentTitle": "Comanda Tavolo 12",
  "content": "=== COMANDA TAVOLO 12 ===\nReparto: cucina\n...",
  "sourceModule": "sala",
  "relatedOrderId": "ord_123",
  "relatedTable": "12"
}
```

**Response:**
```json
{
  "job": {
    "id": "job_xxx",
    "eventType": "order_ticket_kitchen",
    "department": "cucina",
    "deviceId": "dev_yyy",
    "status": "queued",
    "documentTitle": "Comanda Tavolo 12"
  },
  "routed": true,
  "device": { "id": "dev_yyy", "name": "Stampante Cucina 1", "department": "cucina" },
  "warning": null
}
```

---

## 6. Business Rule: Auto-Routing

**L’operatore non deve cercare cosa stampare o quale stampante usare.** Ristoword instrada i job di stampa automaticamente in base a:
- **eventType** (es. order_ticket_kitchen, receipt_final)
- **department** (cucina, bar, pizzeria, cassa, magazzino)

Flusso:
1. Azione operativa (es. Sala crea ordine) → il sistema determina gli eventi di stampa
2. Per ogni evento: risoluzione route (eventType + department → deviceId)
3. Se esiste una route attiva e un dispositivo attivo → job creato con status `queued` e `deviceId`
4. Se non esiste route/device → job creato con status `failed`, `warning` chiaro, fallback manuale (browser)

Il frontend può aprire la vista stampa (`/api/print-jobs/:id/print`) per stampa manuale quando non c’è hardware configurato o per verifica.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/devices | List devices |
| GET | /api/devices/:id | Get device |
| POST | /api/devices | Create device |
| PATCH | /api/devices/:id | Update device |
| DELETE | /api/devices/:id | Delete device |
| POST | /api/devices/:id/test-print | Test print |
| GET | /api/print-routes | List routes |
| GET | /api/print-routes/:id | Get route |
| POST | /api/print-routes | Create route |
| PATCH | /api/print-routes/:id | Update route |
| DELETE | /api/print-routes/:id | Delete route |
| GET | /api/print-jobs | List jobs (query: status, sourceModule, limit) |
| GET | /api/print-jobs/:id | Get job |
| GET | /api/print-jobs/:id/print | HTML view for manual print |
| POST | /api/print-jobs | Create job (auto-routing) |
| POST | /api/print-jobs/:id/retry | Retry failed job |

---

## Module Integration Points

- **Sala**: Alla creazione ordine, `submitOrderTickets` viene chiamato dal backend. Per reparto (bar, cucina, pizzeria) viene creato un job. Il frontend riceve `_printJobs` e apre la vista stampa per fallback manuale.
- **Cassa, Cucina, Bar, Pizzeria, Magazzino**: per integrare, chiamare `POST /api/print-jobs` con `eventType`, `department`, `content`, `sourceModule` al momento dell’azione di stampa. Esempio per Cassa preconto: `eventType: "receipt_prebill"`, `department: "cassa"`.

---

## Architecture Note

Il sistema è progettato per:
- **Browser/manual print**: vista HTML, `window.print()`
- **Futuro bridge locale**: un servizio locale può interrogare i job `queued` e inviarli all’hardware
- **Futuro Electron**: stesso modello, bridge integrato

Non viene simulata stampa diretta su hardware dal browser; la coda e il routing sono pronti per un bridge esterno.
