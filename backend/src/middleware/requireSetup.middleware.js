// Redirect to setup wizard if restaurant not configured
const { isSetupComplete } = require("../config/setup");

const SKIP_PATHS = [
  "/login", "/license", "/setup", "/owner-activate",
  "/api/auth", "/api/license", "/api/setup",
  "/api/licenses",
  "/api/checkout", "/api/stripe",
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
