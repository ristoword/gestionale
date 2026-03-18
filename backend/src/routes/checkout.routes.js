const router = require("express").Router();
const checkoutController = require("../controllers/checkout.controller");

// POST /api/checkout
router.post("/", checkoutController.startCheckout);

// POST /api/checkout/mock/complete
router.post("/mock/complete", checkoutController.mockCompleteCheckout);

module.exports = router;

