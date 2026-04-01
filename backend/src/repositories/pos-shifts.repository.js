// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./pos-shifts.repository.json");
const mysql = require("./mysql/pos-shifts.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  readShifts: (...a) => impl().readShifts(...a),
  writeShifts: (...a) => impl().writeShifts(...a),
  getOpenShift: (...a) => impl().getOpenShift(...a),
  createShift: (...a) => impl().createShift(...a),
  closeShift: (...a) => impl().closeShift(...a),
  getShiftsByDate: (...a) => impl().getShiftsByDate(...a),
  updateShift: (...a) => impl().updateShift(...a),
  toNumber: (...a) => json.toNumber(...a),
  normalizeString: (...a) => json.normalizeString(...a),
};
