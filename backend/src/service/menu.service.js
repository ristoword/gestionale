// backend/src/service/menu.service.js

const menuRepository = require("../repositories/menu.repository");
const recipesRepository = require("../repositories/recipes.repository");

function listAll() {
  return menuRepository.getAll();
}

function listActive() {
  return menuRepository.getActive();
}

function create(data) {
  if (!data.name) {
    throw new Error("Nome piatto obbligatorio");
  }
  return menuRepository.add(data);
}

function getOne(id) {
  const item = menuRepository.getById(id);
  if (!item) {
    throw new Error("Piatto non trovato");
  }
  return item;
}

async function update(id, data) {
  const item = menuRepository.update(id, data);
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
  const dish = menuRepository.add({
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

function remove(id) {
  const ok = menuRepository.remove(id);
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