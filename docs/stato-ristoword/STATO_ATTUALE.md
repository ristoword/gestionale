# Ristoword — stato del progetto

**Ultimo aggiornamento:** 2026-03-30  
**Scopo:** tracciare dove si è arrivati, cosa resta da fare e cosa riprendere al prossimo giro. **Aggiornare questo file a fine sessione** (anche in 5 righe: data, fatto, prossimo).

---

## Dove siamo (snapshot)

- **Backend Node/Express** è il cuore dell’app: API, sessioni, multi-tenant su file JSON in `backend/data/` e/o **MySQL** opzionale, integrazione Gestione Semplificata (validazione codici), Stripe (webhook + checkout), super-admin, dev-access opzionale.
- **Persistenza:** default **JSON**; opzionale **MySQL** con `USE_MYSQL_DATABASE=true` (users, restaurants, licenses, ordini, pagamenti, chiusure, report salvati, storni, turni cassa, … — vedi script migrate).
- **MySQL / Railway:** schema, pool, script bootstrap/migrate/test, repository MySQL paralleli, doc (`backend/docs/MYSQL_RAILWAY.md`, `RAILWAY.md`). Vedi `backend/src/db/README.md`.
- **Deploy:** `railway.toml` (root e/o backend); variabili in `backend/.env.example` e doc Railway/MySQL.
- **Posizionamento (indicativo):** gestionale ristorazione ricco, in evoluzione verso SaaS multi-tenant; non ancora “SaaS enterprise” su test, osservabilità e compliance end-to-end.

---

## Completato / stabile (riferimento)

- Flusso auth, ruoli, licenza, setup, owner-activate, pagine QR pubbliche, ordini (anche `POST /api/qr/orders` con `QR_ORDER_SECRET` + header), molti moduli operativi (magazzino, HACCP, catering, report, ecc.).
- **Hardening (2026-03):** rate limit su `/api/auth/login`, API generica, `POST /dev-access/login`, `POST /api/super-admin/login`; webhook Stripe con body raw + firma; CORS opzionale; sessioni `httpOnly` / `secure` in prod; WebSocket legato a sessione.
- **`POST /api/setup`:** dopo `setupComplete` in `restaurant-config.json` risponde **403** (override solo con `SETUP_ALLOW_REPEAT_POST=true`).
- **Account demo:** disattivabili con `DISABLE_DEMO_LOGIN=true`; in produzione `validateConfig` avvisa se restano attivi.
- **`/dev-access`:** in `NODE_ENV=production` con `DEV_OWNER_ENABLED=true`, login dev-owner / bridge / API sono **404** salvo `DEV_OWNER_ALLOW_IN_PRODUCTION=true`; restano dashboard/status per **owner** con sessione normale.
- **Stripe mock:** in produzione servono **entrambe** `STRIPE_ALLOW_DEV_ROUTES=true` e `STRIPE_ALLOW_DEV_IN_PRODUCTION=true`; altrimenti route mock = 404.
- **`validateConfig`:** avvisi produzione su demo, dev-access, Stripe mock, `GS_VALIDATE_USE_MIRROR`, `QR_ORDER_SECRET` (mancante o troppo corto).
- Documentazione sparsa ma ricca in `docs/` e `backend/docs/` (GS trial, checklist pre go-live, piani vari).

---

## Roadmap per step — obiettivo: gestionale SaaS serio e affidabile

Ordine consigliato: completare prima **Da finire**, poi **Da sistemare**, poi **Da creare**. Adattare in base alla priorità business.

**Ordine operativo suggerito (questo filone):** (1) **coerenza doc / env** (A5 + A3) → (2) **smoke su hosting** (A1) → (3) **cutover MySQL** (A2) → (4) **GS / licenze** (A4).

### A) Da finire (lavoro già iniziato o da chiudere il cerchio)

| Step | Voce | Note operative |
|------|------|------------------|
| **A1** | **Smoke MySQL su cloud** | **Script:** `npm run smoke:hosting -- <URL pubblico>` (+ opz. `--with-mysql` se DB raggiungibile da locale). Poi smoke manuale: login, ordine, cassa, report, storni, turno cassa, webhook Stripe, SMTP. |
| **A2** | **Cutover MySQL residui** | **Menu:** tabella `tenant_menus`, router repository, `npm run migrate:mysql -- --step=menus` (dopo `restaurants`, incluso in `--step=all`). Restano JSON: inventario, booking, HACCP, device, print, … |
| **A3** | **Allineamento env hosting** | Parità con `backend/.env.example` e `docs/PRE_GO_LIVE_CHECKLIST.md`: niente `DEV_OWNER_ALLOW_IN_PRODUCTION` in pubblico se non serve; `DISABLE_DEMO_LOGIN=true`; Stripe dev flag assenti in prod; `QR_ORDER_SECRET` + meta `rw-qr-order-key` se si usano ordini QR. |
| **A4** | **Integrazione GS / licenze in produzione** | Comportamento definitivo mirror vs remoto; test con codici reali e fallimenti di rete; `GS_VALIDATE_USE_MIRROR=false` in prod pubblica. |
| **A5** | **Coerenza documentazione** | Tenere allineati questo file, `PRE_GO_LIVE_CHECKLIST.md`, `backend/.env.example` e note MySQL/Railway dopo ogni blocco di lavoro. *(Passo 1 roadmap: aggiornamento 2026-03-30.)* |

### B) Da sistemare (affidabilità, rischio, operatività)

| Step | Voce | Note operative |
|------|------|------------------|
| **B1** | **Test automatici + CI** | Sostituire il placeholder `npm test`: test API critiche (auth, ordini, pagamenti, licenza), test isolamento tenant dove possibile; pipeline CI su push/PR. |
| **B2** | **Dipendenze e audit** | Chiudere o mitigare `npm audit` (`nodemailer` major, `xlsx` senza fix: policy upload/limiti o libreria alternativa; monitorare `tar` transitivo da bcrypt). |
| **B3** | **Sicurezza applicativa** | Header HTTP (es. Helmet o equivalente dietro proxy), revisione CSRF dove servono cookie di sessione, passata route-by-route su auth/ruoli, rotazione segreti e niente segreti in repo. |
| **B4** | **Sessioni e HTTPS** | Verifica cookie `secure` / `sameSite` / TTL sul dominio reale dietro HTTPS; `trust proxy` già presente — validare sul PaaS. |
| **B5** | **Osservabilità** | Log strutturati (request id, tenant), metriche base, alert su 5xx e fallimenti webhook Stripe. |
| **B6** | **Backup e disaster recovery** | Checklist `PRE_GO_LIVE_CHECKLIST` §6 ampliata (MySQL, sessioni file). **Da fare:** backup automatizzato reale e restore provato. |
| **B7** | **Performance e resilienza** | Timeout su chiamate esterne (AI, SMTP, GS), paginazione liste grandi, rate limit dove manca, WebSocket sotto carico. |

### C) Da creare (capacità tipiche di un SaaS di livello)

| Step | Voce | Note operative |
|------|------|------------------|
| **C1** | **Onboarding prodotto** | Percorso chiaro trial → pagamento → setup → primo valore; messaggi errore comprensibili; minima dipendenza da percorsi tecnici solo-dev. |
| **C2** | **Billing e abbonamenti** | Upgrade/downgrade, rinnovi, fallimenti pagamento, comunicazioni coerenti tra Stripe, DB licenze e UI owner. |
| **C3** | **Console operatore / supporto** | Strumenti per cercare tenant, sospendere servizio, diagnostica licenza, log azioni admin (oltre alla super-admin attuale se serve scalare il supporto). |
| **C4** | **Compliance e trust** | Privacy/GDPR: informativa, export/cancellazione dati, DPA se necessario; chiarezza su hosting, Stripe, email, AI come subprocessor. |
| **C5** | **API e integrazioni (opzionale)** | API versionate, documentazione (OpenAPI), chiavi API, webhook in uscita — se il posizionamento è “piattaforma”. |
| **C6** | **SLO e release** | Status page o comunicazione incidenti; deploy versionati e procedura di rollback. |
| **C7** | **Moduli prodotto deboli** | Esempio noto: **asporto** — backend + auth coerenti oppure esclusione esplicita dal perimetro commerciale. |
| **C8** | **Mobile / PWA (se in scope)** | Esperienza dedicata per reparti operativi, non solo desktop responsive. |

---

## Log sessione (appendere qui ogni volta)

Usare il formato:

```
### YYYY-MM-DD
- Fatto: …
- Bloccato / decisione: …
- Prossimo: …
```

### 2026-03-25

- Fatto: creato `docs/stato-ristoword/STATO_ATTUALE.md` come punto unico per stato e backlog operativo; allineato a struttura repo (JSON attivo, MySQL in preparazione, note sicurezza/debiti tecnici).
- Prossimo: a scelta — cutover MySQL (primo repository) oppure hardening `POST /api/setup` oppure deploy Railway + verifica env.

### 2026-03-29

- Fatto: ping MySQL **opzionale** all’avvio (`MYSQL_PING_ON_START=true` + `DATABASE_URL`/`MYSQL_URL` tipo `mysql://…` oppure host remoto `MYSQLHOST`): verifica connessione senza usare MySQL per i dati; fallimento = solo warning, server e JSON invariati. File: `backend/src/db/mysql-startup-ping.js`, hook in `server.js`, nota in `.env.example`.
- Fatto: **migrazione JSON → MySQL a step** (`scripts/db-migrate-json-to-mysql.js`, `npm run migrate:mysql -- --step=restaurants|users|licenses|orders|all` e `--dry-run`). Stub `restaurants` automatico per tenant mancanti (FK). `src/config/mysqlPersistence.js` solo flag futuro.
- Fatto: cutover **users** — router + MySQL; metodi async ovunque; `validateConfig` avvisa se flag true senza URL DB.
- Fatto: cutover **restaurants** (`restaurants.repository.json.js` + `mysql/restaurants.repository.mysql.js` + router) e **licenses** (`licenses.repository.json.js` + `mysql/licenses.repository.mysql.js` + router); onboarding, owner, license, Stripe sync, super-admin, dev-access aggiornati con `await`.
- Fatto: cutover **orders** — `orders.repository.json.js`, `mysql/orders.repository.mysql.js`, router; tutti i chiamanti con `await`; `tryMarkOrderInventoryProcessed` async.
- Fatto: cutover **payments** — `payments.repository.helpers.js`, `payments.repository.json.js`, `mysql/payments.repository.mysql.js`, router; tabella `payments` in `db/schema.sql`; step migrate `payments`.
- Fatto: cutover **closures** — `closures.repository.helpers.js`, `closures.repository.json.js`, `mysql/closures.repository.mysql.js`, router; tabella `closures`; migrate `closures`.
- Fatto: cutover **report salvati** — `reports.repository.helpers.js`, `reports.repository.json.js`, `mysql/reports.repository.mysql.js`, tabella `saved_reports`; `getDailyData` resta nel router (ordini/pagamenti); migrate `reports`.
- Fatto: cutover **storni** e **cassa-shifts** — helper + JSON + MySQL + router; tabelle `storni_entries`, `cassa_shifts`; migrate `--step=storni` e `--step=cassa-shifts` (inclusi in `--step=all`).
- Prossimo: `db-bootstrap` + migrate step; smoke test storni e apertura/chiusura turno cassa con MySQL.
- Eseguito su DB: `node scripts/db-bootstrap.js` OK; `migrate:mysql --step=restaurants --dry-run` OK; `migrate:mysql --step=all` OK (2 restaurants, stub default/risto2/Boss_risto3, 14 users, 4 licenses, 25 ordini tenant default — altri tenant senza `orders.json` o vuoti non compaiono nel log).

### 2026-03-29 (hardening sicurezza + roadmap SaaS)

- Fatto: gate **`POST /api/setup`** dopo `setupComplete` (`SETUP_ALLOW_REPEAT_POST` per eccezione); **`DISABLE_DEMO_LOGIN`**; blocco **`/dev-access`** tecnico in produzione salvo `DEV_OWNER_ALLOW_IN_PRODUCTION`; rate limit **`POST /dev-access/login`** e **`POST /api/super-admin/login`**; Stripe mock in produzione con doppia env **`STRIPE_ALLOW_DEV_IN_PRODUCTION`**; **`validateConfig`** esteso (QR, Stripe, dev, demo); `npm audit fix` non-forzato; `.env.example` aggiornato.
- Fatto: aggiornato questo documento con sezioni **Da finire / Da sistemare / Da creare** ordinate per step (A1…C8).
- Prossimo: eseguire step **A1–A3** (smoke cloud + cutover residui + env); poi **B1–B2** (test + audit dipendenze).

### 2026-03-30 — Passo 1 roadmap «Da finire»: doc + env (solo documentazione)

- Fatto: allineati **`docs/PRE_GO_LIVE_CHECKLIST.md`** (segreti, Stripe mock doppia env, dev-access, backup MySQL/sessioni, HTTPS/URL, GS mirror) e **`backend/.env.example`** (commento accurato su cosa è già su MySQL vs JSON).
- Fatto: in questo file, **ordine operativo** esplicito (doc → smoke → cutover → GS) e nota su **A5** (passo 1 completato).
- Prossimo passo roadmap: **A1** — smoke sistematici su Railway (o staging) con `USE_MYSQL_DATABASE=true` dove previsto.

### 2026-03-30 — Passo 2 roadmap «Da finire»: A1 (smoke hosting, base)

- Fatto: script **`backend/scripts/smoke-hosting.js`** + npm **`smoke:hosting`**: verifica HTTP `GET /api/health` e `GET /api/setup/status`; opzioni `--with-mysql`, `--mysql-only`, `--http-only`. Documentato in **`backend/docs/RAILWAY.md`**; tabella **A1** aggiornata in questo file.
- Prossimo: eseguire lo script contro l’URL Railway reale + completare smoke **manuali** (login, ordini, cassa, …); poi **A2** cutover JSON residui.

### 2026-03-30 — A2 (primo dominio): menu → MySQL

- Fatto: tabella **`tenant_menus`** in `db/schema.sql`; **`menu.repository.json.js`** + **`mysql/menu.repository.mysql.js`** + router **`menu.repository.js`**; service/controller/route/async **`/api/menu/active`**; migrazione **`--step=menus`** in `db-migrate-json-to-mysql.js` (ordine dopo `restaurants`).
- **Deploy:** da `backend/`: `npm run db:bootstrap` oppure solo menu `npm run db:ensure-tenant-menus`, poi `npm run migrate:mysql -- --step=menus`, poi deploy/redeploy e `USE_MYSQL_DATABASE=true` quando i dati sono migrati. Dettaglio: `backend/docs/MYSQL_RAILWAY.md`.
- Prossimo A2: inventario / booking / … o smoke manuale menu su Railway con MySQL attivo.

---

## Riferimenti rapidi

| Documento | Contenuto |
|-----------|-----------|
| `backend/docs/MYSQL_RAILWAY.md` | MySQL su Railway |
| `backend/docs/RAILWAY.md` | Deploy generale |
| `backend/docs/INTEGRATION_GS_TRIAL.md` | GS ↔ Ristoword |
| `docs/PRE_GO_LIVE_CHECKLIST.md` | Checklist pre produzione |
| `backend/src/db/README.md` | Pool MySQL e flag `USE_MYSQL_DATABASE` |
| `backend/.env.example` | Variabili ambiente e note sicurezza |
