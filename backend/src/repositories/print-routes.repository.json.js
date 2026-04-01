// backend/src/repositories/print-routes.repository.js
// Print routing rules – eventType + department -> deviceId.

const { v4: uuid } = require("uuid");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const EVENT_TYPES = [
  "order_ticket_bar",
  "order_ticket_kitchen",
  "order_ticket_pizzeria",
  "invoice_print",
  "receipt_prebill",
  "receipt_final",
  "inventory_label",
  "inventory_report",
  "catering_proposal_print",
  "daily_menu_print",
  "kitchen_production_print",
  "shopping_list_print",
  "closure_report_print",
];

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "print-routes.json");
}

function readAll() {
  const data = safeReadJson(getDataPath(), { routes: [] });
  const list = Array.isArray(data) ? data : (data.routes || []);
  return list.map(normalizeRoute);
}

function writeAll(routes) {
  atomicWriteJson(getDataPath(), { routes });
}

function normalizeRoute(r) {
  return {
    id: r.id || uuid(),
    restaurantId: r.restaurantId || tenantContext.getRestaurantId(),
    eventType: String(r.eventType || "").trim(),
    department: String(r.department || "").trim(),
    deviceId: r.deviceId || null,
    isActive: r.isActive !== false,
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: r.updatedAt || new Date().toISOString(),
  };
}

async function getAll() {
  return readAll();
}

async function getById(id) {
  const list = readAll();
  return list.find((r) => r.id === id) || null;
}

async function findByEventAndDepartment(eventType, department) {
  const list = readAll();
  return (
    list.find(
      (r) =>
        r.isActive &&
        r.eventType === eventType &&
        (r.department === department || !r.department)
    ) || null
  );
}

async function create(data) {
  const route = normalizeRoute({ ...data, id: data.id || uuid() });
  const list = readAll();
  list.push(route);
  writeAll(list);
  return route;
}

async function update(id, data) {
  const list = readAll();
  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return null;
  list[index] = normalizeRoute({
    ...list[index],
    ...data,
    id: list[index].id,
    updatedAt: new Date().toISOString(),
  });
  writeAll(list);
  return list[index];
}

async function remove(id) {
  const list = readAll();
  const index = list.findIndex((r) => r.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  writeAll(list);
  return true;
}

module.exports = {
  EVENT_TYPES,
  getAll,
  getById,
  findByEventAndDepartment,
  create,
  update,
  remove,
};
