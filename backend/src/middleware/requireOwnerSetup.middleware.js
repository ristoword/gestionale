// backend/src/middleware/requireOwnerSetup.middleware.js
// Redirect to /dev-access/dashboard se ownerSetupCompleted !== true.
// L'**owner** può sempre accedere ai moduli (esplora app prima di creare staff / completare wizard).
// Staff e altri ruoli restano bloccati finché l'owner non marca il setup come completato.

const { isOwnerSetupComplete } = require("../config/ownerSetup");
const { getTenantIdFromRequest } = require("../context/tenantContext");

const OWNER_CONSOLE_PATH = "/dev-access/dashboard";

/** Path esatti o prefissi da non bloccare */
function shouldSkip(pathname) {
  const p = (pathname || "").split("?")[0];
  if (p === "/dev-access/dashboard" || p === "/dev-access" || p.startsWith("/dev-access/status")) return true;
  if (p.startsWith("/api/owner-console") || p.startsWith("/dev-access")) return true;
  if (p.startsWith("/api/staff")) return true; // owner usa staff API durante setup
  if (p.startsWith("/api/auth") || p.startsWith("/api/licenses")) return true;
  if (p.startsWith("/login") || p.startsWith("/owner-activate")) return true;
  if (p.startsWith("/super-admin")) return true; // super-admin bypass
  if (p.startsWith("/api/super-admin")) return true;
  if (p.startsWith("/dev-access")) return true;
  if (p === "/api/system/health" || p === "/api/health") return true;
  if (p.startsWith("/qr") || p.startsWith("/api/qr")) return true;
  if (p === "/api/menu/active") return true;
  if (p.startsWith("/change-password")) return true;
  if (p.startsWith("/setup")) return true;
  if (p.startsWith("/license")) return true;
  if (p.startsWith("/api/setup") || p.startsWith("/api/checkout") || p.startsWith("/api/stripe") || p.startsWith("/api/owner")) return true;
  return false;
}

/** Super-admin: bypass tramite cookie */
async function isSuperAdminRequest(req) {
  try {
    const cookie = req.headers?.cookie || "";
    const match = cookie.match(/super_admin_session=([^;]+)/);
    const token = match ? decodeURIComponent(match[1].trim()) : null;
    if (!token) return false;
    const repo = require("../modules/super-admin/super-admin.repository");
    const session = await repo.verifySessionToken(token);
    return !!session;
  } catch {
    return false;
  }
}

async function requireOwnerSetup(req, res, next) {
  if (shouldSkip(req.path)) return next();

  // Super-admin: bypass totale
  if (req.superAdmin === true) return next();
  if (await isSuperAdminRequest(req)) return next();

  // Dev owner (accesso tecnico emergenza): bypass
  if (req.devOwner === true) return next();

  // Utente non autenticato: lascia che requirePageAuth/requireAuth gestiscano
  const sessionUser = req.session?.user;
  if (!sessionUser) return next();

  // Owner: può usare dashboard, sala, cassa, ecc. anche senza aver ancora completato il wizard / creato dipendenti
  if (String(sessionUser.role || "").toLowerCase() === "owner") {
    return next();
  }

  const restaurantId = getTenantIdFromRequest(req);
  if (!restaurantId) return next();

  const complete = await isOwnerSetupComplete(restaurantId);
  if (complete) return next();

  // Staff / supervisor / altri: finché l'owner non completa il setup, solo console dev-access
  return res.redirect(OWNER_CONSOLE_PATH);
}

module.exports = { requireOwnerSetup, OWNER_CONSOLE_PATH };
