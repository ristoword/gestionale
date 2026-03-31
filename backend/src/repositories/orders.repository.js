// backend/src/repositories/orders.repository.js
// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./orders.repository.json");
const mysql = require("./mysql/orders.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  getAllOrders: (...a) => impl().getAllOrders(...a),
  saveAllOrders: (...a) => impl().saveAllOrders(...a),
  getOrderById: (...a) => impl().getOrderById(...a),
  getNextId: json.getNextId.bind(json),
};
