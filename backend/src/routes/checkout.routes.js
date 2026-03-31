const router = require("express").Router();
const checkoutController = require("../controllers/checkout.controller");
const { stripeDevRoutesOnly } = require("../middleware/stripeDevRoutes.middleware");

// POST /api/checkout
router.post("/", checkoutController.startCheckout);

// POST /api/checkout/mock/complete — STRIPE_ALLOW_DEV_ROUTES; in produzione anche STRIPE_ALLOW_DEV_IN_PRODUCTION
router.post("/mock/complete", stripeDevRoutesOnly, checkoutController.mockCompleteCheckout);

module.exports = router;

