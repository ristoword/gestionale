const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const devicesController = require("../controllers/devices.controller");

router.get("/", asyncHandler(devicesController.listDevices));
router.get("/:id", asyncHandler(devicesController.getDeviceById));
router.post("/", asyncHandler(devicesController.createDevice));
router.patch("/:id", asyncHandler(devicesController.updateDevice));
router.delete("/:id", asyncHandler(devicesController.deleteDevice));
router.post("/:id/test-print", asyncHandler(devicesController.testPrint));

module.exports = router;
