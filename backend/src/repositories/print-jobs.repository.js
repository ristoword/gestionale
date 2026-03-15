// backend/src/repositories/print-jobs.repository.js
// Print job queue – tracks what was sent and where.

const { v4: uuid } = require("uuid");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const STATUSES = ["queued", "sent", "failed", "printed"];

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "print-jobs.json");
}

function readAll() {
  const data = safeReadJson(getDataPath(), { jobs: [] });
  const list = Array.isArray(data) ? data : (data.jobs || []);
  return list.map(normalizeJob);
}

function writeAll(jobs) {
  atomicWriteJson(getDataPath(), { jobs });
}

function normalizeJob(j) {
  return {
    id: j.id || uuid(),
    restaurantId: j.restaurantId || tenantContext.getRestaurantId(),
    eventType: j.eventType || "",
    department: j.department || "",
    deviceId: j.deviceId || null,
    documentTitle: j.documentTitle || "",
    content: j.content || "",
    sourceModule: j.sourceModule || "",
    status: STATUSES.includes(j.status) ? j.status : "queued",
    errorMessage: j.errorMessage || null,
    relatedOrderId: j.relatedOrderId || null,
    relatedTable: j.relatedTable || null,
    createdAt: j.createdAt || new Date().toISOString(),
    updatedAt: j.updatedAt || new Date().toISOString(),
  };
}

async function getAll(filters = {}) {
  let list = readAll();
  if (filters.status) {
    list = list.filter((j) => j.status === filters.status);
  }
  if (filters.sourceModule) {
    list = list.filter((j) => j.sourceModule === filters.sourceModule);
  }
  if (filters.limit) {
    list = list.slice(-filters.limit);
  }
  return list;
}

async function getById(id) {
  const list = readAll();
  return list.find((j) => j.id === id) || null;
}

async function create(data) {
  const job = normalizeJob({ ...data, id: data.id || uuid() });
  const list = readAll();
  list.push(job);
  writeAll(list);
  return job;
}

async function updateStatus(id, status, errorMessage = null) {
  const list = readAll();
  const index = list.findIndex((j) => j.id === id);
  if (index === -1) return null;
  list[index].status = STATUSES.includes(status) ? status : list[index].status;
  list[index].errorMessage = errorMessage ?? list[index].errorMessage;
  list[index].updatedAt = new Date().toISOString();
  writeAll(list);
  return list[index];
}

module.exports = {
  STATUSES,
  getAll,
  getById,
  create,
  updateStatus,
};
