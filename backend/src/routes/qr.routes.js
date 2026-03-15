const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const qrController = require("../controllers/qr.controller");

router.get("/tables", asyncHandler(qrController.listTables));
router.get("/tables/print-all", asyncHandler(qrController.getAllPrint));
router.get("/tables/:id/print", asyncHandler(qrController.getTablePrint));
router.get("/tables/:id", asyncHandler(qrController.getTableById));

module.exports = router;
