// backend/src/repositories/qr-tables.repository.js
// QR table config – derived from setup + optional overrides.

const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const setupConfig = require("../config/setup");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "qr-tables.json");
}

function readOverrides() {
  const data = safeReadJson(getDataPath(), { tables: [] });
  return Array.isArray(data.tables) ? data.tables : [];
}

function writeOverrides(tables) {
  atomicWriteJson(getDataPath(), { tables });
}

/**
 * Get list of tables for QR. Uses setup numTables, optionally merged with qr-tables overrides.
 */
function getTables() {
  const config = setupConfig.readConfig();
  const numTables = Math.max(1, Math.min(999, Number(config?.numTables) || 20));
  const overrides = readOverrides();

  const result = [];
  for (let i = 1; i <= numTables; i++) {
    const override = overrides.find((t) => String(t.id) === String(i) || Number(t.id) === i);
    result.push({
      id: i,
      tableId: String(i),
      label: override?.label || `Tavolo ${i}`,
      qrData: null,
      createdAt: override?.createdAt || null,
      updatedAt: override?.updatedAt || null,
    });
  }
  return result;
}

function getTableById(tableId) {
  const tables = getTables();
  const id = typeof tableId === "string" ? parseInt(tableId, 10) : Number(tableId);
  return tables.find((t) => t.id === id || t.tableId === String(tableId)) || null;
}

module.exports = {
  getTables,
  getTableById,
  readOverrides,
  writeOverrides,
};
