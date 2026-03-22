// backend/src/middleware/stripeDevRoutes.middleware.js
// Blocca in produzione route mock/sync Stripe salvo STRIPE_ALLOW_DEV_ROUTES=true

function stripeDevRoutesOnly(req, res, next) {
  if (process.env.NODE_ENV === "production" && String(process.env.STRIPE_ALLOW_DEV_ROUTES || "").toLowerCase() !== "true") {
    return res.status(403).json({
      error: "stripe_dev_route_disabled",
      message:
        "Operazione riservata a sviluppo o recupero manuale. In produzione usa il webhook firmato da Stripe.",
    });
  }
  return next();
}

module.exports = { stripeDevRoutesOnly };
