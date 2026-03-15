const { v4: uuid } = require("uuid");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const VALID_UNITS = ["g", "kg", "ml", "cl", "l", "pcs"];

let recipes = [];
let lastRecipePath = null;

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "recipes.json");
}

function normalizeIngredient(i) {
  const name = String(i.name || i.ingredientName || "").trim();
  const qty = Number(i.quantity) ?? Number(i.qty) ?? 0;
  const unit = String(i.unit || "").trim().toLowerCase();
  const unitNorm = VALID_UNITS.includes(unit) ? unit : (unit || "g");
  const wastagePercent = Number(i.wastagePercent) ?? Number(i.wastage_percent) ?? 0;
  const costPerUnit = Number(i.costPerUnit) ?? Number(i.cost_per_unit) ?? Number(i.unitCost) ?? 0;
  const totalCost = Number(i.totalCost) ?? Number(i.total_cost) ?? (qty * costPerUnit);
  return {
    ingredientId: i.ingredientId || i.ingredient_id || null,
    ingredientName: name || (i.name || i.ingredientName || ""),
    name: name || (i.name || i.ingredientName || ""),
    quantity: qty,
    unit: unitNorm,
    wastagePercent: Math.max(0, Math.min(100, wastagePercent)),
    costPerUnit,
    totalCost,
  };
}

function readRecipes() {
  const dataPath = getDataPath();
  const data = safeReadJson(dataPath, { recipes: [] });
  let list = Array.isArray(data) ? data : (data.recipes && Array.isArray(data.recipes) ? data.recipes : null);
  if (list == null && data && typeof data === "object" && !Array.isArray(data)) list = [data];
  if (!Array.isArray(list)) list = [];
  return list.map((r) => normalizeRecipeFromFile(r));
}

function normalizeRecipeFromFile(r) {
  const menuItemName = String(r.menuItemName || r.menu_item_name || r.name || "").trim();
  const name = String(r.name || menuItemName || "").trim() || menuItemName;
  const ingredients = Array.isArray(r.ingredients)
    ? r.ingredients.map((i) => normalizeIngredient(i))
    : [];
  return {
    id: r.id || uuid(),
    name,
    menuItemName: menuItemName || name,
    menu_item_name: menuItemName || name,
    category: String(r.category || "").trim(),
    department: r.department || r.area || "cucina",
    area: r.department || r.area || "cucina",
    description: String(r.description || "").trim(),
    yieldPortions: Number(r.yieldPortions) ?? Number(r.yield_portions) ?? Number(r.servings) ?? 1,
    yield_portions: Number(r.yieldPortions) ?? Number(r.yield_portions) ?? Number(r.servings) ?? 1,
    sellingPrice: Number(r.sellingPrice) ?? Number(r.selling_price) ?? 0,
    selling_price: Number(r.sellingPrice) ?? Number(r.selling_price) ?? 0,
    targetFoodCost: Number(r.targetFoodCost) ?? Number(r.target_food_cost) ?? 0,
    target_food_cost: Number(r.targetFoodCost) ?? Number(r.target_food_cost) ?? 0,
    notes: String(r.notes || r.note || "").trim(),
    note: String(r.notes || r.note || "").trim(),
    ingredients,
  };
}

function validateRecipe(data) {
  const errs = [];
  const ingredients = Array.isArray(data.ingredients) ? data.ingredients : [];
  if (ingredients.length < 1) {
    errs.push("La ricetta deve avere almeno 1 ingrediente");
  }
  ingredients.forEach((ing, idx) => {
    const qty = Number(ing.quantity) ?? Number(ing.qty) ?? 0;
    if (qty <= 0) errs.push(`Ingrediente ${idx + 1}: quantità deve essere > 0`);
    const unit = String(ing.unit || "").trim();
    if (!unit) errs.push(`Ingrediente ${idx + 1}: unità obbligatoria`);
  });
  return errs;
}

function writeRecipes(list) {
  atomicWriteJson(getDataPath(), { recipes: list });
}

function ensureLoaded() {
  const currentPath = getDataPath();
  if (recipes.length === 0 || lastRecipePath !== currentPath) {
    lastRecipePath = currentPath;
    recipes = readRecipes();
  }
}

// GET ALL
async function getAll() {
  ensureLoaded();
  return recipes;
}

// GET BY ID
async function getById(id) {
  ensureLoaded();
  return recipes.find((r) => r.id === id) || null;
}

// GET BY MENU ITEM NAME (alias findRecipeByMenuItemName)
async function getByMenuItemName(name) {
  ensureLoaded();
  const normalized = String(name || "").trim().toLowerCase();
  return (
    recipes.find(
      (r) =>
        String(r.menuItemName || r.menu_item_name || "").trim().toLowerCase() === normalized
    ) || null
  );
}

async function findRecipeByMenuItemName(name) {
  return getByMenuItemName(name);
}

// CREATE
async function create(data) {
  ensureLoaded();
  const ingredients = Array.isArray(data.ingredients)
    ? data.ingredients.map((i) => normalizeIngredient(i))
    : [];
  const menuItemName = String(data.menuItemName || data.menu_item_name || data.name || "").trim();
  const name = String(data.name || menuItemName || "").trim() || menuItemName;
  const errs = validateRecipe({ ...data, ingredients });
  if (errs.length > 0) {
    const err = new Error(errs.join("; "));
    err.validationErrors = errs;
    throw err;
  }
  const recipe = normalizeRecipeFromFile({
    id: data.id || uuid(),
    name,
    menuItemName: menuItemName || name,
    category: data.category || "",
    department: data.department || data.area || "cucina",
    description: data.description || "",
    yieldPortions: data.yieldPortions ?? data.yield_portions ?? data.servings ?? 1,
    sellingPrice: data.sellingPrice ?? data.selling_price ?? 0,
    targetFoodCost: data.targetFoodCost ?? data.target_food_cost ?? 0,
    notes: data.notes || data.note || "",
    ingredients,
  });
  recipes.push(recipe);
  writeRecipes(recipes);
  return recipe;
}

// UPDATE
async function update(id, data) {
  ensureLoaded();
  const recipe = recipes.find((r) => r.id === id);
  if (!recipe) return null;

  const updates = { ...recipe, ...data };
  if (Array.isArray(data.ingredients)) {
    updates.ingredients = data.ingredients.map((i) => normalizeIngredient(i));
  }
  const errs = validateRecipe(updates);
  if (errs.length > 0) {
    const err = new Error(errs.join("; "));
    err.validationErrors = errs;
    throw err;
  }

  if (data.name !== undefined) recipe.name = String(data.name).trim();
  if (data.menuItemName !== undefined) recipe.menuItemName = String(data.menuItemName).trim();
  if (data.menu_item_name !== undefined) recipe.menuItemName = String(data.menu_item_name).trim();
  recipe.menu_item_name = recipe.menuItemName;
  if (data.category !== undefined) recipe.category = String(data.category).trim();
  if (data.department !== undefined) recipe.department = data.department;
  if (data.area !== undefined) recipe.department = data.area;
  recipe.area = recipe.department;
  if (data.description !== undefined) recipe.description = String(data.description).trim();
  if (data.yieldPortions !== undefined) recipe.yieldPortions = Number(data.yieldPortions) ?? 1;
  if (data.yield_portions !== undefined) recipe.yieldPortions = Number(data.yield_portions) ?? 1;
  recipe.yield_portions = recipe.yieldPortions;
  if (data.sellingPrice !== undefined) recipe.sellingPrice = Number(data.sellingPrice) ?? 0;
  if (data.selling_price !== undefined) recipe.sellingPrice = Number(data.selling_price) ?? 0;
  recipe.selling_price = recipe.sellingPrice;
  if (data.targetFoodCost !== undefined) recipe.targetFoodCost = Number(data.targetFoodCost) ?? 0;
  if (data.target_food_cost !== undefined) recipe.targetFoodCost = Number(data.target_food_cost) ?? 0;
  recipe.target_food_cost = recipe.targetFoodCost;
  if (data.notes !== undefined) recipe.notes = String(data.notes).trim();
  if (data.note !== undefined) recipe.notes = String(data.note).trim();
  recipe.note = recipe.notes;
  if (Array.isArray(data.ingredients)) {
    recipe.ingredients = data.ingredients.map((i) => normalizeIngredient(i));
  }

  writeRecipes(recipes);
  return recipe;
}

// DELETE
async function remove(id) {
  ensureLoaded();
  const index = recipes.findIndex((r) => r.id === id);
  if (index === -1) return false;

  recipes.splice(index, 1);
  writeRecipes(recipes);
  return true;
}

/**
 * Compute food cost for a recipe. Uses ingredient totalCost or falls back to inventory lookup.
 */
async function getFoodCost(id, inventoryRepository) {
  ensureLoaded();
  const recipe = recipes.find((r) => r.id === id) || null;
  if (!recipe) return null;
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  let recipeTotalCost = 0;
  for (const ing of ingredients) {
    let cost = Number(ing.totalCost) || 0;
    if (cost <= 0) {
      const cpu = Number(ing.costPerUnit) || Number(ing.unitCost) || 0;
      const qty = Number(ing.quantity) ?? Number(ing.qty) ?? 0;
      if (cpu > 0 && qty > 0) {
        cost = qty * cpu;
      } else if (inventoryRepository) {
        const invItem = inventoryRepository.findInventoryItemByName(ing.name || ing.ingredientName);
        const cpuInv = invItem ? inventoryRepository.getCostPerUnit(invItem) : 0;
        cost = qty * cpuInv;
      }
    }
    recipeTotalCost += cost;
  }
  const yieldPortions = Number(recipe.yieldPortions) ?? Number(recipe.yield_portions) ?? 1;
  const costPerPortion = yieldPortions > 0 ? recipeTotalCost / yieldPortions : 0;
  const sellingPrice = Number(recipe.sellingPrice) ?? Number(recipe.selling_price) ?? 0;
  const targetFoodCost = Number(recipe.targetFoodCost) ?? Number(recipe.target_food_cost) ?? 0;
  let foodCostPercent = null;
  if (sellingPrice > 0 && costPerPortion > 0) {
    foodCostPercent = (costPerPortion / sellingPrice) * 100;
  }
  let suggestedPrice = null;
  if (targetFoodCost > 0 && costPerPortion > 0) {
    suggestedPrice = costPerPortion / (targetFoodCost / 100);
  }
  return {
    recipeTotalCost,
    costPerPortion,
    foodCostPercent,
    suggestedPrice,
  };
}

module.exports = {
  VALID_UNITS,
  getAll,
  getById,
  getByMenuItemName,
  findRecipeByMenuItemName,
  create,
  update,
  remove,
  readRecipes,
  getFoodCost,
};
