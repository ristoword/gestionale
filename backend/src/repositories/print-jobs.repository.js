// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./print-jobs.repository.json");
const mysql = require("./mysql/print-jobs.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  STATUSES: json.STATUSES,
  getAll: (...a) => impl().getAll(...a),
  getById: (...a) => impl().getById(...a),
  create: (...a) => impl().create(...a),
  updateStatus: (...a) => impl().updateStatus(...a),
};
