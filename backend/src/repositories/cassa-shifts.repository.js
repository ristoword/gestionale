// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./cassa-shifts.repository.json");
const mysql = require("./mysql/cassa-shifts.repository.mysql");
const { toNumber, normalizeString } = require("./cassa-shifts.repository.helpers");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  CASSA_SHIFTS_FILE: json.getCassaShiftsFilePath,
  ensureFile: async () => {
    if (!useMysqlPersistence()) await json.ensureFile();
  },
  readAll: (...a) => impl().readAll(...a),
  writeAll: (...a) => impl().writeAll(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  getOpenShift: (...a) => impl().getOpenShift(...a),
  getById: (...a) => impl().getById(...a),
  getShiftsByDate: (...a) => impl().getShiftsByDate(...a),
  toNumber,
  normalizeString,
};
