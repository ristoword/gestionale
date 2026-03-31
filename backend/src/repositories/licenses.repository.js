// Router: JSON o MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./licenses.repository.json");
const mysql = require("./mysql/licenses.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  readLicenses: (...a) => impl().readLicenses(...a),
  findByRestaurantId: (...a) => impl().findByRestaurantId(...a),
  findByActivationCode: (...a) => impl().findByActivationCode(...a),
  updateLicense: (...a) => impl().updateLicense(...a),
  hasUsedLicense: (...a) => impl().hasUsedLicense(...a),
  create: (...a) => impl().create(...a),
  codesMatch: json.codesMatch,
  normalizeActivationInput: json.normalizeActivationInput,
};
