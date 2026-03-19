// backend/src/routes/dev-access.routes.js
//
// Sezione privata DEV / Owner tecnico (accesso di emergenza).

const router = require("express").Router();
const devAccessController = require("../controllers/dev-access.controller");
const { requireDevOwnerAuth } = require("../middleware/requireDevOwnerAuth.middleware");

const DEV_ENABLED = () => String(process.env.DEV_OWNER_ENABLED || "").toLowerCase() === "true";

// Consenti accesso owner console: owner session può accedere a dashboard/status anche senza DEV_ENABLED.
function isOwnerSession(req) {
  return req.session?.user?.role === "owner" && req.session?.restaurantId;
}

router.use((req, res, next) => {
  if (DEV_ENABLED()) return next();
  if (isOwnerSession(req) && /^\/(dashboard|status)?$/.test(req.path)) return next();
  return res.status(404).send("Not found");
});

// GET /dev-access/login
router.get("/login", devAccessController.getDevLogin);

// POST /dev-access/login
router.post("/login", devAccessController.postDevLogin);

// GET /dev-access/logout
router.get("/logout", devAccessController.logout);

// GET /dev-access/status (API)
router.get("/status", requireDevOwnerAuth, devAccessController.getDevStatus);

// GET /dev-access/dashboard (HTML)
router.get("/dashboard", requireDevOwnerAuth, devAccessController.getDevDashboard);

// =============================
// DEV BRIDGE explicit module routes
// =============================
// Le route esplicite reindirizzano alla route generica /open/:module
// preservando querystring (es. tenantId).
function redirectToOpen(moduleName) {
  return (req, res) => {
    const idx = String(req.originalUrl || "").indexOf("?");
    const q = idx >= 0 ? String(req.originalUrl || "").slice(idx) : "";
    return res.redirect(`/dev-access/open/${encodeURIComponent(moduleName)}${q}`);
  };
}

router.get("/open/dashboard", requireDevOwnerAuth, redirectToOpen("dashboard"));
router.get("/open/sala", requireDevOwnerAuth, redirectToOpen("sala"));
router.get("/open/cucina", requireDevOwnerAuth, redirectToOpen("cucina"));
router.get("/open/pizzeria", requireDevOwnerAuth, redirectToOpen("pizzeria"));
router.get("/open/cassa", requireDevOwnerAuth, redirectToOpen("cassa"));
router.get("/open/magazzino", requireDevOwnerAuth, redirectToOpen("magazzino"));
router.get("/open/prenotazioni", requireDevOwnerAuth, redirectToOpen("prenotazioni"));
router.get("/open/catering", requireDevOwnerAuth, redirectToOpen("catering"));
router.get("/open/staff", requireDevOwnerAuth, redirectToOpen("staff"));
router.get("/open/ricette", requireDevOwnerAuth, redirectToOpen("ricette"));
router.get("/open/spesa", requireDevOwnerAuth, redirectToOpen("spesa"));
router.get("/open/haccp", requireDevOwnerAuth, redirectToOpen("haccp"));

// GET /dev-access/open/:module (DEV BRIDGE -> real module pages)
router.get("/open/:module", requireDevOwnerAuth, devAccessController.openModule);

// =============================
// DEV API (private)
// =============================
router.get("/api/tenants", requireDevOwnerAuth, devAccessController.apiGetTenants);
router.get("/api/licenses", requireDevOwnerAuth, devAccessController.apiGetLicenses);
router.get("/api/users", requireDevOwnerAuth, devAccessController.apiGetUsers);
router.get("/api/stripe/status", requireDevOwnerAuth, devAccessController.apiGetStripeStatus);
router.get("/api/stripe/mock/status", requireDevOwnerAuth, require("../controllers/dev-access-stripe-mock.controller").apiGetStripeMockStatus);
router.get("/api/operations", requireDevOwnerAuth, devAccessController.apiGetOperations);
router.get("/api/business", requireDevOwnerAuth, devAccessController.apiGetBusiness);
router.get("/api/logs", requireDevOwnerAuth, devAccessController.apiGetLogs);

// actions
router.post("/api/actions/unlock-user", requireDevOwnerAuth, devAccessController.apiPostActionUnlockUser);
router.post("/api/actions/reset-license", requireDevOwnerAuth, devAccessController.apiPostActionResetLicense);
router.post("/api/actions/force-activate", requireDevOwnerAuth, devAccessController.apiPostActionForceActivate);
router.post("/api/actions/clear-temp", requireDevOwnerAuth, devAccessController.apiPostActionClearTemp);
router.post("/api/actions/toggle-module", requireDevOwnerAuth, devAccessController.apiPostActionToggleModule);
router.post("/api/actions/extend-trial", requireDevOwnerAuth, devAccessController.apiPostActionExtendTrial);
router.post(
  "/api/stripe/mock/sync",
  requireDevOwnerAuth,
  require("../controllers/dev-access-stripe-mock.controller").apiPostStripeMockSync
);

// Alias: /dev-access -> /dev-access/dashboard
router.get("/", requireDevOwnerAuth, (req, res) => res.redirect("/dev-access/dashboard"));

module.exports = router;

