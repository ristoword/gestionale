// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./stock-movements.repository.json");
const mysql = require("./mysql/stock-movements.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  getAll: (...a) => impl().getAll(...a),
  createMovement: (...a) => impl().createMovement(...a),
  findByOrderId: (...a) => impl().findByOrderId(...a),
};
