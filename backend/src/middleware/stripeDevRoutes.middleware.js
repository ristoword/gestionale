// backend/src/middleware/stripeDevRoutes.middleware.js
// Delega a stripe.routes.js: 404 se dev routes off; in produzione serve anche STRIPE_ALLOW_DEV_IN_PRODUCTION

const { stripeDevRoutesGuard } = require("../routes/stripe.routes");

function stripeDevRoutesOnly(req, res, next) {
  return stripeDevRoutesGuard(req, res, next);
}

module.exports = { stripeDevRoutesOnly };
