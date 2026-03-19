const fs = require("fs");
const path = require("path");
const { safeReadJson, atomicWriteJson } = require("../../utils/safeFileIO");
const paths = require("../../config/paths");

const MAINTENANCE_FILE = path.join(paths.DATA, "system-maintenance.json");

let cache = { enabled: false, atMs: 0 };

function nowMs() {
  return Date.now();
}

async function isMaintenanceEnabled() {
  // Very small file; keep an ultra-short cache to avoid excessive reads.
  if (nowMs() - cache.atMs < 1500) return cache.enabled;

  const data = safeReadJson(MAINTENANCE_FILE, { enabled: false });
  const enabled = !!data.enabled;
  cache = { enabled, atMs: nowMs() };
  return enabled;
}

async function setMaintenanceEnabled(enabled) {
  const next = { enabled: !!enabled, updatedAt: new Date().toISOString() };
  atomicWriteJson(MAINTENANCE_FILE, next);
  cache = { enabled: !!enabled, atMs: nowMs() };
  return next;
}

module.exports = {
  MAINTENANCE_FILE,
  isMaintenanceEnabled,
  setMaintenanceEnabled,
  // for debugging/testing only
  _readRaw: () => {
    try {
      return fs.existsSync(MAINTENANCE_FILE) ? JSON.parse(fs.readFileSync(MAINTENANCE_FILE, "utf8")) : null;
    } catch (_) {
      return null;
    }
  },
};

