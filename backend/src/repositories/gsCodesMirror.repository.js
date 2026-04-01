// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./gsCodesMirror.repository.json");
const mysql = require("./mysql/gsCodesMirror.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  normalizeCode: (...a) => impl().normalizeCode(...a),
  readState: (...a) => impl().readState(...a),
  upsertBatch: (...a) => impl().upsertBatch(...a),
  findByCode: (...a) => impl().findByCode(...a),
  markUsedLocal: (...a) => impl().markUsedLocal(...a),
  computeStats: (...a) => impl().computeStats(...a),
  touchNotifyToGs: (...a) => impl().touchNotifyToGs(...a),
  generateLocalCodes: (...a) => impl().generateLocalCodes(...a),
  claimAvailableForStripe: (...a) => impl().claimAvailableForStripe(...a),
};
