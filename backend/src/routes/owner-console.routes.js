// backend/src/routes/owner-console.routes.js
// Owner Console: configurazione iniziale cliente.

const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const ownerConsoleController = require("../controllers/owner-console.controller");
const { requireAuth } = require("../middleware/requireAuth.middleware");
const { requireRole } = require("../middleware/requireRole.middleware");

router.get("/owner-console", requireAuth, requireRole(["owner"]), ownerConsoleController.getOwnerConsolePage);
router.get("/api/owner-console/status", requireAuth, requireRole(["owner"]), asyncHandler(ownerConsoleController.apiGetStatus));
router.post("/api/owner-console/email-settings", requireAuth, requireRole(["owner"]), asyncHandler(ownerConsoleController.apiSaveEmailSettings));
router.post("/api/owner-console/complete", requireAuth, requireRole(["owner"]), asyncHandler(ownerConsoleController.apiCompleteSetup));

module.exports = router;
