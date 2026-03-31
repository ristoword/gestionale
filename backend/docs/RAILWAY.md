# Railway — deploy e healthcheck

## Variabili obbligatorie (minimo)

- `SESSION_SECRET` — stringa lunga casuale (altrimenti il server non parte).
- `PORT` — **non** impostarla a mano: Railway la inietta da sola.
- `PUBLIC_APP_URL` o `BASE_URL` — URL pubblico del servizio (es. `https://xxx.up.railway.app`), senza slash finale.

## Healthcheck

L’app espone:

- `GET /api/health`
- `GET /api/system/health`

Entrambe rispondono con **HTTP 200** e JSON `{ status: "ok", ... }` senza login.

### Config as code

In `backend/railway.toml` (o `railway.toml` in root) è già impostato:

```toml
[deploy]
healthcheckPath = "/api/health"
healthcheckTimeout = 300
```

### Dashboard Railway

Se modifichi dalla UI: **Settings → Deploy → Healthcheck Path** = `/api/health`.  
Il file `railway.toml` ha priorità se presente.

## Root directory

- **Solo backend:** imposta Root Directory `backend` e usa il `railway.toml` dentro `backend/`.
- **Repo intero:** Root vuoto o `.` e `npm start` da root (vedi `package.json` in root).

## Avvio

`npm start` → `node src/server.js` (ascolta su `process.env.PORT` e `0.0.0.0`).

## Smoke test da terminale (dopo deploy)

Dalla cartella `backend/`, con l’URL pubblico dell’istanza:

```bash
npm run smoke:hosting -- https://TUO-DOMINIO.up.railway.app
```

Controlla `GET /api/health` e `GET /api/setup/status`. Opzionale: stesso comando con `--with-mysql` per eseguire anche `SELECT 1` usando le credenziali nel `.env` locale (serve `DATABASE_URL` / variabili MySQL verso un host raggiungibile, es. proxy Railway). Solo DB: `node scripts/smoke-hosting.js --mysql-only` (richiede `USE_MYSQL_DATABASE=true`).

## MySQL e menu (cutover)

Se usi `USE_MYSQL_DATABASE=true`, la tabella **`tenant_menus`** deve esistere **prima** che il traffico usi le API menu su MySQL. Ordine consigliato (sempre dalla cartella `backend/`): `npm run db:bootstrap` **oppure** solo DDL menu con `npm run db:ensure-tenant-menus`, poi `npm run migrate:mysql -- --step=menus`, poi deploy / flag. Dettaglio: [MYSQL_RAILWAY.md](./MYSQL_RAILWAY.md) (sezione «Cutover menu su MySQL»).
