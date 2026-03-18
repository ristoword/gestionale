# Blocco unico allineamento reale – RISTOWORD

Obiettivo: una sola fonte di verità per chiusura giornata, storni, report e menu; rimozione dei punti demo/localStorage critici.

---

## A. File toccati

### Backend (nuovi)
- `src/repositories/storni.repository.js` – persistenza storni per tenant (`data/tenants/{id}/storni.json`)
- `src/controllers/storni.controller.js` – list, totalByDate, create, deleteById
- `src/routes/storni.routes.js` – GET /, GET /total, POST /, DELETE /:id

### Backend (modificati)
- `src/app.js` – ROLES_CLOSURES con "supervisor", mount `/api/storni`, ROLES_MENU con "supervisor"
- `src/repositories/closures.repository.js` – campi `storniTotal`, `netTotal`, `covers` in closure
- `src/controllers/closures.controller.js` – integrazione storni e covers (createClosure, computeDayTotals, getClosurePreview, buildExportRows, exportClosure)
- `src/repositories/reports.repository.js` – persistenza su file `data/tenants/{id}/reports.json` (non più in-memory)

### Frontend Supervisor
- `public/supervisor/supervisor.js` – storico da GET /api/closures, storni da GET/POST/DELETE /api/storni, menu da GET/POST/DELETE /api/menu, rimosso localStorage per report/storni

### Frontend Cassa
- `public/cassa/cassa.js` – menu da API (loadOfficialMenu da GET /api/menu, add/delete via API)

### Frontend Sala
- `public/sala/sala.js` – menu: prima API (/api/menu/active), poi cache localStorage

---

## B. localStorage eliminato o declassato

| Chiave / uso | Prima | Dopo |
|--------------|--------|------|
| `rw_reports_history` | Fonte unica storico chiusure Supervisor | **Eliminato** – sostituito da GET /api/closures |
| `rw_storni_YYYY-MM-DD` | Fonte unica storni del giorno | **Eliminato** – sostituito da GET/POST/DELETE /api/storni |
| `rw_menu_official` | Fonte primaria menu (Supervisor, Cassa, Sala) | **Solo cache** – fonte ufficiale = GET /api/menu e GET /api/menu/active |
| `rw_reports_daily` (Cassa) | Report giornalieri locali (revenue, covers, food, staff) | **Non modificato** (uso locale Cassa, fuori scope chiusura unificata) |

---

## C. Nuova fonte unica

| Concetto | Fonte unica | Dettaglio |
|----------|-------------|-----------|
| **Chiusura giornata** | `GET /api/closures`, `POST /api/closures`, `GET /api/closures/preview/:date`, `GET /api/closures/:date/export` | File `data/tenants/{id}/closures.json`. Lordo (grandTotal), storni, netto, ordini chiusi, coperti (covers), pagamenti. Supervisor e Cassa leggono lo stesso storico. |
| **Storni** | `GET /api/storni?date=`, `GET /api/storni?dateFrom=&dateTo=`, `GET /api/storni/total?date=`, `POST /api/storni`, `DELETE /api/storni/:id` | File `data/tenants/{id}/storni.json`. Netto = lordo (payments) − storni. Coerente tra Supervisor e Cassa. |
| **Storico report (chiusure)** | `GET /api/closures` (list con dateFrom/dateTo) | Lo “storico report” in Supervisor è la lista chiusure. Non più `rw_reports_history`. |
| **Report (list/create/delete)** | `GET /api/reports`, `POST /api/reports`, `DELETE /api/reports/:id` | Persistenza su `data/tenants/{id}/reports.json` (non più array in-memory). |
| **Menu / prezzi** | `GET /api/menu`, `GET /api/menu/active`, `POST /api/menu`, `PATCH /api/menu/:id`, `DELETE /api/menu/:id` | Menu su file tenant. Supervisor, Sala e Cassa usano API come fonte; `rw_menu_official` solo cache passiva. |

---

## D. Endpoint finali usati

| Area | Metodo | Endpoint | Uso |
|------|--------|----------|-----|
| Chiusure | GET | `/api/closures?dateFrom=&dateTo=` | Lista storico chiusure |
| Chiusure | POST | `/api/closures` | Chiudi giornata (body: date, closedBy, notes) |
| Chiusure | GET | `/api/closures/preview/:date` | Anteprima totali + storni + netto |
| Chiusure | GET | `/api/closures/check/:date` | Verifica se giornata chiusa |
| Chiusure | GET | `/api/closures/:date` | Dettaglio chiusura |
| Chiusure | GET | `/api/closures/:date/export?format=csv\|xlsx` | Export CSV/Excel |
| Storni | GET | `/api/storni?date=YYYY-MM-DD` | Elenco storni del giorno |
| Storni | GET | `/api/storni/total?date=YYYY-MM-DD` | Totale storni del giorno |
| Storni | POST | `/api/storni` | Crea storno (body: date, amount, reason, table, orderId, note) |
| Storni | DELETE | `/api/storni/:id` | Elimina storno |
| Report | GET | `/api/reports` | Lista report (persistente) |
| Report | POST | `/api/reports` | Crea report |
| Report | DELETE | `/api/reports/:id` | Elimina report |
| Menu | GET | `/api/menu` | Menu completo (fonte ufficiale) |
| Menu | GET | `/api/menu/active` | Menu attivo (Sala/QR) |
| Menu | POST | `/api/menu` | Crea voce menu |
| Menu | PATCH | `/api/menu/:id` | Aggiorna voce |
| Menu | DELETE | `/api/menu/:id` | Elimina voce |

Tutti gli endpoint sono tenant-aware (restaurantId da sessione/context).

---

## E. Test manuali da fare (max 8 punti)

1. **Pagamento in Cassa** → Apri Supervisor: stessi incassi visibili (ordini/pagamenti da backend).
2. **Storno** → Inserisci storno da Supervisor; apri Cassa (anche altro browser): stesso netto (lordo − storni da API).
3. **Chiudi giornata da Cassa** → Apri Supervisor: stessa chiusura nello storico (GET /api/closures).
4. **Chiudi giornata da Supervisor** → Apri Cassa Chiusura Z: giornata risulta chiusa, stessi totali.
5. **Riavvio server** → Storico chiusure, storni e report ancora presenti (file tenant).
6. **Cambio menu/prezzo** → Modifica da Supervisor o Cassa; Sala/Cassa altro dispositivo: stessa fonte backend.
7. **Export chiusura** → CSV/Excel con righe lordo, storni, netto, coperti.
8. **Ruolo supervisor** → Login supervisor: accesso a closures, storni, menu senza errore.

---

## F. Conferma: moduli da MISTO/DEMO a REALE

| Modulo | Prima | Dopo |
|--------|--------|------|
| **Chiusura giornata** | Cassa backend, Supervisor localStorage (`rw_reports_history`) | **REALE**: unica fonte `closures.json` tenant; Supervisor e Cassa usano stesse API. |
| **Storico report** | Supervisor da localStorage | **REALE**: Supervisor legge GET /api/closures; nessuna fonte browser. |
| **Storni** | localStorage `rw_storni_YYYY-MM-DD` | **REALE**: `storni.json` tenant; GET/POST/DELETE /api/storni; netto coerente ovunque. |
| **Menu / prezzi ufficiali** | `rw_menu_official` fonte primaria | **REALE**: /api/menu e /api/menu/active fonte ufficiale; localStorage solo cache passiva (Supervisor, Cassa, Sala). |
| **Reports (list/create/delete)** | In-memory (sparivano al riavvio) | **REALE**: persistenza `reports.json` tenant. |

**Non toccati**: GS, owner activation, login/licenze, staff/presenze/assenze, AI, ordini core, magazzino, design generale.
