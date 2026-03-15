# Ristoword AI/OpenAI Integration – Deliverables

## 1. Created/Modified Files

| File | Action |
|------|--------|
| `backend/package.json` | Modified – added `openai` dependency |
| `backend/src/ai/output.schema.json` | **Created** – JSON schema for AI response |
| `backend/src/ai/output.example.json` | **Created** – example response for dev/testing |
| `backend/src/service/ai-context.service.js` | **Created** – real context from repositories |
| `backend/src/service/ai-openai.service.js` | **Created** – OpenAI backend integration |
| `backend/src/controllers/ai.controller.js` | Modified – added `postQuery` handler |
| `backend/src/routes/ai.routes.js` | Modified – added `POST /query` route |
| `backend/.env.example` | Modified – added `OPENAI_API_KEY`, `OPENAI_MODEL` |
| `backend/public/dashboard/dashboard.js` | Modified – `askAI` uses `POST /api/ai/query`, renders structured JSON |

## 2. Backend Route Used by Frontend

```
POST /api/ai/query
```

- **Auth**: Required (same as other AI routes)
- **Content-Type**: `application/json`

## 3. Required Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes (for AI) | OpenAI API key (e.g. `sk-...`) |
| `OPENAI_MODEL` | No | Model name, default: `gpt-4o-mini` |

Add to `.env`:

```
OPENAI_API_KEY=sk-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

## 4. JSON Schema for AI Response

Location: `backend/src/ai/output.schema.json`

```json
{
  "ok": boolean,
  "answer": "string",
  "intent": "sales_summary | low_stock | recipe_cost | active_orders | transfer_advice | generic",
  "confidence": "high | medium | low",
  "data": {
    "summary": "string",
    "items": [],
    "totals": {},
    "warnings": []
  },
  "sources": [],
  "nextActions": []
}
```

## 5. Example Request Payload

```json
{
  "question": "What products are low in kitchen stock?"
}
```

## 6. Example Response Payload

```json
{
  "ok": true,
  "answer": "Prodotti sotto soglia: farina (2), olio (1). Valuta riordino.",
  "intent": "low_stock",
  "confidence": "high",
  "data": {
    "summary": "2 prodotti sotto soglia in magazzino centrale",
    "items": [
      { "name": "farina", "quantity": 2, "threshold": 5 },
      { "name": "olio", "quantity": 1, "threshold": 3 }
    ],
    "totals": { "lowStockCount": 2 },
    "warnings": ["farina sotto soglia", "olio sotto soglia"]
  },
  "sources": ["inventory"],
  "nextActions": ["Riordina farina e olio"]
}
```

## 7. Architecture

```
Frontend (dashboard askAI)
    │
    ▼
POST /api/ai/query  { question: "..." }
    │
    ▼
ai.controller.postQuery
    │
    ▼
ai-openai.service.queryWithOpenAI(question)
    │
    ├─► ai-context.service.buildContextForQuery()
    │       │
    │       ├─► ordersRepository.getAllOrders()
    │       ├─► paymentsRepository.listPayments()
    │       ├─► inventoryRepository.getAll()
    │       ├─► recipesRepository.getAll()
    │       ├─► reportsRepository.getDailyData()
    │       ├─► orderFoodCostsRepository.readAll()
    │       └─► bookingsRepository.getAll()
    │
    ▼
OpenAI API (backend only, API key in env)
    │
    ▼
Parse + validate JSON response
    │
    ▼
Return structured JSON to frontend
```

## 8. Previous AI: Fake or Real?

**Previous AI was rule-based only (no OpenAI):**

- Regex-based intent detection
- Template-based suggestions built from real data
- Used real repositories: orders, inventory, payments, recipes, reports, order-food-costs, bookings
- **No OpenAI SDK, no API key, no external AI calls**

**Current state:**

- **Rule-based endpoints** (GET `/api/ai`, POST `/api/ai/kitchen`, `/sales`, `/production`, `/inventory`) remain unchanged
- **New OpenAI endpoint** `POST /api/ai/query` uses real OpenAI with real Ristoword context

## 9. Output Files

| File | Purpose |
|------|---------|
| `backend/src/ai/output.schema.json` | JSON schema for response validation |
| `backend/src/ai/output.example.json` | Example for dev/testing |
| `backend/data/ai-last-output.json` | Optional debug – last parsed AI response (written on each successful/fallback call) |

## 10. Debug: ai-last-output.json

- Written to `backend/data/ai-last-output.json` after each AI query
- Contains the last parsed response + `_writtenAt` timestamp
- Safe to ignore in production; useful for local debugging
- Directory is created if missing

## Security Checklist

- [x] OpenAI called only from backend
- [x] API key via `OPENAI_API_KEY` env only
- [x] No API key in frontend or public code
- [x] Frontend calls only backend `POST /api/ai/query`

## Intents Supported

| Intent | Description |
|--------|-------------|
| `active_orders` | Ordini aperti, in attesa, pronti |
| `low_stock` | Prodotti sotto soglia, scorte centrali/reparti |
| `recipe_cost` | Costi ricette, food cost |
| `sales_summary` | Vendite, incassi, top piatti, coperti |
| `transfer_advice` | Trasferimenti magazzino centrale → reparti |
| `generic` | Domanda generale o non classificabile |
