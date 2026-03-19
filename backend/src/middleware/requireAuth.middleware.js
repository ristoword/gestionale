// backend/src/middleware/requireAuth.middleware.js
// Requires req.session.user. Use after express-session.
// Super-admin: se cookie super_admin_session valido, può chiamare le API.

function parseCookie(header) {
  if (!header || typeof header !== "string") return {};
  return header.split(";").reduce((acc, part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent((rest.join("=") || "").trim());
    return acc;
  }, {});
}

async function requireAuth(req, res, next) {
  // DEV bridge: trusted session created via /dev-access/open/:module
  if (req.devOwner === true) return next();
  if (req.session && req.session.user) return next();

  // Super-admin: cookie valido = accesso alle API; imposta contesto owner/default per tenant
  try {
    const cookie = parseCookie(req.headers.cookie);
    const token = cookie.super_admin_session;
    if (token) {
      const superAdminRepository = require("../modules/super-admin/super-admin.repository");
      const session = await superAdminRepository.verifySessionToken(token);
      if (session) {
        req.superAdmin = true;
        req.session = req.session || {};
        // Mantieni tenant scelto da Super Admin (POST /api/super-admin/working-tenant)
        const rid = req.session.restaurantId && String(req.session.restaurantId).trim() !== ""
          ? String(req.session.restaurantId).trim()
          : "default";
        req.session.restaurantId = rid;
        req.session.user = req.session.user || { role: "owner", restaurantId: rid, username: "superadmin" };
        req.session.user.restaurantId = req.session.restaurantId;
        return next();
      }
    }
  } catch (_) {}

  return res.status(401).json({ error: "Non autenticato", message: "Effettua il login." });
}

module.exports = { requireAuth };
