const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const attendanceController = require("../controllers/attendance.controller");
const { requireAuth } = require("../middleware/requireAuth.middleware");

// Utente loggato: storico e oggi (prima di :id)
router.get("/me/today", requireAuth, asyncHandler(attendanceController.meToday));
router.get("/me", requireAuth, asyncHandler(attendanceController.me));

// Owner: lista e daily summary (path statici prima di :id)
router.get("/daily-summary", requireAuth, asyncHandler(attendanceController.dailySummary));
router.get("/", requireAuth, asyncHandler(attendanceController.list));

// Owner: azioni su turno
router.patch("/:id/close", requireAuth, asyncHandler(attendanceController.closeShift));
router.patch("/:id/anomaly", requireAuth, asyncHandler(attendanceController.setAnomaly));

module.exports = router;
