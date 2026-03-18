// Storni giornalieri – persistenza per tenant. Fonte unica per netto (lordo - storni).

const path = require("path");
const fs = require("fs");
const fsp = require("fs").promises;
const crypto = require("crypto");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");

const ENTRIES_KEY = "entries";

function getDataDir() {
  const restaurantId = tenantContext.getRestaurantId();
  if (!restaurantId) return path.join(paths.DATA, "tenants", "default");
  return path.join(paths.DATA, "tenants", restaurantId);
}

function getStorniPath() {
  return path.join(getDataDir(), "storni.json");
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `st_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function ensureFile() {
  const fp = getStorniPath();
  await fsp.mkdir(getDataDir(), { recursive: true });
  if (!fs.existsSync(fp)) {
    await fsp.writeFile(fp, JSON.stringify({ [ENTRIES_KEY]: [] }, null, 2), "utf8");
    return;
  }
  const raw = await fsp.readFile(fp, "utf8");
  if (!raw.trim()) {
    await fsp.writeFile(fp, JSON.stringify({ [ENTRIES_KEY]: [] }, null, 2), "utf8");
  }
}

async function readEntries() {
  await ensureFile();
  const raw = await fsp.readFile(getStorniPath(), "utf8");
  try {
    const data = JSON.parse(raw);
    const list = data[ENTRIES_KEY];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("[Ristoword] storni.json parse error:", err.message);
    return [];
  }
}

async function writeEntries(entries) {
  const fp = getStorniPath();
  await fsp.mkdir(getDataDir(), { recursive: true });
  const tmpPath = fp + "." + Date.now() + ".tmp";
  await fsp.writeFile(tmpPath, JSON.stringify({ [ENTRIES_KEY]: entries }, null, 2), "utf8");
  await fsp.rename(tmpPath, fp);
}

function dateOnly(str) {
  if (!str) return "";
  return String(str).slice(0, 10);
}

async function listByDateRange(dateFrom, dateTo) {
  const entries = await readEntries();
  const from = dateFrom ? dateOnly(dateFrom) : null;
  const to = dateTo ? dateOnly(dateTo) : null;
  let result = entries;
  if (from) result = result.filter((e) => dateOnly(e.date) >= from);
  if (to) result = result.filter((e) => dateOnly(e.date) <= to);
  result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return result;
}

async function getTotalByDate(dateStr) {
  const entries = await readEntries();
  const d = dateOnly(dateStr);
  return entries
    .filter((e) => dateOnly(e.date) === d)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
}

async function create(payload) {
  const entries = await readEntries();
  const now = new Date().toISOString();
  const entry = {
    id: payload.id || createId(),
    date: dateOnly(payload.date || now),
    amount: Number(payload.amount) || 0,
    reason: String(payload.reason || "").trim(),
    table: payload.table != null ? String(payload.table).trim() : "",
    orderId: payload.orderId != null ? String(payload.orderId).trim() : "",
    note: payload.note != null ? String(payload.note).trim() : "",
    createdAt: now,
  };
  entries.push(entry);
  await writeEntries(entries);
  return entry;
}

async function deleteById(id) {
  const entries = await readEntries();
  const idx = entries.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  entries.splice(idx, 1);
  await writeEntries(entries);
  return true;
}

module.exports = {
  listByDateRange,
  getTotalByDate,
  create,
  deleteById,
  readEntries,
};
