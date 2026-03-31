// Router: JSON o MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./restaurants.repository.json");
const mysql = require("./mysql/restaurants.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  generateId: json.generateId,
  readRestaurants: (...a) => impl().readRestaurants(...a),
  writeRestaurants: (...a) => impl().writeRestaurants(...a),
  findBySlug: (...a) => impl().findBySlug(...a),
  findById: (...a) => impl().findById(...a),
  findByAdminEmail: (...a) => impl().findByAdminEmail(...a),
  create: (...a) => impl().create(...a),
};
