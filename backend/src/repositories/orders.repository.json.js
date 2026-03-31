// backend/src/repositories/orders.repository.json.js
// Ordini per tenant su file JSON — default quando USE_MYSQL_DATABASE non è true.

const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "orders.json");
}

function safeReadFile() {
  const parsed = safeReadJson(getDataPath(), []);
  return (Array.isArray(parsed) ? parsed : []).map((o) => ({
    ...o,
    items: Array.isArray(o.items) ? o.items : [],
  }));
}

function writeFile(data) {
  atomicWriteJson(getDataPath(), data);
}

async function getAllOrders() {
  return safeReadFile();
}

async function getOrderById(id) {
  const orders = safeReadFile();
  return orders.find((o) => String(o.id) === String(id)) || null;
}

async function saveAllOrders(orders) {
  writeFile(orders);
}

function getNextId(orders) {
  if (!orders.length) return 1;
  const max = Math.max(...orders.map((o) => Number(o.id) || 0));
  return max + 1;
}

module.exports = {
  getAllOrders,
  saveAllOrders,
  getNextId,
  getOrderById,
};
