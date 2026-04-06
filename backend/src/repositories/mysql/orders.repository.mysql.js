/**
 * Ordini su MySQL — attivo con USE_MYSQL_DATABASE=true.
 * Chiave tenant: restaurant_id (AsyncLocalStorage via tenantContext).
 */

const tenantContext = require("../../context/tenantContext");
const { getPool } = require("../../db/mysql-pool");

const ORDER_EXTRA_SKIP = new Set([
  "id",
  "table",
  "covers",
  "area",
  "waiter",
  "notes",
  "status",
  "createdAt",
  "updatedAt",
  "items",
]);

function parseJsonCol(val) {
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

function buildOrderExtraForDb(order) {
  const ex = {};
  for (const [k, v] of Object.entries(order || {})) {
    if (!ORDER_EXTRA_SKIP.has(k)) ex[k] = v;
  }
  return Object.keys(ex).length ? ex : null;
}

function rowToItem(row) {
  const ex = parseJsonCol(row.extra);
  const base = {
    name: row.name != null ? String(row.name) : "",
    qty: row.qty != null ? Number(row.qty) : 1,
    area: row.area != null ? String(row.area) : undefined,
    category: row.category != null ? String(row.category) : undefined,
    type: row.type != null ? String(row.type) : undefined,
    notes: row.notes != null ? String(row.notes) : "",
  };
  const merged = { ...ex, ...base };
  /* course vive in extra JSON: non deve essere perso (multi-portata). */
  if (ex && ex.course != null) {
    const cn = Number(ex.course);
    merged.course = Number.isFinite(cn) && cn >= 1 ? Math.floor(cn) : 1;
  } else if (merged.course != null) {
    const cn = Number(merged.course);
    merged.course = Number.isFinite(cn) && cn >= 1 ? Math.floor(cn) : 1;
  }
  return merged;
}

function rowToOrder(row, items) {
  const ex = parseJsonCol(row.extra);
  return {
    ...ex,
    id: Number(row.id),
    table: row.table_num != null ? Number(row.table_num) : ex.table ?? null,
    covers: row.covers != null ? Number(row.covers) : ex.covers ?? null,
    area: row.area != null ? String(row.area) : ex.area,
    waiter: row.waiter != null ? String(row.waiter) : ex.waiter,
    notes: row.notes != null ? String(row.notes) : ex.notes,
    status: row.status != null ? String(row.status) : ex.status,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : ex.createdAt,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ex.updatedAt,
    items: items || [],
  };
}

function itemToDbRow(restaurantId, orderId, idx, line) {
  const l = line || {};
  const { name, qty, area, category, type, notes, ...rest } = l;
  const extra = Object.keys(rest).length ? JSON.stringify(rest) : null;
  return [
    restaurantId,
    orderId,
    idx,
    name != null ? String(name) : null,
    qty != null ? Number(qty) : 1,
    area != null ? String(area) : null,
    category != null ? String(category) : null,
    type != null ? String(type) : null,
    notes != null ? String(notes) : null,
    extra,
  ];
}

function getRid() {
  return String(tenantContext.getRestaurantId() || tenantContext.DEFAULT_TENANT);
}

async function getAllOrders() {
  const rid = getRid();
  const pool = getPool();
  const [orderRows] = await pool.query(
    "SELECT * FROM orders WHERE restaurant_id = ? ORDER BY id ASC",
    [rid]
  );
  const [itemRows] = await pool.query(
    "SELECT * FROM order_items WHERE restaurant_id = ? ORDER BY order_id ASC, line_index ASC",
    [rid]
  );
  const byOrder = new Map();
  for (const r of itemRows || []) {
    const oid = Number(r.order_id);
    if (!byOrder.has(oid)) byOrder.set(oid, []);
    byOrder.get(oid).push(rowToItem(r));
  }
  return (orderRows || []).map((row) => rowToOrder(row, byOrder.get(Number(row.id)) || []));
}

async function getOrderById(id) {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM orders WHERE restaurant_id = ? AND id = ?", [
    rid,
    Number(id),
  ]);
  if (!rows || !rows.length) return null;
  const [items] = await pool.query(
    "SELECT * FROM order_items WHERE restaurant_id = ? AND order_id = ? ORDER BY line_index ASC",
    [rid, Number(id)]
  );
  return rowToOrder(rows[0], (items || []).map(rowToItem));
}

async function saveAllOrders(orders) {
  const rid = getRid();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM order_items WHERE restaurant_id = ?", [rid]);
    await conn.query("DELETE FROM orders WHERE restaurant_id = ?", [rid]);
    const list = Array.isArray(orders) ? orders : [];
    for (const o of list) {
      const oid = Number(o.id);
      if (!Number.isFinite(oid)) continue;
      const tableNum = o.table != null ? Number(o.table) : null;
      const covers = o.covers != null ? Number(o.covers) : null;
      const extraObj = buildOrderExtraForDb(o);
      await conn.query(
        `INSERT INTO orders (
          restaurant_id, id, table_num, covers, area, waiter, notes, status, created_at, updated_at, extra
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
        [
          rid,
          oid,
          Number.isFinite(tableNum) ? tableNum : null,
          Number.isFinite(covers) ? covers : null,
          o.area != null ? String(o.area) : null,
          o.waiter != null ? String(o.waiter) : null,
          o.notes != null ? String(o.notes) : null,
          o.status != null ? String(o.status) : null,
          o.createdAt ? new Date(o.createdAt) : new Date(),
          o.updatedAt ? new Date(o.updatedAt) : new Date(),
          extraObj ? JSON.stringify(extraObj) : null,
        ]
      );
      const items = Array.isArray(o.items) ? o.items : [];
      if (items.length > 0) {
        const bulk = items.map((line, idx) => itemToDbRow(rid, oid, idx, line));
        await conn.query(
          "INSERT INTO order_items (restaurant_id, order_id, line_index, name, qty, area, category, type, notes, extra) VALUES ?",
          [bulk]
        );
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  getAllOrders,
  saveAllOrders,
  getOrderById,
};
