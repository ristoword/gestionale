// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./shifts.repository.json");
const mysql = require("./mysql/shifts.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  getAll: (...a) => impl().getAll(...a),
  getByStaffId: (...a) => impl().getByStaffId(...a),
  getByDateRange: (...a) => impl().getByDateRange(...a),
  getById: (...a) => impl().getById(...a),
  create: (...a) => impl().create(...a),
  createMany: (...a) => impl().createMany(...a),
  update: (...a) => impl().update(...a),
  remove: (...a) => impl().remove(...a),
};
