// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./closures.repository.json");
const mysql = require("./mysql/closures.repository.mysql");
const { normalizeClosureInput } = require("./closures.repository.helpers");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  CLOSURES_FILE: json.CLOSURES_FILE,
  ensureClosuresFile: async () => {
    if (!useMysqlPersistence()) await json.ensureClosuresFile();
  },
  readAllClosures: (...a) => impl().readAllClosures(...a),
  writeAllClosures: (...a) => impl().writeAllClosures(...a),
  createClosure: (...a) => impl().createClosure(...a),
  listClosures: (...a) => impl().listClosures(...a),
  getClosureByDate: (...a) => impl().getClosureByDate(...a),
  getClosureById: (...a) => impl().getClosureById(...a),
  isDayClosed: (...a) => impl().isDayClosed(...a),
  normalizeClosureInput,
};
