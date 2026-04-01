// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./qr-tables.repository.json");
const mysql = require("./mysql/qr-tables.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  getTables: (...a) => impl().getTables(...a),
  getTableById: (...a) => impl().getTableById(...a),
  readOverrides: (...a) => impl().readOverrides(...a),
  writeOverrides: (...a) => impl().writeOverrides(...a),
};
