// backend/src/utils/licenseValidation.js
// Shared rules for “tenant has an active subscription / activation” (licenses.json + tenant mirror).

const fs = require("fs");
const licensesRepository = require("../repositories/licenses.repository");
const paths = require("../config/paths");
const { safeReadJson } = require("../utils/safeFileIO");
const { getLicense } = require("../config/license");
const tenantContext = require("../context/tenantContext");

function normalizeExpiry(rec) {
  if (!rec || typeof rec !== "object") return null;
  if (rec.expiresAt) return rec.expiresAt;
  if (rec.endDate) return rec.endDate;
  return null;
}

/**
 * Same spirit as license.controller validateLicenseForActivation, extended for runtime (status "used" = ok).
 */
function isLicenseRecordValid(rec) {
  if (!rec || typeof rec !== "object") return false;

  const expRaw = normalizeExpiry(rec);
  if (expRaw) {
    const exp = new Date(expRaw);
    if (Number.isFinite(exp.getTime()) && exp.getTime() < Date.now()) return false;
  }

  const st = String(rec.status || "").toLowerCase();
  if (st === "expired" || st === "inactive" || st === "cancelled" || st === "revoked") return false;

  return st === "active" || st === "grace" || st === "used" || st === "";
}

function readTenantLicenseJson(restaurantId) {
  const rid = String(restaurantId || "").trim();
  if (!rid) return null;
  try {
    const fp = paths.tenantDataPath(rid, "license.json");
    if (!fs.existsSync(fp)) return null;
    return safeReadJson(fp, null);
  } catch {
    return null;
  }
}

/**
 * @param {string} restaurantId
 * @returns {Promise<boolean>}
 */
async function hasValidLicenseForRestaurant(restaurantId) {
  const rid = String(restaurantId || "").trim();
  if (!rid) return false;

  const globalRow = await licensesRepository.findByRestaurantId(rid);
  if (isLicenseRecordValid(globalRow)) return true;

  const tenantFile = readTenantLicenseJson(rid);
  if (isLicenseRecordValid(tenantFile)) return true;

  // Legacy single-tenant file data/license.json — solo contesto default
  if (rid === tenantContext.DEFAULT_TENANT || rid === "default") {
    try {
      const decorated = await getLicense();
      if (decorated && decorated.valid === true) return true;
    } catch {
      /* ignore */
    }
  }

  return false;
}

module.exports = {
  hasValidLicenseForRestaurant,
  isLicenseRecordValid,
};
