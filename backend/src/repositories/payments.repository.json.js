const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const {
  normalizePaymentInput,
  matchesFilters,
  computePaymentsSummary,
} = require("./payments.repository.helpers");

function getDataDir() {
  const restaurantId = tenantContext.getRestaurantId();
  if (!restaurantId) return paths.DATA;
  return path.join(paths.DATA, "tenants", restaurantId);
}

function getPaymentsPath() {
  return path.join(getDataDir(), "payments.json");
}

async function ensurePaymentsFile() {
  const dataDir = getDataDir();
  const paymentsPath = getPaymentsPath();
  await fsp.mkdir(dataDir, { recursive: true });

  if (!fs.existsSync(paymentsPath)) {
    await fsp.writeFile(paymentsPath, "[]", "utf8");
    return;
  }

  const raw = await fsp.readFile(paymentsPath, "utf8");
  if (!raw.trim()) {
    await fsp.writeFile(paymentsPath, "[]", "utf8");
  }
}

async function readAllPayments() {
  await ensurePaymentsFile();
  const raw = await fsp.readFile(getPaymentsPath(), "utf8");

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error("[Ristoword] payments.json parse error:", err.message);
    return [];
  }
}

async function writeAllPayments(payments) {
  const paymentsPath = getPaymentsPath();
  await fsp.mkdir(getDataDir(), { recursive: true });
  const tmpPath = paymentsPath + "." + Date.now() + ".tmp";
  try {
    await fsp.writeFile(tmpPath, JSON.stringify(payments, null, 2), "utf8");
    await fsp.rename(tmpPath, paymentsPath);
  } catch (err) {
    try {
      await fsp.unlink(tmpPath).catch(() => {});
    } catch (_) {}
    await fsp.writeFile(paymentsPath, JSON.stringify(payments, null, 2), "utf8");
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
  const payments = await readAllPayments();
  return payments.find((payment) => payment.id === id) || null;
}

async function findByOrderIds(orderIds) {
  if (!Array.isArray(orderIds) || orderIds.length === 0) return [];
  const ids = new Set(orderIds.map((id) => String(id)));
  const payments = await readAllPayments();
  return payments.filter((p) => (p.orderIds || []).some((oid) => ids.has(String(oid))));
}

async function createPayment(payload) {
  const payments = await readAllPayments();
  const payment = normalizePaymentInput(payload);

  payments.push(payment);
  await writeAllPayments(payments);

  return payment;
}

async function updatePayment(id, updates = {}) {
  const payments = await readAllPayments();
  const index = payments.findIndex((payment) => payment.id === id);

  if (index === -1) return null;

  const current = payments[index];
  const next = {
    ...current,
    ...updates,
    id: current.id,
    updatedAt: new Date().toISOString(),
  };

  payments[index] = next;
  await writeAllPayments(payments);

  return next;
}

async function deletePayment(id) {
  const payments = await readAllPayments();
  const index = payments.findIndex((payment) => payment.id === id);

  if (index === -1) return false;

  payments.splice(index, 1);
  await writeAllPayments(payments);

  return true;
}

async function getPaymentsSummary(filters = {}) {
  const payments = await listPayments(filters);
  return computePaymentsSummary(payments);
}

module.exports = {
  PAYMENTS_FILE: getPaymentsPath,
  ensurePaymentsFile,
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
