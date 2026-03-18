const { getLicense } = require("../config/license");
const licensesRepository = require("../repositories/licenses.repository");
const stripeMockRepository = require("../stripe/stripeMock.repository");
const stripeWebhookService = require("../stripe/stripeWebhook.service");

function normalizeTenantId(id) {
  return String(id || "").trim();
}

function toSafeInt(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function computeWebhookStatus(state, pendingEventsAll, pendingForTenant) {
  return {
    lastProcessedEventId: state.webhook?.lastProcessedEventId || null,
    lastProcessedAt: state.webhook?.lastProcessedAt || null,
    processedCount: toSafeInt(state.webhook?.processedCount, 0),
    pendingCount: pendingEventsAll.length,
    pendingForTenantCount: pendingForTenant.length,
  };
}

async function buildStripeMockDetails({ tenantId = null } = {}) {
  const tid = normalizeTenantId(tenantId) || "default";

  const stripeEnvKeys = Object.keys(process.env || {}).filter((k) => k.toUpperCase().includes("STRIPE"));
  const keys = {};
  for (const k of stripeEnvKeys) {
    keys[k] = process.env[k] != null && String(process.env[k]).trim().length > 0 ? "present" : "missing";
  }
  const stripeConfigured = Object.values(keys).some((v) => v === "present");

  const state = stripeMockRepository.readState();
  const pendingEventsAll = stripeMockRepository.listUnprocessedEvents(state);
  const pendingForTenant = pendingEventsAll.filter((e) => normalizeTenantId(e.restaurantId) === tid);
  const webhookStatus = computeWebhookStatus(state, pendingEventsAll, pendingForTenant);

  const stripeSession = stripeMockRepository.getLatestSessionForRestaurant(state, tid);

  let localLicenseJson = null;
  try {
    const lic = await getLicense();
    if (lic) {
      localLicenseJson = {
        status: lic.status,
        plan: lic.plan,
        expiresAt: lic.expiresAt || null,
        restaurantName: lic.restaurantName || "",
      };
    }
  } catch (_) {}

  let tenantLicense = null;
  try {
    const rec = await licensesRepository.findByRestaurantId(tid);
    tenantLicense = rec || null;
  } catch (_) {}

  const tenantStatus = tenantLicense?.status || "none";
  const globalValid = !!localLicenseJson && (localLicenseJson.status === "active" || localLicenseJson.status === "grace");

  let mismatch = null;
  if (stripeSession) {
    const s = String(stripeSession.status || "").toLowerCase();
    if (s === "paid") {
      if (!globalValid) mismatch = "Stripe mock ha pagato ma license.json non risulta attivo";
      else if (!(tenantStatus === "active" || tenantStatus === "used"))
        mismatch = "Stripe mock ha pagato ma licenza tenant non risulta active/used";
    } else if (s === "failed") {
      if (globalValid || tenantStatus === "active" || tenantStatus === "used") mismatch = "Stripe mock ha fallito ma local license risulta attiva";
    }
  } else {
    if (stripeConfigured && tenantStatus === "none") mismatch = "Stripe configurato ma nessuna licenza tenant presente (nessun checkout avviato)";
  }

  return {
    stripeEnvKeys: stripeEnvKeys.slice(0, 40),
    keys,
    stripeConfigured,
    mismatch,
    webhookStatus,
    stripeSession,
    localLicenseJson,
    localTenantLicense: tenantLicense,
  };
}

async function apiGetStripeMockStatus(req, res) {
  const tenantId = req.query?.tenantId || req.query?.restaurantId || null;
  const stripe = await buildStripeMockDetails({ tenantId });
  return res.json({ ok: true, stripe });
}

async function apiPostStripeMockSync(req, res) {
  const body = req.body || {};
  const tenantId = body.tenantId || body.restaurantId || req.query?.tenantId || null;
  const stripeSync = await stripeWebhookService.syncPendingWebhooks({ tenantId });
  const stripe = await buildStripeMockDetails({ tenantId });
  return res.json({ ok: true, stripeSync, stripe });
}

module.exports = {
  apiGetStripeMockStatus,
  apiPostStripeMockSync,
};

