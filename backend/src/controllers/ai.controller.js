const aiAssistantService = require("../service/ai-assistant.service");
const aiOpenaiService = require("../service/ai-openai.service");
const { runDepartmentQuery } = require("../modules/ai/ai.orchestrator");

// POST /api/ai/query – production OpenAI backend (structured JSON)
exports.postQuery = async (req, res) => {
  const question = String((req.body && req.body.question) || "").trim();
  if (!question) {
    return res.status(400).json({
      ok: false,
      answer: "Parametro 'question' obbligatorio.",
      intent: "generic",
      confidence: "low",
      data: { summary: "", items: [], totals: {}, warnings: [] },
      sources: [],
      nextActions: [],
    });
  }
  try {
    const result = await aiOpenaiService.queryWithOpenAI(question);
    return res.json(result);
  } catch (err) {
    console.error("[AI] query error:", err.message);
    return res.status(500).json(aiOpenaiService.FALLBACK_RESPONSE);
  }
};

// POST /api/ai/:department/query – new structured AI Operating System entrypoint
exports.postDepartmentQuery = async (req, res) => {
  const department = String(req.params.department || "").toLowerCase();
  const body = req.body || {};
  const mode = body.mode || "read";
  const question = String(body.question || "").trim();
  const quickIntent = body.quickIntent || null;

  try {
    const result = await runDepartmentQuery({
      department,
      mode,
      question,
      quickIntent,
    });
    return res.json(result);
  } catch (err) {
    console.error("[AI] department query error:", err.message);
    return res.status(500).json({
      mode: "read",
      department,
      title: "Errore AI",
      summary: "Si è verificato un errore durante l'elaborazione AI.",
      insights: [],
      actions: [],
      warnings: [err.message || "Errore interno AI"],
      dataPoints: {},
      notes: [],
    });
  }
};

// GET /api/ai/status – operational AI Supervisor status
exports.getOperationalStatus = async (req, res) => {
  try {
    const status = await aiAssistantService.getOperationalStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({
      error: "operational_status_error",
      message: err.message || "Errore durante il calcolo dello stato operativo.",
    });
  }
};

// GET /api/ai/predictive-kitchen – Predictive Kitchen engine
exports.getPredictiveKitchen = async (req, res) => {
  try {
    const result = await aiAssistantService.getPredictiveKitchen();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "predictive_kitchen_error",
      message:
        err.message || "Errore durante l'analisi predittiva cucina.",
    });
  }
};

// GET /api/ai/daily-brain – Daily restaurant operations summary
exports.getDailyBrain = async (req, res) => {
  try {
    const result = await aiAssistantService.getDailyBrain();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "daily_brain_error",
      message: err.message || "Errore durante l'analisi operativa giornaliera.",
    });
  }
};

// GET /api/ai
exports.getGeneralSuggestion = async (req, res) => {
  const question = String(req.query.q || "").trim();
  const result = await aiAssistantService.getResponseForQuestion(question);
  res.json(result);
};

async function getResponseWithContext(type, body = {}) {
  const gathered = await aiAssistantService.gatherContextForType(type);
  const context = { ...gathered, ...body };
  return aiAssistantService.getAssistantResponse(type, context);
}

// POST /api/ai/kitchen
exports.getKitchenSuggestion = async (req, res) => {
  const command = String((req.body && req.body.command) || "").trim();
  if (!command) {
    return res.status(400).json({
      success: false,
      error: "Comando mancante. Invia { command: string }."
    });
  }
  try {
    const result = await aiAssistantService.getResponseForQuestion(command);
    const responseText = result?.message ?? result?.response ?? String(result);
    const payload = {
      success: true,
      response: responseText
    };
    if (result?.type === "menu" && result?.menu) {
      payload.type = "menu";
      payload.menu = result.menu;
      payload.message = result.message;
    }
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "Errore durante l'elaborazione del comando."
    });
  }
};

// POST /api/ai/sales
exports.getSalesSuggestion = async (req, res) => {
  const result = await getResponseWithContext("sales", req.body || {});
  res.json(result);
};

// POST /api/ai/production
exports.getProductionSuggestion = async (req, res) => {
  const result = await getResponseWithContext("production", req.body || {});
  res.json(result);
};

// POST /api/ai/inventory – Magazzino multi-livello (Centrale + reparti)
exports.getInventorySuggestion = async (req, res) => {
  try {
    const result = await aiAssistantService.getInventoryWarehouseSuggestion();
    res.json(result);
  } catch (err) {
    res.status(500).json({
      error: "inventory_suggestion_error",
      message: err.message || "Errore durante l'analisi magazzino.",
    });
  }
};
