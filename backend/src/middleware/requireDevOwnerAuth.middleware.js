// backend/src/middleware/requireDevOwnerAuth.middleware.js
//
// Protegge la sezione DEV (owner tecnico) con cookie dedicato.
// - Non dipende da license/trial/stripe/activation/login cliente
// - Usa solo credenziali statiche in .env + HMAC firmato

const crypto = require("crypto");

const DEV_COOKIE_NAME = "rw-dev-access";
const DEV_ENABLED = () => String(process.env.DEV_OWNER_ENABLED || "").toLowerCase() === "true";

function parseCookies(req) {
  const header = req.headers.cookie || "";
  if (!header) return {};
  return header
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const idx = part.indexOf("=");
      if (idx === -1) return acc;
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      acc[key] = val;
      return acc;
    }, {});
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  return crypto.timingSafeEqual(ba, bb);
}

function verifyDevToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split("|");
  if (parts.length !== 3) return null;
  const [emailLower, expStr, sig] = parts;
  const exp = Number(expStr);
  if (!emailLower || !Number.isFinite(exp)) return null;
  if (Date.now() > exp) return null;

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) return null;

  const base = `${emailLower}|${exp}`;
  const expectedSig = crypto.createHmac("sha256", sessionSecret).update(base).digest("hex");
  if (!timingSafeEqualHex(sig, expectedSig)) return null;

  return { email: emailLower, exp };
}

function getCookieValue(req, name) {
  const cookies = parseCookies(req);
  const raw = cookies[name];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function requireDevOwnerAuth(req, res, next) {
  // Owner session (cliente con licenza): sempre consentito per dashboard/status
  if (req.session?.user?.role === "owner" && req.session?.restaurantId) {
    return next();
  }

  if (!DEV_ENABLED()) {
    return res.status(404).send("Not found");
  }

  const token = getCookieValue(req, DEV_COOKIE_NAME);
  const verified = verifyDevToken(token);
  if (verified) {
    req.devOwner = verified;
    return next();
  }

  // redirect per "pagina", 401 per chiamate API
  const acceptsHtml = (req.headers.accept || "").includes("text/html");
  const wantsJson = (req.xhr || req.headers["content-type"] || "").includes("application/json");
  const isStatusEndpoint = req.path.endsWith("/status");

  if (req.method === "GET" && acceptsHtml && !wantsJson && !isStatusEndpoint) {
    const nextUrl = encodeURIComponent(req.originalUrl || req.path);
    return res.redirect(`/dev-access/login?return=${nextUrl}`);
  }
  if (req.method === "GET" && isStatusEndpoint) {
    return res.status(401).json({ error: "non_autenticato_dev" });
  }

  const nextUrl = encodeURIComponent(req.originalUrl || req.path);
  return res.redirect(`/dev-access/login?return=${nextUrl}`);
}

module.exports = { requireDevOwnerAuth, DEV_COOKIE_NAME };

