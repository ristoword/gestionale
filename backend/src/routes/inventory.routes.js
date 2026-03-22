// backend/src/routes/inventory.routes.js
// Route -> controller -> repository. No direct file access.

const express = require("express");
const asyncHandler = require("../utils/asyncHandler");
const inventoryController = require("../controllers/inventory.controller");

const router = express.Router();

router.get("/", asyncHandler(inventoryController.listInventory));
router.get("/value", asyncHandler(inventoryController.getInventoryValue));
router.get("/transfers", asyncHandler(inventoryController.listTransfers));
router.patch("/transfers/:transferId", asyncHandler(inventoryController.patchLoadTransfer));
router.post("/email-supplier", asyncHandler(inventoryController.emailSupplier));
router.get("/barcode/:code", asyncHandler(inventoryController.getByBarcode));
router.post("/receive/voice-preview", asyncHandler(inventoryController.voicePreview));
router.post("/receive", asyncHandler(inventoryController.receive));
router.post("/", asyncHandler(inventoryController.createInventory));
router.post("/transfer", asyncHandler(inventoryController.transferInventory));
router.post("/return", asyncHandler(inventoryController.returnToCentral));
router.patch("/:id/adjust", asyncHandler(inventoryController.adjustInventory));
router.get("/:id", asyncHandler(inventoryController.getInventoryById));
router.patch("/:id", asyncHandler(inventoryController.updateInventory));
router.delete("/:id", asyncHandler(inventoryController.deleteInventory));

module.exports = router;
