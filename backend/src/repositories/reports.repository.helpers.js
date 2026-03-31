const { v4: uuid } = require("uuid");

function normalizeReportForCreate(data = {}) {
  return {
    id: data.id || uuid(),
    date: data.date != null ? String(data.date).trim() : "",
    revenue: Number(data.revenue) || 0,
    covers: Number(data.covers) || 0,
    note: data.note != null ? String(data.note).trim() : "",
  };
}

function reportDateForSql(dateStr) {
  const d = String(dateStr || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

const REPORT_ROW_KEYS = new Set(["id", "date", "revenue", "covers", "note"]);

function extraFromRawReport(raw) {
  if (!raw || typeof raw !== "object") return null;
  const ex = {};
  for (const k of Object.keys(raw)) {
    if (!REPORT_ROW_KEYS.has(k)) ex[k] = raw[k];
  }
  return Object.keys(ex).length ? ex : null;
}

module.exports = {
  normalizeReportForCreate,
  reportDateForSql,
  extraFromRawReport,
  REPORT_ROW_KEYS,
};
