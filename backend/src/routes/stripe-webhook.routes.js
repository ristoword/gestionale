const router = require("express").Router();
const stripeWebhookController = require("../controllers/stripeWebhook.controller");
const { stripeDevRoutesOnly } = require("../middleware/stripeDevRoutes.middleware");

// POST /api/stripe/webhook è registrato in app.js (raw body + firma Stripe).
// Sync manuale eventi mock — stesso gate di checkout mock (Stripe dev + in prod doppia env)
router.post("/webhook/sync", stripeDevRoutesOnly, stripeWebhookController.syncStripeWebhook);

module.exports = router;

