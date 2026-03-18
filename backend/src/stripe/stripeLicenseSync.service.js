const crypto = require("crypto");

const { getLicense, saveLicense } = require("../config/license");
const licensesRepository = require("../repositories/licenses.repository");

function normalizeTenantId(id) {
  return String(id || "").trim();
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function generateActivationCode(restaurantId, seed) {
  const rid = normalizeTenantId(restaurantId).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
  const base = (seed ? String(seed) : rid) + "|" + Date.now() + "|" + Math.random();
  const h = sha256Hex(base).toUpperCase();
  const p1 = h.slice(0, 4);
  const p2 = h.slice(4, 8);
  return `${rid || "RW"}-${p1}-${p2}`;
}

function computeExpiresAt({ mode = "subscription" } = {}) {
  const now = new Date();
  const days = mode === "trial" ? 14 : 30; // project-level default trial/subscription windows
  const exp = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  return exp.toISOString();
}

async function syncLicenseFromPaidSession({
  session,
  event,
  restaurantName,
  source,
} = {}) {
  const rid = normalizeTenantId(session?.restaurantId || event?.restaurantId);
  if (!rid) throw new Error("restaurantId_obbligatorio");

  const plan = session?.plan || event?.plan || "ristoword_pro";
  const mode = session?.mode || event?.mode || "subscription";
  const nowIso = new Date().toISOString();
  const expiresAt = computeExpiresAt({ mode });

  // Ensure tenant activation code exists (owner activation uses it).
  let tenantLicense = await licensesRepository.findByRestaurantId(rid);
  if (!tenantLicense) {
    const activationCode = generateActivationCode(rid, event?.id || session?.id);
    tenantLicense = licensesRepository.create({
      restaurantId: rid,
      plan,
      status: "active",
      activationCode,
      source: source || "stripe_webhook",
      createdAt: nowIso,
    });
  } else {
    const nextActivationCode = tenantLicense.activationCode
      ? tenantLicense.activationCode
      : generateActivationCode(rid, event?.id || session?.id);

    tenantLicense = licensesRepository.updateLicense({
      restaurantId: rid,
      plan,
      status: "active",
      activationCode: nextActivationCode,
      source: source || tenantLicense.source || "stripe_webhook",
      startDate: tenantLicense.startDate || nowIso,
      endDate: expiresAt,
      // Note: owner activation = transition active->used happens only via owner-activate endpoint.
    });
  }

  const currentLicense = await getLicense().catch(() => null);
  const licenseRestaurantName = restaurantName || rid;

  // Update global license.json used by requireLicense middleware.
  // This is intentionally not per-tenant; it mirrors the most recent successful payment.
  await saveLicense({
    restaurantName: licenseRestaurantName,
    plan,
    licenseCode: tenantLicense.activationCode || tenantLicense.licenseCode || tenantLicense.licenseKey || (event?.id || session?.id),
    licenseKey: tenantLicense.activationCode || tenantLicense.licenseKey || (event?.id || session?.id),
    activatedAt: currentLicense?.activatedAt || nowIso,
    expiresAt,
    status: "active",
    source: source || "stripe_webhook",
  });

  return {
    tenantLicense,
    expiresAt,
    activationCode: tenantLicense.activationCode || null,
  };
}

module.exports = {
  syncLicenseFromPaidSession,
  generateActivationCode,
};

