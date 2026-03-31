// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./payments.repository.json");
const mysql = require("./mysql/payments.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  PAYMENTS_FILE: json.PAYMENTS_FILE,
  ensurePaymentsFile: async () => {
    if (!useMysqlPersistence()) await json.ensurePaymentsFile();
  },
  readAllPayments: (...a) => impl().readAllPayments(...a),
  writeAllPayments: (...a) => impl().writeAllPayments(...a),
  listPayments: (...a) => impl().listPayments(...a),
  getPaymentById: (...a) => impl().getPaymentById(...a),
  findByOrderIds: (...a) => impl().findByOrderIds(...a),
  createPayment: (...a) => impl().createPayment(...a),
  updatePayment: (...a) => impl().updatePayment(...a),
  deletePayment: (...a) => impl().deletePayment(...a),
  getPaymentsSummary: (...a) => impl().getPaymentsSummary(...a),
};
