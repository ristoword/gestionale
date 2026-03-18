// backend/src/app.js
const express = require("express");
const path = require("path");
const sessionMiddleware = require("./config/session");
const { ensureTenantMigration } = require("./utils/tenantMigration");

const app = express();

// Trust proxy (Railway, Heroku, etc.)
app.set("trust proxy", 1);

// Ensure default tenant has data (migrate from legacy data/ if needed)
ensureTenantMigration();

// =======================
//  MIDDLEWARE DI BASE
// =======================
app.use(express.json());
app.use(sessionMiddleware);

// Tenant context for multi-tenant data isolation (resolves restaurantId from session)
const { setTenantContext } = require("./middleware/tenantContext.middleware");
app.use(setTenantContext);

// License check: block app if not activated (except login, license API, QR)
const { requireLicense } = require("./middleware/requireLicense.middleware");
const { requireSetup } = require("./middleware/requireSetup.middleware");
const { requireAuth } = require("./middleware/requireAuth.middleware");
const { requireRole } = require("./middleware/requireRole.middleware");
const { requirePageAuth } = require("./middleware/requirePageAuth.middleware");
const { requireMustChangePassword } = require("./middleware/requireMustChangePassword.middleware");

app.use(requireLicense);
app.use(requireSetup);
app.use(requireMustChangePassword);

// SYSTEM HEALTH (no auth – for monitoring/load balancers)
function healthHandler(req, res) {
  const uptimeMs = process.uptime() * 1000;
  const uptimeStr = `${Math.floor(uptimeMs / 3600000)}h ${Math.floor((uptimeMs % 3600000) / 60000)}m`;
  res.json({
    status: "ok",
    serverTime: new Date().toISOString(),
    uptime: uptimeStr,
    version: process.env.RISTOWORD_VERSION || "ristoword-dev",
  });
}
app.get("/api/system/health", healthHandler);
app.get("/api/health", healthHandler); // alias for backward compatibility

const ROLES_ALL = ["owner", "sala", "cucina", "cassa"];
const ROLES_ORDERS = ["owner", "sala", "cucina", "cassa"];
const ROLES_MENU = ["owner", "sala", "cassa", "supervisor"];
const ROLES_PAYMENTS = ["owner", "cassa"];
const ROLES_REPORTS = ["owner", "sala", "cucina", "cassa"];
const ROLES_CLOSURES = ["owner", "cassa", "supervisor"];

// =======================
//  ROUTE PAGINA HOME / DASHBOARD (prima di static, così / serve la dashboard)
// =======================

// Home -> operational dashboard (requires session)
app.get("/", requirePageAuth, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../public/dashboard/dashboard.html")
  );
});

// Alias esplicito /dashboard
app.get("/dashboard", requirePageAuth, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../public/dashboard/dashboard.html")
  );
});

// Cambio password obbligatorio al primo accesso
app.get("/change-password", requirePageAuth, (req, res) => {
  res.sendFile(
    path.join(__dirname, "../public/change-password/change-password.html")
  );
});

// Owner activation (public)
app.get("/owner-activate", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../public/owner-activate/owner-activate.html")
  );
});

// QR table ordering: /qr/1, /qr/2, etc. (no auth – public QR)
app.get("/qr", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/qr/index.html"));
});
app.get("/qr/:table", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/qr/index.html"));
});

// Protected HTML pages – redirect to login if no session
app.use(requirePageAuth);

// Serve tutti i file statici da /public
// Es: /dashboard/dashboard.html, /sala/sala.html, /cucina/cucina.html, ecc.
app.use(express.static(path.join(__dirname, "../public")));

// =======================
//  API (ROUTES) – orders, menu, reports, ai, recipes + others
// =======================

// ORDERS – /api/orders
try {
  const ordersRouter = require("./routes/orders.routes");
  const OrdersController = require("./controllers/orders.controller");
  const asyncHandler = require("./utils/asyncHandler");
  app.post("/api/qr/orders", asyncHandler(OrdersController.createOrder));
  app.use("/api/orders", requireAuth, requireRole(ROLES_ORDERS), ordersRouter);
} catch (e) {
  console.warn("orders.routes non trovato:", e.message);
}

// QR TABLES (admin – protected; supervisor included for QR management)
try {
  const qrRouter = require("./routes/qr.routes");
  const ROLES_QR = ["owner", "sala", "cucina", "cassa", "supervisor"];
  app.use("/api/qr", requireAuth, requireRole(ROLES_QR), qrRouter);
} catch (e) {
  console.warn("qr.routes non trovato:", e.message);
}

// MENU – /api/menu (public GET /api/menu/active for QR)
try {
  const menuRouter = require("./routes/menu.routes");
  const MenuController = require("./controllers/menu.controller");
  app.get("/api/menu/active", (req, res, next) => MenuController.listActiveMenu(req, res).catch(next));
  app.use("/api/menu", requireAuth, requireRole(ROLES_MENU), menuRouter);
} catch (e) {
  console.warn("menu.routes non trovato:", e.message);
}

// LICENSE (no auth – for activation flow)
try {
  const licenseRouter = require("./routes/license.routes");
  app.use("/api/licenses", licenseRouter);
} catch (e) {
  console.warn("license.routes non trovato (ok se non ancora creato)");
}

// SETUP (no auth – for first-time configuration)
try {
  const setupRouter = require("./routes/setup.routes");
  app.use("/api/setup", setupRouter);
} catch (e) {
  console.warn("setup.routes non trovato (ok se non ancora creato)");
}

// INVENTORY (Magazzino)
try {
  const inventoryRouter = require("./routes/inventory.routes");
  const ROLES_INVENTORY = ["owner", "sala", "cucina", "cassa", "magazzino"];
  app.use("/api/inventory", requireAuth, requireRole(ROLES_INVENTORY), inventoryRouter);
} catch (e) {
  console.warn("inventory.routes non trovato (ok se non ancora creato)");
}

// DAILY MENU (Menu del Giorno)
try {
  const dailyMenuRouter = require("./routes/daily-menu.routes");
  app.use("/api/daily-menu", requireAuth, requireRole(ROLES_ALL), dailyMenuRouter);
} catch (e) {
  console.warn("daily-menu.routes non trovato (ok se non ancora creato)");
}

// HACCP
try {
  const haccpRouter = require("./routes/haccp.routes");
  app.use("/api/haccp", requireAuth, requireRole(ROLES_ALL), haccpRouter);
} catch (e) {
  console.warn("haccp.routes non trovato (ok se non ancora creato)");
}

// PRENOTAZIONI / BOOKING
try {
  const bookingsRouter = require("./routes/bookings.routes");
  app.use("/api/bookings", requireAuth, requireRole(ROLES_ALL), bookingsRouter);
} catch (e) {
  console.warn("bookings.routes non trovato (ok se non ancora creato)");
}

// STAFF – owner: CRUD completo; supervisor: sola lettura (elenco, dettaglio) per dropdown/staff attivi
try {
  const staffRouter = require("./routes/staff.routes");
  const ROLES_STAFF_READ = ["owner", "supervisor"];
  app.use("/api/staff", requireAuth, requireRole(ROLES_STAFF_READ), staffRouter);
} catch (e) {
  console.warn("staff.routes non trovato (ok se non ancora creato)");
}

// ATTENDANCE – presenze/timbrature (owner: lista/summary/close; user: me/today)
try {
  const attendanceRouter = require("./routes/attendance.routes");
  app.use("/api/attendance", requireAuth, attendanceRouter);
} catch (e) {
  console.warn("attendance.routes non trovato (ok se non ancora creato)");
}

// LEAVE – richieste assenze (ferie, permessi, malattia). Owner: list/approve/reject/balances; staff: me/create/cancel
try {
  const leaveRouter = require("./routes/leave.routes");
  app.use("/api/leave", requireAuth, leaveRouter);
} catch (e) {
  console.warn("leave.routes non trovato (ok se non ancora creato)");
}

// CATERING / BANCHETTI
try {
  const cateringRouter = require("./routes/catering.routes");
  app.use("/api/catering", requireAuth, requireRole(ROLES_ALL), cateringRouter);
} catch (e) {
  console.warn("catering.routes non trovato (ok se non ancora creato)");
}

// REPORTS – /api/reports
try {
  const reportsRouter = require("./routes/reports.routes");
  app.use("/api/reports", requireAuth, requireRole(ROLES_REPORTS), reportsRouter);
} catch (e) {
  console.warn("reports.routes non trovato:", e.message);
}

// PAYMENTS (Cassa)
try {
  const paymentsRouter = require("./routes/payments.routes");
  app.use("/api/payments", requireAuth, requireRole(ROLES_PAYMENTS), paymentsRouter);
} catch (e) {
  console.warn("payments.routes non trovato (ok se non ancora creato)");
}

// CLOSURES (Daily Z) – owner/cassa/supervisor
try {
  const closuresRouter = require("./routes/closures.routes");
  app.use("/api/closures", requireAuth, requireRole(ROLES_CLOSURES), closuresRouter);
} catch (e) {
  console.warn("closures.routes non trovato (ok se non ancora creato)");
}

// STORNI – fonte unica per netto (lordo - storni)
try {
  const storniRouter = require("./routes/storni.routes");
  app.use("/api/storni", requireAuth, requireRole(ROLES_CLOSURES), storniRouter);
} catch (e) {
  console.warn("storni.routes non trovato (ok se non ancora creato)");
}

// AI – /api/ai
try {
  const aiRouter = require("./routes/ai.routes");
  app.use("/api/ai", requireAuth, requireRole(ROLES_ALL), aiRouter);
} catch (e) {
  console.warn("ai.routes non trovato:", e.message);
}

// AUTH (no auth middleware – login/logout)
try {
  const authRouter = require("./routes/auth.routes");
  app.use("/api/auth", authRouter);
} catch (e) {
  console.warn("auth.routes non trovato (ok se non ancora creato)");
}

// SESSIONS (Staff access)
try {
  const sessionsRouter = require("./routes/sessions.routes");
  app.use("/api/sessions", requireAuth, requireRole(ROLES_ALL), sessionsRouter);
} catch (e) {
  console.warn("sessions.routes non trovato (ok se non ancora creato)");
}

// RECIPES – /api/recipes
try {
  const recipesRouter = require("./routes/recipes.routes");
  app.use("/api/recipes", requireAuth, requireRole(ROLES_ALL), recipesRouter);
} catch (e) {
  console.warn("recipes.routes non trovato:", e.message);
}

// STOCK MOVEMENTS
try {
  const stockMovementsRouter = require("./routes/stock-movements.routes");
  app.use("/api/stock-movements", requireAuth, requireRole(ROLES_ALL), stockMovementsRouter);
} catch (e) {
  console.warn("stock-movements.routes non trovato (ok se non ancora creato)");
}

// CUSTOMERS (CRM)
try {
  const customersRouter = require("./routes/customers.routes");
  app.use("/api/customers", requireAuth, requireRole(ROLES_ALL), customersRouter);
} catch (e) {
  console.warn("customers.routes non trovato (ok se non ancora creato)");
}

// DEVICES / HARDWARE
try {
  const devicesRouter = require("./routes/devices.routes");
  app.use("/api/devices", requireAuth, requireRole(ROLES_ALL), devicesRouter);
} catch (e) {
  console.warn("devices.routes non trovato:", e.message);
}

// PRINT ROUTES
try {
  const printRoutesRouter = require("./routes/print-routes.routes");
  app.use("/api/print-routes", requireAuth, requireRole(ROLES_ALL), printRoutesRouter);
} catch (e) {
  console.warn("print-routes.routes non trovato:", e.message);
}

// PRINT JOBS
try {
  const printJobsRouter = require("./routes/print-jobs.routes");
  app.use("/api/print-jobs", requireAuth, requireRole(ROLES_ALL), printJobsRouter);
} catch (e) {
  console.warn("print-jobs.routes non trovato:", e.message);
}

// ERROR HANDLER
const errorHandler = require("./middleware/errorHandler.middleware");
app.use(errorHandler)

// =======================
//  ESPORTA APP
// =======================
module.exports = app;