// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./catering-presets.repository.json");
const mysql = require("./mysql/catering-presets.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  SECTION_TYPES: json.SECTION_TYPES,
  ITEM_MODES: json.ITEM_MODES,
  ITEM_UNITS: json.ITEM_UNITS,
  getAll: (...a) => impl().getAll(...a),
  getById: (...a) => impl().getById(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  remove: (...a) => impl().remove(...a),
};
