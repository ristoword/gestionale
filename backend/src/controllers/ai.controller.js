const aiAssistantService = require("../service/ai-assistant.service");
const aiOpenaiService = require("../service/ai-openai.service");
const { runDepartmentQuery } = require("../modules/ai/ai.orchestrator");

// ================================
//   AI USAGE TRACKING (lightweight)
// ================================

function getTodayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function detectSourceFromRequest(req) {
  try {
    const hdr = (req.headers && (req.headers["x-rw-source"] || req.headers["x-rw-module"])) || "";
    if (typeof hdr === "string" && hdr.trim()) {
      const h = hdr.toLowerCase();
      if (h.includes("cassa")) return "cassa";
      if (h.includes("cucina") || h.includes("kitchen")) return "cucina";
    }
    const ref = (req.headers && req.headers.referer) || "";
    if (typeof ref === "string" && ref) {
      const r = ref.toLowerCase();
      if (r.includes("/cassa/") || r.includes("cassa")) return "cassa";
      if (r.includes("/cucina/") || r.includes("kitchen")) return "cucina";
    }
  } catch (_) {
    // ignore detection errors
  }
  return "other";
}

function getUsageState() {
  if (!global.__rw_aiUsage) {
    global.__rw_aiUsage = {
      date: getTodayISODate(),
      total: 0,
      bySource: {
        cassa: 0,
        cucina: 0,
        other: 0,
      },
    };
  }
  const today = getTodayISODate();
  if (global.__rw_aiUsage.date !== today) {
    global.__rw_aiUsage = {
      date: today,
      total: 0,
      bySource: {
        cassa: 0,
        cucina: 0,
        other: 0,
      },
    };
  }
  return global.__rw_aiUsage;
}

function trackAiUsage(req) {
  const state = getUsageState();
  const source = detectSourceFromRequest(req);
  state.total += 1;
  if (!state.bySource[source]) {
    state.bySource[source] = 0;
  }
  state.bySource[source] += 1;

  // Soft console log for ops visibility
  // Example: [AI USAGE] 2026-03-17 → total: 124 (cassa: 80, cucina: 40, other: 4)
  // eslint-disable-next-line no-console
  console.log(
    `[AI USAGE] ${state.date} → total: ${state.total} (cassa: ${state.bySource.cassa || 0}, cucina: ${
      state.bySource.cucina || 0
    }, other: ${state.bySource.other || 0})`
  );
}

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
    trackAiUsage(req);
    const result = await aiOpenaiService.queryWithOpenAI(question);
    return res.json(result);
  } catch (err) {
    console.error("[AI] query error:", err.message);
    return res.status(500).json(aiOpenaiService.FALLBACK_RESPONSE);
  }
};

// POST /api/ai/:department/query – new structured AI Operating System entrypoint
exports.postDepartmentQuery = async (req, res) => {
  console.log("[AI ROUTE] POST /api/ai/:department/query hit");
  const department = String(req.params.department || "").toLowerCase();
  const body = req.body || {};
  const mode = body.mode || "read";
  const question = String(body.question || "").trim();
  const quickIntent = body.quickIntent || null;

  let responded = false;
  const timeoutMs = 5000;
  const timeoutId = setTimeout(() => {
    if (responded) return;
    responded = true;
    console.error("[AI ERROR] Department query timeout, sending fallback response", {
      department,
    });
    res.json({
      ok: false,
      answer: "AI temporaneamente non disponibile.",
      intent: department || "generic",
      confidence: "low",
      data: {
        summary: "",
        items: [],
        totals: {},
        warnings: ["AI temporaneamente non disponibile"],
      },
      sources: [],
    });
  }, timeoutMs);

  try {
    trackAiUsage(req);
    console.log("[AI CONTROLLER] postDepartmentQuery start", {
      department,
      mode,
      hasQuestion: !!question,
      quickIntent,
    });
    const result = await runDepartmentQuery({
      department,
      mode,
      question,
      quickIntent,
    });
    if (!responded) {
      responded = true;
      clearTimeout(timeoutId);
      console.log("[AI CONTROLLER] postDepartmentQuery success", {
        department,
        mode,
        title: result?.title,
      });
      return res.json(result);
    }
  } catch (err) {
    console.error("[AI ERROR] department query error:", err.message);
    if (!responded) {
      responded = true;
      clearTimeout(timeoutId);
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

// GET /api/ai/usage – debug-only daily usage counters (no auth)
exports.getUsage = async (req, res) => {
  const state = getUsageState();
  res.json({
    date: state.date,
    total: state.total,
    bySource: {
      cassa: state.bySource.cassa || 0,
      cucina: state.bySource.cucina || 0,
      other: state.bySource.other || 0,
    },
  });
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
