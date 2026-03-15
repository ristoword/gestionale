# Catering Menu Builder + Preset Event Menus + PDF/Print – Deliverables

## 1. Created and Modified Files

### Backend – Created
- `backend/src/repositories/catering-presets.repository.js` – Preset menus CRUD, validation, normalization

### Backend – Modified
- `backend/src/repositories/catering.repository.js` – Full event structure, migration from legacy, `createFromPreset`, safeFileIO
- `backend/src/controllers/catering.controller.js` – Presets, events, from-preset, print HTML
- `backend/src/routes/catering.routes.js` – Preset and event routes, print route
- `backend/src/service/onboarding.service.js` – Added `catering-presets.json` to TENANT_FILES
- `backend/src/utils/tenantMigration.js` – Added `catering-presets.json`
- `backend/src/controllers/setup.controller.js` – Added `catering-presets.json` to tenant setup

### Frontend – Modified
- `backend/public/catering/catering.html` – Nav, Presets, Event Builder, Events list, Calcolatore
- `backend/public/catering/catering.js` – Preset CRUD, Event builder, sections/items (detailed & priced), print/PDF
- `backend/public/catering/catering.css` – Styles aligned with Ristoword (cucina/magazzino)

### Data Files (tenant-specific)
- `backend/data/tenants/{tenantId}/catering-presets.json` – Preset menus
- `backend/data/tenants/{tenantId}/catering-events.json` – Catering events (extended structure)

---

## 2. UI Areas Added in Catering

### Tab: Preset menu
- **Form** (left): Nome, Descrizione, Prezzo default/persona, Note, Sezioni con voci
- **List** (right): Elenco preset con Usa, Modifica, Duplica, Elimina
- **Sezioni**: Nome, Tipo (buffet/antipasti/primo/secondo/dessert/bevande/custom)
- **Voci per sezione**: Nome, Modalità (Grammature | Prezzo), Qty+unità o €/pax o € fisso, Note
- Supporto per molte voci per sezione (senza limite artificiale)

### Tab: Event builder
- **Dati**: Titolo, Cliente, Data, Ospiti, Prezzo/persona, Note
- **Azioni**: Nuovo evento vuoto | Usa preset → Crea da preset
- **Sezioni e piatti**: Stessa logica dei preset (add/remove section, add/remove item)
- **Bottoni**: Salva evento, Stampa, Esporta PDF

### Tab: Eventi
- Lista eventi salvati con Modifica, Stampa, PDF, Elimina

### Tab: Calcolatore
- Calcolatore legacy (3/4/5 portate, Degustazione) invariato

---

## 3. Example Preset Menu Payload

```json
{
  "name": "Matrimonio Silver",
  "description": "Menu completo matrimonio – fascia media",
  "defaultPricePerPerson": 55,
  "notes": "Upgrade vini +10€/pax",
  "sections": [
    {
      "name": "Buffet Aperitivo",
      "type": "buffet",
      "items": [
        { "name": "Tartine miste", "mode": "priced", "pricePerPerson": 3.5, "notes": "" },
        { "name": "Bruschette", "mode": "detailed", "quantityPerPerson": 80, "unit": "g", "notes": "pane + condimenti" }
      ]
    },
    {
      "name": "Antipasti",
      "type": "antipasti",
      "items": [
        { "name": "Antipasto misto mare", "mode": "priced", "pricePerPerson": 12, "notes": "" }
      ]
    },
    {
      "name": "Primo",
      "type": "primo",
      "items": [
        { "name": "Risotto ai frutti di mare", "mode": "detailed", "quantityPerPerson": 120, "unit": "g", "notes": "" }
      ]
    }
  ]
}
```

---

## 4. Example Catering Event Payload

```json
{
  "id": "evt_xxx",
  "restaurantId": "default",
  "title": "Catering Bianchi",
  "eventName": "Catering Bianchi",
  "clientName": "Famiglia Bianchi",
  "eventDate": "2026-06-15",
  "guestCount": 80,
  "menuType": "preset",
  "presetMenuId": "preset_yyy",
  "sections": [
    {
      "id": "sec_1",
      "name": "Buffet Aperitivo",
      "type": "buffet",
      "items": [
        { "id": "it_1", "name": "Tartine miste", "mode": "priced", "pricePerPerson": 3.5, "notes": "" }
      ]
    }
  ],
  "notes": "Senza glutine per 3 ospiti",
  "pricePerPerson": 55,
  "totalEstimatedPrice": 4400,
  "status": "draft",
  "createdAt": "2026-03-11T10:00:00.000Z",
  "updatedAt": "2026-03-11T10:00:00.000Z"
}
```

---

## 5. Preset vs Event: Business Rule

**Preset menu** = Template riutilizzabile. Non viene mai modificato quando si crea un evento.

**Evento cliente** = Copia modificabile derivata da un preset (o creata da zero). È l’oggetto sul quale si lavora per la proposta al cliente.

Regola:
- **Usa preset** → viene creata una **nuova copia** dell’evento con sezioni e voci replicate
- Modifiche (aggiunta/rimozione/sostituzione piatti, grammature, prezzi, note) si applicano **solo all’evento**, mai al preset
- Stampa ed export PDF usano sempre i dati dell’**evento** salvato, non del preset originale

---

## 6. Print / PDF

### Stampa
- Bottone **Stampa** apre una nuova finestra con la URL `/api/catering/events/:id/print`
- La risposta è HTML formattato per stampa (header, sezioni, piatti, totali, note)
- Nella finestra: pulsante **Stampa / Salva come PDF** che chiama `window.print()`
- L’utente può scegliere “Salva come PDF” dalla finestra di stampa del browser

### Esporta PDF
- Bottone **Esporta PDF** apre la stessa finestra di stampa
- L’utente usa “Salva come PDF” come destinazione di stampa

Nessuna libreria server-side: tutto avviene tramite stampa del browser, senza dipendenze aggiuntive (es. Puppeteer).

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/catering/presets | Lista preset |
| GET | /api/catering/presets/:id | Dettaglio preset |
| POST | /api/catering/presets | Crea preset |
| PATCH | /api/catering/presets/:id | Aggiorna preset |
| DELETE | /api/catering/presets/:id | Elimina preset |
| GET | /api/catering/events | Lista eventi |
| GET | /api/catering/events/:id | Dettaglio evento |
| GET | /api/catering/events/:id/print | HTML stampabile |
| POST | /api/catering/events | Crea evento |
| POST | /api/catering/events/from-preset/:presetId | Crea evento da preset |
| PATCH | /api/catering/events/:id | Aggiorna evento |
| DELETE | /api/catering/events/:id | Elimina evento |

**Compatibilità**: GET/POST/PATCH/DELETE su `/api/catering` e `/api/catering/:id` restano disponibili per la logica legacy.
