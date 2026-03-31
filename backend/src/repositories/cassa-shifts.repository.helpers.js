function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeString(v, fallback = "") {
  if (v == null) return fallback;
  return String(v).trim();
}

function getNextNumericId(shifts) {
  const ids = (shifts || []).map((s) => Number(s.id)).filter((n) => Number.isFinite(n));
  if (ids.length === 0) return 1;
  return Math.max(...ids) + 1;
}

const SHIFT_KEYS = new Set([
  "id",
  "shift_id",
  "opened_at",
  "closed_at",
  "opening_float",
  "cash_total",
  "card_total",
  "other_total",
  "status",
]);

function extraFromRawShift(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ex = {};
  for (const k of Object.keys(raw)) {
    if (!SHIFT_KEYS.has(k)) ex[k] = raw[k];
  }
  return Object.keys(ex).length ? ex : null;
}

module.exports = {
  toNumber,
  normalizeString,
  getNextNumericId,
  extraFromRawShift,
};
