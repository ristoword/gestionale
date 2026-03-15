const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const recipesController = require("../controllers/recipes.controller");

// GET /api/recipes
router.get("/", asyncHandler(recipesController.listRecipes));

// GET /api/recipes/:id/food-cost (before :id to avoid "food-cost" as id)
router.get("/:id/food-cost", asyncHandler(recipesController.getRecipeFoodCost));

// GET /api/recipes/:id
router.get("/:id", asyncHandler(recipesController.getRecipeById));

// POST /api/recipes
router.post("/", asyncHandler(recipesController.createRecipe));

// PATCH /api/recipes/:id
router.patch("/:id", asyncHandler(recipesController.updateRecipe));

// DELETE /api/recipes/:id
router.delete("/:id", asyncHandler(recipesController.deleteRecipe));

module.exports = router;