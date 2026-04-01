// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./attendance.repository.json");
const mysql = require("./mysql/attendance.repository.mysql");

function impl() { return useMysqlPersistence() ? mysql : json; }

module.exports = {
  MAX_SHIFT_HOURS: json.MAX_SHIFT_HOURS,
  dateOnly: (...a) => impl().dateOnly(...a),
  readAttendance: (...a) => impl().readAttendance(...a),
  writeAttendance: (...a) => impl().writeAttendance(...a),
  findOpenShiftByUser: (...a) => impl().findOpenShiftByUser(...a),
  listByRestaurant: (...a) => impl().listByRestaurant(...a),
  listByUser: (...a) => impl().listByUser(...a),
  createShift: (...a) => impl().createShift(...a),
  closeShift: (...a) => impl().closeShift(...a),
  updateShift: (...a) => impl().updateShift(...a),
  markAnomaly: (...a) => impl().markAnomaly(...a),
  createAnomalyRecord: (...a) => impl().createAnomalyRecord(...a),
  getDailySummary: (...a) => impl().getDailySummary(...a),
  getWorkedMinutesBetween: (...a) => impl().getWorkedMinutesBetween(...a),
  checkShiftTooLong: (...a) => impl().checkShiftTooLong(...a),
};
