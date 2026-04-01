// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./print-routes.repository.json");
const mysql = require("./mysql/print-routes.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  EVENT_TYPES: json.EVENT_TYPES,
  getAll: (...a) => impl().getAll(...a),
  getById: (...a) => impl().getById(...a),
  findByEventAndDepartment: (...a) => impl().findByEventAndDepartment(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  remove: (...a) => impl().remove(...a),
};
