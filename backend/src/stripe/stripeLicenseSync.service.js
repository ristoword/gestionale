const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { getLicense, saveLicense } = require("../config/license");
const paths = require("../config/paths");
const licensesRepository = require("../repositories/licenses.repository");
const mailService = require("../service/mail.service");

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

/** Sincronizza data/tenants/{rid}/license.json (stesso schema usato da super-admin). */
function writeTenantLicenseMirror(record) {
  const rid = normalizeTenantId(record?.restaurantId);
  if (!rid) return null;
  const tenantLicensePath = paths.tenantDataPath(rid, "license.json");
  const dir = path.dirname(tenantLicensePath);
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    restaurantId: rid,
    plan: record.plan || "",
    status: record.status || "active",
    activationCode: record.activationCode || null,
    expiresAt: record.expiresAt || null,
    source: record.source || "",
    activatedAt: record.activatedAt || null,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(tenantLicensePath, JSON.stringify(payload, null, 2), "utf8");
  return payload;
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
      expiresAt,
      source: source || "stripe_webhook",
      createdAt: nowIso,
      updatedAt: nowIso,
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
      expiresAt,
      source: source || tenantLicense.source || "stripe_webhook",
      updatedAt: nowIso,
      // Note: owner activation = transition active->used happens only via owner-activate endpoint.
    });
  }

  writeTenantLicenseMirror({
    restaurantId: rid,
    plan: tenantLicense.plan,
    status: tenantLicense.status,
    activationCode: tenantLicense.activationCode,
    expiresAt,
    source: tenantLicense.source,
    activatedAt: tenantLicense.activatedAt || null,
  });

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

  const activationCode = tenantLicense.activationCode || null;
  let emailSent = false;
  let emailError = null;
  const customerEmail = session?.customerEmail || null;
  const customerName = session?.customerName || null;

  if (customerEmail && activationCode) {
    try {
      const mailRes = await mailService.sendRistowordActivationEmail({
        to: customerEmail,
        restaurantId: rid,
        activationCode,
        plan,
        expiresAt,
        customerName,
      });
      emailSent = !!mailRes.sent;
      emailError = mailRes.error || null;
    } catch (e) {
      emailError = e && e.message ? e.message : String(e);
    }
  }

  return {
    tenantLicense,
    expiresAt,
    activationCode,
    emailSent,
    emailError,
    ownerActivateUrl: mailService.buildOwnerActivateLink(activationCode, customerEmail),
  };
}

module.exports = {
  syncLicenseFromPaidSession,
  generateActivationCode,
  writeTenantLicenseMirror,
};

