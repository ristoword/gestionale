// Condiviso tra payments.repository.json e mysql (nessuna dipendenza da storage).

const crypto = require("crypto");

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `pay_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeString(value, fallback = "") {
  if (value == null) return fallback;
  return String(value).trim();
}

function normalizePaymentInput(input = {}) {
  const nowIso = new Date().toISOString();

  return {
    id: input.id || createId(),
    table: normalizeString(input.table, "-"),
    orderIds: Array.isArray(input.orderIds)
      ? input.orderIds.map((id) => normalizeString(id)).filter(Boolean)
      : [],
    subtotal: toNumber(input.subtotal, 0),
    discountAmount: toNumber(input.discountAmount, 0),
    discountType: normalizeString(input.discountType, "none"),
    discountReason: normalizeString(input.discountReason, ""),
    vatPercent: toNumber(input.vatPercent, 0),
    vatAmount: toNumber(input.vatAmount, 0),
    total: toNumber(input.total, 0),
    paymentMethod: normalizeString(input.paymentMethod, "unknown"),
    amountReceived: toNumber(input.amountReceived, 0),
    changeAmount: toNumber(input.changeAmount, 0),
    covers: toNumber(input.covers, 0),
    operator: normalizeString(input.operator, ""),
    note: normalizeString(input.note, ""),
    customerName: normalizeString(input.customerName, ""),
    customerId: normalizeString(input.customerId, ""),
    companyName: normalizeString(input.companyName, ""),
    vatNumber: normalizeString(input.vatNumber, ""),
    status: normalizeString(input.status, "closed"),
    createdAt: input.createdAt || nowIso,
    updatedAt: nowIso,
    closedAt: input.closedAt || nowIso,
  };
}

function matchesFilters(payment, filters = {}) {
  if (filters.id && payment.id !== filters.id) return false;
  if (filters.table && String(payment.table) !== String(filters.table)) return false;
  if (
    filters.paymentMethod &&
    String(payment.paymentMethod).toLowerCase() !== String(filters.paymentMethod).toLowerCase()
  ) {
    return false;
  }
  if (
    filters.operator &&
    String(payment.operator).toLowerCase() !== String(filters.operator).toLowerCase()
  ) {
    return false;
  }
  if (
    filters.status &&
    String(payment.status).toLowerCase() !== String(filters.status).toLowerCase()
  ) {
    return false;
  }

  if (filters.dateFrom) {
    const fromTs = new Date(filters.dateFrom).getTime();
    const payTs = new Date(payment.closedAt || payment.createdAt).getTime();
    if (Number.isFinite(fromTs) && payTs < fromTs) return false;
  }

  if (filters.dateTo) {
    const toTs = new Date(filters.dateTo).getTime();
    const payTs = new Date(payment.closedAt || payment.createdAt).getTime();
    if (Number.isFinite(toTs) && payTs > toTs) return false;
  }

  return true;
}

function computePaymentsSummary(payments) {
  const summary = {
    count: payments.length,
    gross: 0,
    discountAmount: 0,
    vatAmount: 0,
    net: 0,
    covers: 0,
    byMethod: {},
  };

  for (const payment of payments) {
    const subtotal = toNumber(payment.subtotal, 0);
    const discountAmount = toNumber(payment.discountAmount, 0);
    const vatAmount = toNumber(payment.vatAmount, 0);
    const total = toNumber(payment.total, 0);
    const covers = toNumber(payment.covers, 0);
    const method = normalizeString(payment.paymentMethod, "unknown");

    summary.gross += subtotal;
    summary.discountAmount += discountAmount;
    summary.vatAmount += vatAmount;
    summary.net += total;
    summary.covers += covers;

    if (!summary.byMethod[method]) {
      summary.byMethod[method] = {
        count: 0,
        total: 0,
      };
    }

    summary.byMethod[method].count += 1;
    summary.byMethod[method].total += total;
  }

  return summary;
}

/** Chiavi mappate su colonne DB / normalizePaymentInput — il resto va in `extra`. */
const PAYMENT_KNOWN_KEYS = new Set([
  "id",
  "table",
  "orderIds",
  "subtotal",
  "discountAmount",
  "discountType",
  "discountReason",
  "vatPercent",
  "vatAmount",
  "total",
  "paymentMethod",
  "amountReceived",
  "changeAmount",
  "covers",
  "operator",
  "note",
  "customerName",
  "customerId",
  "companyName",
  "vatNumber",
  "status",
  "createdAt",
  "updatedAt",
  "closedAt",
]);

function extraFromRawPayment(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ex = {};
  for (const k of Object.keys(raw)) {
    if (!PAYMENT_KNOWN_KEYS.has(k)) ex[k] = raw[k];
  }
  return Object.keys(ex).length ? ex : null;
}

module.exports = {
  createId,
  toNumber,
  normalizeString,
  normalizePaymentInput,
  matchesFilters,
  computePaymentsSummary,
  PAYMENT_KNOWN_KEYS,
  extraFromRawPayment,
};
