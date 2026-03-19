// backend/src/controllers/owner-console.controller.js
// Owner Console: configurazione iniziale cliente (licenza, staff, locale).

const path = require("path");
const licensesRepository = require("../repositories/licenses.repository");
const usersRepository = require("../repositories/users.repository");
const { getLicense } = require("../config/license");
const { readOwnerSetup, setOwnerSetupCompleted } = require("../config/ownerSetup");
const { getTenantIdFromRequest } = require("../context/tenantContext");

function ensureOwner(req, res) {
  const role = req.session?.user?.role;
  if (role !== "owner" && req.devOwner !== true) {
    res.status(403).json({ error: "Solo l'owner può accedere a questa area." });
    return null;
  }
  const restaurantId = getTenantIdFromRequest(req);
  if (!restaurantId) {
    res.status(403).json({ error: "Ristorante non in sessione." });
    return null;
  }
  return restaurantId;
}

function htmlPath(name) {
  return path.join(__dirname, "../../public/owner-console", name);
}

// GET /owner-console – pagina principale
exports.getOwnerConsolePage = (req, res) => {
  const restaurantId = ensureOwner(req, res);
  if (!restaurantId) return;
  res.sendFile(htmlPath("owner-console.html"));
};

// GET /api/owner-console/status – stato licenza, locale, staff
exports.apiGetStatus = async (req, res) => {
  const restaurantId = ensureOwner(req, res);
  if (!restaurantId) return;

  const license = licensesRepository.findByRestaurantId(restaurantId);
  const globalLicense = await getLicense();
  const ownerSetup = readOwnerSetup(restaurantId);
  const staff = usersRepository.findByRestaurantId(restaurantId).filter((u) => String(u.role).toLowerCase() !== "owner");

  const licenseStatus = {
    valid: !!(license && (license.status === "active" || license.status === "grace")),
    status: license?.status || "—",
    plan: license?.plan || "—",
    expiresAt: license?.expiresAt || null,
    restaurantId,
  };

  if (license?.expiresAt) {
    const exp = new Date(license.expiresAt);
    licenseStatus.expired = exp < new Date();
  }

  res.json({
    ok: true,
    license: licenseStatus,
    globalLicense: globalLicense ? { status: globalLicense.status, plan: globalLicense.plan } : null,
    ownerSetup,
    staff: staff.map((u) => ({
      id: u.id,
      username: u.username,
      name: u.name,
      surname: u.surname,
      role: u.role,
      is_active: u.is_active !== false,
    })),
    restaurantId,
  });
};

// POST /api/owner-console/complete – completa configurazione iniziale
exports.apiCompleteSetup = async (req, res) => {
  const restaurantId = ensureOwner(req, res);
  if (!restaurantId) return;

  setOwnerSetupCompleted(restaurantId);

  res.json({
    ok: true,
    message: "Configurazione completata",
    redirectTo: "/supervisor/supervisor.html",
  });
};
