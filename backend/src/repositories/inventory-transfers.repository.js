// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./inventory-transfers.repository.json");
const mysql = require("./mysql/inventory-transfers.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  addTransfer: (...a) => impl().addTransfer(...a),
  getRecentTransfers: (...a) => impl().getRecentTransfers(...a),
  getById: (...a) => impl().getById(...a),
  updateTransfer: (...a) => impl().updateTransfer(...a),
  readTransfers: (...a) => impl().readTransfers(...a),
};
