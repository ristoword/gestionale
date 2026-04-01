// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./recipes.repository.json");
const mysql = require("./mysql/recipes.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  VALID_UNITS: json.VALID_UNITS,
  UNIT_ALIASES: json.UNIT_ALIASES,
  normalizeUnit: (...a) => json.normalizeUnit(...a),
  normalizeIngredient: (...a) => json.normalizeIngredient(...a),
  validateRecipe: (...a) => json.validateRecipe(...a),
  getAll: (...a) => impl().getAll(...a),
  getAllRecipes: (...a) => impl().getAllRecipes(...a),
  getById: (...a) => impl().getById(...a),
  getByMenuItemName: (...a) => impl().getByMenuItemName(...a),
  findRecipeByMenuItemName: (...a) => impl().findRecipeByMenuItemName(...a),
  getByDishId: (...a) => impl().getByDishId(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  remove: (...a) => impl().remove(...a),
  getFoodCost: (...a) => impl().getFoodCost(...a),
};
