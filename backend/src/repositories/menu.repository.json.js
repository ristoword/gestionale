// backend/src/repositories/menu.repository.json.js — persistenza menu su file JSON per tenant.

const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

function getMenuPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "menu.json");
}

function readMenu() {
  const data = safeReadJson(getMenuPath(), []);
  return Array.isArray(data) ? data : [];
}

function writeMenu(data) {
  atomicWriteJson(getMenuPath(), Array.isArray(data) ? data : []);
}

async function getAll() {
  return readMenu();
}

async function getById(id) {
  const menu = readMenu();
  return menu.find((item) => item.id === Number(id));
}

async function getActive() {
  const menu = readMenu();
  return menu.filter((item) => item.active);
}

async function add(itemData) {
  const menu = readMenu();
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
  writeMenu(menu);
  return newItem;
}

async function update(id, updates) {
  const menu = readMenu();
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
  writeMenu(menu);
  return menu[index];
}

async function remove(id) {
  const menu = readMenu();
  const index = menu.findIndex((m) => String(m.id) === String(id));
  if (index === -1) return false;
  menu.splice(index, 1);
  writeMenu(menu);
  return true;
}

async function getByRecipeId(recipeId) {
  const menu = readMenu();
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
