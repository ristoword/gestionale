const crypto = require("crypto");
const { getJson, setJson } = require("./tenant-module.mysql");

const MODULE_KEY = "customers";

function createId() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return `cli_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}
function normalizeString(v, fallback = "") { if (v == null) return fallback; return String(v).trim(); }

function buildCustomer(data = {}) {
  const now = new Date().toISOString();
  return {
    id: data.id || createId(),
    name: normalizeString(data.name, ""),
    surname: normalizeString(data.surname, ""),
    phone: normalizeString(data.phone, ""),
    email: normalizeString(data.email, ""),
    notes: normalizeString(data.notes, ""),
    birthday: normalizeString(data.birthday, ""),
    anniversaries: Array.isArray(data.anniversaries) ? data.anniversaries.map((a) => ({ label: normalizeString(a.label || a, ""), date: normalizeString(typeof a === "object" ? a.date : "", "") })) : [],
    allergies: Array.isArray(data.allergies) ? data.allergies.map(String) : [],
    intolerances: Array.isArray(data.intolerances) ? data.intolerances.map(String) : [],
    preferences: Array.isArray(data.preferences) ? data.preferences.map(String) : [],
    category: ["normal", "top", "vip"].includes(data.category) ? data.category : "normal",
    createdAt: data.createdAt || now, updatedAt: now,
  };
}

async function getAll() { const data = await getJson(MODULE_KEY, []); return Array.isArray(data) ? data : []; }
async function getById(id) { const list = await getAll(); return list.find((c) => c.id === id) || null; }
async function findByPhone(phone) { const p = normalizeString(phone).replace(/\D/g, ""); if (!p) return null; const list = await getAll(); return list.find((c) => normalizeString(c.phone).replace(/\D/g, "") === p) || null; }
async function findByEmail(email) { const e = normalizeString(email).toLowerCase(); if (!e) return null; const list = await getAll(); return list.find((c) => normalizeString(c.email).toLowerCase() === e) || null; }
async function searchByNameOrPhone(query) { const q = normalizeString(query).toLowerCase(); if (!q) return []; const list = await getAll(); return list.filter((c) => `${normalizeString(c.name)} ${normalizeString(c.surname)}`.toLowerCase().includes(q) || normalizeString(c.phone).includes(q)); }
async function create(data) { const list = await getAll(); const customer = buildCustomer({ ...data }); list.push(customer); await setJson(MODULE_KEY, list); return customer; }
async function update(id, data) { const list = await getAll(); const idx = list.findIndex((c) => c.id === id); if (idx === -1) return null; const existing = list[idx]; const merged = { ...existing, ...data, id: existing.id, createdAt: existing.createdAt }; const updated = buildCustomer(merged); updated.createdAt = existing.createdAt; updated.updatedAt = new Date().toISOString(); list[idx] = updated; await setJson(MODULE_KEY, list); return updated; }

module.exports = { getAll, getById, findByPhone, findByEmail, searchByNameOrPhone, create, update, buildCustomer };
