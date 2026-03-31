const crypto = require("crypto");

function createId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `st_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function dateOnly(str) {
  if (!str) return "";
  return String(str).slice(0, 10);
}

function normalizeStornoCreate(payload = {}) {
  const now = new Date().toISOString();
  return {
    id: payload.id || createId(),
    date: dateOnly(payload.date || now),
    amount: Number(payload.amount) || 0,
    reason: String(payload.reason || "").trim(),
    table: payload.table != null ? String(payload.table).trim() : "",
    orderId: payload.orderId != null ? String(payload.orderId).trim() : "",
    note: payload.note != null ? String(payload.note).trim() : "",
    createdAt: now,
  };
}

const STORNO_KNOWN = new Set([
  "id",
  "date",
  "amount",
  "reason",
  "table",
  "orderId",
  "note",
  "createdAt",
]);

function extraFromRawStorno(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ex = {};
  for (const k of Object.keys(raw)) {
    if (!STORNO_KNOWN.has(k)) ex[k] = raw[k];
  }
  return Object.keys(ex).length ? ex : null;
}

module.exports = {
  createId,
  dateOnly,
  normalizeStornoCreate,
  extraFromRawStorno,
};
