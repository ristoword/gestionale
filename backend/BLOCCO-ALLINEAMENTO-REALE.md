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
- `src/repositories/closures.repository.js` – campi `storniTotal`, `netTotal` in closure
- `src/controllers/closures.controller.js` – integrazione storni (createClosure, getClosurePreview, buildExportRows, exportClosure)
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
| **Chiusura giornata** | `GET /api/closures`, `POST /api/closures`, `GET /api/closures/preview/:date`, `GET /api/closures/:date/export` | File `data/tenants/{id}/closures.json`. Lordo, netto, storni, ordini chiusi, pagamenti da backend. Supervisor e Cassa leggono lo stesso storico. |
| **Storni** | `GET /api/storni?date=`, `GET /api/storni?dateFrom=&dateTo=`, `GET /api/storni/total?date=`, `POST /api/storni`, `DELETE /api/storni/:id` | File `data/tenants/{id}/storni.json`. Netto = lordo (payments) − storni. Coerente tra Supervisor e Cassa. |
| **Storico report (chiusure)** | `GET /api/closures` (list con dateFrom/dateTo) | Lo “storico report” in Supervisor è la lista chiusure. Non più `rw_reports_history`. |
| **Report (list/create/delete)** | `GET /api/reports`, `POST /api/reports`, `DELETE /api/reports/:id` | Persistenza su `data/tenants/{id}/reports.json` (non più array in-memory). |
| **Menu / prezzi** | `GET /api/menu`, `GET /api/menu/active`, `POST /api/menu`, `PATCH /api/menu/:id`, `DELETE /api/menu/:id` | Menu su file tenant. Supervisor, Sala e Cassa usano API come fonte; `rw_menu_official` solo cache passiva. |

---

## D. Test manuali finali da fare

1. **Storni**  
   - Da Supervisor: aggiungere storno (importo, motivo), verificare in lista; eliminare uno storno.  
   - Verificare che lo stesso giorno la Cassa (chiusura Z / preview) veda lo stesso totale storni e netto coerente.

2. **Chiusura giornata**  
   - Da Supervisor: “Chiudi giornata” per la data odierna; verificare che compaia in “Storico report” e che lordo/netto/storni/ordini chiusi siano corretti.  
   - Da Cassa: aprire Chiusura Z, stesso giorno: verificare che la giornata risulti chiusa e che i totali (inclusi storni e netto) coincidano.  
   - Export CSV/Excel da Cassa/Supervisor per una data chiusa: verificare righe Storni e Totale netto.

3. **Menu**  
   - Da Supervisor: aggiungere una voce menù, eliminarla. Da Cassa: aprire il menù e verificare che le stesse voci (stesso prezzo) compaiano senza rilevare da localStorage.  
   - Da Sala: verificare che il menù attivo sia quello del backend (refresh dopo modifica da Supervisor/Cassa).

4. **Report (API)**  
   - Verificare che GET /api/reports restituisca la lista e che dopo riavvio server i report creati siano ancora presenti (persistenza su file).

5. **Ruoli**  
   - Accesso Supervisor a `/api/closures`, `/api/storni`, `/api/menu`: tutte le operazioni devono essere consentite con ruolo supervisor.

---

## E. Conferma: cosa è diventato REALE al 100%

- **Chiusura giornata**: unica fonte = backend (`closures.json` per tenant). Lordo, netto, storni, ordini chiusi, pagamenti sono calcolati e salvati lato server. Supervisor e Cassa usano le stesse API.
- **Storni**: unica fonte = backend (`storni.json` per tenant). Inserimento ed eliminazione solo via API. Il netto (lordo − storni) è coerente in chiusure, preview ed export.
- **Storico report (chiusure)**: Supervisor legge solo da GET /api/closures; nessun storico in localStorage.
- **Report (list/create/delete)**: persistenza su file per tenant; niente più array in-memory.
- **Menu/prezzi**: API menu (e menu/active) sono l’unica fonte ufficiale; Supervisor, Cassa e Sala leggono da backend; localStorage è solo cache in caso di API non disponibile.

**Non toccati** (come richiesto): owner activation, login/licenze, staff/presenze/assenze, ordini core, AI, GS.
