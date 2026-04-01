// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./sessions.repository.json");
const mysql = require("./mysql/sessions.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  SESSIONS_FILE: json.SESSIONS_FILE,
  readAllSessions: (...a) => impl().readAllSessions(...a),
  createSession: (...a) => impl().createSession(...a),
  endSession: (...a) => impl().endSession(...a),
  endSessionByUserId: (...a) => impl().endSessionByUserId(...a),
  getActiveSessions: (...a) => impl().getActiveSessions(...a),
};
