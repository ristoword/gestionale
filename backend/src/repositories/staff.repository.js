// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./staff.repository.json");
const mysql = require("./mysql/staff.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  getAll: (...a) => impl().getAll(...a),
  getAllFiltered: (...a) => impl().getAllFiltered(...a),
  getById: (...a) => impl().getById(...a),
  getByDepartment: (...a) => impl().getByDepartment(...a),
  getManagers: (...a) => impl().getManagers(...a),
  getOperational: (...a) => impl().getOperational(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  remove: (...a) => impl().remove(...a),
  addDiscipline: (...a) => impl().addDiscipline(...a),
};
