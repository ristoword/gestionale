# Ristoword – Dish / Recipe / Menu / Food Cost / Inventory Economics

## Summary

Implementation refines and connects **existing** modules only. No duplicate parallel systems were created.

**Chain:** dish ↔ recipe ↔ menu ↔ sale → inventory deduction → food cost → dashboard analytics

---

## 1. Files Modified / Created

### Backend – Repositories
- `backend/src/repositories/recipes.repository.js` – linkedDishId, iva/overhead/packaging/labor, unit aliases (gr, lt, pz), getByDishId, getFoodCost extended with wastage and full production cost
- `backend/src/repositories/menu.repository.js` – recipeId, sellingPrice, createdAt, updatedAt, getByRecipeId
- `backend/src/repositories/daily-menu.repository.js` – recipeId on dishes
- `backend/src/repositories/inventory.repository.js` – getTotalValue()

### Backend – Services
- `backend/src/service/menu.service.js` – update() syncs recipe.linkedDishId; createDishFromRecipe()
- `backend/src/service/inventory.service.js` – resolve recipe by item.recipeId when present, else by name
- `backend/src/service/reports.service.js` – getTopDishes(), getDishMargins(), getFoodCostAlerts()

### Backend – Controllers / Routes
- `backend/src/controllers/menu.controller.js` – update async, createFromRecipe
- `backend/src/controllers/inventory.controller.js` – getInventoryValue
- `backend/src/controllers/reports.controller.js` – getTopDishes, getDishMargins, getFoodCostAlerts
- `backend/src/routes/menu.routes.js` – POST /from-recipe
- `backend/src/routes/inventory.routes.js` – GET /value
- `backend/src/routes/reports.routes.js` – GET /top-dishes, /dish-margins, /foodcost-alerts

### Frontend – Cucina
- `backend/public/cucina/cucina.html` – Chip “Valore Magazzino”, nav “Food Cost”
- `backend/public/cucina/cucina.js` – renderKpi() fetches GET /api/inventory/value and shows it
- `backend/public/cucina/food-cost.html` – **new** Food Cost page
- `backend/public/cucina/food-cost.css` – **new** styles
- `backend/public/cucina/food-cost.js` – **new** logic (recipes, ingredient grid, summary, save)

---

## 2. Dish ↔ Recipe Linking

- **Dish (menu item):** `id`, `name`, `category`, `price`, `sellingPrice`, `recipeId`, `createdAt`, `updatedAt`.  
  Stored in `menu.repository` (menu fisso) and in `daily-menu.repository` (menu del giorno) with optional `recipeId`.
- **Recipe:** `id`, `name`, `description`, `yieldPortions`, `ingredients[]`, `linkedDishId`, `createdAt`, `updatedAt`, plus cost fields below.
- **Attach recipe to dish:** `PATCH /api/menu/:id` with `{ recipeId: "uuid" }`. Backend sets `recipe.linkedDishId = dish.id`.
- **Create dish from recipe:** `POST /api/menu/from-recipe` with `{ recipeId: "uuid" }`. Creates menu item (name, price from recipe), sets `recipeId` and `recipe.linkedDishId`.
- **Resolve recipe on sale:** Order item can have `recipeId`; else recipe is resolved by `item.name` (findRecipeByMenuItemName).  
  Used in `inventory.service` for deduction and food cost.

---

## 3. Food Cost Formula (Backend)

- **Per ingredient:**  
  `lineTotal = quantity × unitCost`  
  `costAfterWastage = lineTotal × (1 + wastagePercent/100)`  
  `rawIngredientCost = sum(costAfterWastage)`
- **Production:**  
  `ivaAmount = rawIngredientCost × (ivaPercent/100)`  
  `overheadAmount = rawIngredientCost × (overheadPercent/100)`  
  `finalProductionCost = rawIngredientCost + ivaAmount + overheadAmount + packagingCost + laborCost`
- **Portion and margin:**  
  `costPerPortion = finalProductionCost / yieldPortions`  
  `foodCostPercent = (costPerPortion / sellingPrice) × 100`  
  `grossMargin = sellingPrice - costPerPortion`  
  `suggestedPrice = costPerPortion / (targetFoodCost/100)`

Units supported: g, gr, kg, ml, cl, l, lt, pcs, pz (normalized in backend).

---

## 4. Inventory Impact on Dish Sale

- When order reaches **servito** or **chiuso**, `inventory.service.onOrderFinalized()`:
  1. Resolves recipe per item (by `item.recipeId` or by `item.name`).
  2. If no recipe: warning, no deduction.
  3. Otherwise: `ingredient deduction = recipe quantity × number of dishes sold` from the recipe’s department (e.g. cucina) via `deductFromDepartment`.
  4. Records stock movements and updates `order-food-costs` (cost of goods sold, estimated revenue/margin).

Existing logic kept; only added resolution by `recipeId` when present.

---

## 5. Inventory Value

- **Endpoint:** `GET /api/inventory/value`
- **Response:** `{ value: number, formatted: "€ 12.430,50" }`
- **Calculation:** `sum(product.central × getCostPerUnit(product))` over all inventory items.

Cucina header shows this in the first chip: **Valore Magazzino** (replacing the previous “In preparazione” chip; “In preparazione” remains as second chip).

---

## 6. Sales Economics

- **Stored:** Per order in `order-food-costs` (totalFoodCost, estimatedRevenue, estimatedMargin).
- **Computed for reports:** Per-dish revenue, COGS, margin, food cost % from orders + recipes + inventory in:
  - `GET /api/reports/dish-margins?date=`
  - `GET /api/reports/top-dishes?date=&limit=`
  - `GET /api/reports/foodcost-alerts?threshold=`

---

## 7. Dashboard / AI Analytics

- **GET /api/reports/top-dishes** – Piatti più venduti (qty, revenue) per data.
- **GET /api/reports/dish-margins** – Per piatto: revenue, costOfGoodsSold, grossMargin, foodCostPercent; summary con totalRevenue, totalCogs, averageMarginPercent.
- **GET /api/reports/foodcost-alerts** – Ricette con food cost % sopra soglia o sopra target.

Data from real orders, recipes, inventory, and order-food-costs. No duplicate modules.

---

## 8. Food Cost Page (Cucina)

- **Entry:** Cucina → **Food Cost** (nav button).
- **Page:** Select recipe → ingredient grid (ingredientName, quantity, unit, unitCost, totalCost, wastagePercent, notes), live totals, summary cards (Costo ingredienti, Costo produzione, Costo porzione, Prezzo vendita, Food cost %, Margine lordo, Prezzo consigliato). Save via `PATCH /api/recipes/:id`.
- **Style:** Same as existing Cucina (cucina.css + food-cost.css).

---

## 9. Compatibility

- **Not broken:** Sala order flow, kitchen board, menu system, inventory, payments, AI, supervisor dashboard, existing routes, Railway deployment, auth/session.
- **No duplicate modules:** Only existing repositories, services, and routes were extended; new frontend is one Food Cost page and one new report route group.

---

## 10. Confirmation

- **Dish–recipe linking:** Implemented (recipeId on dish, linkedDishId on recipe, PATCH menu, POST /menu/from-recipe, resolution in inventory.service).
- **Food cost formula:** Implemented in `recipes.repository.getFoodCost()` and in Food Cost page.
- **Inventory deduction rule:** Unchanged; recipe resolution extended with recipeId.
- **Dashboard metrics:** top-dishes, dish-margins, foodcost-alerts added.
- **No duplicate modules:** Confirmed; only refinements and connections to existing code.
