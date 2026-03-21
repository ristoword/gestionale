# Ristoword — riprendere da qui

*Ultimo aggiornamento: contesto “memorizzato” per sessioni future.*

## Flusso attivazione owner (stato attuale)

1. **Frontend** `/owner-activate`:  
   - `POST https://www.gestionesemplificata.com/api/licenses/validate` con `{ code }`  
   - Se valido (`data.valid` o `data.data.valid`): step 2 email/password  
   - `POST /api/owner/complete-activation` same-origin con `{ code, email, password }` + `credentials: "same-origin"`

2. **Backend**  
   - `app.use("/api/owner", ownerRoutes)` in `app.js`  
   - `POST /api/owner/complete-activation` in `src/routes/owner.routes.js` → `src/controllers/owner.controller.js`  
   - Rivalida il codice con GS (POST server-side), crea/aggiorna utente in `users.json`, licenza in `licenses.json` se serve, sessione owner, risposta `{ success: true, redirectTo: "/dev-access/dashboard" }`

3. **Rimosso / non usato per la UI licenza**  
   - Mount `/api/licenses` rimosso da `app.js` (controller ancora nel repo ma non esposto)  
   - `requireLicense` middleware = solo `next()` (nessuna lettura `license.json` per bloccare)

4. **Documentazione integrazione GS**  
   - `docs/INTEGRATION_GS_TRIAL.md` (checkout Stripe, CORS, ecc.)  
   - `.cursor/rules/gs-trial-ristoword.mdc`

## Batch codici trial (GS master ↔ RW mirror)

- Doc: **`docs/GS_BATCH_CODES.md`**
- Mirror locale: `data/gs-codes-mirror.json`
- Import: `POST /api/owner/gs-import-codes` + header `X-GS-Sync-Secret` (`GS_RW_SYNC_SECRET`)
- Stats: `GET /api/owner/gs-mirror-stats`
- Dopo attivazione: notify GS (`GS_WEBHOOK_ACTIVATION_URL` + `X-RW-Sync-Secret` / `GS_RW_SHARED_SECRET`)

## Attenzioni per domani

- **CORS**: il browser su Ristoword che chiama GS deve avere **CORS abilitato su Gestione Semplificata** per l’origine del sito RW.  
- **Node**: `owner.controller` usa `fetch` verso GS (Node 18+).  
- **Stripe**: non toccato dal flusso owner-activate GS.

## File chiave

| Area | File |
|------|------|
| Owner UI | `public/owner-activate/owner-activate.html`, `owner-activate.js` |
| API owner | `src/routes/owner.routes.js`, `src/controllers/owner.controller.js` |
| App | `src/app.js` (mount `/api/owner`) |
| Skip middleware | `requireSetup.middleware.js`, `requireOwnerSetup.middleware.js` (`/api/owner`) |
| Utenti | `src/repositories/users.repository.js` (campo `email` opzionale in create) |

---

*Domani: apri questo file o chiedi “riprendi da SESSION_HANDOFF”.*
