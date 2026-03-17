const router = require("express").Router();
const asyncHandler = require("../utils/asyncHandler");
const aiController = require("../controllers/ai.controller");

// Hard-safe kitchen test endpoint to guarantee response and verify wiring
router.post("/kitchen/query", (req, res) => {
  console.log("[AI ROUTE] /api/ai/kitchen/query direct handler hit");
  return res.json({
    ok: false,
    answer: "AI temporaneamente non disponibile (test route).",
    intent: "kitchen",
    confidence: "low",
    data: {
      summary: "",
      items: [],
      totals: {},
      warnings: ["AI temporaneamente non disponibile (test route)"],
    },
    sources: [],
  });
});

// GET /api/ai
router.get("/", asyncHandler(aiController.getGeneralSuggestion));

// POST /api/ai/query – production OpenAI (structured JSON) – generic/global
router.post("/query", asyncHandler(aiController.postQuery));

// POST /api/ai/:department/query – AI Operating System per reparto (kitchen, supervisor, warehouse, cash, creative)
router.post("/:department/query", asyncHandler(aiController.postDepartmentQuery));

// GET /api/ai/status – AI Supervisor operational status
router.get("/status", asyncHandler(aiController.getOperationalStatus));

// GET /api/ai/predictive-kitchen – Predictive Kitchen engine
router.get("/predictive-kitchen", asyncHandler(aiController.getPredictiveKitchen));

// GET /api/ai/daily-brain – Daily restaurant operations summary
router.get("/daily-brain", asyncHandler(aiController.getDailyBrain));

// POST /api/ai/kitchen
router.post("/kitchen", asyncHandler(aiController.getKitchenSuggestion));

// POST /api/ai/sales
router.post("/sales", asyncHandler(aiController.getSalesSuggestion));

// POST /api/ai/production
router.post("/production", asyncHandler(aiController.getProductionSuggestion));

// POST /api/ai/inventory – Magazzino multi-livello
router.post("/inventory", asyncHandler(aiController.getInventorySuggestion));

// GET /api/ai/usage – debug-only usage stats (no auth)
router.get("/usage", asyncHandler(aiController.getUsage));

module.exports = router;