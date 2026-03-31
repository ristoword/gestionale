// backend/src/repositories/users.repository.js
// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.
// Tutti i metodi dati sono async e restituiscono Promise.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./users.repository.json");
const mysql = require("./mysql/users.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  get DEFAULT_LEAVE_BALANCES() {
    return json.DEFAULT_LEAVE_BALANCES;
  },
  ensureLeaveBalances: json.ensureLeaveBalances.bind(json),

  readUsers: (...a) => impl().readUsers(...a),
  writeUsers: (...a) => impl().writeUsers(...a),
  findByCredentials: (...a) => impl().findByCredentials(...a),
  findByUsername: (...a) => impl().findByUsername(...a),
  findById: (...a) => impl().findById(...a),
  findByRestaurantId: (...a) => impl().findByRestaurantId(...a),
  createUser: (...a) => impl().createUser(...a),
  updateUser: (...a) => impl().updateUser(...a),
  findOwnerByRestaurantId: (...a) => impl().findOwnerByRestaurantId(...a),
  setUserPassword: (...a) => impl().setUserPassword(...a),
};
