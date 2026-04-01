const { getJson, setJson } = require("./tenant-module.mysql");

const MODULE_KEY = "inventory-transfers";

async function readTransfers() {
  const data = await getJson(MODULE_KEY, []);
  return Array.isArray(data) ? data : [];
}

async function addTransfer(record) {
  const list = await readTransfers();
  const entry = { id: Date.now(), ...record, createdAt: new Date().toISOString() };
  list.unshift(entry);
  await setJson(MODULE_KEY, list);
  return entry;
}

async function getRecentTransfers(limit = 100) {
  const list = await readTransfers();
  return list.slice(0, Math.min(limit, list.length));
}

async function getById(id) {
  const list = await readTransfers();
  return list.find((t) => String(t.id) === String(id)) || null;
}

async function updateTransfer(id, patch) {
  const list = await readTransfers();
  const idx = list.findIndex((t) => String(t.id) === String(id));
  if (idx === -1) return null;
  const next = { ...list[idx], ...patch, updatedAt: new Date().toISOString() };
  list[idx] = next;
  await setJson(MODULE_KEY, list);
  return next;
}

module.exports = { addTransfer, getRecentTransfers, getById, updateTransfer, readTransfers };
