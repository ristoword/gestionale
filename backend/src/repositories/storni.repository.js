// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./storni.repository.json");
const mysql = require("./mysql/storni.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  ensureFile: async () => {
    if (!useMysqlPersistence()) await json.ensureFile();
  },
  readEntries: (...a) => impl().readEntries(...a),
  listByDateRange: (...a) => impl().listByDateRange(...a),
  getTotalByDate: (...a) => impl().getTotalByDate(...a),
  create: (...a) => impl().create(...a),
  deleteById: (...a) => impl().deleteById(...a),
};
