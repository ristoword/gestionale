const router = require("express").Router();
const stripeWebhookController = require("../controllers/stripeWebhook.controller");

router.post("/webhook", stripeWebhookController.handleStripeWebhook);
router.post("/webhook/sync", stripeWebhookController.syncStripeWebhook);

module.exports = router;

