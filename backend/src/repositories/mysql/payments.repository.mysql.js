/**
 * Pagamenti su MySQL — attivo con USE_MYSQL_DATABASE=true.
 */

const tenantContext = require("../../context/tenantContext");
const { getPool } = require("../../db/mysql-pool");
const {
  normalizePaymentInput,
  matchesFilters,
  computePaymentsSummary,
  extraFromRawPayment,
} = require("../payments.repository.helpers");

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

function parseOrderIds(raw) {
  let orderIds = raw;
  if (Buffer.isBuffer(orderIds)) {
    try {
      orderIds = JSON.parse(orderIds.toString("utf8"));
    } catch {
      return [];
    }
  } else if (typeof orderIds === "string") {
    try {
      orderIds = JSON.parse(orderIds);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(orderIds)) return [];
  return orderIds.map((x) => String(x));
}

function rowToPayment(row) {
  const ex = parseJson(row.extra);
  const orderIds = parseOrderIds(row.order_ids);

  return {
    ...ex,
    id: String(row.id),
    table: row.table_ref != null ? String(row.table_ref) : ex.table ?? "-",
    orderIds,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discount_amount),
    discountType: row.discount_type != null ? String(row.discount_type) : ex.discountType ?? "none",
    discountReason:
      row.discount_reason != null ? String(row.discount_reason) : ex.discountReason ?? "",
    vatPercent: Number(row.vat_percent),
    vatAmount: Number(row.vat_amount),
    total: Number(row.total),
    paymentMethod:
      row.payment_method != null ? String(row.payment_method) : ex.paymentMethod ?? "unknown",
    amountReceived: Number(row.amount_received),
    changeAmount: Number(row.change_amount),
    covers: row.covers != null ? Number(row.covers) : 0,
    operator: row.operator != null ? String(row.operator) : ex.operator ?? "",
    note: row.note != null ? String(row.note) : ex.note ?? "",
    customerName: row.customer_name != null ? String(row.customer_name) : ex.customerName ?? "",
    customerId: row.customer_id != null ? String(row.customer_id) : ex.customerId ?? "",
    companyName: row.company_name != null ? String(row.company_name) : ex.companyName ?? "",
    vatNumber: row.vat_number != null ? String(row.vat_number) : ex.vatNumber ?? "",
    status: row.status != null ? String(row.status) : ex.status ?? "closed",
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : ex.createdAt,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : ex.updatedAt,
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : ex.closedAt,
  };
}

function bindPaymentParams(rid, p, extraObj) {
  return [
    rid,
    String(p.id),
    p.table != null ? String(p.table) : null,
    JSON.stringify(Array.isArray(p.orderIds) ? p.orderIds : []),
    p.subtotal,
    p.discountAmount,
    p.discountType,
    p.discountReason,
    p.vatPercent,
    p.vatAmount,
    p.total,
    p.paymentMethod,
    p.amountReceived,
    p.changeAmount,
    p.covers,
    p.operator,
    p.note,
    p.customerName,
    p.customerId,
    p.companyName,
    p.vatNumber,
    p.status,
    p.createdAt ? new Date(p.createdAt) : new Date(),
    p.updatedAt ? new Date(p.updatedAt) : new Date(),
    p.closedAt ? new Date(p.closedAt) : new Date(),
    extraObj ? JSON.stringify(extraObj) : null,
  ];
}

async function readAllPayments() {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM payments WHERE restaurant_id = ? ORDER BY closed_at DESC, created_at DESC",
    [rid]
  );
  return (rows || []).map(rowToPayment);
}

async function writeAllPayments(payments) {
  const rid = getRid();
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("DELETE FROM payments WHERE restaurant_id = ?", [rid]);
    const list = Array.isArray(payments) ? payments : [];
    for (const raw of list) {
      const p = normalizePaymentInput(raw);
      const extraObj = extraFromRawPayment(raw);
      await conn.query(
        `INSERT INTO payments (
          restaurant_id, id, table_ref, order_ids, subtotal, discount_amount, discount_type, discount_reason,
          vat_percent, vat_amount, total, payment_method, amount_received, change_amount, covers,
          operator, note, customer_name, customer_id, company_name, vat_number, status,
          created_at, updated_at, closed_at, extra
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        bindPaymentParams(rid, p, extraObj)
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

async function listPayments(filters = {}) {
  const payments = await readAllPayments();
  return payments
    .filter((payment) => matchesFilters(payment, filters))
    .sort((a, b) => {
      const aTs = new Date(a.closedAt || a.createdAt || 0).getTime();
      const bTs = new Date(b.closedAt || b.createdAt || 0).getTime();
      return bTs - aTs;
    });
}

async function getPaymentById(id) {
  const rid = getRid();
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM payments WHERE restaurant_id = ? AND id = ? LIMIT 1",
    [rid, String(id)]
  );
  if (!rows || !rows.length) return null;
  return rowToPayment(rows[0]);
}

async function findByOrderIds(orderIds) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return [];
  const ids = new Set(orderIds.map((id) => String(id)));
  const payments = await readAllPayments();
  return payments.filter((p) => (p.orderIds || []).some((oid) => ids.has(String(oid))));
}

async function createPayment(payload) {
  const p = normalizePaymentInput(payload);
  const extraObj = extraFromRawPayment(payload);
  const rid = getRid();
  const pool = getPool();
  await pool.query(
    `INSERT INTO payments (
      restaurant_id, id, table_ref, order_ids, subtotal, discount_amount, discount_type, discount_reason,
      vat_percent, vat_amount, total, payment_method, amount_received, change_amount, covers,
      operator, note, customer_name, customer_id, company_name, vat_number, status,
      created_at, updated_at, closed_at, extra
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    bindPaymentParams(rid, p, extraObj)
  );
  return p;
}

async function updatePayment(id, updates = {}) {
  const current = await getPaymentById(id);
  if (!current) return null;

  const next = {
    ...current,
    ...updates,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };
  const p = normalizePaymentInput(next);
  const extraObj = extraFromRawPayment(next);
  const rid = getRid();
  const pool = getPool();
  await pool.query(
    `UPDATE payments SET
      table_ref=?, order_ids=?, subtotal=?, discount_amount=?, discount_type=?, discount_reason=?,
      vat_percent=?, vat_amount=?, total=?, payment_method=?, amount_received=?, change_amount=?,
      covers=?, operator=?, note=?, customer_name=?, customer_id=?, company_name=?, vat_number=?,
      status=?, created_at=?, updated_at=?, closed_at=?, extra=?
    WHERE restaurant_id=? AND id=?`,
    [
      p.table,
      JSON.stringify(Array.isArray(p.orderIds) ? p.orderIds : []),
      p.subtotal,
      p.discountAmount,
      p.discountType,
      p.discountReason,
      p.vatPercent,
      p.vatAmount,
      p.total,
      p.paymentMethod,
      p.amountReceived,
      p.changeAmount,
      p.covers,
      p.operator,
      p.note,
      p.customerName,
      p.customerId,
      p.companyName,
      p.vatNumber,
      p.status,
      p.createdAt ? new Date(p.createdAt) : new Date(),
      p.updatedAt ? new Date(p.updatedAt) : new Date(),
      p.closedAt ? new Date(p.closedAt) : new Date(),
      extraObj ? JSON.stringify(extraObj) : null,
      rid,
      String(id),
    ]
  );
  return getPaymentById(id);
}

async function deletePayment(id) {
  const rid = getRid();
  const pool = getPool();
  const [res] = await pool.query("DELETE FROM payments WHERE restaurant_id = ? AND id = ?", [
    rid,
    String(id),
  ]);
  return res && res.affectedRows > 0;
}

async function getPaymentsSummary(filters = {}) {
  const payments = await listPayments(filters);
  return computePaymentsSummary(payments);
}

module.exports = {
  readAllPayments,
  writeAllPayments,
  listPayments,
  getPaymentById,
  findByOrderIds,
  createPayment,
  updatePayment,
  deletePayment,
  getPaymentsSummary,
};
