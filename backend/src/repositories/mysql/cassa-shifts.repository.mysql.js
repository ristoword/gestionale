/**
 * Turni cassa su MySQL — attivo con USE_MYSQL_DATABASE=true.
 */

const tenantContext = require("../../context/tenantContext");
const { getPool } = require("../../db/mysql-pool");
const {
  toNumber,
  normalizeString,
  extraFromRawShift,
} = require("../cassa-shifts.repository.helpers");

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

function rowToShift(row) {
  const ex = parseJson(row.extra);
  const id = Number(row.id);
  return {
    ...ex,
    id,
    shift_id: id,
    opened_at: row.opened_at ? new Date(row.opened_at).toISOString() : ex.opened_at ?? null,
    closed_at: row.closed_at ? new Date(row.closed_at).toISOString() : ex.closed_at ?? null,
    opening_float: Number(row.opening_float),
    cash_total: Number(row.cash_total),
    card_total: Number(row.card_total),
    other_total: Number(row.other_total),
    status: row.status != null ? String(row.status) : ex.status ?? "open",
  };
}

function bindShiftRow(rid, s, extraObj) {
  const id = Number(s.id != null ? s.id : s.shift_id);
  if (!Number.isFinite(id)) return null;
  return [
    rid,
    id,
    s.opened_at ? new Date(s.opened_at) : new Date(),
    s.closed_at ? new Date(s.closed_at) : null,
    toNumber(s.opening_float, 0),
    toNumber(s.cash_total, 0),
    toNumber(s.card_total, 0),
    toNumber(s.other_total, 0),
    normalizeString(s.status, "open"),
    extraObj ? JSON.stringify(extraObj) : null,
  ];
}

async function readAll() {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM cassa_shifts WHERE restaurant_id = ? ORDER BY opened_at DESC",
    [rid]
  );
  return (rows || []).map(rowToShift);
}

async function writeAll(shifts) {
  const rid = getRid();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM cassa_shifts WHERE restaurant_id = ?", [rid]);
    const list = Array.isArray(shifts) ? shifts : [];
    for (const raw of list) {
      const extraObj = extraFromRawShift(raw);
      const params = bindShiftRow(rid, raw, extraObj);
      if (!params) continue;
      await conn.query(
        `INSERT INTO cassa_shifts (
          restaurant_id, id, opened_at, closed_at, opening_float, cash_total, card_total, other_total, status, extra
        ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        params
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

async function nextNumericId() {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT COALESCE(MAX(id), 0) AS m FROM cassa_shifts WHERE restaurant_id = ?",
    [rid]
  );
  const m = rows && rows[0] ? Number(rows[0].m) : 0;
  return Number.isFinite(m) ? m + 1 : 1;
}

async function create(shiftData) {
  const id = await nextNumericId();
  const shift = {
    id,
    shift_id: id,
    opened_at: shiftData.opened_at || new Date().toISOString(),
    closed_at: shiftData.closed_at || null,
    opening_float: toNumber(shiftData.opening_float, 0),
    cash_total: toNumber(shiftData.cash_total, 0),
    card_total: toNumber(shiftData.card_total, 0),
    other_total: toNumber(shiftData.other_total, 0),
    status: normalizeString(shiftData.status, "open"),
  };
  const extraObj = extraFromRawShift(shiftData);
  const rid = getRid();
  const pool = getPool();
  const params = bindShiftRow(rid, shift, extraObj);
  await pool.query(
    `INSERT INTO cassa_shifts (
      restaurant_id, id, opened_at, closed_at, opening_float, cash_total, card_total, other_total, status, extra
    ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
    params
  );
  return shift;
}

async function update(id, updates) {
  const current = await getById(id);
  if (!current) return null;
  const next = {
    ...current,
    ...updates,
    id: current.id,
    shift_id: current.shift_id ?? current.id,
  };
  const extraObj = extraFromRawShift(next);
  const rid = getRid();
  const pool = getPool();
  await pool.query(
    `UPDATE cassa_shifts SET
      opened_at=?, closed_at=?, opening_float=?, cash_total=?, card_total=?, other_total=?, status=?, extra=?
    WHERE restaurant_id=? AND id=?`,
    [
      next.opened_at ? new Date(next.opened_at) : new Date(),
      next.closed_at ? new Date(next.closed_at) : null,
      toNumber(next.opening_float, 0),
      toNumber(next.cash_total, 0),
      toNumber(next.card_total, 0),
      toNumber(next.other_total, 0),
      normalizeString(next.status, "open"),
      extraObj ? JSON.stringify(extraObj) : null,
      rid,
      Number(current.id),
    ]
  );
  return getById(id);
}

async function getOpenShift() {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT * FROM cassa_shifts WHERE restaurant_id = ? AND LOWER(TRIM(COALESCE(status,''))) = 'open'
     ORDER BY opened_at DESC LIMIT 1`,
    [rid]
  );
  if (!rows || !rows.length) return null;
  return rowToShift(rows[0]);
}

async function getById(id) {
  const rid = getRid();
  const pool = getPool();
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  const [rows] = await pool.query(
    "SELECT * FROM cassa_shifts WHERE restaurant_id = ? AND id = ? LIMIT 1",
    [rid, n]
  );
  if (!rows || !rows.length) return null;
  return rowToShift(rows[0]);
}

async function getShiftsByDate(dateStr) {
  const target = String(dateStr || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) return [];
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM cassa_shifts WHERE restaurant_id = ? AND DATE(opened_at) = ? ORDER BY opened_at ASC",
    [rid, target]
  );
  return (rows || []).map(rowToShift);
}

module.exports = {
  readAll,
  writeAll,
  create,
  update,
  getOpenShift,
  getById,
  getShiftsByDate,
};
