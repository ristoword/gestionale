const path = require("path");
const { isMaintenanceEnabled } = require("../modules/system/maintenance.service");

function isAssetRequest(pathname) {
  return (
    /^\/icons\//.test(pathname) ||
    /\.(css|js|png|jpg|jpeg|svg|ico|webp|woff|woff2|ttf|eot)$/i.test(pathname)
  );
}

function isSuperAdminPath(pathname) {
  return (
    pathname === "/super-admin-login" ||
    pathname === "/dashboard/super-admin-login" ||
    pathname === "/super-admin-dashboard" ||
    pathname === "/super-admin-change-password" ||
    pathname === "/super-admin-console" ||
    pathname.startsWith("/super-admin/js") ||
    pathname.startsWith("/super-admin/") ||
    pathname.startsWith("/api/super-admin")
  );
}

function isMaintenancePage(pathname) {
  return pathname.startsWith("/maintenance/");
}

async function maintenanceMiddleware(req, res, next) {
  // Always bypass super-admin area.
  if (isSuperAdminPath(req.path)) return next();
  if (isMaintenancePage(req.path)) return next();

  // Always allow health checks.
  if (req.path === "/api/system/health" || req.path === "/api/health") return next();

  // Keep assets available (maintenance page will be inline-styled).
  if (isAssetRequest(req.path)) return next();

  const enabled = await isMaintenanceEnabled();
  if (!enabled) return next();

  // Public site disabled: show maintenance page (GET) or 503 (other methods).
  if (req.method === "GET") {
    return res.sendFile(path.join(__dirname, "../../public/maintenance/maintenance.html"));
  }

  return res.status(503).json({
    ok: false,
    maintenance: true,
    message: "Sistema in manutenzione. Riprova più tardi.",
  });
}

module.exports = { maintenanceMiddleware };

