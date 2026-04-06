// backend/src/service/inventory.service.js
// Automatic inventory deduction and food cost when an order reaches final state (servito/chiuso).
// Safe: no recipe = skip with warning; never breaks order flow.

const inventoryRepository = require("../repositories/inventory.repository");
const logger = require("../utils/logger");
const orderInventoryHelpers = require("../utils/orderInventoryHelpers");
const recipesRepository = require("../repositories/recipes.repository");
const stockMovementsRepository = require("../repositories/stock-movements.repository");
const orderFoodCostsRepository = require("../repositories/order-food-costs.repository");

const processedClosedOrders = new Set();

function normalizeName(s) {
  return String(s || "").trim().toLowerCase();
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Compute order total revenue from items (price * qty). */
function getOrderTotal(order = {}) {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.reduce((acc, item) => {
    const price = toNumber(item.price, 0);
    const qty = toNumber(item.qty, 1);
    return acc + price * qty;
  }, 0);
}

/**
 * Calculate recipe ingredient cost (sum of qty * cost_per_unit from inventory).
 */
async function calculateRecipeIngredientCost(recipe, servedQty) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  let cost = 0;

  for (const ing of ingredients) {
    const invItem = await inventoryRepository.findInventoryItemByName(ing.name);
    const qty = (Number(ing.quantity) ?? Number(ing.qty) ?? 0) * (Number(servedQty) || 1);
    const costPerUnit = invItem
      ? inventoryRepository.getCostPerUnit(invItem)
      : Number(ing.unitCost) || 0;
    cost += qty * costPerUnit;
  }

  return cost;
}

/**
 * Check if recipe ingredient unit matches inventory product unit when both exist.
 */
function unitsMatch(recipeUnit, invUnit) {
  const ru = String(recipeUnit || "").trim().toLowerCase();
  const iu = String(invUnit || "").trim().toLowerCase();
  if (!ru || !iu) return true;
  return ru === iu;
}

/**
 * Validate recipe consumption without deducting (pre-check).
 * Returns { valid, failures } - valid is false if any ingredient fails.
 */
async function validateRecipeConsumption(recipe, servedQty) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const department = recipe.department || recipe.area || "cucina";
  const failures = [];

  for (const ing of ingredients) {
    const name = ing.name || ing.ingredientName || "";
    const needQty = (Number(ing.quantity) ?? Number(ing.qty) ?? 0) * (Number(servedQty) || 1);
    if (!name || needQty <= 0) continue;

    const invItem = await inventoryRepository.findInventoryItemByName(name);
    if (!invItem) {
      failures.push({
        type: "missing_inventory",
        ingredient: name,
        message: `Prodotto non trovato in magazzino: ${name}`,
      });
      continue;
    }

    const invUnit = invItem.unit || "";
    const ingUnit = ing.unit || "";
    if (invUnit && ingUnit && !unitsMatch(ingUnit, invUnit)) {
      failures.push({
        type: "unit_mismatch",
        ingredient: name,
        message: `Unità ricetta (${ingUnit}) non corrisponde a magazzino (${invUnit}) per: ${name}`,
      });
      continue;
    }

    const deptStock = inventoryRepository.getDepartmentStock(invItem, department);
    if (deptStock < needQty) {
      failures.push({
        type: "insufficient_stock",
        ingredient: name,
        requested: needQty,
        available: deptStock,
        message: `${name}: richiesti ${needQty}, disponibili in cucina ${deptStock}`,
      });
    }
  }

  return { valid: failures.length === 0, failures };
}

/**
 * Validate entire order consumption (all recipe items) without deducting.
 * Use before setStatus to block servito/chiuso when kitchen stock is insufficient.
 */
async function validateOrderConsumption(order) {
  if (!order || !order.id) return { valid: false, error: "Ordine non valido", failures: [] };

  // Bar / bevande: no kitchen recipe stock gate (food-only lines are validated).
  const foodOrder = orderInventoryHelpers.filterOrderItemsForInventory(order);
  const items = Array.isArray(foodOrder.items) ? foodOrder.items : [];
  if (items.length === 0) {
    return { valid: true, error: null, failures: [] };
  }

  const allFailures = [];

  for (const item of items) {
    const itemName = String(item.name || "").trim();
    const servedQty = Number(item.qty) || 1;
    const recipeId = item.recipeId || item.recipe_id || null;
    const recipe = recipeId
      ? await recipesRepository.getById(recipeId)
      : await recipesRepository.findRecipeByMenuItemName(itemName);
    if (!recipe) continue;

    const { valid, failures } = validateRecipeConsumption(recipe, servedQty);
    if (!valid && failures.length > 0) {
      allFailures.push({ item: itemName, failures });
    }
  }

  if (allFailures.length === 0) {
    return { valid: true, error: null, failures: [] };
  }

  const first = allFailures[0].failures[0];
  return {
    valid: false,
    error: first?.message || "Stock cucina insufficiente",
    failures: allFailures.flatMap((a) => a.failures),
  };
}

/**
 * Deduct recipe ingredients from department warehouse (cucina).
 * Uses getDepartmentStock to check availability before deducting.
 * If ANY ingredient has insufficient kitchen stock, BLOCKS entire consumption and returns error.
 * Uses deductFromDepartment instead of central deduction.
 */
async function deductRecipeIngredients(order, itemName, recipe, servedQty) {
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const department = recipe.department || recipe.area || "cucina";
  const warnings = [];
  const preCheckFailures = [];

  for (const ing of ingredients) {
    const name = ing.name || ing.ingredientName || "";
    const needQty = (Number(ing.quantity) ?? Number(ing.qty) ?? 0) * (Number(servedQty) || 1);
    if (!name || needQty <= 0) continue;

    const invItemLoop = await inventoryRepository.findInventoryItemByName(name);
    if (!invItemLoop) {
      preCheckFailures.push({
        type: "missing_inventory",
        ingredient: name,
        message: `Prodotto non trovato in magazzino: ${name}`,
      });
      continue;
    }

    const invUnit = invItemLoop.unit || "";
    const ingUnit = ing.unit || "";
    if (invUnit && ingUnit && !unitsMatch(ingUnit, invUnit)) {
      preCheckFailures.push({
        type: "unit_mismatch",
        ingredient: name,
        message: `Unità ricetta (${ingUnit}) non corrisponde a magazzino (${invUnit}) per: ${name}`,
      });
      continue;
    }

    const deptStock = inventoryRepository.getDepartmentStock(invItemLoop, department);
    if (deptStock < needQty) {
      preCheckFailures.push({
        type: "insufficient_stock",
        ingredient: name,
        requested: needQty,
        available: deptStock,
        message: `${name}: richiesti ${needQty}, disponibili in cucina ${deptStock}`,
      });
    }
  }

  if (preCheckFailures.length > 0) {
    return {
      blocked: true,
      error: preCheckFailures[0].message,
      failures: preCheckFailures,
      warnings: [],
    };
  }

  for (const ing of ingredients) {
    const name = ing.name || ing.ingredientName || "";
    const needQty = (Number(ing.quantity) ?? Number(ing.qty) ?? 0) * (Number(servedQty) || 1);
    if (!name || needQty <= 0) continue;

    const invItem = await inventoryRepository.findInventoryItemByName(name);
    const before = inventoryRepository.getDepartmentStock(invItem, department);
    const result = await inventoryRepository.deductFromDepartment(name, needQty, department);

    if (!result.success) {
      return {
        blocked: true,
        error: result.reason === "insufficient_stock"
          ? `${name}: richiesti ${result.requested}, disponibili ${result.available}`
          : `Errore scarico ${name}: ${result.reason}`,
        failures: [{ type: "deduct_failed", ingredient: name }],
        warnings: [],
      };
    }

    if (result.belowMin) {
      warnings.push({
        type: "low_stock",
        ingredient: name,
        newStock: result.newStock,
        minStock: inventoryRepository.getMinStock(invItem),
      });
    }

    await stockMovementsRepository.createMovement({
      type: "recipe_consumption",
      orderId: order.id,
      orderStatus: order.status || "chiuso",
      itemName: itemName || "",
      ingredientName: name,
      quantity: needQty,
      unit: ing.unit || invItem.unit || "",
      before,
      after: result.newStock,
      fromWarehouse: department,
      toWarehouse: null,
      productId: invItem.id,
      productName: invItem.name,
      recipeId: recipe.id || null,
      sourceModule: "orders",
      reason: "Consumo ingredienti da ricetta (ordine servito/chiuso)",
      note: "Consumo ingredienti da ricetta (ordine servito/chiuso)",
    });
  }

  return { blocked: false, warnings };
}

/**
 * Process order when it reaches final state (servito or chiuso): deduct ingredients, record stock movements, compute food cost and margin.
 * Idempotent: uses order.inventoryProcessedAt (via tryMarkOrderInventoryProcessed) + in-memory Set.
 * Safe: missing recipe = skip item and add warning; never throws.
 */
async function onOrderFinalized(order) {
  if (!order || !order.id) {
    return { ok: false, message: "Ordine non valido", totalFoodCost: 0, itemFoodCosts: [], warnings: [] };
  }

  const processKey = `closed_${order.id}`;
  if (processedClosedOrders.has(processKey)) {
    return {
      ok: true,
      skipped: true,
      message: "Ordine già scaricato",
      totalFoodCost: 0,
      itemFoodCosts: [],
      warnings: [],
    };
  }

  const existingMovements = await stockMovementsRepository.findByOrderId(order.id);
  const hasRecipeConsumption = existingMovements.some((m) => m.type === "recipe_consumption" || m.type === "deduction");
  if (hasRecipeConsumption) {
    return {
      ok: true,
      skipped: true,
      message: "Ordine già scaricato (movimenti esistenti)",
      totalFoodCost: 0,
      itemFoodCosts: [],
      warnings: [],
    };
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const itemFoodCosts = [];
  const allWarnings = [];
  let totalFoodCost = 0;

  // Validate ALL recipe items first to avoid partial deduction
  const validation = await validateOrderConsumption(order);
  if (!validation.valid) {
    return {
      ok: false,
      blocked: true,
      message: "Scarico bloccato: stock cucina insufficiente",
      error: validation.error,
      failures: validation.failures || [],
      orderId: order.id,
      itemFoodCosts: [],
      totalFoodCost: 0,
      warnings: [],
    };
  }

  for (const item of items) {
    const itemName = String(item.name || "").trim();
    const servedQty = Number(item.qty) || 1;
    const recipeId = item.recipeId || item.recipe_id || null;

    const recipe = recipeId
      ? await recipesRepository.getById(recipeId)
      : await recipesRepository.findRecipeByMenuItemName(itemName);

    if (!recipe) {
      allWarnings.push({ type: "no_recipe", item: itemName });
      continue;
    }

    const foodCost = await calculateRecipeIngredientCost(recipe, servedQty);
    totalFoodCost += foodCost;
    itemFoodCosts.push({ itemName, qty: servedQty, foodCost });

    const deductResult = await deductRecipeIngredients(order, itemName, recipe, servedQty);
    if (deductResult.blocked) {
      return {
        ok: false,
        blocked: true,
        message: "Scarico bloccato: stock cucina insufficiente",
        error: deductResult.error,
        failures: deductResult.failures || [],
        orderId: order.id,
        itemFoodCosts: [],
        totalFoodCost: 0,
        warnings: [...allWarnings, { type: "deduction_blocked", error: deductResult.error }],
      };
    }
    allWarnings.push(...(deductResult.warnings || []));
  }

  processedClosedOrders.add(processKey);

  if (allWarnings.length > 0) {
    // info: avvisi non bloccanti (es. ricetta mancante); evita falsi "error" su stderr
    logger.info("Inventory deduction warnings", { orderId: order.id, warnings: allWarnings.length });
  }
  if (totalFoodCost > 0 || allWarnings.length > 0) {
    logger.info("Inventory deduction event", { orderId: order.id, totalFoodCost, itemCount: itemFoodCosts.length });
  }

  const estimatedRevenue = getOrderTotal(order);
  const estimatedMargin = estimatedRevenue - totalFoodCost;

  if (totalFoodCost > 0 || estimatedRevenue > 0) {
    await orderFoodCostsRepository.recordOrderFoodCost(
      order.id,
      totalFoodCost,
      order.updatedAt || new Date().toISOString(),
      { estimatedRevenue, estimatedMargin }
    );
  }

  return {
    ok: true,
    orderId: order.id,
    itemFoodCosts,
    totalFoodCost,
    estimatedRevenue,
    estimatedMargin,
    warnings: allWarnings,
  };
}

/** @deprecated Use onOrderFinalized. Kept for backward compatibility. */
async function onOrderClosed(order) {
  return onOrderFinalized(order);
}

/**
 * Count inventory items below min stock.
 */
async function getLowStockCount() {
  const items = await inventoryRepository.readInventory();
  let count = 0;
  for (const item of items) {
    const stock = inventoryRepository.getStock(item);
    const min = inventoryRepository.getMinStock(item);
    if (min > 0 && stock < min) count += 1;
  }
  return count;
}

module.exports = {
  onOrderFinalized,
  onOrderClosed,
  validateOrderConsumption,
  calculateRecipeIngredientCost,
  getLowStockCount,
};
