// backend/src/modules/ai/ai.orchestrator.js
// Central AI orchestrator: prepares context and prompts per department, calls OpenAI, normalizes output.

const { normalizeDepartment, normalizeMode, buildBaseResponse } = require("./ai.schemas");
const { CORE_SYSTEM_PROMPT, buildDepartmentPrompt } = require("./ai.prompts");
const aiOpenaiService = require("../../service/ai-openai.service");
const aiContextService = require("../../service/ai-context.service");
const aiTools = require("./ai.tools");

function buildUserPrompt({ department, mode, question, quickIntent, context }) {
  const header = {
    department,
    mode,
    quickIntent: quickIntent || null,
  };

  return `
HEADER:
${JSON.stringify(header, null, 2)}

CONTESTO OPERATIVO (JSON, usare solo questi dati):
${JSON.stringify(context, null, 2)}

DOMANDA DELL'UTENTE:
${question || "(nessuna domanda testuale, usa quickIntent)"}

ISTRUZIONI RISPOSTA:
- Restituisci UN SOLO oggetto JSON con questa struttura:
{
  "mode": "read|suggest|act",
  "department": "kitchen|supervisor|warehouse|cash|creative",
  "title": "breve titolo",
  "summary": "1-3 frasi riassuntive",
  "insights": ["punti elenco operativi"],
  "actions": [
    {
      "id": "string_id_azione",
      "label": "etichetta pulsante",
      "description": "spiegazione breve dell'azione",
      "dangerous": false
    }
  ],
  "warnings": ["messaggi importanti per il ristoratore"],
  "dataPoints": { "chiave": "valore" },
  "notes": ["eventuali note testuali aggiuntive"]
}

- Se non puoi rispondere con confidenza, scrivi chiaramente perché nei warnings.
`;
}

async function buildDepartmentContext(department) {
  const base = await aiContextService.buildContextForQuery().catch(() => ({}));

  switch (department) {
    case "kitchen": {
      const [activeOrders, lowStock, dailyMenu] = await Promise.all([
        aiTools.getActiveOrdersSummary().catch(() => null),
        aiTools.getLowStockItems().catch(() => []),
        aiTools.getDailyMenu().catch(() => ({})),
      ]);
      return {
        ...base,
        kitchen: {
          activeOrders: activeOrders || {},
          lowStockKitchen: lowStock,
          dailyMenu,
        },
      };
    }
    case "supervisor": {
      const sales = await aiTools.getTodaySalesSummary().catch(() => ({}));
      return { ...base, supervisor: { sales } };
    }
    case "warehouse": {
      const [inventory, lowStock] = await Promise.all([
        aiTools.getInventorySnapshot().catch(() => []),
        aiTools.getLowStockItems().catch(() => []),
      ]);
      return {
        ...base,
        warehouse: {
          inventory,
          lowStock,
        },
      };
    }
    case "cash": {
      const sales = await aiTools.getTodaySalesSummary().catch(() => ({}));
      return {
        ...base,
        cash: { sales },
      };
    }
    case "creative": {
      const [inventory, recipes, menuItems] = await Promise.all([
        aiTools.getInventorySnapshot().catch(() => []),
        aiTools.getRecipes().catch(() => []),
        aiTools.getMenuItems().catch(() => []),
      ]);
      return {
        ...base,
        creative: {
          inventory,
          recipes,
          menuItems,
        },
      };
    }
    default:
      return base;
  }
}

async function runDepartmentQuery({ department, mode, question, quickIntent }) {
  const dep = normalizeDepartment(department);
  const m = normalizeMode(mode);

  const baseResp = buildBaseResponse({ mode: m, department: dep });

  let context = {};
  try {
    context = await buildDepartmentContext(dep);
  } catch (err) {
    baseResp.warnings.push("Errore nel caricamento del contesto operativo.");
  }

  const systemPrompt =
    CORE_SYSTEM_PROMPT + "\n" + buildDepartmentPrompt(dep);

  const userPrompt = buildUserPrompt({
    department: dep,
    mode: m,
    question,
    quickIntent,
    context,
  });

  // Usa il servizio OpenAI esistente che restituisce già JSON valido, poi lo mappiamo sullo schema richiesto.
  const raw = await aiOpenaiService
    .queryWithOpenAI(userPrompt, systemPrompt)
    .catch((err) => {
      baseResp.warnings.push(
        `Errore AI: ${err?.message || "servizio AI non disponibile"}`
      );
      return null;
    });

  if (!raw || typeof raw !== "object") {
    return {
      ...baseResp,
      title: "AI non disponibile",
      summary: "Il servizio AI non è momentaneamente disponibile.",
    };
  }

  // Prova a mappare i campi se il modello ha già seguito lo schema richiesto.
  return {
    ...baseResp,
    mode: normalizeMode(raw.mode || m),
    department: normalizeDepartment(raw.department || dep),
    title: raw.title || baseResp.title,
    summary: raw.summary || raw.answer || baseResp.summary,
    insights: Array.isArray(raw.insights) ? raw.insights : baseResp.insights,
    actions: Array.isArray(raw.actions) ? raw.actions : baseResp.actions,
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings
      : baseResp.warnings,
    dataPoints:
      raw.dataPoints && typeof raw.dataPoints === "object"
        ? raw.dataPoints
        : baseResp.dataPoints,
    notes: Array.isArray(raw.notes) ? raw.notes : baseResp.notes,
  };
}

module.exports = {
  runDepartmentQuery,
};

