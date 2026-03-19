// backend/src/controllers/dev-access.controller.js
//
// Area tecnica DEV: accesso tecnico emergenza con credenziali statiche da .env.

const path = require("path");
const crypto = require("crypto");

const devService = require("../dev-access/services/dev-access.service");
const { getModuleTarget } = require("../dev-access/dev-bridge.mapping");

const DEV_ENABLED = () => devService.isDevEnabled();

const DEV_COOKIE_NAME = "rw-dev-access";
const DEV_BRIDGE_TTL_MINUTES = Number(process.env.DEV_BRIDGE_SESSION_TTL_MINUTES || "15");

// Rate limit login dev (best-effort, in-memory only)
const devLoginAttempts = new Map(); // key => {count, firstTs}
const DEV_LOGIN_LIMIT = 6;
const DEV_LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 min

function getClientIp(req) {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0].trim();
  }
  return req.ip || "unknown";
}

function isRateLimited(req, emailLower) {
  const ip = getClientIp(req);
  const key = `${ip}|${emailLower || ""}`;
  const now = Date.now();
  const state = devLoginAttempts.get(key);
  if (!state) return { limited: false, key };
  if (now - state.firstTs > DEV_LOGIN_WINDOW_MS) return { limited: false, key };
  const limited = Number(state.count || 0) >= DEV_LOGIN_LIMIT;
  return { limited, key };
}

function bumpRateLimit(req, emailLower) {
  const ip = getClientIp(req);
  const key = `${ip}|${emailLower || ""}`;
  const now = Date.now();
  const state = devLoginAttempts.get(key);
  if (!state || now - state.firstTs > DEV_LOGIN_WINDOW_MS) {
    devLoginAttempts.set(key, { count: 1, firstTs: now });
  } else {
    state.count = Number(state.count || 0) + 1;
    devLoginAttempts.set(key, state);
  }
}

function clearRateLimit(req, emailLower) {
  const ip = getClientIp(req);
  const key = `${ip}|${emailLower || ""}`;
  devLoginAttempts.delete(key);
}

function setDevCookie(res, token, opts = {}) {
  const sessionSecret = process.env.SESSION_SECRET || "dev";
  const secure = process.env.NODE_ENV === "production";
  const maxAgeMs = opts.maxAgeMs ?? 24 * 60 * 60 * 1000;
  const exp = new Date(Date.now() + maxAgeMs);

  // Value già HMAC; encode per evitare caratteri speciali nell'intestazione.
  const value = encodeURIComponent(token);

  // Manual cookie serialization (evita dipendenze cookie-parser)
  res.setHeader(
    "Set-Cookie",
    [
      `${DEV_COOKIE_NAME}=${value}`,
      `HttpOnly`,
      `Path=/dev-access`,
      `Expires=${exp.toUTCString()}`,
      `Max-Age=${Math.floor(maxAgeMs / 1000)}`,
      `SameSite=Lax`,
      secure ? `Secure` : ``,
    ]
      .filter(Boolean)
      .join("; ")
  );
}

function clearDevCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${DEV_COOKIE_NAME}=; Path=/dev-access; Max-Age=0; HttpOnly; SameSite=Lax`
  );
}

function restorePrevSessionIfDevBridgeSaved(req) {
  if (!req || !req.session) return;

  const hasPrevUser = Object.prototype.hasOwnProperty.call(req.session, "_devPrevUser");
  const hasPrevRestaurantId = Object.prototype.hasOwnProperty.call(req.session, "_devPrevRestaurantId");

  if (hasPrevUser) {
    req.session.user = req.session._devPrevUser;
  } else if (req.session.user) {
    delete req.session.user;
  }

  if (hasPrevRestaurantId) {
    req.session.restaurantId = req.session._devPrevRestaurantId;
  } else if (req.session.restaurantId) {
    delete req.session.restaurantId;
  }

  delete req.session._devPrevUser;
  delete req.session._devPrevRestaurantId;
}

function createDevBridgeSession(req, { tenantId } = {}) {
  if (!req || !req.session) return;

  const rid = String(tenantId || "").trim() || req.session.restaurantId || "default";

  // Save current session to restore on logout / expiry.
  const hasPrevUser = Object.prototype.hasOwnProperty.call(req.session, "_devPrevUser");
  if (!hasPrevUser) {
    req.session._devPrevUser = req.session.user;
    req.session._devPrevRestaurantId = req.session.restaurantId;
  }

  // Technical DEV session:
  // - mark devOwner for bypass in global middlewares
  // - impersonate owner user so existing controllers (ensureOwner) work unchanged
  req.session.devOwner = true;
  req.session.devOwnerExpiresAt = Date.now() + DEV_BRIDGE_TTL_MINUTES * 60 * 1000;
  req.session.restaurantId = rid;
  req.session.user = {
    id: "dev-owner-bridge",
    username: "dev-owner-bridge",
    role: "owner",
    department: "dev",
    mustChangePassword: false,
    restaurantId: rid,
  };
}

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

let expectedPasswordHashCache = null;
function getExpectedPasswordHash() {
  if (expectedPasswordHashCache != null) return expectedPasswordHashCache;
  const pwd = String(process.env.DEV_OWNER_PASSWORD || "");
  expectedPasswordHashCache = devService.sha256Hex(pwd);
  return expectedPasswordHashCache;
}

function verifyStaticCredentials(email, password) {
  if (!DEV_ENABLED()) return false;
  const expectedEmail = normalizeEmail(process.env.DEV_OWNER_EMAIL);
  if (!expectedEmail) return false;

  const actualEmail = normalizeEmail(email);
  if (!actualEmail || !timingSafeEqual(actualEmail, expectedEmail)) return false;
  if (!password || typeof password !== "string") return false;

  const actualHash = devService.sha256Hex(password);
  const expectedHash = getExpectedPasswordHash();
  if (!expectedHash) return false;
  if (!timingSafeEqual(actualHash, expectedHash)) return false;
  return true;
}

function buildDevToken(emailLower) {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) throw new Error("SESSION_SECRET mancante");

  const expMs = 24 * 60 * 60 * 1000; // 24h
  const exp = Date.now() + expMs;
  const expStr = String(Math.floor(exp));
  const base = `${emailLower}|${expStr}`;
  const sig = crypto.createHmac("sha256", sessionSecret).update(base).digest("hex");
  return `${emailLower}|${expStr}|${sig}`;
}

function devTemplatesBase() {
  return path.join(__dirname, "..", "dev-access");
}

function htmlPath(name) {
  return path.join(devTemplatesBase(), name);
}

// GET /dev-access/login
async function getDevLogin(req, res) {
  return res.sendFile(htmlPath("login.html"));
}

// POST /dev-access/login
async function postDevLogin(req, res) {
  const { email, password } = req.body || {};
  const emailLower = normalizeEmail(email);

  const rate = isRateLimited(req, emailLower);
  if (rate.limited) {
    bumpRateLimit(req, emailLower);
    return res.status(429).json({ success: false, error: "rate_limited" });
  }

  const ok = verifyStaticCredentials(email, password);
  if (!ok) {
    bumpRateLimit(req, emailLower);
    try {
      await devService.appendDevLog({
        event: "login_failed",
        ts: new Date().toISOString(),
        ip: getClientIp(req),
        emailHash: emailLower ? devService.sha256Hex(emailLower) : null,
      });
    } catch (_) {}
    return res.status(401).json({ success: false, error: "credenziali_dev_invalide" });
  }

  clearRateLimit(req, emailLower);

  try {
    await devService.appendDevLog({
      event: "login_success",
      ts: new Date().toISOString(),
      ip: getClientIp(req),
      emailHash: emailLower ? devService.sha256Hex(emailLower) : null,
    });
  } catch (_) {}

  const token = buildDevToken(emailLower);
  setDevCookie(res, token, { maxAgeMs: 24 * 60 * 60 * 1000 });
  return res.json({ success: true });
}

// POST/GET /dev-access/logout
async function logout(req, res) {
  clearDevCookie(res);

  // Cancel DEV bridge session + restore previous user context (if any).
  try {
    if (req.session && req.session.devOwner === true) {
      restorePrevSessionIfDevBridgeSaved(req);
    } else if (req.session) {
      // If keys exist but devOwner flag was already cleared by expiry middleware.
      restorePrevSessionIfDevBridgeSaved(req);
    }
    if (req.session) {
      delete req.session.devOwner;
      delete req.session.devOwnerExpiresAt;
    }
  } catch (_) {}

  try {
    await devService.appendDevLog({
      event: "logout",
      ts: new Date().toISOString(),
      ip: getClientIp(req),
    });
  } catch (_) {}
  // redirect solo se navigazione browser
  if ((req.headers.accept || "").includes("text/html")) {
    return res.redirect("/dev-access/login");
  }
  return res.json({ success: true });
}

// GET /dev-access/dashboard
async function getDevDashboard(req, res) {
  return res.sendFile(htmlPath("dashboard.html"));
}

// GET /dev-access/open/:module
// Creates a short-lived technical devOwner session and redirects to the real module page.
async function openModule(req, res) {
  const moduleName = req.params && req.params.module ? String(req.params.module) : "";
  const tenantId = req.query && req.query.tenantId ? String(req.query.tenantId) : null;

  const target = getModuleTarget(moduleName);
  if (!target) return res.status(404).send("Module non riconosciuto");

  // Create dev bridge session.
  try {
    createDevBridgeSession(req, { tenantId });
  } catch (e) {
    // Non bloccare: la sessione rimane best-effort.
  }

  return res.redirect(target.targetPath);
}

// GET /dev-access/status
async function getDevStatus(req, res) {
  const tenantId = (req.query?.tenantId && String(req.query.tenantId).trim()) || req.session?.restaurantId || null;

  let system = null;
  let licenses = null;
  let users = null;
  let stripe = null;
  let operations = null;
  let business = null;
  let logs = [];
  try {
    system = await devService.getSystemSnapshot({ tenantId });
    licenses = await devService.getLicensesSnapshot({ tenantId });
    users = await devService.getUsersSnapshot({ tenantId });
    stripe = await devService.getStripeStatus({ tenantId });
    operations = await devService.getOperationsSnapshot({ tenantId });
    business = await devService.getBusinessSnapshot({ tenantId });
    logs = await devService.listDevLogs(30);
  } catch (err) {
    // Non bloccare: ritorna anche se alcuni moduli falliscono
    system = system || { environment: process.env.NODE_ENV || "unknown", version: "ristoword-dev" };
    licenses = licenses || { licensesCount: 0, licenses: [], totalLicenses: 0 };
    users = users || { usersCount: 0, sample: [] };
    stripe = stripe || { stripeEnvKeys: [], keys: {}, stripeConfigured: false };
  }

  const currentTenant = req.session?.restaurantId || tenantId || null;
  const status = {
    ...system,
    devOwnerAuthenticated: true,
    tenantId: tenantId || currentTenant,
    currentTenant: currentTenant,
    localLicenses: {
      decoratedLicense: system.localLicense || null,
      // Compatibilità con dashboard attuale: campo “licensesRecords”
      licensesRecords: licenses.licenses || [],
      licensesCount: licenses.totalLicenses ?? licenses.licensesCount ?? 0,
    },
    localUsers: {
      usersCount: users.usersCount ?? 0,
      sample: users.sample || [],
    },
    stripe: {
      stripeEnvKeys: stripe.stripeEnvKeys || [],
      keys: stripe.keys || {},
      hasAnyStripeConfig: !!stripe.stripeConfigured,
      mismatch: stripe.mismatch || null,
    },
    fileProbes: system.fileProbes || {},
    operations,
    business,
    devLogs: logs,
    tenants: await devService.listTenantsForUi(),
    quickLinks: {
      systemHealth: "/api/system/health",
      apiStatus: "/api/health",
      publicMenuActive: "/api/menu/active",
      dashboardOperational: "/dashboard",
      ownerActivate: "/owner-activate",
      devLicenses: "/dev-access/api/licenses",
      devOperations: "/dev-access/api/operations",
    },
  };

  try {
    // Best-effort: registra accesso “status” anonimo su base IP.
    await devService.appendDevLog({
      event: "dev_status_view",
      ts: new Date().toISOString(),
      ip: getClientIp(req),
      tenantId: tenantId || null,
    });
  } catch (_) {}

  return res.json(status);
}

function getTenantIdFromReq(req) {
  if (!req || !req.query) return null;
  const tid = req.query.tenantId;
  if (tid == null) return null;
  const s = String(tid).trim();
  return s || null;
}

// =============================
// DEV API (step 3-10)
// =============================

async function apiGetTenants(req, res) {
  const data = await devService.listTenantsForUi();
  res.json(data);
}

async function apiGetLicenses(req, res) {
  const tenantId = getTenantIdFromReq(req);
  const data = await devService.getLicensesSnapshot({ tenantId });
  res.json(data);
}

async function apiGetUsers(req, res) {
  const tenantId = getTenantIdFromReq(req);
  const data = await devService.getUsersSnapshot({ tenantId });
  res.json(data);
}

async function apiGetStripeStatus(req, res) {
  const tenantId = getTenantIdFromReq(req);
  const data = await devService.getStripeStatus({ tenantId });
  res.json(data);
}

async function apiGetOperations(req, res) {
  const tenantId = getTenantIdFromReq(req);
  const data = await devService.getOperationsSnapshot({ tenantId });
  res.json(data);
}

async function apiGetBusiness(req, res) {
  const tenantId = getTenantIdFromReq(req);
  const data = await devService.getBusinessSnapshot({ tenantId });
  res.json(data);
}

async function apiGetLogs(req, res) {
  const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const logs = await devService.listDevLogs(limit);
  res.json({ limit, logs });
}

async function apiPostActionUnlockUser(req, res) {
  const body = req.body || {};
  const result = await devService.performActionUnlockUser({
    userId: body.userId,
    username: body.username,
    tenantId: body.tenantId || getTenantIdFromReq(req),
  });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
}

async function apiPostActionResetLicense(req, res) {
  const body = req.body || {};
  const tenantId = body.tenantId || getTenantIdFromReq(req);
  const result = await devService.performActionResetLicense({ tenantId });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
}

async function apiPostActionForceActivate(req, res) {
  const body = req.body || {};
  const tenantId = body.tenantId || getTenantIdFromReq(req);
  const result = await devService.performActionForceActivate({
    tenantId,
    plan: body.plan,
  });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
}

async function apiPostActionClearTemp(req, res) {
  const body = req.body || {};
  const tenantId = body.tenantId || getTenantIdFromReq(req);
  const result = await devService.performActionClearTemp({ tenantId });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
}

async function apiPostActionToggleModule(req, res) {
  const body = req.body || {};
  const tenantId = body.tenantId || getTenantIdFromReq(req);
  const result = await devService.performActionToggleModule({
    tenantId,
    moduleName: body.moduleName,
    enabled: body.enabled,
  });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
}

async function apiPostActionExtendTrial(req, res) {
  const body = req.body || {};
  const tenantId = body.tenantId || getTenantIdFromReq(req);
  const days = body.days || 30;
  const result = await devService.performActionExtendTrial({ tenantId, days });
  if (!result.ok) return res.status(400).json(result);
  res.json(result);
}

module.exports = {
  getDevLogin,
  postDevLogin,
  logout,
  getDevDashboard,
  getDevStatus,
  openModule,
  // step 3-10 api
  apiGetTenants,
  apiGetLicenses,
  apiGetUsers,
  apiGetStripeStatus,
  apiGetOperations,
  apiGetBusiness,
  apiGetLogs,
  apiPostActionUnlockUser,
  apiPostActionResetLicense,
  apiPostActionForceActivate,
  apiPostActionClearTemp,
  apiPostActionToggleModule,
  apiPostActionExtendTrial,
  DEV_COOKIE_NAME,
};

