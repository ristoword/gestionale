const crypto = require("crypto");
const { getJson, setJson } = require("./tenant-module.mysql");

const MAX_SHIFT_HOURS = 16;
const RECORDS_KEY = "records";
const MODULE_KEY = "attendance";

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `at_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
function dateOnly(iso) { if (!iso) return ""; return String(iso).slice(0, 10); }
function getWorkedMinutesBetween(clockInAt, clockOutAt) {
  if (!clockInAt || !clockOutAt) return 0;
  const a = new Date(clockInAt).getTime(); const b = new Date(clockOutAt).getTime();
  if (b <= a) return 0; return Math.floor((b - a) / 60000);
}
async function readAttendance() {
  const data = await getJson(MODULE_KEY, { [RECORDS_KEY]: [] });
  return Array.isArray(data[RECORDS_KEY]) ? data[RECORDS_KEY] : [];
}
async function writeAttendance(_restaurantId, records) {
  await setJson(MODULE_KEY, { [RECORDS_KEY]: Array.isArray(records) ? records : [] });
}
async function findOpenShiftByUser(userId, restaurantId) {
  const records = await readAttendance(restaurantId);
  const uid = String(userId || "").trim();
  const today = dateOnly(new Date().toISOString());
  return records.find((r) => r.userId === uid && r.restaurantId === restaurantId && r.status === "open" && dateOnly(r.clockInAt) === today) || null;
}
async function listByRestaurant(restaurantId, filters = {}) {
  let records = await readAttendance(restaurantId);
  const rid = String(restaurantId || "").trim();
  records = records.filter((r) => r.restaurantId === rid);
  if (filters.userId) records = records.filter((r) => r.userId === String(filters.userId).trim());
  if (filters.dateFrom) { const from = dateOnly(filters.dateFrom); records = records.filter((r) => dateOnly(r.clockInAt || r.clockOutAt || r.date) >= from); }
  if (filters.dateTo) { const to = dateOnly(filters.dateTo); records = records.filter((r) => dateOnly(r.clockInAt || r.clockOutAt || r.date) <= to); }
  if (filters.status) records = records.filter((r) => r.status === filters.status);
  records.sort((a,b)=> new Date(b.clockInAt || b.createdAt) - new Date(a.clockInAt || a.createdAt));
  return records;
}
async function listByUser(userId, restaurantId) { return listByRestaurant(restaurantId, { userId }); }
async function createShift(restaurantId, data) {
  const now = new Date().toISOString();
  const isAnomalyOnly = data.status === "anomaly" && data.clockInAt == null;
  const record = { id: data.id || createId(), userId: String(data.userId), restaurantId: String(restaurantId), date: dateOnly(data.date || data.clockOutAt || now), clockInAt: isAnomalyOnly ? null : (data.clockInAt || now), clockOutAt: data.clockOutAt || null, workedMinutes: data.workedMinutes ?? 0, status: data.status || "open", anomalyType: data.anomalyType || null, notes: data.notes || "", createdAt: data.createdAt || now, updatedAt: data.updatedAt || now };
  const records = await readAttendance(restaurantId); records.push(record); await writeAttendance(restaurantId, records); return record;
}
async function closeShift(restaurantId, id, data) {
  const records = await readAttendance(restaurantId);
  const idx = records.findIndex((r) => r.id === id && r.restaurantId === restaurantId);
  if (idx === -1) return null;
  const now = new Date().toISOString(); const clockOutAt = data.clockOutAt || now; const workedMinutes = getWorkedMinutesBetween(records[idx].clockInAt, clockOutAt);
  records[idx] = { ...records[idx], clockOutAt, workedMinutes, status: "closed", anomalyType: records[idx].anomalyType || null, notes: data.notes != null ? data.notes : records[idx].notes, updatedAt: now };
  await writeAttendance(restaurantId, records); return records[idx];
}
async function updateShift(restaurantId, id, data) {
  const records = await readAttendance(restaurantId);
  const idx = records.findIndex((r) => r.id === id && r.restaurantId === restaurantId);
  if (idx === -1) return null;
  const now = new Date().toISOString(); const prev = records[idx]; const patch = { ...data, updatedAt: now };
  if (patch.clockOutAt != null && prev.clockInAt) patch.workedMinutes = getWorkedMinutesBetween(prev.clockInAt, patch.clockOutAt);
  records[idx] = { ...prev, ...patch };
  await writeAttendance(restaurantId, records); return records[idx];
}
async function markAnomaly(restaurantId, id, anomalyType, notes) {
  const records = await readAttendance(restaurantId);
  const idx = records.findIndex((r) => r.id === id && r.restaurantId === restaurantId);
  if (idx === -1) return null;
  const now = new Date().toISOString();
  records[idx] = { ...records[idx], status: "anomaly", anomalyType: anomalyType || records[idx].anomalyType, notes: notes != null ? notes : records[idx].notes, updatedAt: now };
  await writeAttendance(restaurantId, records); return records[idx];
}
async function createAnomalyRecord(restaurantId, userId, anomalyType, clockOutAt) {
  const now = clockOutAt || new Date().toISOString();
  return createShift(restaurantId, { userId, status: "anomaly", anomalyType, clockInAt: null, clockOutAt: now, workedMinutes: 0, date: dateOnly(now), notes: anomalyType });
}
function checkShiftTooLong(record) { if (!record || record.clockOutAt) return false; const inMs = new Date(record.clockInAt).getTime(); const hours = (Date.now() - inMs) / (1000*60*60); return hours >= MAX_SHIFT_HOURS; }
async function getDailySummary(restaurantId, date, usersWithRates = []) {
  const day = dateOnly(date || new Date().toISOString());
  const recordsRaw = await readAttendance(restaurantId);
  const records = recordsRaw.filter((r) => dateOnly(r.clockInAt || r.clockOutAt || r.date) === day);
  let totalWorkedMinutes = 0; const byUser = {}; const openShifts = records.filter((r) => r.status === "open");
  for (const r of records) { totalWorkedMinutes += r.workedMinutes || 0; byUser[r.userId] = (byUser[r.userId] || 0) + (r.workedMinutes || 0); }
  const totalWorkedHours = Math.round((totalWorkedMinutes / 60) * 100) / 100;
  const rateMap = new Map((usersWithRates || []).map((u) => [String(u.id), Number(u.hourlyRate) || 0]));
  let estimatedLaborCost = 0;
  for (const [uid, mins] of Object.entries(byUser)) { const rate = rateMap.get(uid); if (rate > 0) estimatedLaborCost += (mins / 60) * rate; }
  estimatedLaborCost = Math.round(estimatedLaborCost * 100) / 100;
  const recordsForResponse = records.map((r) => (r.status === "open" && checkShiftTooLong(r) ? { ...r, anomalyType: r.anomalyType || "shift_too_long" } : r));
  const anomaliesForCount = recordsForResponse.filter((r) => r.status === "anomaly" || r.anomalyType);
  return { date: day, totalWorkedMinutes, totalWorkedHours, estimatedLaborCost, openShiftsCount: openShifts.length, anomaliesCount: anomaliesForCount.length, recordsCount: records.length, records: recordsForResponse };
}
module.exports = { readAttendance, writeAttendance, findOpenShiftByUser, listByRestaurant, listByUser, createShift, closeShift, updateShift, markAnomaly, createAnomalyRecord, getDailySummary, getWorkedMinutesBetween, checkShiftTooLong, MAX_SHIFT_HOURS, dateOnly };
