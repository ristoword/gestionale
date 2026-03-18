// backend/src/controllers/license.controller.js
const { getLicense, saveLicense } = require("../config/license");
const {
  findByActivationCode,
  updateLicense,
} = require("../repositories/licenses.repository");

// GET /api/license
async function getLicenseController(req, res) {
  const license = await getLicense();
  return res.json(license);
}

// GET /api/license/status
async function getStatus(req, res) {
  const license = await getLicense();
  const activated = license && license.valid;
  return res.json({
    activated: !!activated,
    valid: license ? license.valid : false,
    status: license ? license.status : "unlicensed",
    plan: license?.plan || "",
    restaurantName: license?.restaurantName || "",
    expiresAt: license?.expiresAt || null,
    daysLeft: license?.daysLeft ?? null,
    licenseKey: license && (license.licenseCode || license.licenseKey) ? "****" : "",
    activatedAt: license?.activatedAt || "",
  });
}

// POST /api/license/deactivate
async function deactivateLicense(req, res) {
  const { saveLicense } = require("../config/license");
  await saveLicense({
    licenseCode: "",
    licenseKey: "",
    activatedAt: null,
    restaurantName: "",
    plan: "",
    expiresAt: null,
  });
  return res.json({ ok: true, message: "Licenza disattivata." });
}

// POST /api/license/owner-activate
// Body: { "licenseCode": "XXXX-YYYY" }
async function ownerActivate(req, res) {
  const { licenseCode } = req.body || {};

  if (!licenseCode || typeof licenseCode !== "string") {
    return res.status(400).json({
      ok: false,
      status: "invalid",
      message: "Codice licenza mancante o non valido",
    });
  }

  const license = findByActivationCode(licenseCode);
  if (!license) {
    return res.status(404).json({
      ok: false,
      status: "invalid",
      message: "Licenza non trovata",
    });
  }

  if (license.status === "used") {
    return res.status(409).json({
      ok: false,
      status: "used",
      message: "Licenza già utilizzata",
    });
  }

  if (license.status && license.status !== "active" && license.status !== "grace") {
    return res.status(400).json({
      ok: false,
      status: license.status,
      message: "Licenza non attiva",
    });
  }

  const nowIso = new Date().toISOString();
  const updated = updateLicense({
    restaurantId: license.restaurantId,
    activationCode: license.activationCode,
    status: "used",
    activatedAt: nowIso,
    source: license.source || "manual_activation",
  });

  if (!updated) {
    return res.status(500).json({
      ok: false,
      status: "error",
      message: "Impossibile aggiornare lo stato della licenza",
    });
  }

  return res.json({
    ok: true,
    status: "valid",
    message: "Licenza attivata correttamente",
    restaurantId: updated.restaurantId,
    activatedAt: updated.activatedAt,
    redirectTo: "/login?ownerActivated=1",
  });
}

// POST /api/license/activate
// Body: { "code": "DEMO-1234", "restaurantName": "Ristorante La Focaccia" }
async function activateLicense(req, res) {
  const { code, restaurantName } = req.body || {};

  if (!code || typeof code !== "string") {
    return res
      .status(400)
      .json({ ok: false, error: "Codice licenza mancante o non valido." });
  }

  if (!restaurantName || typeof restaurantName !== "string") {
    return res
      .status(400)
      .json({ ok: false, error: "Nome ristorante mancante o non valido." });
  }

  // PRIMA VERSIONE SEMPLICE:
  // accetta solo codici che iniziano con "DEMO-"
  if (!code.startsWith("DEMO-")) {
    return res
      .status(400)
      .json({ ok: false, error: "Codice licenza non riconosciuto." });
  }

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 30 * 24 * 60 * 60 * 1000 // 30 giorni
  );

  const plan = code.toUpperCase().startsWith("DEMO-") ? "demo" : "starter";
  const decorated = await saveLicense({
    restaurantName,
    licenseCode: code,
    licenseKey: code,
    plan,
    activatedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });

  return res.json({
    ok: true,
    status: decorated.status,
    restaurantName: decorated.restaurantName,
    expiresAt: decorated.expiresAt,
    daysLeft: decorated.daysLeft,
  });
}

module.exports = {
  getLicense: getLicenseController,
  activateLicense,
  getStatus,
  deactivateLicense,
  ownerActivate,
};