// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./devices.repository.json");
const mysql = require("./mysql/devices.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  DEPARTMENTS: json.DEPARTMENTS,
  DEVICE_TYPES: json.DEVICE_TYPES,
  CONNECTION_TYPES: json.CONNECTION_TYPES,
  getAll: (...a) => impl().getAll(...a),
  getById: (...a) => impl().getById(...a),
  getByDepartment: (...a) => impl().getByDepartment(...a),
  getDefaultForDepartment: (...a) => impl().getDefaultForDepartment(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  remove: (...a) => impl().remove(...a),
};
