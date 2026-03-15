const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const printRoutesController = require("../controllers/print-routes.controller");

router.get("/", asyncHandler(printRoutesController.listRoutes));
router.get("/:id", asyncHandler(printRoutesController.getRouteById));
router.post("/", asyncHandler(printRoutesController.createRoute));
router.patch("/:id", asyncHandler(printRoutesController.updateRoute));
router.delete("/:id", asyncHandler(printRoutesController.deleteRoute));

module.exports = router;
