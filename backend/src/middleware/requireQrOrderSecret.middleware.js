// backend/src/middleware/requireQrOrderSecret.middleware.js
// Protects POST /api/qr/orders from anonymous spam.
// Set QR_ORDER_SECRET in .env and the same value in public/qr/index.html
// meta name="rw-qr-order-key" (content) so the browser can send header X-QR-Order-Key.

const crypto = require("crypto");

function timingSafeEqualString(a, b) {
  const ba = Buffer.from(String(a || ""), "utf8");
  const bb = Buffer.from(String(b || ""), "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * - If QR_ORDER_SECRET is not set → 403 (ordering off; no public POST).
 * - If set → require X-QR-Order-Key header to match (timing-safe).
 */
function requireQrOrderSecret(req, res, next) {
  const secret = String(process.env.QR_ORDER_SECRET || "").trim();
  if (!secret) {
    return res.status(403).json({ error: "QR ordering temporarily disabled" });
  }

  const header = req.headers["x-qr-order-key"];
  const provided = Array.isArray(header) ? header[0] : header;
  if (!timingSafeEqualString(secret, provided)) {
    return res.status(401).json({ error: "Unauthorized QR order request" });
  }

  return next();
}

module.exports = { requireQrOrderSecret };
