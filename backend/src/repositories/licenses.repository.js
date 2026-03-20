// backend/src/repositories/licenses.repository.js
// Per-restaurant license/subscription records.

const fs = require("fs");
const path = require("path");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");
const paths = require("../config/paths");

const DATA_FILE = path.join(__dirname, "..", "..", "data", "licenses.json");

/** Normalizza input utente (spazi, caratteri invisibili). */
function normalizeActivationInput(input) {
  return String(input || "")
    .trim()
    .replace(/[\u00A0\u2000-\u200B\uFEFF]/g, " ")
    .replace(/\s+/g, " ");
}

function codesMatch(stored, userInput) {
  const a = normalizeActivationInput(stored).toUpperCase();
  const b = normalizeActivationInput(userInput).toUpperCase();
  return a.length > 0 && a === b;
}

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

/**
 * Se il codice esiste solo in data/tenants/{id}/license.json ma non in licenses.json, lo importa.
 */
function syncFromTenantFileIfCodeMatches(userNeedle) {
  const tenantsDir = path.join(paths.DATA, "tenants");
  if (!fs.existsSync(tenantsDir)) return null;
  const dirs = fs
    .readdirSync(tenantsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const tid of dirs) {
    const fp = paths.tenantDataPath(tid, "license.json");
    if (!fs.existsSync(fp)) continue;
    const raw = safeReadJson(fp, null);
    if (!raw || typeof raw !== "object" || !raw.activationCode) continue;
    if (!codesMatch(raw.activationCode, userNeedle)) continue;
    const rid = String(raw.restaurantId || tid).trim();
    if (!rid) continue;
    const existing = findByRestaurantId(rid);
    if (existing) {
      const merged = updateLicense({
        restaurantId: rid,
        activationCode: raw.activationCode,
        plan: raw.plan || existing.plan,
        status: raw.status || existing.status,
        expiresAt: raw.expiresAt != null ? raw.expiresAt : existing.expiresAt,
        source: raw.source || existing.source || "tenant_license_sync",
        updatedAt: new Date().toISOString(),
      });
      return merged || existing;
    }
    return create({
      restaurantId: rid,
      plan: raw.plan || "ristoword_pro",
      status: raw.status || "active",
      activationCode: raw.activationCode,
      expiresAt: raw.expiresAt || null,
      source: raw.source || "tenant_license_sync",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return null;
}

function findByActivationCode(activationCode) {
  const needle = normalizeActivationInput(activationCode);
  if (!needle) return null;

  const list = readLicenses();
  const fromGlobal = list.find(
    (l) => typeof l.activationCode === "string" && codesMatch(l.activationCode, needle)
  );
  if (fromGlobal) return fromGlobal;

  return syncFromTenantFileIfCodeMatches(needle);
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
  // Important: keep optional fields (activationCode, dates, etc.) so owner-activate can work.
  // The previous implementation dropped activationCode and other extra payload fields.
  const record = {
    ...license,
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
