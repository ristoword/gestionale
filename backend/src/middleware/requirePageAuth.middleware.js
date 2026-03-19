// backend/src/middleware/requirePageAuth.middleware.js
// Redirect to login if requesting a protected page without session.
// Use before express.static for HTML page requests.
// Super-admin: se cookie super_admin_session è valido, può accedere a tutte le pagine.

const LOGIN_PATH = "/login/login.html";

function parseCookieHeader(header) {
  if (!header || typeof header !== "string") return {};
  return header.split(";").reduce((acc, part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent((rest.join("=") || "").trim());
    return acc;
  }, {});
}

const PROTECTED_PATTERNS = [
  /^\/owner-console$/,
  /^\/owner-console\/.*/,
  /^\/change-password$/,
  /^\/change-password\/change-password\.html$/,
  /^\/dashboard\/dashboard\.html$/,
  /^\/sala\/sala\.html$/,
  /^\/cucina\/cucina\.html$/,
  /^\/pizzeria\/pizzeria\.html$/,
  /^\/bar\/bar\.html$/,
  /^\/magazzino\/magazzino\.html$/,
  /^\/cassa\/cassa\.html$/,
  /^\/cassa\/chiusura\.html$/,
  /^\/prenotazioni\/prenotazioni\.html$/,
  /^\/catering\/catering\.html$/,
  /^\/staff\/staff\.html$/,
  /^\/asporto\/asporto\.html$/,
  /^\/supervisor\/supervisor\.html$/,
  /^\/supervisor\/staff\/staff\.html$/,
  /^\/supervisor\/customers\/customers\.html$/,
  /^\/hardware\/hardware\.html$/,
  /^\/qr-tables\/qr-tables\.html$/,
  /^\/menu-admin\/menu-admin\.html$/,
  /^\/daily-menu\/daily-menu\.html$/,
];

function isProtectedPath(pathname) {
  const p = (pathname || "").split("?")[0];
  return PROTECTED_PATTERNS.some((re) => re.test(p));
}

async function requirePageAuth(req, res, next) {
  if (req.method !== "GET") return next();
  if (!isProtectedPath(req.path)) return next();
  // DEV bridge: bypass login redirect for dev sessions.
  if (req.devOwner === true) return next();
  if (req.session && req.session.user) return next();

  // Super-admin: se ha cookie super_admin_session valido, può entrare in tutte le pagine.
  try {
    const cookie = parseCookieHeader(req.headers.cookie);
    const token = cookie.super_admin_session;
    if (token) {
      const superAdminRepository = require("../modules/super-admin/super-admin.repository");
      const session = await superAdminRepository.verifySessionToken(token);
      if (session) {
        return next();
      }
    }
  } catch (_) {}

  const returnTo = encodeURIComponent(req.originalUrl || req.path);
  const dest = LOGIN_PATH + (returnTo ? "?return=" + returnTo : "");

  // Temporary redirect diagnostics (only when ownerActivated flag is involved)
  try {
    const original = String(req.originalUrl || "");
    const shouldLog = original.includes("ownerActivated=1") || original.includes("ownerActivated%3D1");
    if (shouldLog) {
      console.warn("[REDIRECT][requirePageAuth]", {
        from: original,
        path: req.path,
        ownerActivated: new URLSearchParams(req.query || {}).get("ownerActivated"),
        reason: "protected_page_without_session",
        to: dest,
      });
    }
  } catch (_) {}

  return res.redirect(dest);
}

module.exports = { requirePageAuth, isProtectedPath };
