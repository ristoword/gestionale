// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./staff-requests.repository.json");
const mysql = require("./mysql/staff-requests.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  getAll: (...a) => impl().getAll(...a),
  getById: (...a) => impl().getById(...a),
  getByStaffId: (...a) => impl().getByStaffId(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
};
