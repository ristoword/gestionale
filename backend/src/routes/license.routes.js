const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const licenseController = require("../controllers/license.controller");

// GET /api/licenses (globale)
router.get("/", asyncHandler(licenseController.getLicense));

// GET /api/licenses/validate?code=... – alias GET di verify-code (GS / curl)
router.get("/validate", asyncHandler(licenseController.validateCodeQuery));

// POST /api/licenses/verify-code – verifica codice senza attivare
router.post("/verify-code", asyncHandler(licenseController.verifyCode));

// POST /api/licenses/complete-activation – crea owner, marca licenza, auto-login
router.post("/complete-activation", asyncHandler(licenseController.completeActivation));

// POST /api/license/activate
router.post("/activate", asyncHandler(licenseController.activateLicense));

// POST /api/license/deactivate
router.post("/deactivate", asyncHandler(licenseController.deactivateLicense));

// GET /api/license/status
router.get("/status", asyncHandler(licenseController.getStatus));

module.exports = router;