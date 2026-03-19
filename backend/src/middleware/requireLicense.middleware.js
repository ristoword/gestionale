// backend/src/middleware/requireLicense.middleware.js
// Block access if license not activated. Skip for login, license API, QR.

const { getLicense } = require("../config/license");

function parseCookie(header) {
  if (!header || typeof header !== "string") return {};
  return header.split(";").reduce((acc, part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent((rest.join("=") || "").trim());
    return acc;
  }, {});
}

const SKIP_PATHS = [
  "/login",
  "/owner-activate",
  "/super-admin-login",
  "/dashboard/super-admin-login",
  "/owner-console",
  "/super-admin-dashboard",
  "/super-admin-change-password",
  "/super-admin",
  "/api/super-admin",
  "/api/auth",
  "/api/license",
  "/api/licenses",
  "/api/setup",
  "/api/checkout",
  "/api/stripe",
  "/license",
  "/setup",
  "/api/system/health",
  "/api/health",
  "/api/qr",
  "/qr",
  "/api/menu/active",
  "/change-password",
];

function shouldSkipLicenseCheck(path) {
  const p = (path || "").split("?")[0];
  return SKIP_PATHS.some((prefix) => p === prefix || p.startsWith(prefix + "/"));
}

async function requireLicense(req, res, next) {
  // DEV bridge: bypass license activation checks for devOwner sessions.
  if (req.devOwner === true) return next();
  if (shouldSkipLicenseCheck(req.path)) {
    return next();
  }
  try {
    // Temporary redirect diagnostics for owner activation online issues
    // (only logs when ownerActivated=1 is present in the request URL).
    try {
      const original = String(req.originalUrl || "");
      const shouldLog = original.includes("ownerActivated=1") || original.includes("ownerActivated%3D1");
      if (shouldLog) {
        console.warn("[REDIRECT][requireLicense] check", {
          from: original,
          path: req.path,
          ownerActivated: new URLSearchParams(req.query || {}).get("ownerActivated"),
        });
      }
    } catch (_) {}

    // Super-admin autenticato: bypass licenza globale (supporto / ispezione tenant da dashboard)
    try {
      const token = parseCookie(req.headers.cookie).super_admin_session;
      if (token) {
        const superAdminRepository = require("../modules/super-admin/super-admin.repository");
        const saSession = await superAdminRepository.verifySessionToken(token);
        if (saSession) return next();
      }
    } catch (_) {}

    const sessionUser = req.session && req.session.user;
    const isOwner = sessionUser && sessionUser.role === "owner";

    // Owner: può entrare anche senza licenza "used" (es. primo accesso, nessun attivo)
    if (isOwner) {
      const rid = sessionUser.restaurantId || req.session.restaurantId;
      if (!rid) {
        if (String(req.originalUrl || "").includes("ownerActivated=1")) {
          console.warn("[REDIRECT][requireLicense] owner_no_rid -> /login");
        }
        return res.redirect("/login");
      }
      // Non reindirizziamo più a /owner-activate: l'owner può entrare comunque
      // e attivare la licenza quando vuole da /owner-activate o /account
      return next();
    }

    const license = await getLicense();
    const status = license && license.status;
    if (status === "active" || status === "grace") {
      return next();
    }
    if (status === "expired") {
      if (req.xhr || req.headers.accept === "application/json" || req.path.startsWith("/api/")) {
        if (String(req.originalUrl || "").includes("ownerActivated=1")) {
          console.warn("[REDIRECT][requireLicense] expired_api -> 403", { path: req.path });
        }
        return res.status(403).json({ error: "Licenza scaduta", message: "Rinnovare la licenza per continuare." });
      }
      return res.redirect("/license/license.html?expired=1");
    }
    if (!license || status === "unlicensed") {
      if (req.xhr || req.headers.accept === "application/json" || req.path.startsWith("/api/")) {
        if (String(req.originalUrl || "").includes("ownerActivated=1")) {
          console.warn("[REDIRECT][requireLicense] unlicensed_api -> 403", { path: req.path });
        }
        return res.status(403).json({ error: "Licenza non attivata", message: "Attivare la licenza per accedere." });
      }
      return res.redirect("/license/license.html");
    }
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireLicense };