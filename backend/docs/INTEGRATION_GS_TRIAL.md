# Integrazione Gestione Semplificata (GS) → Ristoword (trial / Stripe)

Documento di riferimento per completare il lato **GS**: cosa fa già il backend Ristoword e cosa deve fare il gestionale.

## Principio

- **Il codice di attivazione lo genera Ristoword** al momento in cui il pagamento risulta confermato (webhook / flusso mock).
- GS **non** deve inventare il codice: chiama le API Ristoword, poi mostra al cliente **codice + link** (e/o si affida all’email inviata da Ristoword se SMTP è configurato).

## Variabili ambiente su Ristoword (`.env` in `backend/`)

| Variabile | Ruolo |
|-----------|--------|
| `APP_URL` | URL pubblico senza slash finale (es. `https://app.tuodominio.it`) — link assoluti nelle email |
| `SMTP_*` | Se impostate, Ristoword invia email con codice + link a `/owner-activate` |
| `SUPER_ADMIN_*` | Solo dashboard manutentore, non per i clienti trial |

Dettagli anche in `backend/.env.example`.

---

## 1) Avvio checkout (dopo registrazione utente su GS)

**`POST {APP_URL}/api/checkout`**  
`Content-Type: application/json`

Body consigliato:

```json
{
  "restaurantId": "ID_TENANT_UNIVOCO_GS",
  "mode": "trial",
  "plan": "ristoword_pro",
  "customerEmail": "cliente@email.it",
  "customerName": "Mario Rossi"
}
```

- **`restaurantId`** (alias accettato: `tenantId`): stesso identificativo che userete per quel locale in tutto il flusso; deve essere **stabile** (non cambiare tra trial e abbonamento).
- **`mode`**: `"trial"` → scadenza licenza 14 giorni; `"subscription"` → 30 giorni (default progetto).
- **`customerEmail`**: accettati anche `email` o `adminEmail` — **importante** per l’email automatica da Ristoword.
- **`customerName`** (opzionale): usato nell’email.

**Risposta (esempio):**

```json
{
  "ok": true,
  "sessionId": "cs_...",
  "status": "created",
  "restaurantId": "ID_TENANT_UNIVOCO_GS",
  "mode": "trial",
  "customerEmail": "cliente@email.it"
}
```

GS deve **salvare `sessionId`** per lo step successivo (o passarlo alla pagina di ritorno da Stripe).

---

## 2) Dopo pagamento Stripe (confermato)

Oggi nel repo il checkout è integrato come **mock** lato Ristoword (stesso contratto API utile finché non agganciate Stripe reale sullo stesso endpoint webhook interno).

**`POST {APP_URL}/api/checkout/mock/complete`**  
`Content-Type: application/json`

```json
{
  "sessionId": "cs_...",
  "outcome": "paid"
}
```

- Con **`outcome": "paid"`** il backend:
  - elabora subito l’evento (come un webhook),
  - crea/aggiorna la licenza in `licenses.json` con **`activationCode`** e **`expiresAt`**,
  - aggiorna `data/tenants/{restaurantId}/license.json`,
  - se SMTP ok → invia email al `customerEmail` della sessione con codice + link.

**Risposta (campi utili per GS):**

| Campo | Uso su GS |
|-------|-----------|
| `activationCode` | Mostrare in pagina “Pagamento riuscito” (sempre presente se OK) |
| `ownerActivateUrl` | Link diretto (già con `code` e `email` in query dove possibile) |
| `emailSent` | `true` se l’email è partita |
| `emailError` | Se non partita (es. SMTP non configurato): **obbligatorio** mostrare codice + link in pagina |
| `nextStep` | Testo guida per UX |

Quando passerete a **Stripe reale**, dovrete chiamare (o far chiamare a Stripe) l’equivalente elaborazione webhook che oggi è attaccata allo stesso `syncLicenseFromPaidSession` — il contratto verso GS resta: **codice + URL in risposta o via email**.

---

## 3) Lato cliente Ristoword (dopo GS)

1. Cliente apre **`/owner-activate`** (o `ownerActivateUrl` restituito dall’API).
2. Inserisce **codice**, poi **email + password** (flusso già in UI).
3. Redirect a onboarding owner (`/dev-access/dashboard` nel setup attuale): personale, permessi, licenza, ecc.

---

## Checklist GS

- [ ] Chiamare `POST /api/checkout` con `restaurantId` stabile + `customerEmail` + `mode: "trial"`.
- [ ] Dopo successo Stripe, chiamare `POST /api/checkout/mock/complete` con `sessionId` e `outcome: "paid"` **oppure**, in produzione, fare in modo che il webhook Stripe su Ristoword esegua la stessa logica senza questo endpoint mock.
- [ ] Pagina successo: mostrare **`activationCode`** e bottone/link a **`ownerActivateUrl`**; se `emailSent === false`, non dire “controlla la posta” senza alternative.
- [ ] Opzionale: redirect browser a `ownerActivateUrl` automaticamente.

---

## File codice rilevanti (Ristoword)

- `backend/src/stripe/checkout.service.js` — avvio sessione, completamento + webhook automatico
- `backend/src/stripe/stripeLicenseSync.service.js` — generazione codice, scadenze, mirror tenant, trigger email
- `backend/src/controllers/checkout.controller.js` — body/risposta HTTP
- `backend/src/service/mail.service.js` — `sendRistowordActivationEmail`, `buildOwnerActivateLink`
- `backend/public/owner-activate/` — UI attivazione owner

---

*Ultimo aggiornamento: integrazione trial GS documentata per passare allo sviluppo lato Gestione Semplificata.*
