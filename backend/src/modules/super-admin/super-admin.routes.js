const express = require("express");

const superAdminController = require("./super-admin.controller");
const { requireSuperAdmin } = require("../../middleware/super-admin.middleware");

const router = express.Router();

// Pages
router.get("/super-admin-login", superAdminController.getSuperAdminLoginPage);
router.get("/super-admin-change-password", requireSuperAdmin, superAdminController.getSuperAdminChangePasswordPage);
router.get("/super-admin-dashboard", requireSuperAdmin, superAdminController.getSuperAdminDashboardPage);
router.get("/super-admin-console", requireSuperAdmin, superAdminController.getSuperAdminConsolePage);

// Auth APIs
router.post("/api/super-admin/login", superAdminController.apiLogin);
router.post("/api/super-admin/change-password", requireSuperAdmin, superAdminController.apiChangePassword);
router.post("/api/super-admin/logout", requireSuperAdmin, superAdminController.apiLogout);

// Maintenance
router.post("/api/super-admin/maintenance/toggle", requireSuperAdmin, superAdminController.apiMaintenanceToggle);

// Licenses
router.post("/api/super-admin/license/create-temp", requireSuperAdmin, superAdminController.apiCreateTempLicense);
router.post("/api/super-admin/license/revoke", requireSuperAdmin, superAdminController.apiRevokeLicense);

// Customers / Access
router.post("/api/super-admin/customer/block", requireSuperAdmin, superAdminController.apiBlockCustomer);
router.post("/api/super-admin/customer/unblock", requireSuperAdmin, superAdminController.apiUnblockCustomer);
router.post("/api/super-admin/customer/force-logout", requireSuperAdmin, superAdminController.apiForceLogoutCustomer);

// Dashboard data
router.get("/api/super-admin/system-status", requireSuperAdmin, superAdminController.apiGetSystemStatus);
router.get("/api/super-admin/payments", requireSuperAdmin, superAdminController.apiGetPayments);
router.get("/api/super-admin/customers", requireSuperAdmin, superAdminController.apiGetCustomers);
router.get("/api/super-admin/licenses", requireSuperAdmin, superAdminController.apiGetLicenses);
router.get("/api/super-admin/working-tenant", requireSuperAdmin, superAdminController.apiGetWorkingTenant);
router.post("/api/super-admin/working-tenant", requireSuperAdmin, superAdminController.apiSetWorkingTenant);
router.post("/api/super-admin/license/mark-trusted", requireSuperAdmin, superAdminController.apiLicenseMarkTrusted);

// Optional admin update: stripe/config values (masked on output)
router.post("/api/super-admin/system-status", requireSuperAdmin, superAdminController.apiPostSystemStatus);

// Console avanzata (codici GS mirror, rubrica email, reset password utenti)
router.get("/api/super-admin/console/gs-codes", requireSuperAdmin, superAdminController.apiGetGsMirrorConsole);
router.post("/api/super-admin/console/gs-codes/generate", requireSuperAdmin, superAdminController.apiPostGenerateGsCodes);
router.get("/api/super-admin/console/contacts", requireSuperAdmin, superAdminController.apiGetConsoleContacts);
router.post("/api/super-admin/console/contacts", requireSuperAdmin, superAdminController.apiPostConsoleContact);
router.get("/api/super-admin/console/users", requireSuperAdmin, superAdminController.apiGetConsoleUsers);
router.post("/api/super-admin/console/reset-password", requireSuperAdmin, superAdminController.apiPostResetUserPassword);

module.exports = router;

