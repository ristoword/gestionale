const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const cateringController = require("../controllers/catering.controller");

// Presets – must be before :id to avoid "presets" as id
router.get("/presets", asyncHandler(cateringController.listPresets));
router.get("/presets/:id", asyncHandler(cateringController.getPresetById));
router.post("/presets", asyncHandler(cateringController.createPreset));
router.patch("/presets/:id", asyncHandler(cateringController.updatePreset));
router.delete("/presets/:id", asyncHandler(cateringController.deletePreset));

// Events
router.get("/events", asyncHandler(cateringController.listEvents));
router.post("/events/from-preset/:presetId", asyncHandler(cateringController.createEventFromPreset));
router.get("/events/:id/print", asyncHandler(cateringController.getEventPrintHtml));
router.get("/events/:id", asyncHandler(cateringController.getEventById));
router.post("/events", asyncHandler(cateringController.createEvent));
router.patch("/events/:id", asyncHandler(cateringController.updateEvent));
router.delete("/events/:id", asyncHandler(cateringController.deleteEvent));

// Legacy – backward compatibility
router.get("/", asyncHandler(cateringController.listCatering));
router.get("/:id", asyncHandler(cateringController.getCateringById));
router.post("/", asyncHandler(cateringController.createCatering));
router.patch("/:id", asyncHandler(cateringController.updateCatering));
router.delete("/:id", asyncHandler(cateringController.deleteCatering));

module.exports = router;
