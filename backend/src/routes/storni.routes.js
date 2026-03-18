const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const storniController = require("../controllers/storni.controller");

router.get("/total", asyncHandler(storniController.totalByDate));
router.get("/", asyncHandler(storniController.list));
router.post("/", asyncHandler(storniController.create));
router.delete("/:id", asyncHandler(storniController.deleteById));

module.exports = router;
