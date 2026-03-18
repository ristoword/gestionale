// backend/src/routes/dev-access.routes.js
//
// Sezione privata DEV / Owner tecnico (accesso di emergenza).

const router = require("express").Router();
const devAccessController = require("../controllers/dev-access.controller");
const { requireDevOwnerAuth } = require("../middleware/requireDevOwnerAuth.middleware");

const DEV_ENABLED = () => String(process.env.DEV_OWNER_ENABLED || "").toLowerCase() === "true";

// Disabilita completamente la route se DEV_OWNER_ENABLED non è true.
router.use((req, res, next) => {
  if (!DEV_ENABLED()) return res.status(404).send("Not found");
  return next();
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

// GET /dev-access/open/:module (DEV BRIDGE -> real module pages)
router.get("/open/:module", requireDevOwnerAuth, devAccessController.openModule);

// =============================
// DEV API (private)
// =============================
router.get("/api/tenants", requireDevOwnerAuth, devAccessController.apiGetTenants);
router.get("/api/licenses", requireDevOwnerAuth, devAccessController.apiGetLicenses);
router.get("/api/users", requireDevOwnerAuth, devAccessController.apiGetUsers);
router.get("/api/stripe/status", requireDevOwnerAuth, devAccessController.apiGetStripeStatus);
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

// Alias: /dev-access -> /dev-access/dashboard
router.get("/", requireDevOwnerAuth, (req, res) => res.redirect("/dev-access/dashboard"));

module.exports = router;

