// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.
// getDailyData aggrega ordini + pagamenti (repository già routerizzati).

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const ordersRepository = require("./orders.repository");
const paymentsRepository = require("./payments.repository");
const json = require("./reports.repository.json");
const mysql = require("./mysql/reports.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

function isSameDay(dateValue, targetDate) {
  if (!dateValue) return false;
  const d = new Date(dateValue);
  const t = targetDate ? new Date(targetDate) : new Date();
  if (Number.isNaN(d.getTime()) || Number.isNaN(t.getTime())) return false;
  return (
    d.getFullYear() === t.getFullYear() &&
    d.getMonth() === t.getMonth() &&
    d.getDate() === t.getDate()
  );
}

/**
 * Dati giornalieri da ordini e pagamenti (fonte operativa).
 */
async function getDailyData(targetDate = new Date()) {
  const allOrders = await ordersRepository.getAllOrders();
  const allPayments = await paymentsRepository.listPayments({});
  const date = targetDate instanceof Date ? targetDate : new Date(targetDate);

  const orders = allOrders.filter((o) =>
    isSameDay(o.updatedAt || o.createdAt || o.date, date)
  );
  const payments = allPayments.filter((p) =>
    isSameDay(p.closedAt || p.createdAt, date)
  );

  return { orders, payments };
}

module.exports = {
  getDailyData,
  getAll: (...a) => impl().getAll(...a),
  getById: (...a) => impl().getById(...a),
  create: (...a) => impl().create(...a),
  remove: (...a) => impl().remove(...a),
};
