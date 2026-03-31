# Checklist operativo pre go-live — RistoWord

Documento di verifica **prima** di mettere in produzione un’istanza o un nuovo tenant.  
Seguire in ordine; spuntare ogni voce quando completata.

---

## 1. Server e ambiente

- [ ] **Node.js** versione supportata (LTS consigliata) installata sul server.
- [ ] **`NODE_ENV=production`** impostato.
- [ ] Process manager (**systemd**, **PM2**, **Railway**, ecc.) configurato con **restart automatico** in caso di crash.
- [ ] **HTTPS** attivo (certificato valido); niente solo HTTP in produzione per sessioni e cookie `secure`.
- [ ] URL pubblici (`PUBLIC_APP_URL` / `APP_URL` / `BASE_URL`) in **https://** su host reale: in avvio, `validateConfig` avvisa se sono **http://** (cookie `secure` potrebbe non essere inviato).
- [ ] **Dominio** e DNS puntano all’istanza corretta.
- [ ] Variabile **`RISTOWORD_VERSION`** (opzionale) per tracciare il deploy.

---

## 2. Segreti e sicurezza (obbligatori)

- [ ] **`SESSION_SECRET`**: stringa lunga, casuale, **unica** per ambiente (mai default o copiata da esempi pubblici).
- [ ] **`TENANT_SMTP_SECRET`**: impostata in produzione se usate **email SMTP per tenant** (Console owner); lunga e segreta.
- [ ] File **`.env` non committato** nel repository; backup dei segreti in **password manager** o vault, non in chat.
- [ ] Utenti **default** di test disattivati o password cambiate.
- [ ] In produzione pubblica: **`DISABLE_DEMO_LOGIN=true`** dopo aver creato utenti reali (disattiva login account demo `risto_*`).
- [ ] **`POST /api/setup`**: dopo il primo setup completato non deve essere richiamabile dall’esterno; in codice è bloccato con 403 salvo eccezione controllata (`SETUP_ALLOW_REPEAT_POST`) — in hosting non impostare quest’ultima salvo reinstallazione voluta.
- [ ] Ordini **QR** (`/qr`, `POST /api/qr/orders`): se li usi, **`QR_ORDER_SECRET`** in `.env` e stesso valore nel meta `rw-qr-order-key` in `public/qr/index.html`.
- [ ] Accesso **SSH / pannello hosting** con MFA dove possibile.

---

## 3. Stripe e pagamenti

- [ ] **Chiavi Stripe live** (non test) in ambiente produzione.
- [ ] **`STRIPE_WEBHOOK_SECRET`** configurato e uguale a quello mostrato nel Dashboard Stripe per l’endpoint webhook.
- [ ] URL pubblico **`/api/stripe/webhook`** raggiungibile da internet (Stripe deve poter fare POST).
- [ ] **`PUBLIC_APP_URL`** / URL di successo/cancel checkout coerenti con il dominio reale (vedi warning in avvio se mancanti).
- [ ] **Route mock Stripe** (`/api/checkout/mock/complete`, ecc.): in **`NODE_ENV=production`** restano **404** a meno di **`STRIPE_ALLOW_DEV_ROUTES=true`** e **`STRIPE_ALLOW_DEV_IN_PRODUCTION=true`**. Su hosting pubblico lasciare **entrambe assenti o false**.
- [ ] Test manuale: un pagamento di prova in **importo minimo** e verifica licenza/attivazione.

---

## 4. Email (globale e per tenant)

- [ ] **SMTP globale** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`) se volete invii senza config per tenant.
- [ ] Oppure: istruzioni al cliente per **Console owner → Email operativa** (SMTP del locale).
- [ ] Test invio: **lista spesa** (Cucina) o **email magazzino** verso una casella di test.
- [ ] SPF/DKIM sul dominio del mittente (consigliato per deliverability).

---

## 5. Licenza e multi-tenant

- [ ] **Licenza attiva** per ogni `restaurantId` che deve operare (file/licenza coerenti con il processo GS / onboarding in uso).
- [ ] **`GS_VALIDATE_USE_MIRROR`**: in **produzione pubblica** lasciare **false** (validazione codici verso GS); **true** solo in dev/staging controllato. Testare timeout/rete prima del go-live.
- [ ] Sessione utente con **`restaurantId`** corretto dopo login (verifica su Sala/Cucina che i dati siano del tenant giusto).
- [ ] Cartella **`data/tenants/<id>/`** presente e scrivibile dal processo Node (e/o dati equivalenti su **MySQL** se `USE_MYSQL_DATABASE=true`).
- [ ] Con **MySQL**: verificare migrazioni eseguite (`npm run migrate:mysql`) e backup del **database** oltre ai file sotto `data/`.

---

## 6. Backup e disaster recovery

- [ ] **Backup schedulato** della cartella `data/` (almeno giornaliero) + retention definita.
- [ ] Con **MySQL** (es. Railway): snapshot / backup automatici del servizio database; retention e regione annotati.
- [ ] **Export periodico** (dump SQL o backup) conservato anche **fuori** dal solo PaaS (storage separato), per rischio account/provider.
- [ ] Sessioni su file (`backend/data/sessions/` in produzione con `express-session` + file store): incluse nel backup filesystem o accettato logout globale dopo restore.
- [ ] Prova di **restore** su ambiente di staging (DB + `data/` se usi ancora JSON misto).
- [ ] Documentato **chi** ripristina e **in quanto tempo** (RTO/RPO concordati con il cliente).

---

## 7. Rete e accessi applicativi

- [ ] **`/dev-access`**: in produzione, login dev-owner / bridge / API tecnica sono disattivi (**404**) se `DEV_OWNER_ENABLED=true` senza **`DEV_OWNER_ALLOW_IN_PRODUCTION=true`** (su hosting pubblico non impostare quest’ultima salvo necessità). Restano raggiungibili dashboard/status per **owner** già loggato con sessione normale.
- [ ] **Super-admin**: credenziali forti; cookie `super_admin_session` non su macchine condivise in modo non sicuro.
- [ ] (Opzionale ma consigliato) **Rate limiting** sul login a livello reverse proxy (Nginx, Cloudflare, ecc.).

---

## 8. Funzioni core — smoke test

Dopo ogni deploy, da repo (cartella `backend/`):

- [ ] **`npm run smoke:hosting -- https://<tuo-dominio>`** — health + setup status (vedi `backend/docs/RAILWAY.md`). Opzionale: `--with-mysql` se il DB è raggiungibile dalla macchina che lancia lo script.

Eseguire rapidamente su **un tenant reale** o di staging:

- [ ] Login owner / sala / cucina / cassa.
- [ ] Creazione ordine Sala → visibile Cucina → cambio stato → coerenza mappa/WS.
- [ ] **Corsi / marcia** (se usati): invio multi-corso, marcia, colori KDS.
- [ ] Chiusura ordine / cassa (percorso usato dal locale).
- [ ] Magazzino: ricezione o movimento minimo (se modulo attivo).

---

## 9. Monitoraggio

- [ ] **`GET /api/health`** incluso in monitor (UptimeRobot, Pingdom, health check del PaaS).
- [ ] Log applicativi accessibili (stdout o file) per diagnostica errori.
- [ ] Alert su **5xx** o downtime (anche minimi).

---

## 10. Legale e commerciale (responsabilità)

- [ ] **Privacy / GDPR**: informativa su trattamento dati clienti finali; dove risiedono i dati (`data/` sul server).
- [ ] **Contratto / SLA** con il cliente: cosa è incluso (backup, ore assistenza, aggiornamenti).
- [ ] Piano **aggiornamenti** e **manutenzione** post vendita.

---

## Riepilogo “semáforo”

| Area            | Senza questa voce…                          |
|-----------------|---------------------------------------------|
| SESSION_SECRET  | Rischio sessioni compromesse                |
| HTTPS + cookie  | Sessioni esposte / non funzionanti          |
| Backup `data/`  | Perdita totale in caso di incidente         |
| Stripe webhook  | Pagamenti ok ma licenza/sync non aggiornati |
| Test smoke core | Sorprese in prima giornata operativa        |

---

*Ultimo aggiornamento: 2026-03-30 — allineata a hardening e variabili in `backend/.env.example`. Roadmap e stato progetto: `docs/stato-ristoword/STATO_ATTUALE.md`.*

---

## Riferimento hardening blocco 1 (bootstrap)

All’avvio, `backend/src/server.js` emette warning se `NODE_ENV` ≠ production, `SESSION_SECRET` assente o &lt; 20 caratteri, mancanza di `PUBLIC_APP_URL` / `BASE_URL` / `APP_URL`, e dopo `listen` stampa `[Ristoword] MODE|PORT|BASE_URL|SECURITY`. Dettagli anche in `backend/src/config/validateConfig.js`.
