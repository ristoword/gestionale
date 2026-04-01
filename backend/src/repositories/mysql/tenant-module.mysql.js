/**
 * Payload JSON generico per tenant (tabella tenant_module_data).
 * Chiave modulo stabile (es. "inventory", "bookings") — non il nome file.
 */

const { getPool } = require("../../db/mysql-pool");
const tenantContext = require("../../context/tenantContext");

const GLOBAL_ID = "__global__";

function restaurantId() {
  const id = tenantContext.getRestaurantId();
  return id != null && String(id).trim() !== "" ? String(id).trim() : "default";
}

function parsePayload(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === "object" && !Buffer.isBuffer(val)) return val;
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/**
 * @param {string} moduleKey es. "inventory"
 * @param {*} defaultValue
 */
async function getJson(moduleKey, defaultValue = null) {
  const pool = getPool();
  const rid = restaurantId();
  const [rows] = await pool.query(
    "SELECT payload_json FROM tenant_module_data WHERE restaurant_id = ? AND module_key = ? LIMIT 1",
    [rid, moduleKey]
  );
  if (!rows || !rows.length) return defaultValue;
  return parsePayload(rows[0].payload_json, defaultValue);
}

async function setJson(moduleKey, payload) {
  const pool = getPool();
  const rid = restaurantId();
  const jsonStr = JSON.stringify(payload === undefined ? null : payload);
  await pool.query(
    `INSERT INTO tenant_module_data (restaurant_id, module_key, payload_json, updated_at)
     VALUES (?, ?, CAST(? AS JSON), NOW(3))
     ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), updated_at = NOW(3)`,
    [rid, moduleKey, jsonStr]
  );
}

async function getGlobalJson(moduleKey, defaultValue = null) {
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT payload_json FROM tenant_module_data WHERE restaurant_id = ? AND module_key = ? LIMIT 1",
    [GLOBAL_ID, moduleKey]
  );
  if (!rows || !rows.length) return defaultValue;
  return parsePayload(rows[0].payload_json, defaultValue);
}

async function setGlobalJson(moduleKey, payload) {
  const pool = getPool();
  const jsonStr = JSON.stringify(payload === undefined ? null : payload);
  await pool.query(
    `INSERT INTO tenant_module_data (restaurant_id, module_key, payload_json, updated_at)
     VALUES (?, ?, CAST(? AS JSON), NOW(3))
     ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), updated_at = NOW(3)`,
    [GLOBAL_ID, moduleKey, jsonStr]
  );
}

module.exports = {
  getJson,
  setJson,
  getGlobalJson,
  setGlobalJson,
  GLOBAL_RESTAURANT_ID: GLOBAL_ID,
};
