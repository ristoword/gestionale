// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./catering.repository.json");
const mysql = require("./mysql/catering.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  getAll: (...a) => impl().getAll(...a),
  getById: (...a) => impl().getById(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  remove: (...a) => impl().remove(...a),
  createFromPreset: (...a) => impl().createFromPreset(...a),
};
