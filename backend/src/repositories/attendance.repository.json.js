// Presenze/timbrature per tenant. File: data/tenants/{restaurantId}/attendance.json

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const paths = require("../config/paths");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const MAX_SHIFT_HOURS = 16;
const RECORDS_KEY = "records";

function getFilePath(restaurantId) {
  const id = restaurantId != null && String(restaurantId).trim() !== "" ? String(restaurantId).trim() : null;
  if (!id) return path.join(paths.DATA, "attendance.json");
  return path.join(paths.DATA, "tenants", id, "attendance.json");
}

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readAttendance(restaurantId) {
  const filePath = getFilePath(restaurantId);
  const data = safeReadJson(filePath, { [RECORDS_KEY]: [] });
  return Array.isArray(data[RECORDS_KEY]) ? data[RECORDS_KEY] : [];
}

function writeAttendance(restaurantId, records) {
  const filePath = getFilePath(restaurantId);
  ensureDir(filePath);
  atomicWriteJson(filePath, { [RECORDS_KEY]: records });
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `at_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function getWorkedMinutesBetween(clockInAt, clockOutAt) {
  if (!clockInAt || !clockOutAt) return 0;
  const a = new Date(clockInAt).getTime();
  const b = new Date(clockOutAt).getTime();
  if (b <= a) return 0;
  return Math.floor((b - a) / 60000);
}

function dateOnly(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 10);
}

function findOpenShiftByUser(userId, restaurantId) {
  const records = readAttendance(restaurantId);
  const uid = String(userId || "").trim();
  const today = dateOnly(new Date().toISOString());
  return records.find(
    (r) =>
      r.userId === uid &&
      r.restaurantId === restaurantId &&
      r.status === "open" &&
      dateOnly(r.clockInAt) === today
  ) || null;
}

function listByRestaurant(restaurantId, filters = {}) {
  let records = readAttendance(restaurantId);
  const rid = String(restaurantId || "").trim();
  records = records.filter((r) => r.restaurantId === rid);

  if (filters.userId) {
    const uid = String(filters.userId).trim();
    records = records.filter((r) => r.userId === uid);
  }
  if (filters.dateFrom) {
    const from = dateOnly(filters.dateFrom);
    records = records.filter((r) => dateOnly(r.clockInAt || r.clockOutAt || r.date) >= from);
  }
  if (filters.dateTo) {
    const to = dateOnly(filters.dateTo);
    records = records.filter((r) => dateOnly(r.clockInAt || r.clockOutAt || r.date) <= to);
  }
  if (filters.status) {
    records = records.filter((r) => r.status === filters.status);
  }
  records.sort((a, b) => new Date(b.clockInAt || b.createdAt) - new Date(a.clockInAt || a.createdAt));
  return records;
}

function listByUser(userId, restaurantId) {
  return listByRestaurant(restaurantId, { userId });
}

function createShift(restaurantId, data) {
  const now = new Date().toISOString();
  const isAnomalyOnly = data.status === "anomaly" && data.clockInAt == null;
  const record = {
    id: data.id || createId(),
    userId: String(data.userId),
    restaurantId: String(restaurantId),
    date: dateOnly(data.date || data.clockOutAt || now),
    clockInAt: isAnomalyOnly ? null : (data.clockInAt || now),
    clockOutAt: data.clockOutAt || null,
    workedMinutes: data.workedMinutes ?? 0,
    status: data.status || "open",
    anomalyType: data.anomalyType || null,
    notes: data.notes || "",
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
  };
  const records = readAttendance(restaurantId);
  records.push(record);
  writeAttendance(restaurantId, records);
  return record;
}

function closeShift(restaurantId, id, data) {
  const records = readAttendance(restaurantId);
  const idx = records.findIndex((r) => r.id === id && r.restaurantId === restaurantId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  const clockOutAt = data.clockOutAt || now;
  const workedMinutes = getWorkedMinutesBetween(records[idx].clockInAt, clockOutAt);
  records[idx] = {
    ...records[idx],
    clockOutAt,
    workedMinutes,
    status: "closed",
    anomalyType: records[idx].anomalyType || null,
    notes: data.notes != null ? data.notes : records[idx].notes,
    updatedAt: now,
  };
  writeAttendance(restaurantId, records);
  return records[idx];
}

function updateShift(restaurantId, id, data) {
  const records = readAttendance(restaurantId);
  const idx = records.findIndex((r) => r.id === id && r.restaurantId === restaurantId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  const prev = records[idx];
  const patch = { ...data, updatedAt: now };
  if (patch.clockOutAt != null && prev.clockInAt) {
    patch.workedMinutes = getWorkedMinutesBetween(prev.clockInAt, patch.clockOutAt);
  }
  records[idx] = { ...prev, ...patch };
  writeAttendance(restaurantId, records);
  return records[idx];
}

function markAnomaly(restaurantId, id, anomalyType, notes) {
  const records = readAttendance(restaurantId);
  const idx = records.findIndex((r) => r.id === id && r.restaurantId === restaurantId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  records[idx] = {
    ...records[idx],
    status: "anomaly",
    anomalyType: anomalyType || records[idx].anomalyType,
    notes: notes != null ? notes : records[idx].notes,
    updatedAt: now,
  };
  writeAttendance(restaurantId, records);
  return records[idx];
}

function createAnomalyRecord(restaurantId, userId, anomalyType, clockOutAt) {
  const now = clockOutAt || new Date().toISOString();
  return createShift(restaurantId, {
    userId,
    status: "anomaly",
    anomalyType,
    clockInAt: null,
    clockOutAt: now,
    workedMinutes: 0,
    date: dateOnly(now),
    notes: anomalyType,
  });
}

function getDailySummary(restaurantId, date, usersWithRates = []) {
  const day = dateOnly(date || new Date().toISOString());
  const records = readAttendance(restaurantId).filter(
    (r) => dateOnly(r.clockInAt || r.clockOutAt || r.date) === day
  );
  let totalWorkedMinutes = 0;
  const byUser = {};
  const openShifts = records.filter((r) => r.status === "open");
  const anomalies = records.filter((r) => r.status === "anomaly" || r.anomalyType);
  for (const r of records) {
    totalWorkedMinutes += r.workedMinutes || 0;
    byUser[r.userId] = (byUser[r.userId] || 0) + (r.workedMinutes || 0);
  }
  const totalWorkedHours = Math.round((totalWorkedMinutes / 60) * 100) / 100;
  const rateMap = new Map((usersWithRates || []).map((u) => [String(u.id), Number(u.hourlyRate) || 0]));
  let estimatedLaborCost = 0;
  for (const [uid, mins] of Object.entries(byUser)) {
    const rate = rateMap.get(uid);
    if (rate > 0) estimatedLaborCost += (mins / 60) * rate;
  }
  estimatedLaborCost = Math.round(estimatedLaborCost * 100) / 100;
  // Enrich open shifts with shift_too_long for display (no persist)
  const recordsForResponse = records.map((r) => {
    if (r.status === "open" && checkShiftTooLong(r)) {
      return { ...r, anomalyType: r.anomalyType || "shift_too_long" };
    }
    return r;
  });
  const anomaliesForCount = recordsForResponse.filter((r) => r.status === "anomaly" || r.anomalyType);
  return {
    date: day,
    totalWorkedMinutes,
    totalWorkedHours,
    estimatedLaborCost,
    openShiftsCount: openShifts.length,
    anomaliesCount: anomaliesForCount.length,
    recordsCount: records.length,
    records: recordsForResponse,
  };
}

function checkShiftTooLong(record) {
  if (!record || record.clockOutAt) return false;
  const inMs = new Date(record.clockInAt).getTime();
  const hours = (Date.now() - inMs) / (1000 * 60 * 60);
  return hours >= MAX_SHIFT_HOURS;
}

module.exports = {
  readAttendance,
  writeAttendance,
  findOpenShiftByUser,
  listByRestaurant,
  listByUser,
  createShift,
  closeShift,
  updateShift,
  markAnomaly,
  createAnomalyRecord,
  getDailySummary,
  getWorkedMinutesBetween,
  checkShiftTooLong,
  MAX_SHIFT_HOURS,
  dateOnly,
};
