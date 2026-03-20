# Integrazione Gestione Semplificata (GS) ↔ Ristoword (Stripe trial / licenza)

Contratto unico tra **GS** (frontend/gestionale) e **Ristoword** (questo backend).  
**Il codice di attivazione lo genera solo Ristoword** dopo pagamento confermato (`syncLicenseFromPaidSession`).

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
