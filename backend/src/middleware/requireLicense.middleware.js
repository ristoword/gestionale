// backend/src/middleware/requireLicense.middleware.js
// Enforces an active tenant license for authenticated traffic. Public activation/login paths stay open.

const { getTenantIdFromRequest } = require("../context/tenantContext");
const { hasValidLicenseForRestaurant } = require("../utils/licenseValidation");

const LICENSE_PAGE = "/license/license.html";

/**
 * Paths allowed without a valid license (align with requireSetup + operational needs).
 * Use prefix match: path === prefix || path.startsWith(prefix + "/")
 */
const SKIP_PREFIXES = [
  "/login",
  "/license",
  "/setup",
  "/owner-activate",
  "/owner-console",
  "/super-admin-login",
  "/dashboard/super-admin-login",
  "/super-admin-dashboard",
  "/super-admin-change-password",
  "/super-admin-console",
  "/super-admin",
  "/dev-access",
  "/api/auth",
  "/api/setup",
  "/api/licenses",
  "/api/license",
  "/api/checkout",
  "/api/stripe",
  "/api/owner",
  "/api/super-admin",
  "/api/system/health",
  "/api/health",
  "/qr",
  "/api/qr",
  "/api/menu/active",
  "/icons",
];

function pathMatchesSkip(pathname) {
  const p = (pathname || "").split("?")[0];
  return SKIP_PREFIXES.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}

function isStaticAssetPath(p) {
  return /\.(css|js|map|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|eot)$/i.test(p || "");
}

async function isSuperAdminCookieOk(req) {
  try {
    const header = req.headers?.cookie || "";
    const m = header.match(/super_admin_session=([^;]+)/);
    const token = m ? decodeURIComponent(m[1].trim()) : null;
    if (!token) return false;
    const repo = require("../modules/super-admin/super-admin.repository");
    const session = await repo.verifySessionToken(token);
    return !!session;
  } catch {
    return false;
  }
}

async function requireLicense(req, res, next) {
  if (req.method === "OPTIONS") return next();

  const p = (req.path || "").split("?")[0];

  if (pathMatchesSkip(p) || isStaticAssetPath(p)) {
    return next();
  }

  if (req.devOwner === true) return next();

  try {
    if (await isSuperAdminCookieOk(req)) return next();
  } catch (_) {
    /* continue */
  }

  // Unauthenticated: allow reaching login / public pages; API protection happens at requireAuth.
  if (!req.session || !req.session.user) {
    return next();
  }

  const restaurantId = getTenantIdFromRequest(req);
  try {
    const ok = await hasValidLicenseForRestaurant(restaurantId);
    if (ok) return next();
  } catch (e) {
    console.warn("[requireLicense] validation error:", e && e.message ? e.message : e);
    return res.status(503).json({
      error: "license_check_failed",
      message: "Impossibile verificare la licenza. Riprova tra poco.",
    });
  }

  const wantsJson =
    (req.headers.accept && String(req.headers.accept).includes("application/json")) ||
    (req.path && String(req.path).startsWith("/api/")) ||
    req.xhr === true;

  if (wantsJson || p.startsWith("/api/")) {
    return res.status(403).json({
      error: "license_required",
      message:
        "Licenza non attiva o scaduta. Completa l'attivazione o contatta l'amministratore.",
    });
  }

  const dest = `${LICENSE_PAGE}?reason=required`;
  return res.redirect(302, dest);
}

module.exports = { requireLicense };
