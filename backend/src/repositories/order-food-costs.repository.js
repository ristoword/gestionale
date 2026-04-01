// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./order-food-costs.repository.json");
const mysql = require("./mysql/order-food-costs.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  recordOrderFoodCost: (...a) => impl().recordOrderFoodCost(...a),
  getTotalFoodCostForDate: (...a) => impl().getTotalFoodCostForDate(...a),
  readAll: (...a) => impl().readAll(...a),
};
