// backend/src/repositories/menu.repository.js
// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./menu.repository.json");
const mysql = require("./mysql/menu.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  getAll: (...a) => impl().getAll(...a),
  getActive: (...a) => impl().getActive(...a),
  getById: (...a) => impl().getById(...a),
  getByRecipeId: (...a) => impl().getByRecipeId(...a),
  add: (...a) => impl().add(...a),
  update: (...a) => impl().update(...a),
  remove: (...a) => impl().remove(...a),
};
