// backend/src/repositories/licenses.repository.js
// Per-restaurant license/subscription records.

const path = require("path");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const DATA_FILE = path.join(__dirname, "..", "..", "data", "licenses.json");

function readLicenses() {
  const data = safeReadJson(DATA_FILE, { licenses: [] });
  return Array.isArray(data.licenses) ? data.licenses : [];
}

function writeLicenses(licenses) {
  const dir = path.dirname(DATA_FILE);
  require("fs").mkdirSync(dir, { recursive: true });
  atomicWriteJson(DATA_FILE, { licenses });
}

function findByRestaurantId(restaurantId) {
  const id = String(restaurantId || "").trim();
  return readLicenses().find((l) => l.restaurantId === id);
}

function findByActivationCode(activationCode) {
  const code = String(activationCode || "").trim();
  if (!code) return null;
  return readLicenses().find(
    (l) =>
      typeof l.activationCode === "string" &&
      l.activationCode.trim() === code
  );
}

function hasUsedLicense(restaurantId) {
  const id = String(restaurantId || "").trim();
  if (!id) return false;
  const licenses = readLicenses();
  return licenses.some(
    (l) => l.restaurantId === id && l.status === "used"
  );
}

function updateLicense(updated) {
  const licenses = readLicenses();
  const idx = licenses.findIndex(
    (l) =>
      (updated.restaurantId && l.restaurantId === updated.restaurantId) ||
      (updated.activationCode &&
        typeof l.activationCode === "string" &&
        l.activationCode.trim() === String(updated.activationCode || "").trim())
  );
  if (idx === -1) return null;
  const merged = {
    ...licenses[idx],
    ...updated,
  };
  licenses[idx] = merged;
  writeLicenses(licenses);
  return merged;
}

function create(license) {
  const licenses = readLicenses();
  const record = {
    restaurantId: license.restaurantId,
    plan: license.plan || "ristoword_pro",
    status: license.status || "active",
    source: license.source || "manual_onboarding",
    createdAt: license.createdAt || new Date().toISOString(),
  };
  licenses.push(record);
  writeLicenses(licenses);
  return record;
}

module.exports = {
  readLicenses,
  findByRestaurantId,
  findByActivationCode,
  updateLicense,
  hasUsedLicense,
  create,
};
