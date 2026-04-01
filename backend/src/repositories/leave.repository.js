// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./leave.repository.json");
const mysql = require("./mysql/leave.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  readLeaveRequests: (...a) => impl().readLeaveRequests(...a),
  writeLeaveRequests: (...a) => impl().writeLeaveRequests(...a),
  createLeaveRequest: (...a) => impl().createLeaveRequest(...a),
  findLeaveById: (...a) => impl().findLeaveById(...a),
  updateLeaveRequest: (...a) => impl().updateLeaveRequest(...a),
  getOrInitUserBalances: (...a) => impl().getOrInitUserBalances(...a),
  updateUserBalances: (...a) => impl().updateUserBalances(...a),
  defaultBalances: (...a) => impl().defaultBalances(...a),
  dateOnly: (...a) => impl().dateOnly(...a),
  hasOverlap: (...a) => impl().hasOverlap(...a),
};
