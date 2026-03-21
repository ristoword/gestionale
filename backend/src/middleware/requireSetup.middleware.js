// Redirect to setup wizard if restaurant not configured
const { isSetupComplete } = require("../config/setup");

const SKIP_PATHS = [
  "/login", "/license", "/setup", "/owner-activate",
  "/super-admin-login", "/dashboard/super-admin-login", "/super-admin-dashboard", "/super-admin-change-password", "/super-admin-console", "/super-admin",
  "/owner-console",
  "/api/auth", "/api/license", "/api/setup", "/api/licenses", "/api/super-admin",
  "/api/checkout", "/api/stripe", "/api/owner",
  "/api/system/health", "/api/health",
  "/qr", "/api/qr",
  "/api/menu/active",
];

function shouldSkip(path) {
  const p = (path || "").split("?")[0];
  return SKIP_PATHS.some((prefix) => p === prefix || p.startsWith(prefix + "/"));
}

async function requireSetup(req, res, next) {
  // DEV bridge: bypass setup wizard during devOwner sessions.
  if (req.devOwner === true) return next();
  if (shouldSkip(req.path)) return next();

  try {
    // Super-admin: può aprire moduli anche se il setup "globale" non è marcato completo
    try {
      const header = req.headers?.cookie || "";
      const token = header.match(/super_admin_session=([^;]+)/)
        ? decodeURIComponent(header.match(/super_admin_session=([^;]+)/)[1].trim())
        : null;
      if (token) {
        const repo = require("../modules/super-admin/super-admin.repository");
        const sa = await repo.verifySessionToken(token);
        if (sa) return next();
      }
    } catch (_) {}

    try {
      const original = String(req.originalUrl || "");
      const shouldLog = original.includes("ownerActivated=1") || original.includes("ownerActivated%3D1");
      if (shouldLog) {
        console.warn("[REDIRECT][requireSetup] check", { from: original, path: req.path });
      }
    } catch (_) {}

    const complete = await isSetupComplete();
    if (complete) return next();

    if (req.xhr || req.headers.accept === "application/json" || req.path.startsWith("/api/")) {
      try {
        const original = String(req.originalUrl || "");
        const shouldLog = original.includes("ownerActivated=1") || original.includes("ownerActivated%3D1");
        if (shouldLog) {
          console.warn("[REDIRECT][requireSetup] api_setup_required_403", { path: req.path });
        }
      } catch (_) {}
      return res.status(403).json({
        error: "setup_required",
        message: "Completa la configurazione iniziale del ristorante.",
      });
    }
    try {
      const original = String(req.originalUrl || "");
      const shouldLog = original.includes("ownerActivated=1") || original.includes("ownerActivated%3D1");
      if (shouldLog) {
        console.warn("[REDIRECT][requireSetup] setup_required -> /setup/setup.html");
      }
    } catch (_) {}
    return res.redirect("/setup/setup.html");
  } catch {
    return next();
  }
}

module.exports = { requireSetup };
