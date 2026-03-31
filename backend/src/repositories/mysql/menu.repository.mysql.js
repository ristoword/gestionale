// backend/src/repositories/mysql/menu.repository.mysql.js — menu per tenant come JSON array (stesso schema di menu.json).

const { getPool } = require("../../db/mysql-pool");
const tenantContext = require("../../context/tenantContext");

function restaurantId() {
  const id = tenantContext.getRestaurantId();
  return id != null && String(id).trim() !== "" ? String(id).trim() : "default";
}

function normalizeRows(itemsJson) {
  if (itemsJson == null) return [];
  if (Array.isArray(itemsJson)) return itemsJson;
  if (typeof itemsJson === "string") {
    try {
      const p = JSON.parse(itemsJson);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function readArray() {
  const pool = getPool();
  const rid = restaurantId();
  const [rows] = await pool.query("SELECT items_json FROM tenant_menus WHERE restaurant_id = ? LIMIT 1", [rid]);
  if (!rows || !rows.length) return [];
  return normalizeRows(rows[0].items_json);
}

async function writeArray(menu) {
  const pool = getPool();
  const rid = restaurantId();
  const payload = Array.isArray(menu) ? menu : [];
  await pool.query(
    `INSERT INTO tenant_menus (restaurant_id, items_json, updated_at)
     VALUES (?, CAST(? AS JSON), NOW(3))
     ON DUPLICATE KEY UPDATE items_json = VALUES(items_json), updated_at = NOW(3)`,
    [rid, JSON.stringify(payload)]
  );
}

async function getAll() {
  return readArray();
}

async function getById(id) {
  const menu = await readArray();
  return menu.find((item) => item.id === Number(id));
}

async function getActive() {
  const menu = await readArray();
  return menu.filter((item) => item.active);
}

async function add(itemData) {
  const menu = await readArray();
  const ids = menu.map((m) => m.id || 0).filter((n) => Number.isFinite(n));
  const nextId = ids.length ? Math.max(...ids) + 1 : 1;
  const now = new Date().toISOString();

  const newItem = {
    id: nextId,
    name: itemData.name,
    category: itemData.category || "Generale",
    price: Number(itemData.price) || 0,
    sellingPrice: Number(itemData.sellingPrice ?? itemData.price) || 0,
    recipe: itemData.recipe || null,
    recipeId: itemData.recipeId || itemData.recipe_id || null,
    linkedRecipeId: itemData.linkedRecipeId || itemData.recipeId || itemData.recipe_id || null,
    active: itemData.active !== false,
    area: itemData.area || null,
    code: itemData.code || null,
    notes: itemData.notes || null,
    ingredients: Array.isArray(itemData.ingredients) ? itemData.ingredients : [],
    yield: itemData.yield ?? itemData.yieldPortions ?? itemData.yield_portions ?? null,
    ivaPercent: itemData.ivaPercent ?? itemData.iva_percent ?? null,
    overheadPercent: itemData.overheadPercent ?? itemData.overhead_percent ?? null,
    packagingCost: itemData.packagingCost ?? itemData.packaging_cost ?? null,
    laborCost: itemData.laborCost ?? itemData.labor_cost ?? null,
    energyCost: itemData.energyCost ?? itemData.energy_cost ?? null,
    extraCost: itemData.extraCost ?? itemData.extra_cost ?? null,
    foodCostTarget: itemData.foodCostTarget ?? itemData.targetFoodCost ?? itemData.target_food_cost ?? null,
    marginTarget: itemData.marginTarget ?? itemData.margin_target ?? null,
    computedFoodCost: itemData.computedFoodCost ?? null,
    computedCostPerPortion: itemData.computedCostPerPortion ?? null,
    computedProductionCost: itemData.computedProductionCost ?? null,
    computedMarginValue: itemData.computedMarginValue ?? null,
    computedMarginPercent: itemData.computedMarginPercent ?? null,
    suggestedPrice: itemData.suggestedPrice ?? null,
    createdAt: now,
    updatedAt: now,
  };

  menu.push(newItem);
  await writeArray(menu);
  return newItem;
}

async function update(id, updates) {
  const menu = await readArray();
  const index = menu.findIndex((m) => String(m.id) === String(id));
  if (index === -1) return null;
  const next = { ...menu[index], ...updates };
  if (updates.recipeId !== undefined) next.recipeId = updates.recipeId || null;
  if (updates.recipe_id !== undefined) next.recipeId = updates.recipe_id || null;
  if (updates.linkedRecipeId !== undefined) {
    next.linkedRecipeId = updates.linkedRecipeId || null;
  } else if (updates.recipeId !== undefined || updates.recipe_id !== undefined) {
    next.linkedRecipeId = updates.recipeId || updates.recipe_id || null;
  }
  if (updates.sellingPrice !== undefined) next.sellingPrice = Number(updates.sellingPrice) || 0;
  if (updates.ingredients !== undefined && Array.isArray(updates.ingredients)) {
    next.ingredients = updates.ingredients;
  }
  if (updates.yield !== undefined || updates.yieldPortions !== undefined || updates.yield_portions !== undefined) {
    next.yield = updates.yield ?? updates.yieldPortions ?? updates.yield_portions ?? null;
  }
  if (updates.ivaPercent !== undefined || updates.iva_percent !== undefined) {
    next.ivaPercent = updates.ivaPercent ?? updates.iva_percent ?? null;
  }
  if (updates.overheadPercent !== undefined || updates.overhead_percent !== undefined) {
    next.overheadPercent = updates.overheadPercent ?? updates.overhead_percent ?? null;
  }
  if (updates.packagingCost !== undefined || updates.packaging_cost !== undefined) {
    next.packagingCost = updates.packagingCost ?? updates.packaging_cost ?? null;
  }
  if (updates.laborCost !== undefined || updates.labor_cost !== undefined) {
    next.laborCost = updates.laborCost ?? updates.labor_cost ?? null;
  }
  if (updates.energyCost !== undefined || updates.energy_cost !== undefined) {
    next.energyCost = updates.energyCost ?? updates.energy_cost ?? null;
  }
  if (updates.extraCost !== undefined || updates.extra_cost !== undefined) {
    next.extraCost = updates.extraCost ?? updates.extra_cost ?? null;
  }
  if (updates.foodCostTarget !== undefined || updates.targetFoodCost !== undefined || updates.target_food_cost !== undefined) {
    next.foodCostTarget = updates.foodCostTarget ?? updates.targetFoodCost ?? updates.target_food_cost ?? null;
  }
  if (updates.marginTarget !== undefined || updates.margin_target !== undefined) {
    next.marginTarget = updates.marginTarget ?? updates.margin_target ?? null;
  }
  if (updates.computedFoodCost !== undefined) next.computedFoodCost = updates.computedFoodCost;
  if (updates.computedCostPerPortion !== undefined) next.computedCostPerPortion = updates.computedCostPerPortion;
  if (updates.computedProductionCost !== undefined) next.computedProductionCost = updates.computedProductionCost;
  if (updates.computedMarginValue !== undefined) next.computedMarginValue = updates.computedMarginValue;
  if (updates.computedMarginPercent !== undefined) next.computedMarginPercent = updates.computedMarginPercent;
  if (updates.suggestedPrice !== undefined) next.suggestedPrice = updates.suggestedPrice;
  next.updatedAt = new Date().toISOString();
  menu[index] = next;
  await writeArray(menu);
  return menu[index];
}

async function remove(id) {
  const menu = await readArray();
  const index = menu.findIndex((m) => String(m.id) === String(id));
  if (index === -1) return false;
  menu.splice(index, 1);
  await writeArray(menu);
  return true;
}

async function getByRecipeId(recipeId) {
  const menu = await readArray();
  const id = String(recipeId || "").trim();
  if (!id) return null;
  return menu.find((m) => String(m.recipeId || m.recipe_id || "") === id) || null;
}

module.exports = {
  getAll,
  getActive,
  getById,
  getByRecipeId,
  add,
  update,
  remove,
};
