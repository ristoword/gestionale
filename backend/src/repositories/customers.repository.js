// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./customers.repository.json");
const mysql = require("./mysql/customers.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  getAll: (...a) => impl().getAll(...a),
  getById: (...a) => impl().getById(...a),
  findByPhone: (...a) => impl().findByPhone(...a),
  findByEmail: (...a) => impl().findByEmail(...a),
  searchByNameOrPhone: (...a) => impl().searchByNameOrPhone(...a),
  create: (...a) => impl().create(...a),
  update: (...a) => impl().update(...a),
  buildCustomer: (...a) => impl().buildCustomer(...a),
};
