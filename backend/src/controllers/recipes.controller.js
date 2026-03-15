const recipesRepository = require("../repositories/recipes.repository");
const inventoryRepository = require("../repositories/inventory.repository");

// GET /api/recipes
exports.listRecipes = async (req, res) => {
  const data = await recipesRepository.getAll();
  res.json(data);
};

// GET /api/recipes/:id
exports.getRecipeById = async (req, res) => {
  const recipe = await recipesRepository.getById(req.params.id);

  if (!recipe) {
    return res.status(404).json({ error: "Ricetta non trovata" });
  }

  res.json(recipe);
};

// GET /api/recipes/:id/food-cost (must be before :id in route order - use /food-cost as sub-route)
exports.getRecipeFoodCost = async (req, res) => {
  const foodCost = await recipesRepository.getFoodCost(req.params.id, inventoryRepository);

  if (!foodCost) {
    return res.status(404).json({ error: "Ricetta non trovata" });
  }

  res.json(foodCost);
};

// POST /api/recipes
exports.createRecipe = async (req, res) => {
  try {
    const recipe = await recipesRepository.create(req.body || {});
    res.status(201).json(recipe);
  } catch (err) {
    if (err.validationErrors) {
      return res.status(400).json({ error: err.message, validationErrors: err.validationErrors });
    }
    throw err;
  }
};

// PATCH /api/recipes/:id
exports.updateRecipe = async (req, res) => {
  try {
    const recipe = await recipesRepository.update(req.params.id, req.body || {});

    if (!recipe) {
      return res.status(404).json({ error: "Ricetta non trovata" });
    }

    res.json(recipe);
  } catch (err) {
    if (err.validationErrors) {
      return res.status(400).json({ error: err.message, validationErrors: err.validationErrors });
    }
    throw err;
  }
};

// DELETE /api/recipes/:id
exports.deleteRecipe = async (req, res) => {
  const ok = await recipesRepository.remove(req.params.id);

  if (!ok) {
    return res.status(404).json({ error: "Ricetta non trovata" });
  }

  res.json({ success: true });
};