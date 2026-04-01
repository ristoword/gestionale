// backend/src/repositories/inventory-transfers.repository.js
// Storico trasferimenti interni: Magazzino Centrale → Scorte reparti

const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "inventory-transfers.json");
}

function readTransfers() {
  const data = safeReadJson(getDataPath(), []);
  return Array.isArray(data) ? data : [];
}

function addTransfer(record) {
  const list = readTransfers();
  const entry = {
    id: Date.now(),
    ...record,
    createdAt: new Date().toISOString(),
  };
  list.unshift(entry);
  atomicWriteJson(getDataPath(), list);
  return entry;
}

function getRecentTransfers(limit = 100) {
  const list = readTransfers();
  return list.slice(0, Math.min(limit, list.length));
}

function getById(id) {
  const list = readTransfers();
  return list.find((t) => String(t.id) === String(id)) || null;
}

function updateTransfer(id, patch) {
  const list = readTransfers();
  const idx = list.findIndex((t) => String(t.id) === String(id));
  if (idx === -1) return null;
  const next = {
    ...list[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  list[idx] = next;
  atomicWriteJson(getDataPath(), list);
  return next;
}

module.exports = {
  addTransfer,
  getRecentTransfers,
  getById,
  updateTransfer,
  readTransfers,
};
