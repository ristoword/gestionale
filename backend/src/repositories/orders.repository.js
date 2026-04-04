// backend/src/repositories/orders.repository.js
// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./orders.repository.json");
const mysql = require("./mysql/orders.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

/** Prossimo id ordine: stessa regola per JSON e MySQL (max id dalla lista tenant corrente). */
function getNextId(orders) {
  const list = Array.isArray(orders) ? orders : [];
  if (!list.length) return 1;
  const max = Math.max(...list.map((o) => Number(o.id) || 0));
  return max + 1;
}

module.exports = {
  getAllOrders: (...a) => impl().getAllOrders(...a),
  saveAllOrders: (...a) => impl().saveAllOrders(...a),
  getOrderById: (...a) => impl().getOrderById(...a),
  getNextId,
};
