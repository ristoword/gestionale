const { v4: uuid } = require("uuid");
const { getJson, setJson } = require("./tenant-module.mysql");

const MODULE_KEY = "bookings";

async function getAll() {
  const data = await getJson(MODULE_KEY, []);
  return Array.isArray(data) ? data : [];
}

async function getById(id) {
  const list = await getAll();
  return list.find((b) => b.id === id) || null;
}

async function create(data) {
  const list = await getAll();
  const booking = {
    id: uuid(), customerId: data.customerId || null, name: data.name || "", phone: data.phone || "",
    people: Number(data.people) || 1, date: data.date || "", time: data.time || "",
    note: data.note || data.notes || "", area: data.area || "", status: data.status || "nuova",
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  list.push(booking);
  await setJson(MODULE_KEY, list);
  return booking;
}

async function update(id, data) {
  const list = await getAll();
  const idx = list.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  const existing = list[idx];
  const updated = { ...existing, ...data, id: existing.id, updatedAt: new Date().toISOString() };
  list[idx] = updated;
  await setJson(MODULE_KEY, list);
  return updated;
}

async function remove(id) {
  const list = await getAll();
  const idx = list.findIndex((b) => b.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  await setJson(MODULE_KEY, list);
  return true;
}

module.exports = { getAll, getById, create, update, remove };
