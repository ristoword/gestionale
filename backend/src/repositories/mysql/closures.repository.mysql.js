/**
 * Chiusure giornaliere (Z) su MySQL — attivo con USE_MYSQL_DATABASE=true.
 */

const tenantContext = require("../../context/tenantContext");
const { getPool } = require("../../db/mysql-pool");
const {
  normalizeClosureInput,
  extraFromRawClosure,
  resolveClosureDateOnly,
} = require("../closures.repository.helpers");

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

function rowToClosure(row) {
  const ex = parseJson(row.extra);
  const dateStr = sqlDateToStr(row.closure_date);
  return {
    ...ex,
    id: String(row.id),
    date: dateStr,
    cashTotal: Number(row.cash_total),
    cardTotal: Number(row.card_total),
    otherTotal: Number(row.other_total),
    grandTotal: Number(row.grand_total),
    storniTotal: Number(row.storni_total),
    netTotal: Number(row.net_total),
    paymentsCount: row.payments_count != null ? Number(row.payments_count) : 0,
    closedOrdersCount: row.closed_orders_count != null ? Number(row.closed_orders_count) : 0,
    covers: row.covers != null ? Number(row.covers) : 0,
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : ex.closedAt,
    closedBy: row.closed_by != null ? String(row.closed_by) : ex.closedBy ?? "",
    notes: row.notes != null ? String(row.notes) : ex.notes ?? "",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : ex.createdAt,
  };
}

function bindParams(rid, c, extraObj) {
  const dateOnly = resolveClosureDateOnly(c);
  return [
    rid,
    String(c.id),
    dateOnly,
    c.cashTotal,
    c.cardTotal,
    c.otherTotal,
    c.grandTotal,
    c.storniTotal,
    c.netTotal,
    c.paymentsCount,
    c.closedOrdersCount,
    c.covers,
    c.closedAt ? new Date(c.closedAt) : new Date(),
    c.closedBy,
    c.notes,
    c.createdAt ? new Date(c.createdAt) : new Date(),
    extraObj ? JSON.stringify(extraObj) : null,
  ];
}

async function readAllClosures() {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM closures WHERE restaurant_id = ? ORDER BY closure_date DESC",
    [rid]
  );
  return (rows || []).map(rowToClosure);
}

async function writeAllClosures(closures) {
  const rid = getRid();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM closures WHERE restaurant_id = ?", [rid]);
    const list = Array.isArray(closures) ? closures : [];
    for (const raw of list) {
      const c = normalizeClosureInput(raw);
      const extraObj = extraFromRawClosure(raw);
      await conn.query(
        `INSERT INTO closures (
          restaurant_id, id, closure_date, cash_total, card_total, other_total, grand_total,
          storni_total, net_total, payments_count, closed_orders_count, covers,
          closed_at, closed_by, notes, created_at, extra
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        bindParams(rid, c, extraObj)
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function createClosure(payload) {
  const c = normalizeClosureInput(payload);
  const extraObj = extraFromRawClosure(payload);
  const rid = getRid();
  const pool = getPool();
  await pool.query(
    `INSERT INTO closures (
      restaurant_id, id, closure_date, cash_total, card_total, other_total, grand_total,
      storni_total, net_total, payments_count, closed_orders_count, covers,
      closed_at, closed_by, notes, created_at, extra
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    bindParams(rid, c, extraObj)
  );
  return { ...c, date: resolveClosureDateOnly(c) };
}

async function listClosures(filters = {}) {
  const rid = getRid();
  const pool = getPool();
  let sql = "SELECT * FROM closures WHERE restaurant_id = ?";
  const params = [rid];
  if (filters.dateFrom) {
    sql += " AND closure_date >= ?";
    params.push(String(filters.dateFrom).slice(0, 10));
  }
  if (filters.dateTo) {
    sql += " AND closure_date <= ?";
    params.push(String(filters.dateTo).slice(0, 10));
  }
  sql += " ORDER BY closure_date DESC";
  const [rows] = await pool.query(sql, params);
  return (rows || []).map(rowToClosure);
}

async function getClosureByDate(dateStr) {
  const rid = getRid();
  const d = String(dateStr || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM closures WHERE restaurant_id = ? AND closure_date = ? ORDER BY closed_at DESC LIMIT 1",
    [rid, d]
  );
  if (!rows || !rows.length) return null;
  return rowToClosure(rows[0]);
}

async function getClosureById(id) {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM closures WHERE restaurant_id = ? AND id = ? LIMIT 1",
    [rid, String(id)]
  );
  if (!rows || !rows.length) return null;
  return rowToClosure(rows[0]);
}

async function isDayClosed(dateStr) {
  const c = await getClosureByDate(dateStr);
  return !!c;
}

module.exports = {
  readAllClosures,
  writeAllClosures,
  createClosure,
  listClosures,
  getClosureByDate,
  getClosureById,
  isDayClosed,
};
