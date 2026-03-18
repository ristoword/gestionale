// backend/src/controllers/dev-access.controller.js
//
// Area tecnica DEV: accesso tecnico emergenza con credenziali statiche da .env.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { getLicense } = require("../config/license");
const licensesRepository = require("../repositories/licenses.repository");
const usersRepository = require("../repositories/users.repository");
const { safeReadJson } = require("../utils/safeFileIO");

const DEV_ENABLED = () => String(process.env.DEV_OWNER_ENABLED || "").toLowerCase() === "true";

const DEV_COOKIE_NAME = "rw-dev-access";

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

function timingSafeEqual(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function verifyStaticCredentials(email, password) {
  if (!DEV_ENABLED()) return false;
  const expectedEmail = normalizeEmail(process.env.DEV_OWNER_EMAIL);
  const expectedPassword = String(process.env.DEV_OWNER_PASSWORD || "");
  if (!expectedEmail || !expectedPassword) return false;

  const actualEmail = normalizeEmail(email);
  if (!actualEmail || !timingSafeEqual(actualEmail, expectedEmail)) return false;
  if (!password || typeof password !== "string") return false;
  if (!timingSafeEqual(password, expectedPassword)) return false;
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

function getProbe(filePath, fallback = null) {
  try {
    const exists = fs.existsSync(filePath);
    if (!exists) return { exists: false, ok: false, error: "missing" };
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return { exists: true, ok: false, error: "empty" };
    const parsed = JSON.parse(raw);
    return { exists: true, ok: true, keys: parsed && typeof parsed === "object" ? Object.keys(parsed).slice(0, 8) : typeof parsed, valueSample: fallback };
  } catch (err) {
    return { exists: fs.existsSync(filePath), ok: false, error: err.message };
  }
}

// GET /dev-access/login
async function getDevLogin(req, res) {
  return res.sendFile(htmlPath("login.html"));
}

// POST /dev-access/login
async function postDevLogin(req, res) {
  const { email, password } = req.body || {};
  if (!verifyStaticCredentials(email, password)) {
    return res.status(401).json({ success: false, error: "credenziali_dev_invalide" });
  }

  const emailLower = normalizeEmail(email);
  const token = buildDevToken(emailLower);
  setDevCookie(res, token, { maxAgeMs: 24 * 60 * 60 * 1000 });
  return res.json({ success: true });
}

// POST/GET /dev-access/logout
async function logout(req, res) {
  clearDevCookie(res);
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

// GET /dev-access/status
async function getDevStatus(req, res) {
  const now = new Date();
  const serverTime = now.toISOString();
  const uptimeMs = process.uptime() * 1000;
  const uptimeStr = `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`;

  let licenseDecorated = null;
  try {
    licenseDecorated = await getLicense();
  } catch (_) {}

  let licenseRecords = [];
  try {
    licenseRecords = (await licensesRepository.readLicenses()) || [];
  } catch (err) {
    licenseRecords = [];
  }

  let users = [];
  try {
    users = (await usersRepository.readUsers()) || [];
  } catch (_) {
    users = [];
  }

  const stripeEnvKeys = Object.keys(process.env || {}).filter((k) => k.toUpperCase().includes("STRIPE"));
  const stripeKeys = stripeEnvKeys.reduce((acc, k) => {
    const present = process.env[k] != null && String(process.env[k]).trim().length > 0;
    acc[k] = present ? "present" : "missing";
    return acc;
  }, {});

  // Probing file accessibile (non modifica dati)
  const probes = {};
  const repoRoot = path.join(__dirname, "..", "..");
  const dataDir = path.join(repoRoot, "data");
  probes.licenseJson = getProbe(path.join(dataDir, "license.json"));
  probes.licensesJson = getProbe(path.join(dataDir, "licenses.json"));
  probes.usersJson = getProbe(path.join(dataDir, "users.json"));

  // Default tenant probes (tenant-aware già gestito per i moduli reali, qui serve solo “accesso a file”)
  const tenantsDir = path.join(dataDir, "tenants");
  try {
    if (fs.existsSync(tenantsDir)) {
      const tenantIds = fs.readdirSync(tenantsDir).slice(0, 6);
      probes.tenantsSample = tenantIds.map((rid) => {
        const tDir = path.join(tenantsDir, rid);
        const hasClosures = fs.existsSync(path.join(tDir, "closures.json"));
        const hasStorni = fs.existsSync(path.join(tDir, "storni.json"));
        const hasReports = fs.existsSync(path.join(tDir, "reports.json"));
        return { restaurantId: rid, hasClosures, hasStorni, hasReports };
      });
    }
  } catch (_) {}

  // Stato backend minimo: controlla anche oggetti richiesti del runtime
  const status = {
    serverTime,
    uptime: uptimeStr,
    environment: process.env.NODE_ENV || "unknown",
    version: process.env.RISTOWORD_VERSION || "ristoword-dev",
    node: { version: process.version, platform: process.platform },
    devOwnerAuthenticated: true,
    localLicenses: {
      decoratedLicense: licenseDecorated,
      licensesRecords: licenseRecords.slice(0, 15),
      licensesCount: licenseRecords.length,
    },
    localUsers: {
      usersCount: users.length,
      sample: users.slice(0, 25).map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        department: u.department,
        restaurantId: u.restaurantId,
        is_active: u.is_active,
        mustChangePassword: u.mustChangePassword === true,
      })),
    },
    stripe: {
      stripeEnvKeys,
      keys: stripeKeys,
      hasAnyStripeConfig: stripeEnvKeys.length > 0 && Object.values(stripeKeys).some((v) => v === "present"),
    },
    fileProbes: probes,
    quickLinks: {
      systemHealth: "/api/system/health",
      publicMenuActive: "/api/menu/active",
      dashboardOperational: "/dashboard",
      ownerActivate: "/owner-activate",
    },
  };

  return res.json(status);
}

module.exports = {
  getDevLogin,
  postDevLogin,
  logout,
  getDevDashboard,
  getDevStatus,
  DEV_COOKIE_NAME,
};

