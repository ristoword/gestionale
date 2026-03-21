const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const ownerController = require("../controllers/owner.controller");
const gsSyncController = require("../controllers/gsSync.controller");

router.post("/complete-activation", asyncHandler(ownerController.completeActivation));

/** Import batch codici da GS → mirror locale (X-GS-Sync-Secret) */
router.post(
  "/gs-import-codes",
  gsSyncController.requireSyncSecret,
  asyncHandler(gsSyncController.postImportCodes)
);
/** Statistiche mirror (solo diagnostica) */
router.get(
  "/gs-mirror-stats",
  gsSyncController.requireSyncSecret,
  asyncHandler(gsSyncController.getMirrorStats)
);

module.exports = router;
