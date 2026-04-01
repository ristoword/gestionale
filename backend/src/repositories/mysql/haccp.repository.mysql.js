const { v4: uuid } = require("uuid");
const { getJson, setJson } = require("./tenant-module.mysql");

const MODULE_KEY = "haccp-checks";

async function readAll() {
  const data = await getJson(MODULE_KEY, []);
  return Array.isArray(data) ? data : [];
}

async function writeAll(checks) {
  await setJson(MODULE_KEY, Array.isArray(checks) ? checks : []);
}

async function getAll() { return readAll(); }
async function getById(id) { const list = await readAll(); return list.find((c) => c.id === id) || null; }
async function create(data) {
  const check = {
    id: uuid(), type: data.type || "", value: data.value ?? data.temp ?? "", unit: data.unit || "",
    date: data.date || "", time: data.time || "", operator: data.operator || "",
    note: data.note || data.notes || "", temp: data.temp ?? data.value, notes: data.notes || data.note || "",
    createdAt: data.createdAt || new Date().toISOString(),
  };
  const list = await readAll(); list.push(check); await writeAll(list); return check;
}
async function update(id, data) { const list = await readAll(); const index = list.findIndex((c) => c.id === id); if (index === -1) return null; list[index] = { ...list[index], ...data }; await writeAll(list); return list[index]; }
async function remove(id) { const list = await readAll(); const index = list.findIndex((c) => c.id === id); if (index === -1) return false; list.splice(index,1); await writeAll(list); return true; }

module.exports = { getAll, getById, create, update, remove };
