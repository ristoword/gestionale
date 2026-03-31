/**
 * Report salvati (reports.json) su MySQL — attivo con USE_MYSQL_DATABASE=true.
 * Nota: getDailyData resta nel router e usa orders + payments.
 */

const tenantContext = require("../../context/tenantContext");
const { getPool } = require("../../db/mysql-pool");
const {
  normalizeReportForCreate,
  reportDateForSql,
  extraFromRawReport,
} = require("../reports.repository.helpers");

function getRid() {
  return String(tenantContext.getRestaurantId() || tenantContext.DEFAULT_TENANT);
}

function parseJson(val) {
  if (val == null) return {};
  if (typeof val === "object" && !Buffer.isBuffer(val)) return { ...val };
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }
  return {};
}

function sqlDateToStr(v) {
  if (v == null) return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
}

function rowToReport(row) {
  const ex = parseJson(row.extra);
  const dateStr = row.report_date != null ? sqlDateToStr(row.report_date) : ex.date ?? "";
  return {
    ...ex,
    id: String(row.id),
    date: dateStr,
    revenue: Number(row.revenue),
    covers: row.covers != null ? Number(row.covers) : 0,
    note: row.note != null ? String(row.note) : ex.note ?? "",
  };
}

async function getAll() {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM saved_reports WHERE restaurant_id = ? ORDER BY report_date IS NULL, report_date DESC, id ASC",
    [rid]
  );
  return (rows || []).map(rowToReport);
}

async function getById(id) {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM saved_reports WHERE restaurant_id = ? AND id = ? LIMIT 1",
    [rid, String(id)]
  );
  if (!rows || !rows.length) return null;
  return rowToReport(rows[0]);
}

async function create(data) {
  const r = normalizeReportForCreate(data);
  const extraObj = extraFromRawReport(data);
  const rid = getRid();
  const pool = getPool();
  const rd = reportDateForSql(r.date);
  await pool.query(
    `INSERT INTO saved_reports (restaurant_id, id, report_date, revenue, covers, note, extra)
     VALUES (?,?,?,?,?,?,?)`,
    [rid, String(r.id), rd, r.revenue, r.covers, r.note, extraObj ? JSON.stringify(extraObj) : null]
  );
  return r;
}

async function remove(id) {
  const rid = getRid();
  const pool = getPool();
  const [res] = await pool.query("DELETE FROM saved_reports WHERE restaurant_id = ? AND id = ?", [
    rid,
    String(id),
  ]);
  return res && res.affectedRows > 0;
}

module.exports = {
  getAll,
  getById,
  create,
  remove,
};
