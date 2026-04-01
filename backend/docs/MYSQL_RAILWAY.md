# MySQL / Railway

Questa nota descrive file e passi per MySQL su Railway. Con `USE_MYSQL_DATABASE=false` (default) i dati restano su **JSON**; con `true`, i moduli già migrati (ordini, pagamenti, chiusure, report, storni, turni cassa, **menu**, …) usano il DB dopo bootstrap + migrate (vedi sotto per il menu).

## Dipendenze Node

| Pacchetto | Ruolo |
|-----------|--------|
| **mysql2** | Driver MySQL ufficiale per Node (API `promise` per async/await). |

In molte installazioni del progetto `mysql2` è già presente in `package.json`. Se mancasse, dalla cartella `backend/`:

```bash
npm install mysql2
```

**Non** è obbligatorio installare `mysql2` finché non eseguite gli script di test/bootstrap.

## File nuovi (solo infrastruttura)

| Percorso | Scopo |
|----------|--------|
| `db/schema.sql` | DDL completo (…, payments, closures, saved_reports). |
| `src/db/mysql-pool.js` | Pool `mysql2/promise`; ping avvio opzionale + script migrate; **non** usato dai repository JSON runtime. |
| `src/db/README.md` | Nota d’uso del modulo `db/`. |
| `scripts/db-test-connection.js` | Verifica connessione al DB. |
| `scripts/db-bootstrap.js` | Applica `db/schema.sql` (multiple statements). Alias: `npm run db:bootstrap`. |
| `db/tenant_menus.sql` | Solo DDL tabella `tenant_menus`; script `npm run db:ensure-tenant-menus`. |
| `scripts/db-ensure-tenant-menus.js` | Applica `db/tenant_menus.sql` (DB già bootstrappato, aggiunge solo menu). |
| `scripts/db-migrate-json-to-mysql.js` | Migrazione JSON → MySQL (`--step=…`, incluso `menus`). |
| `docs/mysql-env.example.txt` | Esempio variabili (incluso flag futuro `USE_MYSQL_DATABASE`). |
| `docs/MYSQL_RAILWAY.md` | Questa documentazione. |
| `src/repositories/mysql/README.md` | Indice repository MySQL paralleli. |
| `src/repositories/mysql/users.repository.mysql.js` | Utenti su MySQL; usato se `USE_MYSQL_DATABASE=true`. |
| `src/repositories/mysql/restaurants.repository.mysql.js` | Ristoranti (tenant registry) su MySQL. |
| `src/repositories/mysql/licenses.repository.mysql.js` | Licenze globali su MySQL. |
| `src/repositories/mysql/orders.repository.mysql.js` | Ordini + righe (`order_items`) per tenant; usato se `USE_MYSQL_DATABASE=true`. |
| `src/repositories/mysql/payments.repository.mysql.js` | Pagamenti cassa per tenant; usato se `USE_MYSQL_DATABASE=true`. |
| `src/repositories/mysql/closures.repository.mysql.js` | Chiusure giornaliere Z per tenant; usato se `USE_MYSQL_DATABASE=true`. |
| `src/repositories/mysql/reports.repository.mysql.js` | Report salvati (`saved_reports`); usato se `USE_MYSQL_DATABASE=true`. |
| `src/repositories/mysql/storni.repository.mysql.js` | Storni (`storni_entries`); step migrate `storni`. |
| `src/repositories/mysql/cassa-shifts.repository.mysql.js` | Turni cassa (`cassa_shifts`); step migrate `cassa-shifts`. |
| `src/repositories/mysql/menu.repository.mysql.js` | Menu tenant (`tenant_menus`); usato se `USE_MYSQL_DATABASE=true`. |

### Cutover menu su MySQL (ordine obbligatorio)

Con `USE_MYSQL_DATABASE=true`, le API menu leggono/scrivono **`tenant_menus`**. Se il codice è attivo **prima** che la tabella esista, le chiamate menu vanno in errore finché non completi DDL + migrazione dati.

1. **Schema (una tantum)** — dalla cartella **`backend/`**:
   - DB nuovo o vuoto: `npm run db:bootstrap` (oppure `node scripts/db-bootstrap.js`), che applica tutto `db/schema.sql`.
   - DB già con le altre tabelle: solo menu → `npm run db:ensure-tenant-menus` (applica `db/tenant_menus.sql`).
2. **Dati menu**: `npm run migrate:mysql -- --step=menus` (richiede `restaurants` già migrate; vedi step `restaurants` se serve).
3. **Deploy**: pubblica il codice che usa il repository MySQL per il menu; oppure redeploy dopo i passi sopra.
4. **Flag**: imposta `USE_MYSQL_DATABASE=true` solo **dopo** bootstrap (o `db:ensure-tenant-menus`) **e** migrate `menus` verificata. Con `USE_MYSQL_DATABASE=false` il menu resta solo JSON e puoi deployare il codice senza attivare MySQL per il menu finché non hai eseguito i passi 1–2.

### Riferimento storico

`docs/mysql-bootstrap-railway.sql` (se presente) è un precedente schema; il file **canonico** per il bootstrap è ora **`db/schema.sql`**.

## Flag `USE_MYSQL_DATABASE`

- Modulo `src/config/mysqlPersistence.js` (`useMysqlPersistence()`): se `true`, i router con implementazione MySQL delegano a `mysql/*` (inclusi storni e turni cassa).
- **Sessioni Express:** con lo stesso flag `true`, `src/config/session.js` usa **`express-mysql-session`** (tabella `sessions` in `db/schema.sql`). Non servono più file in `data/sessions/`. Rollback temporaneo: `USE_FILE_SESSION_STORE=true`.
- Documentato anche in `docs/mysql-env.example.txt`.

## Ordine operativo consigliato (deploy)

1. **Railway**: creare servizio MySQL (o plugin) e copiare host, porta, database, utente, password (o `DATABASE_URL`).
2. **Locale / staging**: aggiungere le variabili in `backend/.env` (non committare segreti).
3. **Test connessione**: dalla cartella `backend/` eseguire `node scripts/db-test-connection.js`.
4. **Bootstrap tabelle**: `node scripts/db-bootstrap.js` (su DB vuoto o dopo backup).
5. **Migrazione dati**: `npm run migrate:mysql -- --step=all` (o step singoli) su copia/staging prima della produzione.
6. **Cutover**: impostare `USE_MYSQL_DATABASE=true` solo dopo migrazione verificata e smoke test (login, ordini, chiusure).

## Comandi (uno per riga)

Entra nella cartella **dove si trovano** `package.json`, `src/` e `scripts/` (nel repo spesso è `…/backend`). **Non** anteporre un altro `backend/` al comando: se lanci `node backend/scripts/…` da lì, Node cercherà `backend/backend/scripts/…` e darà `MODULE_NOT_FOUND`.

```bash
cd backend
```

```bash
npm install mysql2
```

*(solo se `mysql2` non è già installato)*

```bash
node scripts/db-test-connection.js
```

```bash
npm run db:bootstrap
```

*(solo tabella menu su DB già esistente)*

```bash
npm run db:ensure-tenant-menus
```

```bash
npm run migrate:mysql -- --step=restaurants
npm run migrate:mysql -- --step=users
npm run migrate:mysql -- --step=licenses
npm run migrate:mysql -- --step=orders
npm run migrate:mysql -- --step=menus
npm run migrate:mysql -- --step=all
```

*(opzione `--dry-run` per simulazione; import idempotente — non sostituisce i repository JSON nell’app finché non attiverete il cutover)*

## Rischi reali

- **Bootstrap su DB non vuoto**: `CREATE TABLE IF NOT EXISTS` non altera colonne; cambi di schema richiedono migrazioni manuali o ALTER.
- **Segreti**: non committare `.env` con password reali.
- **Downtime**: la cutover da JSON a MySQL richiede piano di sync e rollback.
