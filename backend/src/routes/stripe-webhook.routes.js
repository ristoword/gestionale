const router = require("express").Router();
const stripeWebhookController = require("../controllers/stripeWebhook.controller");
const { stripeDevRoutesOnly } = require("../middleware/stripeDevRoutes.middleware");

// POST /api/stripe/webhook è registrato in app.js (raw body + firma Stripe).
// Sync manuale eventi mock — solo dev o STRIPE_ALLOW_DEV_ROUTES=true in produzione
router.post("/webhook/sync", stripeDevRoutesOnly, stripeWebhookController.syncStripeWebhook);

module.exports = router;

