// backend/src/repositories/devices.repository.js
// Hardware device management – printers, scanners, cash drawers.

const { v4: uuid } = require("uuid");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const DEPARTMENTS = ["sala", "cucina", "bar", "pizzeria", "cassa", "magazzino"];
const DEVICE_TYPES = [
  "thermal_printer",
  "kitchen_printer",
  "bar_printer",
  "pizzeria_printer",
  "cashier_printer",
  "label_printer",
  "barcode_scanner",
  "cash_drawer",
];
const CONNECTION_TYPES = ["usb", "network", "bluetooth"];

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "devices.json");
}

function readAll() {
  const data = safeReadJson(getDataPath(), { devices: [] });
  const list = Array.isArray(data) ? data : (data.devices || []);
  return list.map(normalizeDevice);
}

function writeAll(devices) {
  atomicWriteJson(getDataPath(), { devices });
}

function normalizeDevice(d) {
  return {
    id: d.id || uuid(),
    restaurantId: d.restaurantId || tenantContext.getRestaurantId(),
    name: String(d.name || "").trim() || "Dispositivo",
    type: DEVICE_TYPES.includes(d.type) ? d.type : "thermal_printer",
    department: DEPARTMENTS.includes(d.department) ? d.department : "cassa",
    connectionType: CONNECTION_TYPES.includes(d.connectionType) ? d.connectionType : "usb",
    ipAddress: d.ipAddress || null,
    port: d.port || null,
    identifier: d.identifier || d.devicePath || null,
    devicePath: d.devicePath || d.identifier || null,
    isDefault: Boolean(d.isDefault),
    isActive: d.isActive !== false,
    notes: String(d.notes || "").trim(),
    createdAt: d.createdAt || new Date().toISOString(),
    updatedAt: d.updatedAt || new Date().toISOString(),
  };
}

async function getAll() {
  return readAll();
}

async function getById(id) {
  const list = readAll();
  return list.find((d) => d.id === id) || null;
}

async function getByDepartment(department) {
  const list = readAll();
  return list.filter((d) => d.department === department && d.isActive);
}

async function getDefaultForDepartment(department) {
  const list = readAll();
  return list.find((d) => d.department === department && d.isDefault && d.isActive) || null;
}

async function create(data) {
  const device = normalizeDevice({ ...data, id: data.id || uuid() });
  if (device.isDefault) {
    const list = readAll();
    list.forEach((d) => {
      if (d.department === device.department) d.isDefault = false;
    });
    list.push(device);
    writeAll(list);
  } else {
    const list = readAll();
    list.push(device);
    writeAll(list);
  }
  return device;
}

async function update(id, data) {
  const list = readAll();
  const index = list.findIndex((d) => d.id === id);
  if (index === -1) return null;

  const existing = list[index];
  const device = normalizeDevice({
    ...existing,
    ...data,
    id: existing.id,
    updatedAt: new Date().toISOString(),
  });

  if (device.isDefault && !existing.isDefault) {
    list.forEach((d) => {
      if (d.department === device.department && d.id !== device.id) d.isDefault = false;
    });
  }
  if (data.isActive === false && existing.isDefault) {
    device.isDefault = false;
  }

  list[index] = device;
  writeAll(list);
  return device;
}

async function remove(id) {
  const list = readAll();
  const index = list.findIndex((d) => d.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  writeAll(list);
  return true;
}

module.exports = {
  DEPARTMENTS,
  DEVICE_TYPES,
  CONNECTION_TYPES,
  getAll,
  getById,
  getByDepartment,
  getDefaultForDepartment,
  create,
  update,
  remove,
};
