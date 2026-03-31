// backend/src/routes/menu.routes.js

const express = require("express");
const router = express.Router();
const asyncHandler = require("../utils/asyncHandler");
const MenuController = require("../controllers/menu.controller");

router.get("/", asyncHandler(MenuController.listMenu));
router.get("/active", asyncHandler(MenuController.listActiveMenu));
router.get("/:id", asyncHandler(MenuController.getOne));
router.post("/", asyncHandler(MenuController.create));
router.post("/from-recipe", asyncHandler(MenuController.createFromRecipe));
router.patch("/:id", asyncHandler(MenuController.update));
router.delete("/:id", asyncHandler(MenuController.remove));

module.exports = router;