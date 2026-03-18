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

// Alias: /dev-access -> /dev-access/dashboard
router.get("/", requireDevOwnerAuth, (req, res) => res.redirect("/dev-access/dashboard"));

module.exports = router;

