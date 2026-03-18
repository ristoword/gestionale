const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const leaveController = require("../controllers/leave.controller");
const { requireAuth } = require("../middleware/requireAuth.middleware");

// Static paths first (before :id)

// Staff: mie richieste e crea
router.get("/me", requireAuth, asyncHandler(leaveController.me));
router.post("/me", requireAuth, asyncHandler(leaveController.create));
// Staff: annulla richiesta (solo pending)
router.post("/me/:id/cancel", requireAuth, asyncHandler(leaveController.cancel));

// Balances
router.get("/balances/me", requireAuth, asyncHandler(leaveController.balancesMe));
router.get("/balances/:userId", requireAuth, asyncHandler(leaveController.balancesUser));

// Owner: lista e azioni
router.get("/", requireAuth, asyncHandler(leaveController.list));
router.post("/:id/approve", requireAuth, asyncHandler(leaveController.approve));
router.post("/:id/reject", requireAuth, asyncHandler(leaveController.reject));

module.exports = router;
