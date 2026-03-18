// backend/src/middleware/requireLicense.middleware.js
// Block access if license not activated. Skip for login, license API, QR.

const { getLicense } = require("../config/license");
const { hasUsedLicense } = require("../repositories/licenses.repository");

const SKIP_PATHS = [
  "/login",
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
    const sessionUser = req.session && req.session.user;
    // Owner: richiede sempre una licenza per-restaurant "used"
    if (sessionUser && sessionUser.role === "owner") {
      const rid = sessionUser.restaurantId || req.session.restaurantId;
      if (!rid) {
        return res.redirect("/login");
      }
      const ok = hasUsedLicense(rid);
      if (!ok) {
        return res.redirect("/owner-activate");
      }
    }

    const license = await getLicense();
    const status = license && license.status;
    if (status === "active" || status === "grace") {
      return next();
    }
    if (status === "expired") {
      if (req.xhr || req.headers.accept === "application/json" || req.path.startsWith("/api/")) {
        return res.status(403).json({ error: "Licenza scaduta", message: "Rinnovare la licenza per continuare." });
      }
      return res.redirect("/license/license.html?expired=1");
    }
    if (!license || status === "unlicensed") {
      if (req.xhr || req.headers.accept === "application/json" || req.path.startsWith("/api/")) {
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