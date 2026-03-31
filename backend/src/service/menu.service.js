// backend/src/service/menu.service.js

const menuRepository = require("../repositories/menu.repository");
const recipesRepository = require("../repositories/recipes.repository");
const { computeAdvancedFoodCost } = require("./foodcost.service");

async function listAll() {
  return await menuRepository.getAll();
}

async function listActive() {
  return await menuRepository.getActive();
}

async function create(data) {
  if (!data.name) {
    throw new Error("Nome piatto obbligatorio");
  }
  let enriched = { ...data };

  if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
    const fc = computeAdvancedFoodCost({
      ingredients: data.ingredients,
      ivaPercent: data.ivaPercent ?? data.iva_percent,
      overheadPercent: data.overheadPercent ?? data.overhead_percent,
      packagingCost: data.packagingCost ?? data.packaging_cost,
      laborCost: data.laborCost ?? data.labor_cost,
      energyCost: data.energyCost ?? data.energy_cost,
      extraCost: data.extraCost ?? data.extra_cost,
      yieldPortions: data.yield ?? data.yieldPortions ?? data.yield_portions,
      sellingPrice: data.sellingPrice ?? data.price,
      foodCostTarget: data.foodCostTarget ?? data.targetFoodCost ?? data.target_food_cost,
      marginTarget: data.marginTarget ?? data.margin_target,
    });

    enriched = {
      ...enriched,
      ivaPercent: fc.ivaPercent ?? data.ivaPercent,
      overheadPercent: fc.overheadPercent ?? data.overheadPercent,
      packagingCost: fc.packagingCost,
      laborCost: fc.laborCost,
      energyCost: fc.energyCost,
      extraCost: fc.extraCost,
      yield: fc.yieldPortions,
      foodCostTarget: fc.foodCostTarget ?? data.foodCostTarget,
      marginTarget: fc.marginTarget ?? data.marginTarget,
      computedFoodCost: fc.foodCostPercent,
      computedCostPerPortion: fc.costPerPortion,
      computedProductionCost: fc.finalProductionCost,
      computedMarginValue: fc.marginValue,
      computedMarginPercent: fc.marginPercent,
      suggestedPrice: fc.suggestedPrice,
    };
  }

  return await menuRepository.add(enriched);
}

async function getOne(id) {
  const item = await menuRepository.getById(id);
  if (!item) {
    throw new Error("Piatto non trovato");
  }
  return item;
}

async function update(id, data) {
  let patch = { ...data };

  if (Array.isArray(data.ingredients) && data.ingredients.length > 0) {
    const fc = computeAdvancedFoodCost({
      ingredients: data.ingredients,
      ivaPercent: data.ivaPercent ?? data.iva_percent,
      overheadPercent: data.overheadPercent ?? data.overhead_percent,
      packagingCost: data.packagingCost ?? data.packaging_cost,
      laborCost: data.laborCost ?? data.labor_cost,
      energyCost: data.energyCost ?? data.energy_cost,
      extraCost: data.extraCost ?? data.extra_cost,
      yieldPortions: data.yield ?? data.yieldPortions ?? data.yield_portions,
      sellingPrice: data.sellingPrice ?? data.price,
      foodCostTarget: data.foodCostTarget ?? data.targetFoodCost ?? data.target_food_cost,
      marginTarget: data.marginTarget ?? data.margin_target,
    });

    patch = {
      ...patch,
      ivaPercent: fc.ivaPercent ?? data.ivaPercent,
      overheadPercent: fc.overheadPercent ?? data.overheadPercent,
      packagingCost: fc.packagingCost,
      laborCost: fc.laborCost,
      energyCost: fc.energyCost,
      extraCost: fc.extraCost,
      yield: fc.yieldPortions,
      foodCostTarget: fc.foodCostTarget ?? data.foodCostTarget,
      marginTarget: fc.marginTarget ?? data.marginTarget,
      computedFoodCost: fc.foodCostPercent,
      computedCostPerPortion: fc.costPerPortion,
      computedProductionCost: fc.finalProductionCost,
      computedMarginValue: fc.marginValue,
      computedMarginPercent: fc.marginPercent,
      suggestedPrice: fc.suggestedPrice,
    };
  }

  const item = await menuRepository.update(id, patch);
  if (!item) throw new Error("Piatto non trovato");
  if (data.recipeId != null || data.recipe_id != null) {
    const recipeId = data.recipeId || data.recipe_id;
    if (recipeId) {
      const recipe = await recipesRepository.getById(recipeId);
      if (recipe) {
        await recipesRepository.update(recipeId, { linkedDishId: String(id) });
      }
    }
  }
  return item;
}

async function createDishFromRecipe(recipeId) {
  const recipe = await recipesRepository.getById(recipeId);
  if (!recipe) throw new Error("Ricetta non trovata");
  const name = recipe.name || recipe.menuItemName || "Piatto da ricetta";
  const price = recipe.sellingPrice ?? recipe.selling_price ?? 0;
  const dish = await menuRepository.add({
    name,
    price,
    sellingPrice: price,
    recipeId: recipe.id,
    category: recipe.category || "Generale",
    area: recipe.area || recipe.department || null,
  });
  await recipesRepository.update(recipeId, { linkedDishId: String(dish.id) });
  return dish;
}

async function remove(id) {
  const ok = await menuRepository.remove(id);
  if (!ok) throw new Error("Piatto non trovato");
  return true;
}

module.exports = {
  listAll,
  listActive,
  create,
  getOne,
  update,
  remove,
  createDishFromRecipe,
};
