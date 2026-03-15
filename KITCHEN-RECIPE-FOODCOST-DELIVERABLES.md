# Kitchen Recipe + Food Cost + Department Warehouse Consumption – Deliverables

## 1. Created/Modified Files

### Backend – Created
- None (all features integrated into existing modules)

### Backend – Modified
- `backend/src/repositories/orders.repository.js` – added `getOrderById`
- `backend/src/repositories/inventory.repository.js` – already had `deductFromDepartment`, `getDepartmentStock`
- `backend/src/repositories/recipes.repository.js` – extended schema, validation, `getFoodCost`
- `backend/src/repositories/stock-movements.repository.js` – extended movement fields, added `restaurantId`
- `backend/src/service/inventory.service.js` – `validateOrderConsumption`, `validateRecipeConsumption`, kitchen consumption from `stocks.cucina`, validate-before-deduct
- `backend/src/service/orders.service.js` – added `getOrderById`
- `backend/src/controllers/orders.controller.js` – validate stock before servito/chiuso, return 400 if blocked
- `backend/src/controllers/recipes.controller.js` – `getRecipeFoodCost` endpoint
- `backend/src/routes/recipes.routes.js` – GET `/:id/food-cost`

### Frontend – Modified
- `backend/public/cucina/cucina.js` – Ricette: API-based, ingredient rows, food cost section, kitchen stock display
- `backend/public/cucina/cucina.html` – Ricette section structure
- `backend/public/magazzino/magazzino.html` – Transfer modal (central → cucina)
- `backend/public/magazzino/magazzino.js` – Transfer logic
- `backend/public/daily-menu/daily-menu.js` – Recipe link warning for dishes
- `backend/public/sala/sala.js` – Error handling for blocked status (400)
- `backend/public/bar/bar.js` – Error handling for blocked status (400)
- `backend/public/pizzeria/pizzeria.js` – Error handling for blocked status (400)
- `backend/public/cassa/cassa.js` – Error handling for blocked status (400)

### Data Files (tenant-specific)
- `backend/data/tenants/{tenantId}/recipes.json` – recipes
- `backend/data/tenants/{tenantId}/inventory.json` – `central` + `stocks.cucina`, etc.
- `backend/data/tenants/{tenantId}/stock-movements.json` – movements
- `backend/data/tenants/{tenantId}/inventory-transfers.json` – transfers

---

## 2. UI Areas Added/Updated

### Cucina
- **Ricette** (view-ricette)
  - Recipe list loaded from `/api/recipes`
  - Create/Edit recipe form: name, category, department, yield portions, selling price, target food cost, description, notes
  - Ingredient rows: add/remove, quantity, unit (g, kg, ml, cl, l, pcs), kitchen stock per ingredient
  - Food Cost section: recipe total cost, cost per portion, food cost %, suggested price (from `/api/recipes/:id/food-cost`)

### Magazzino
- **Transfer modal**
  - Product selection, quantity, unit
  - From: Magazzino Centrale (fixed)
  - To: Cucina / Sala / Bar / Proprietà
  - Operator, note
  - POST `/api/inventory/transfer`

### Menu del Giorno
- **Dish cards**
  - Warning when dish has no linked recipe: “Nessuna ricetta collegata, non verrà scaricato dal magazzino”
  - Linking by dish name ↔ recipe `menuItemName`

### Sala / Bar / Pizzeria / Cassa
- **Order status change**
  - When setting status to servito/chiuso, if kitchen stock is insufficient, API returns 400 with error message
  - UI shows the server error (e.g. “Mozzarella: richiesti 100, disponibili in cucina 50”)

---

## 3. Example Recipe Payload

```json
{
  "name": "Filetto Rossini",
  "menuItemName": "Filetto Rossini",
  "category": "Secondo",
  "department": "cucina",
  "description": "Filetto di manzo con foie gras e tartufo nero",
  "yieldPortions": 1,
  "sellingPrice": 42,
  "targetFoodCost": 30,
  "notes": "Usare foie gras fresco",
  "ingredients": [
    { "ingredientName": "filetto di manzo", "quantity": 180, "unit": "g" },
    { "ingredientName": "foie gras", "quantity": 30, "unit": "g" },
    { "ingredientName": "tartufo nero", "quantity": 10, "unit": "g" },
    { "ingredientName": "madeira", "quantity": 25, "unit": "cl" },
    { "ingredientName": "sale", "quantity": 15, "unit": "g" },
    { "ingredientName": "pepe nero", "quantity": 15, "unit": "g" }
  ]
}
```

---

## 4. Example Stock Transfer Payload

Current API: **POST /api/inventory/transfer**

```json
{
  "productId": "inv_001",
  "toDepartment": "cucina",
  "quantity": 2,
  "note": "Rifornimento giornaliero cucina",
  "operator": "Mario"
}
```

- `fromWarehouse` is implicit: **central**
- `toWarehouse` = `toDepartment` (cucina = kitchen)

---

## 5. Final Stock Rule

### Central vs Kitchen Warehouse

| Warehouse | Role | Used for |
|-----------|------|----------|
| **Central** | Main stock | New loads, corrections, source for transfers |
| **Kitchen (cucina)** | Operational stock | Kitchen consumption for recipes |

### Rules

1. **Transfer (central → kitchen)**
   - Central stock decreases
   - Kitchen stock increases
   - Stored in `inventory-transfers.json` and `stock-movements`

2. **Consumption (order servito/chiuso)**
   - Recipe ingredients are deducted from **kitchen** (`stocks.cucina`)
   - Never from central
   - Recorded as `recipe_consumption` in `stock-movements`

3. **Insufficient kitchen stock**
   - Order status change to servito/chiuso is blocked (HTTP 400)
   - Error message: e.g. `"Mozzarella: richiesti 100, disponibili in cucina 50"`
   - No silent fallback to central

4. **Workflow**
   - Transfer products from central to kitchen before service
   - When orders are closed/served, ingredients are consumed only from kitchen
   - If kitchen stock is not enough, transfer more from central, then retry closing

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/recipes | List all recipes |
| GET | /api/recipes/:id | Get recipe by ID |
| GET | /api/recipes/:id/food-cost | Get food cost for recipe |
| POST | /api/recipes | Create recipe |
| PATCH | /api/recipes/:id | Update recipe |
| DELETE | /api/recipes/:id | Delete recipe |
| POST | /api/inventory/transfer | Transfer central → department (e.g. cucina) |
| PATCH | /api/orders/:id/status | Set order status (validates kitchen stock for servito/chiuso) |
