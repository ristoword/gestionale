// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./daily-menu.repository.json");
const mysql = require("./mysql/daily-menu.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  CATEGORIES: json.CATEGORIES,
  getAll: (...a) => impl().getAll(...a),
  getActiveDishes: (...a) => impl().getActiveDishes(...a),
  addDish: (...a) => impl().addDish(...a),
  updateDish: (...a) => impl().updateDish(...a),
  removeDish: (...a) => impl().removeDish(...a),
  toggleDish: (...a) => impl().toggleDish(...a),
  setMenuActive: (...a) => impl().setMenuActive(...a),
};
