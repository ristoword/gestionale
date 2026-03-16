// Basic helpers (kept for backward compatibility with any existing usages)
function calculateIngredientCost(ingredient = {}) {
  const unitCost = Number(ingredient.unitCost) || 0;
  const quantity = Number(ingredient.quantity) || 0;
  return unitCost * quantity;
}

function calculateRecipeCost(ingredients = []) {
  return ingredients.reduce((acc, ingredient) => {
    return acc + calculateIngredientCost(ingredient);
  }, 0);
}

function calculateFoodCostPercent(recipeCost = 0, sellingPrice = 0) {
  const price = Number(sellingPrice) || 0;
  if (price <= 0) return 0;
  return (Number(recipeCost) / price) * 100;
}

function calculateSuggestedPrice(recipeCost = 0, targetMarginPercent = 35) {
  const margin = Number(targetMarginPercent) || 35;
  const divisor = 1 - margin / 100;
  if (divisor <= 0) return 0;
  return Number(recipeCost) / divisor;
}

function analyzeDish({ ingredients = [], sellingPrice = 0, targetMarginPercent = 35 } = {}) {
  const recipeCost = calculateRecipeCost(ingredients);
  const foodCostPercent = calculateFoodCostPercent(recipeCost, sellingPrice);
  const suggestedPrice = calculateSuggestedPrice(recipeCost, targetMarginPercent);

  return {
    recipeCost,
    sellingPrice: Number(sellingPrice) || 0,
    foodCostPercent,
    suggestedPrice,
    targetMarginPercent: Number(targetMarginPercent) || 35,
  };
}

// ==========================================
// ADVANCED FOOD COST (shared by Recipes / Crea Piatti)
// ==========================================

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Compute advanced food cost metrics from a generic config.
 *
 * Config shape (all fields optional, sensible defaults applied):
 * - ingredients[]: { quantity, unitCost, wastagePercent }
 * - ivaPercent, overheadPercent
 * - packagingCost, laborCost, energyCost, extraCost
 * - yieldPortions
 * - sellingPrice
 * - foodCostTarget, marginTarget
 */
function computeAdvancedFoodCost(config = {}) {
  const ingredients = Array.isArray(config.ingredients) ? config.ingredients : [];

  let rawIngredientCost = 0;

  ingredients.forEach((ing) => {
    const qty = toNumber(ing.quantity, 0);
    const unitCost = toNumber(ing.unitCost, 0);
    const wastagePercent = toNumber(ing.wastagePercent, 0);

    let lineTotal = qty * unitCost;
    if (lineTotal < 0) lineTotal = 0;

    const afterWastage =
      wastagePercent > 0 ? lineTotal * (1 + wastagePercent / 100) : lineTotal;

    rawIngredientCost += afterWastage;
  });

  const ivaPercent = toNumber(config.ivaPercent ?? config.iva_percent, 0);
  const overheadPercent = toNumber(config.overheadPercent ?? config.overhead_percent, 0);

  const packagingCost = toNumber(config.packagingCost ?? config.packaging_cost, 0);
  const laborCost = toNumber(config.laborCost ?? config.labor_cost, 0);
  const energyCost = toNumber(config.energyCost ?? config.energy_cost, 0);
  const extraCost = toNumber(config.extraCost ?? config.extra_cost, 0);

  const ivaAmount = rawIngredientCost * (ivaPercent / 100);
  const overheadAmount = rawIngredientCost * (overheadPercent / 100);

  const finalProductionCost =
    rawIngredientCost +
    ivaAmount +
    overheadAmount +
    packagingCost +
    laborCost +
    energyCost +
    extraCost;

  const yieldPortions =
    toNumber(config.yieldPortions ?? config.yield_portions ?? config.yield, 1) || 1;

  const costPerPortion =
    yieldPortions > 0 ? finalProductionCost / yieldPortions : 0;

  const sellingPrice = toNumber(
    config.sellingPrice ?? config.selling_price ?? config.price,
    0
  );

  let foodCostPercent = null;
  if (sellingPrice > 0 && costPerPortion > 0) {
    foodCostPercent = (costPerPortion / sellingPrice) * 100;
  }

  const foodCostTarget = toNumber(
    config.foodCostTarget ?? config.targetFoodCost ?? config.target_food_cost,
    0
  );
  const marginTarget = toNumber(config.marginTarget ?? config.margin_target, 0);

  let suggestedPriceFromFoodCost = null;
  if (foodCostTarget > 0 && costPerPortion > 0) {
    suggestedPriceFromFoodCost = costPerPortion / (foodCostTarget / 100);
  }

  let marginValue = null;
  let marginPercent = null;
  if (sellingPrice > 0 && costPerPortion > 0) {
    marginValue = sellingPrice - costPerPortion;
    marginPercent = (marginValue / sellingPrice) * 100;
  }

  let suggestedPriceFromMargin = null;
  if (marginTarget > 0 && marginTarget < 100 && costPerPortion > 0) {
    const targetMarginFraction = marginTarget / 100;
    const divisor = 1 - targetMarginFraction;
    if (divisor > 0) {
      suggestedPriceFromMargin = costPerPortion / divisor;
    }
  }

  const suggestedPrice =
    suggestedPriceFromFoodCost != null
      ? suggestedPriceFromFoodCost
      : suggestedPriceFromMargin;

  return {
    rawIngredientCost,
    ivaAmount,
    overheadAmount,
    packagingCost,
    laborCost,
    energyCost,
    extraCost,
    finalProductionCost,
    yieldPortions,
    costPerPortion,
    sellingPrice,
    foodCostPercent,
    foodCostTarget,
    marginTarget,
    marginValue,
    marginPercent,
    suggestedPrice,
  };
}

module.exports = {
  calculateIngredientCost,
  calculateRecipeCost,
  calculateFoodCostPercent,
  calculateSuggestedPrice,
  analyzeDish,
  computeAdvancedFoodCost,
};