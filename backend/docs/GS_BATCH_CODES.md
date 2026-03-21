# Codici trial batch — GS (master) ↔ Ristoword (cache)

Soluzione **tampone pulita**: un solo stato logico autoritativo su **Gestione Semplificata**; Ristoword tiene solo **replica/cache** (`data/gs-codes-mirror.json`) e **notifica GS** all’attivazione.

---

## 1. Struttura dati codici batch (su GS)

File consigliato su GS: `licenses.json` (o path equivalente), **array** di oggetti:

```json
{
  "codes": [
    {
      "code": "TRIAL-GS-2026-XXXXXXXX",
      "status": "available",
      "assignedEmail": null,
      "activatedAt": null,
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "source": "GS-batch"
    }
  ]
}
```

| Campo | Significato |
|--------|-------------|
| `code` | Codice univoco (stringa) |
| `status` | `available` \| `assigned` \| `used` \| `expired` |
| `assignedEmail` | Email se assegnato (opzionale) |
| `activatedAt` | ISO quando attivato su RW/GS |
| `expiresAt` | ISO scadenza trial |
| `source` | Fisso `"GS-batch"` per batch |

**Regole**

- GS aggiorna `status` quando: generi batch (`available`), assegni (`assigned`), ricevi notify da RW (`used`), scadenza (`expired`).
- **Validate** pubblico: `POST /api/licenses/validate` con `{ code }` — deve rispondere `valid: true` solo se il codice è usabile secondo le regole GS.

---

## 2. Cosa implementare su GS (repo separato)

### 2.1 Utility admin — generazione 25 codici

- Funzione (solo admin) che genera 25 stringhe univoche (es. prefisso `TRIAL-GS-` + random).
- Inserisce in `licenses.json` con `status: "available"`, `source: "GS-batch"`, `expiresAt` coerente (es. +14 giorni da generazione).

### 2.2 Vista / endpoint admin (lettura)

Esempi minimi (da adattare al framework GS):

| Vista / route | Contenuto |
|---------------|-----------|
| Lista | Tutti i codici con filtri `status` |
| Riepilogo | Conteggi: disponibili, assegnati, usati, scaduti |
| Dettaglio | Per codice: email, `activatedAt`, se mai attivato |

Query tipiche:

- Disponibili: `status === "available"`
- Assegnati: `status === "assigned"` o `assignedEmail != null`
- Usati: `status === "used"` o `activatedAt != null`
- **Chi si è attivato**: `status === "used"` **oppure** `activatedAt` valorizzato dopo notify da RW
- **Chi no**: `available` o `assigned` senza attivazione

### 2.3 Endpoint per ricevere notifica da Ristoword (obbligatorio per allineamento)

Quando un utente completa l’attivazione su RW, il backend RW chiama (se configurato):

- **URL** (esempio): `https://www.gestionesemplificata.com/api/licenses/rw/activation-used`  
  (path reale = quello che imposti in `GS_WEBHOOK_ACTIVATION_URL` su RW)

**Headers**

- `Content-Type: application/json`
- `X-RW-Sync-Secret: <stesso valore di GS_RW_SHARED_SECRET su RW>`

**Body JSON**

```json
{
  "code": "TRIAL-GS-...",
  "email": "owner@email.it",
  "activatedAt": "2026-03-21T12:00:00.000Z",
  "expiresAt": null,
  "source": "ristoword"
}
```

**Azione GS**: aggiornare il record del codice: `status: "used"`, `activatedAt`, eventualmente `assignedEmail`, e persistere. Così **la dashboard GS** riflette “chi ha attivato”.

---

## 2.5 Ristoword → GS (push batch + riserva Stripe)

Per provare **pagamento → codice dal pool (scala dai 25)** e **Genera codici** che aggiornano **anche** GS, implementare su GS due endpoint (o uno unificato) e impostare le env su Ristoword:

| Env RW | Quando | Body tipico |
|--------|--------|-------------|
| `GS_CODES_UPSERT_URL` | Dopo **Genera 1/25** in Super Admin Console | `{ "source":"ristoword", "codes":[{ "code","status","assignedEmail","expiresAt","source" }, ...] }` header `X-RW-Sync-Secret` |
| `GS_CODES_RESERVE_URL` | Dopo **Stripe pagato** (codice preso dal mirror e marcato `assigned`) | `{ "code","assignedEmail","expiresAt","status":"assigned","source":"ristoword-stripe","reservedAt" }` |

Segreto: stesso `GS_RW_SHARED_SECRET` o `GS_RW_SYNC_SECRET` usato per import e webhook.

**Stripe (mock o reale)**: `syncLicenseFromPaidSession` usa `claimAvailableForStripe`: primo codice `available` → `assigned` + email; se il pool è vuoto, genera un codice RW come prima (fallback).

**Validate**: resta `POST` verso GS (`GS_VALIDATE_URL`). Per test **solo locale** senza GS: `GS_VALIDATE_USE_MIRROR=true` — accetta codici presenti nel mirror (`assigned` richiede stessa email).

---

## 3. Ristoword — sync GS → RW (import mirror)

**Non** sostituisce la validazione live su GS (`POST validate` resta il gate).

### Endpoint

`POST /api/owner/gs-import-codes`

**Header**: `X-GS-Sync-Secret: <GS_RW_SYNC_SECRET>` (stesso segreto concordato; minimo 8 caratteri)

**Body**

```json
{
  "codes": [
    {
      "code": "TRIAL-GS-001",
      "status": "available",
      "assignedEmail": null,
      "activatedAt": null,
      "expiresAt": "2026-12-31T23:59:59.000Z",
      "source": "GS-batch"
    }
  ]
}
```

**Risposta**: `{ ok: true, imported: N, totalInMirror, stats }`

**File locale**: `backend/data/gs-codes-mirror.json` — **solo cache**; lo stato giuridico resta su GS.

### Statistiche mirror (diagnostica)

`GET /api/owner/gs-mirror-stats` con stesso header segreto.

---

## 4. Ristoword — dopo attivazione owner

1. Flusso esistente: validate GS → `complete-activation` → utente + `licenses.json` (tenant) come oggi.
2. **Nuovo**: aggiorna mirror locale (`markUsedLocal`) e chiama **notify** verso GS (`GS_WEBHOOK_ACTIVATION_URL`).

Variabili `.env` su RW:

```env
# Segreto condiviso: import batch + verifica lato GS sul webhook
GS_RW_SYNC_SECRET=genera-stringa-lunga-casuale

# URL su GS che riceve "codice usato" da Ristoword (implementare lato GS)
GS_WEBHOOK_ACTIVATION_URL=https://www.gestionesemplificata.com/api/licenses/rw/activation-used

# Stesso valore come header X-RW-Sync-Secret lato GS per accettare solo RW
GS_RW_SHARED_SECRET=stesso-valore-di-GS_RW_SYNC_SECRET
```

Se `GS_WEBHOOK_ACTIVATION_URL` è vuota, RW salta la notify (log: skipped) senza rompere il flusso.

---

## 5. File modificati / aggiunti (Ristoword)

| File | Ruolo |
|------|--------|
| `src/repositories/gsCodesMirror.repository.js` | Persistenza mirror `data/gs-codes-mirror.json` |
| `src/service/gsMasterSync.service.js` | POST notify, push batch, riserva Stripe |
| `src/stripe/stripeLicenseSync.service.js` | Prelievo codice dal pool dopo pagamento |
| `src/controllers/gsSync.controller.js` | Import + stats (segreto) |
| `src/routes/owner.routes.js` | Route `gs-import-codes`, `gs-mirror-stats` |
| `src/controllers/owner.controller.js` | Mirror `used` + notify dopo attivazione |
| `docs/GS_BATCH_CODES.md` | Questa specifica |
| `.env.example` | Variabili documentate |

---

## 6. Test manuale (max 8 punti)

1. Su GS: generare 25 codici batch e salvare in `licenses.json` (`available`, `source: "GS-batch"`).
2. Esportare JSON array `codes` e chiamare `POST {RW}/api/owner/gs-import-codes` con header `X-GS-Sync-Secret` e body `{ "codes": [ ... ] }` → atteso `ok: true`.
3. `GET {RW}/api/owner/gs-mirror-stats` con stesso segreto → conteggi coerenti.
4. Aprire `/owner-activate` su RW, inserire un codice valido su GS → step 2 email/password.
5. Completare attivazione → login OK e redirect dashboard.
6. Verificare `backend/data/gs-codes-mirror.json`: codice con `status: "used"`.
7. Su GS: endpoint webhook riceve POST con `code`/`email`/`activatedAt` e aggiorna record → in admin GS il codice risulta **usato** / attivato.
8. (Opzionale) Se `GS_WEBHOOK_ACTIVATION_URL` è vuota: attivazione RW comunque OK; mirror locale aggiornato; log `skipped` sulla notify.

---

*GS resta master; RW = validate live + cache import + notifica uso.*
