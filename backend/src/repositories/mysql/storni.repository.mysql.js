/**
 * Storni su MySQL — attivo con USE_MYSQL_DATABASE=true.
 */

const tenantContext = require("../../context/tenantContext");
const { getPool } = require("../../db/mysql-pool");
const {
  dateOnly,
  normalizeStornoCreate,
  extraFromRawStorno,
} = require("../storni.repository.helpers");

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

function rowToEntry(row) {
  const ex = parseJson(row.extra);
  return {
    ...ex,
    id: String(row.id),
    date: sqlDateToStr(row.entry_date),
    amount: Number(row.amount),
    reason: row.reason != null ? String(row.reason) : ex.reason ?? "",
    table: row.table_ref != null ? String(row.table_ref) : ex.table ?? "",
    orderId: row.order_ref != null ? String(row.order_ref) : ex.orderId ?? "",
    note: row.note != null ? String(row.note) : ex.note ?? "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : ex.createdAt,
  };
}

async function readEntries() {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM storni_entries WHERE restaurant_id = ? ORDER BY created_at DESC",
    [rid]
  );
  return (rows || []).map(rowToEntry);
}

async function listByDateRange(dateFrom, dateTo) {
  const rid = getRid();
  const pool = getPool();
  const from = dateFrom ? dateOnly(dateFrom) : null;
  const to = dateTo ? dateOnly(dateTo) : null;
  let sql = "SELECT * FROM storni_entries WHERE restaurant_id = ?";
  const params = [rid];
  if (from) {
    sql += " AND entry_date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND entry_date <= ?";
    params.push(to);
  }
  sql += " ORDER BY created_at DESC";
  const [rows] = await pool.query(sql, params);
  return (rows || []).map(rowToEntry);
}

async function getTotalByDate(dateStr) {
  const rid = getRid();
  const d = dateOnly(dateStr);
  if (!d) return 0;
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS t FROM storni_entries WHERE restaurant_id = ? AND entry_date = ?",
    [rid, d]
  );
  return Number(rows && rows[0] ? rows[0].t : 0) || 0;
}

async function create(payload) {
  const e = normalizeStornoCreate(payload);
  const extraObj = extraFromRawStorno(payload);
  const rid = getRid();
  const pool = getPool();
  const ed = dateOnly(e.date) || dateOnly(e.createdAt);
  await pool.query(
    `INSERT INTO storni_entries (
      restaurant_id, id, entry_date, amount, reason, table_ref, order_ref, note, created_at, extra
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      rid,
      String(e.id),
      ed || dateOnly(new Date().toISOString()),
      e.amount,
      e.reason,
      e.table || null,
      e.orderId || null,
      e.note || null,
      new Date(e.createdAt),
      extraObj ? JSON.stringify(extraObj) : null,
    ]
  );
  return e;
}

async function deleteById(id) {
  const rid = getRid();
  const pool = getPool();
  const [res] = await pool.query("DELETE FROM storni_entries WHERE restaurant_id = ? AND id = ?", [
    rid,
    String(id),
  ]);
  return res && res.affectedRows > 0;
}

module.exports = {
  readEntries,
  listByDateRange,
  getTotalByDate,
  create,
  deleteById,
};
