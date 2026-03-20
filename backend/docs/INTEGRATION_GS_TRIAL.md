# Integrazione Gestione Semplificata (GS) ↔ Ristoword (Stripe trial / licenza)

Contratto unico tra **GS** (frontend/gestionale) e **Ristoword** (questo backend).  
**Il codice di attivazione lo genera solo Ristoword** dopo pagamento confermato (`syncLicenseFromPaidSession`).

---

## Memorandum operativo (da tenere allineato tra i due siti)

| Passaggio | Chi | Cosa succede |
|-----------|-----|----------------|
| 1 | **GS** | L’utente sceglie piano trial / abbonamento; GS invia `restaurantId` **stabile** (stesso ID tenant in entrambi i sistemi). |
| 2 | **GS → Ristoword** | `POST /api/checkout` con `restaurantId`, `mode` (`trial` o subscription), `customerEmail`, `customerName`. Risposta: **`sessionId`**. |
| 3 | **Cliente / Stripe** | Il **pagamento** è incassato da **Stripe** (conto Stripe del merchant). Ristoword **non** è il merchant: riceve solo notifiche (webhook) o, in dev, simulazione. |
| 4 | **GS → Ristoword** | Dopo pagamento OK: in **dev/test** `POST /api/checkout/mock/complete` con `sessionId`, `outcome: "paid"`. In **produzione** l’equivalente è il **webhook** Stripe verso RW che elabora l’evento (stessa `syncLicenseFromPaidSession`). |
| 5 | **Ristoword** | Scrive licenza tenant (`licenses.json`, `data/tenants/{id}/license.json`), genera **`activationCode`**, **`expiresAt`**, opzionale **email** (`SMTP_*`, `APP_URL`). |
| 6 | **GS** | Mostra all’utente `activationCode`, `ownerActivateUrl`, `expiresAt`. Se `emailSent === false` o errore SMTP, **mostrare sempre il codice in UI** (non solo “controlla la posta”). |
| 7 | **Cliente** | Apre `ownerActivateUrl` o `/owner-activate` → `POST /api/licenses/complete-activation` crea **account owner** (email + password) → permessi “owner” sul tenant. |
| 8 | **Cliente** | Login operativo: `/login/login.html` — staff creati dall’owner in **Owner console** / gestione utenti. |

**Chi “accetta i dati” e chi “dà i permessi”**

- **Stripe**: incassa il pagamento; titolare dei dati carta/PSD2 è il flusso Stripe Checkout / Customer Portal configurato sul **conto Stripe** collegato al prodotto.
- **Ristoword**: **non** riceve PAN carta; riceve solo **sessione pagata** (mock o webhook). È lui che **scrive la licenza** e **genera il codice**; è lui che, su `complete-activation`, **crea l’utente owner** nel proprio DB/sessioni.
- **Gestione Semplificata**: orchestrazione UI e chiamate API verso RW; **non** deve generare codici licenza autonomamente; usa le risposte RW.
- **Permessi applicativi** (sala, cassa, …): li assegna l’**owner** dopo login, tramite Ristoword (staff API), non GS direttamente — salvo integrazioni future esplicite.

**Middleware RW (nessuna modifica necessaria per GS)**  
`requireLicense` e `requireSetup` **saltano** già `/api/checkout`, `/api/stripe`, `/api/licenses` (vedi `requireLicense.middleware.js`, `requireSetup.middleware.js`). Le API trial restano raggiungibili anche se l’istanza non è ancora “attivata” globalmente.

---

## Collegamenti esistenti compatibili trial + GS (riferimento rapido)

Sia **`API`** la base URL del backend Ristoword (es. `http://localhost:3000` in locale, `https://…` in produzione).  
Configurazione su GS: `VITE_RISTOWORD_API_URL` / `NEXT_PUBLIC_RISTOWORD_API_URL` = stesso valore di **`API`**.

### API REST (flusso trial / licenza / GS)

| Metodo | Path | Ruolo |
|--------|------|--------|
| `POST` | `{API}/api/checkout` | Avvio checkout: body `restaurantId`, `mode: "trial"`, `customerEmail`, … → risposta con **`sessionId`**. |
| `POST` | `{API}/api/checkout/mock/complete` | Dopo pagamento (mock/dev): body `sessionId`, `outcome: "paid"` → risposta con **`activationCode`**, **`ownerActivateUrl`**, **`expiresAt`**, `emailSent`, … |
| `GET` | `{API}/api/licenses/validate?code=CODICE` | Verifica codice senza body (curl / browser). |
| `POST` | `{API}/api/licenses/verify-code` | Verifica codice: body `{ "licenseCode": "..." }` (stesso uso della UI owner-activate). |
| `POST` | `{API}/api/licenses/complete-activation` | Crea account owner: body `licenseCode`, `email`, `password`, `confirmPassword`. |

### Pagine web (browser cliente)

| Path | Ruolo |
|------|--------|
| `{API}/owner-activate` | Attivazione owner: codice + email + password. Query supportate: `?code=...&email=...` (come da `ownerActivateUrl`). |
| `{API}/dev-access/dashboard` | Dopo attivazione completata (redirect attuale; onboarding owner). |
| `{API}/login/login.html` | Login operativo dopo che l’owner ha creato l’accesso. |

### Stripe mock / webhook (sviluppo o test)

| Metodo | Path | Ruolo |
|--------|------|--------|
| `POST` | `{API}/api/stripe/webhook` | Body `{ "eventId": "evt_..." }` — elabora evento da `stripe-mock.json`. |
| `POST` | `{API}/api/stripe/webhook/sync` | Elabora eventi in coda (dev). |

### Health check

| Metodo | Path |
|--------|------|
| `GET` | `{API}/api/health` o `{API}/api/system/health` |

### Ambiente Ristoword (`.env` in `backend/`)

| Variabile | Ruolo |
|-----------|--------|
| `APP_URL` | Base pubblica per link nelle email (codice + link). |
| `CORS_ALLOWED_ORIGINS` | Origini del browser GS (es. `http://localhost:5173`) se GS ≠ stesso host dell’API. |
| `SMTP_*` | Invio email con codice dopo `mock/complete` (opzionale). |

**Nota:** non esiste un endpoint che “generi” un codice da solo senza sessione di checkout + pagamento confermato (o Super Admin); il codice utile per GS arriva dalla risposta di **`/api/checkout/mock/complete`** (o dall’equivalente webhook in produzione).

---

## Sincronizzazione (tabella)

| Fase | Chi | Azione |
|------|-----|--------|
| 1 | GS | Registrazione utente / scelta `restaurantId` stabile (tenant) |
| 2 | GS → RW | `POST /api/checkout` con `restaurantId`, `mode: "trial"`, `customerEmail` |
| 3 | Cliente | Pagamento Stripe (reale o simulato lato vostro processo) |
| 4 | GS → RW | `POST /api/checkout/mock/complete` `{ sessionId, outcome: "paid" }` **(mock)** oppure in prod solo webhook Stripe su RW |
| 5 | RW | Scrive `licenses.json` + `data/tenants/{id}/license.json`, genera `activationCode`, `expiresAt` (14gg trial / 30gg subscription), email opzionale |
| 6 | GS | Mostra `activationCode`, `ownerActivateUrl`, `expiresAt` (se `emailSent === false` **non** dire solo “controlla la posta”) |
| 7 | Cliente | `/owner-activate` → password → onboarding owner |

---

## Variabili Ristoword (`backend/.env`)

| Variabile | Ruolo |
|-----------|--------|
| `APP_URL` | URL pubblico senza `/` finale — link assoluti nelle email (`https://app.tuodominio.it`) |
| `SMTP_*` | Email con codice + link (opzionale ma consigliato in prod) |
| `CORS_ALLOWED_ORIGINS` | Origini GS separate da virgola, es. `http://localhost:5173,https://gs.tuodominio.it` — **necessario** se il browser GS non è same-origin con l’API |
| `SUPER_ADMIN_*` | Solo manutenzione, **non** per il flusso trial clienti |

---

## Variabili consigliate su GS

| Variabile (esempio) | Valore |
|---------------------|--------|
| `VITE_RISTOWORD_API_URL` / `NEXT_PUBLIC_RISTOWORD_API_URL` | Base API: `http://localhost:3000` (dev) o `https://api.tuodominio.it` (prod) |

Tutte le chiamate: `{API_URL}/api/checkout`, ecc.

---

## 1) Avvio checkout

**`POST {API_URL}/api/checkout`** · `Content-Type: application/json`

```json
{
  "restaurantId": "ID_TENANT_UNIVOCO_GS",
  "mode": "trial",
  "plan": "ristoword_pro",
  "customerEmail": "cliente@email.it",
  "customerName": "Mario Rossi"
}
```

- `restaurantId` (alias `tenantId`): **stabile** nel tempo.
- `mode`: `"trial"` → scadenza **14 giorni**; `"subscription"` → **30 giorni** (logica in `stripeLicenseSync.service.js`).
- `customerEmail`: anche `email` o `adminEmail`.

**Risposta:** `sessionId`, `restaurantId`, `mode`, `customerEmail`, …

GS deve **conservare `sessionId`** fino al post-pagamento.

---

## 2) Post-pagamento (mock attuale)

**`POST {API_URL}/api/checkout/mock/complete`**

```json
{
  "sessionId": "cs_...",
  "outcome": "paid"
}
```

**Risposta (campi da usare in UI):**

| Campo | Note |
|-------|------|
| `activationCode` | Da mostrare sempre se presente |
| `ownerActivateUrl` | Link con `code` + `email` in query |
| `expiresAt` | ISO scadenza licenza |
| `restaurantId`, `plan`, `mode` | Display / supporto |
| `emailSent` / `emailError` | Se errore SMTP, UI deve mostrare codice + link |

In **produzione con Stripe reale**, questo endpoint mock può non essere esposto: l’equivalente è il **webhook** che chiama la stessa `syncLicenseFromPaidSession` (stesso file licenza / stesso codice).

### Produzione Stripe reale (indicazioni)

- Configurare su Stripe Dashboard: **Webhook endpoint** → URL pubblico RW (es. `https://api.tuodominio.it/api/stripe/webhook` o route definita nel progetto quando si integra SDK reale).
- In questo repository l’elaborazione evento è centralizzata in `stripeWebhook.service.js` → `processWebhookEvent` → `syncLicenseFromPaidSession` (`stripeLicenseSync.service.js`).
- Variabili tipiche: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price ID (vedi super-admin / `.env`); il mock locale usa `stripe-mock.json` senza chiamate Stripe live.
- **GS** in produzione: dopo redirect success da Stripe, può **pollare** RW (es. licenza per `restaurantId`) oppure attendere email; oppure chiamare endpoint di stato se ne aggiungete uno dedicato — **senza** esporre `mock/complete` in pubblico se non serve.

---

## 3) Verifica codice (QA / GS)

- **`GET /api/licenses/validate?code=...`**
- **`POST /api/licenses/verify-code`** body `{ "licenseCode": "..." }`

Risposta ok: `{ "ok": true, "restaurantId": "...", "message": "..." }`.

---

## 4) Esempio `fetch` da browser (GS)

```javascript
const API = import.meta.env.VITE_RISTOWORD_API_URL || "http://localhost:3000";

export async function startRistowordTrial({ restaurantId, email, name }) {
  const r = await fetch(`${API}/api/checkout`, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      restaurantId,
      mode: "trial",
      customerEmail: email,
      customerName: name,
    }),
  });
  return r.json();
}

export async function completeRistowordAfterPayment(sessionId) {
  const r = await fetch(`${API}/api/checkout/mock/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId, outcome: "paid" }),
  });
  return r.json();
}
```

Configurate **`CORS_ALLOWED_ORIGINS`** sul backend con l’origine del dev server GS (es. `http://localhost:5173`).

---

## 5) Script verifica locale (Ristoword)

Con server avviato (`npm start` in `backend/`):

```bash
chmod +x scripts/verify-gs-ristoword-flow.sh
RISTOWORD_URL=http://localhost:3000 ./scripts/verify-gs-ristoword-flow.sh
```

Esegue checkout → mock complete → validate.

---

## 6) Cliente finale (Ristoword UI)

1. `/owner-activate` (o `ownerActivateUrl`)
2. `POST /api/licenses/complete-activation` (già usato dalla pagina)
3. Redirect onboarding owner (`/dev-access/dashboard` nel setup attuale)

---

## File codice rilevanti

- `backend/src/middleware/corsOptional.middleware.js` — CORS per GS
- `backend/src/stripe/checkout.service.js` — sessione + post-pagamento
- `backend/src/stripe/stripeLicenseSync.service.js` — codice, scadenza, email, mirror tenant
- `backend/src/controllers/checkout.controller.js` — JSON HTTP
- `backend/src/controllers/license.controller.js` — `validateCodeQuery`, verify, complete
- `backend/scripts/verify-gs-ristoword-flow.sh` — smoke test

---

*Aggiorna questo file se cambiate endpoint o durata trial.*
