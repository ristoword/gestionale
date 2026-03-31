const crypto = require("crypto");

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `cls_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeString(v, fallback = "") {
  if (v == null) return fallback;
  return String(v).trim();
}

function normalizeClosureInput(input = {}) {
  const nowIso = new Date().toISOString();
  return {
    id: input.id || createId(),
    date: normalizeString(input.date, ""),
    cashTotal: toNumber(input.cashTotal, 0),
    cardTotal: toNumber(input.cardTotal, 0),
    otherTotal: toNumber(input.otherTotal, 0),
    grandTotal: toNumber(input.grandTotal, 0),
    storniTotal: toNumber(input.storniTotal, 0),
    netTotal: toNumber(input.netTotal, 0),
    paymentsCount: toNumber(input.paymentsCount, 0),
    closedOrdersCount: toNumber(input.closedOrdersCount, 0),
    covers: toNumber(input.covers, 0),
    closedAt: input.closedAt || nowIso,
    closedBy: normalizeString(input.closedBy, ""),
    notes: normalizeString(input.notes, ""),
    createdAt: input.createdAt || nowIso,
  };
}

const CLOSURE_KNOWN_KEYS = new Set([
  "id",
  "date",
  "cashTotal",
  "cardTotal",
  "otherTotal",
  "grandTotal",
  "storniTotal",
  "netTotal",
  "paymentsCount",
  "closedOrdersCount",
  "covers",
  "closedAt",
  "closedBy",
  "notes",
  "createdAt",
]);

function extraFromRawClosure(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ex = {};
  for (const k of Object.keys(raw)) {
    if (!CLOSURE_KNOWN_KEYS.has(k)) ex[k] = raw[k];
  }
  return Object.keys(ex).length ? ex : null;
}

/** YYYY-MM-DD per colonna DATE; fallback da closedAt/createdAt/today. */
function resolveClosureDateOnly(c) {
  let d = String(c.date || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const alt = String(c.closedAt || c.createdAt || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(alt)) return alt;
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  createId,
  toNumber,
  normalizeString,
  normalizeClosureInput,
  extraFromRawClosure,
  resolveClosureDateOnly,
  CLOSURE_KNOWN_KEYS,
};
