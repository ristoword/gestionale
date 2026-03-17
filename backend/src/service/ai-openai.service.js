// backend/src/service/ai-openai.service.js
// Production OpenAI integration: backend-only, strict JSON output, real Ristoword context.

const OpenAI = require("openai");
const path = require("path");
const env = require("../config/env");
const aiContextService = require("./ai-context.service");
const aiAssistantService = require("./ai-assistant.service");
const paths = require("../config/paths");

const VALID_INTENTS = [
  "sales_summary",
  "low_stock",
  "recipe_cost",
  "active_orders",
  "transfer_advice",
  "generic",
];
const VALID_CONFIDENCE = ["high", "medium", "low"];

const FALLBACK_RESPONSE = {
  ok: false,
  answer: "Risposta AI non disponibile in questo momento.",
  intent: "generic",
  confidence: "low",
  data: {
    summary: "",
    items: [],
    totals: {},
    warnings: ["Servizio AI temporaneamente non disponibile."],
  },
  sources: [],
  nextActions: [],
};

const SYSTEM_PROMPT = `Sei l'assistente AI di Ristoword, un sistema di gestione ristorante. Rispondi SOLO sulla base dei dati operativi forniti.
REGOLE:
1. Usa esclusivamente i dati nel contesto fornito. Non inventare numeri o fatti.
2. Se un dato non è disponibile, dillo chiaramente nell'answer e metti confidence "low".
3. Sii conciso e operativo. Rispondi in italiano.
4. Restituisci SEMPRE un JSON valido secondo questo schema esatto:

{
  "ok": true o false,
  "answer": "stringa riassuntiva per l'utente",
  "intent": "sales_summary | low_stock | recipe_cost | active_orders | transfer_advice | generic",
  "confidence": "high | medium | low",
  "data": {
    "summary": "stringa riassuntiva",
    "items": [],
    "totals": {},
    "warnings": []
  },
  "sources": ["elenco fonti usate"],
  "nextActions": ["azioni suggerite"]
}

Intenti supportati:
- active_orders: ordini aperti, in attesa, pronti
- low_stock: prodotti sotto soglia, scorte centrali o reparti
- recipe_cost: costi ricette, food cost
- sales_summary: vendite, incassi, top piatti, coperti
- transfer_advice: suggerimenti trasferimenti magazzino centrale -> reparti
- generic: domanda generale o non classificabile`;

/**
 * Validate parsed AI output against the response contract.
 */
function validateAiOutput(obj) {
  if (!obj || typeof obj !== "object") return false;
  if (typeof obj.ok !== "boolean") return false;
  if (typeof obj.answer !== "string") return false;
  if (!VALID_INTENTS.includes(obj.intent)) return false;
  if (!VALID_CONFIDENCE.includes(obj.confidence)) return false;
  if (!obj.data || typeof obj.data !== "object") return false;
  if (typeof obj.data.summary !== "string") return false;
  if (!Array.isArray(obj.data.items)) return false;
  if (!obj.data.totals || typeof obj.data.totals !== "object") return false;
  if (!Array.isArray(obj.data.warnings)) return false;
  if (!Array.isArray(obj.sources)) return false;
  if (!Array.isArray(obj.nextActions)) return false;
  return true;
}

/**
 * Parse and validate model response. Returns validated object or null.
 */
function parseAndValidate(content) {
  if (!content || typeof content !== "string") return null;
  const trimmed = content.trim();
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  return validateAiOutput(parsed) ? parsed : null;
}

/**
 * Write last parsed output to debug file (optional, for local development).
 */
function writeDebugOutput(data) {
  try {
    const outputPath = path.join(paths.DATA, "ai-last-output.json");
    const { atomicWriteJson } = require("../utils/safeFileIO");
    atomicWriteJson(outputPath, { ...data, _writtenAt: new Date().toISOString() });
  } catch (err) {
    if (env.NODE_ENV !== "production") {
      console.warn("[AI] Could not write ai-last-output.json:", err.message);
    }
  }
}

/**
 * Call OpenAI and return structured JSON response.
 * Uses real context from Ristoword repositories.
 * NEVER hangs: guarded by a hard timeout and robust fallbacks.
 */
async function queryWithOpenAI(question, overrideSystemPrompt) {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.OPENAI_MODEL;

  if (!apiKey || String(apiKey).trim() === "") {
    // Nessuna chiave OpenAI configurata: torna al motore AI interno legacy
    // in modo trasparente per Cassa / Cucina mantenendo lo schema di risposta
    // JSON richiesto dal frontend.
    const legacy = await aiAssistantService.getResponseForQuestion(question);
    const answer =
      (legacy && (legacy.answer || legacy.message)) ||
      "Situazione operativa stabile. Nessun alert.";

    return {
      ok: true,
      answer,
      intent: "generic",
      confidence: "low",
      data: {
        summary: "",
        items: [],
        totals: {},
        warnings: [],
      },
      sources: [],
      nextActions: [],
    };
  }

  console.log("[AI OPENAI] Starting queryWithOpenAI");

  let context;
  try {
    console.log("[AI CONTEXT] buildContextForQuery start");
    context = await aiContextService.buildContextForQuery();
    console.log("[AI CONTEXT] buildContextForQuery done");
  } catch (err) {
    console.error("[AI ERROR] Context build error:", err.message);
    return {
      ...FALLBACK_RESPONSE,
      answer: "Errore nel caricamento dei dati operativi.",
      data: { ...FALLBACK_RESPONSE.data, warnings: ["Context build failed"] },
    };
  }

  const contextStr = JSON.stringify(context, null, 2);
  const userPrompt = `Contesto operativo Ristoword (usa SOLO questi dati):
${contextStr}

Domanda dell'utente: ${question}

Rispondi con un unico oggetto JSON valido, senza testo aggiuntivo prima o dopo.`;

  let client;
  try {
    client = new OpenAI({ apiKey: apiKey.trim() });
  } catch (err) {
    console.error("[AI ERROR] OpenAI client init error:", err.message);
    return { ...FALLBACK_RESPONSE, answer: "Errore inizializzazione OpenAI." };
  }

  try {
    console.log("[AI OPENAI] Calling chat.completions.create");

    const timeoutMs = 20000;
    const completion = await Promise.race([
      client.chat.completions.create({
        model,
        messages: [
          { role: "system", content: overrideSystemPrompt || SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1024,
      }),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("AI_TIMEOUT: OpenAI response exceeded 20s")),
          timeoutMs
        )
      ),
    ]);

    console.log("[AI OPENAI] chat.completions.create completed");

    const content =
      completion?.choices?.[0]?.message?.content ||
      completion?.choices?.[0]?.message?.refusal ||
      "";
    const validated = parseAndValidate(content);

    if (validated) {
      console.log("[AI RESPONSE] Valid AI output parsed");
      writeDebugOutput(validated);
      return validated;
    }

    if (completion?.choices?.[0]?.message?.refusal) {
      return {
        ...FALLBACK_RESPONSE,
        answer: "La richiesta non può essere elaborata per motivi di policy.",
      };
    }

    console.warn("[AI ERROR] Invalid or unparseable output:", content?.slice(0, 200));
    writeDebugOutput({ raw: content, validated: false });
    return FALLBACK_RESPONSE;
  } catch (err) {
    const msg = err?.message || String(err);
    console.error("[AI ERROR] OpenAI API error:", msg);
    if (msg.includes("401") || msg.includes("Incorrect API key")) {
      return {
        ...FALLBACK_RESPONSE,
        answer: "Chiave API OpenAI non valida.",
      };
    }
    if (msg.includes("429") || msg.includes("rate limit")) {
      return {
        ...FALLBACK_RESPONSE,
        answer: "Limite richieste OpenAI superato. Riprova tra poco.",
      };
    }
    return {
      ...FALLBACK_RESPONSE,
      answer: "Servizio AI temporaneamente non disponibile.",
    };
  }
}

module.exports = {
  queryWithOpenAI,
  validateAiOutput,
  FALLBACK_RESPONSE,
};
