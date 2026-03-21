const path = require("path");

const superAdminService = require("./super-admin.service");

function htmlPath(fileName) {
  return path.join(__dirname, "../../templates/pages", fileName);
}

function cookieOptions() {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
  };
}

function setSuperAdminCookie(res, token, expiresAt) {
  const maxAgeMs = expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 30 * 24 * 60 * 60 * 1000;
  res.cookie("super_admin_session", token, { ...cookieOptions(), maxAge: maxAgeMs });
}

exports.getSuperAdminLoginPage = (req, res) => {
  res.sendFile(htmlPath("super-admin-login.html"));
};

exports.getSuperAdminChangePasswordPage = (req, res) => {
  res.sendFile(htmlPath("super-admin-change-password.html"));
};

exports.getSuperAdminDashboardPage = (req, res) => {
  const mustChange = !!req.superAdmin?.mustChangePassword;
  if (mustChange) return res.redirect("/super-admin-change-password");
  res.sendFile(htmlPath("super-admin-dashboard.html"));
};

/** Console avanzata (solo super-admin): URL non linkata pubblicamente. */
exports.getSuperAdminConsolePage = (req, res) => {
  const mustChange = !!req.superAdmin?.mustChangePassword;
  if (mustChange) return res.redirect("/super-admin-change-password");
  res.sendFile(htmlPath("super-admin-console.html"));
};

exports.apiLogin = async (req, res) => {
  const body = req.body || {};
  const username = body.username;
  const password = body.password;

  try {
    const result = await superAdminService.apiLogin({ username, password });
    if (!result.ok) return res.status(401).json(result);

    setSuperAdminCookie(res, result.token, result.expiresAt);
    return res.json({ ok: true, mustChangePassword: result.mustChangePassword });
  } catch (err) {
    const msg = err && err.message ? String(err.message) : "Errore server";
    return res.status(500).json({ ok: false, message: msg });
  }
};

exports.apiLogout = async (req, res) => {
  const token = req.superAdminSessionToken;
  await superAdminService.apiLogout({ token });

  // Clear cookie client-side.
  res.clearCookie("super_admin_session", cookieOptions());
  return res.json({ ok: true });
};

exports.apiChangePassword = async (req, res) => {
  const token = req.superAdminSessionToken;
  const body = req.body || {};
  const newPassword = body.newPassword;
  const result = await superAdminService.apiChangePassword({ token, newPassword });
  if (!result.ok) return res.status(400).json(result);
  return res.json({ ok: true });
};

exports.apiMaintenanceToggle = async (req, res) => {
  const body = req.body || {};
  const enabled = body.enabled;
  const result = await superAdminService.apiToggleMaintenance({ enabled });
  return res.json(result);
};

exports.apiCreateTempLicense = async (req, res) => {
  const body = req.body || {};
  const result = await superAdminService.apiCreateTempLicense({
    restaurantId: body.restaurantId,
    plan: body.plan,
    mode: body.mode || body.licenseType,
    expiresAt: body.expiresAt,
    extendDays: body.extendDays,
    activateImmediately: body.activateImmediately,
    note: body.note,
  });
  if (!result.ok) return res.status(400).json(result);
  return res.json(result);
};

exports.apiRevokeLicense = async (req, res) => {
  const body = req.body || {};
  const result = await superAdminService.apiRevokeLicense({
    restaurantId: body.restaurantId,
    reason: body.reason,
    suspicious: body.suspicious,
  });
  if (!result.ok) return res.status(400).json(result);
  return res.json(result);
};

exports.apiBlockCustomer = async (req, res) => {
  const body = req.body || {};
  const result = await superAdminService.apiBlockCustomer({ restaurantId: body.restaurantId });
  return res.json(result);
};

exports.apiUnblockCustomer = async (req, res) => {
  const body = req.body || {};
  const result = await superAdminService.apiUnblockCustomer({ restaurantId: body.restaurantId });
  return res.json(result);
};

exports.apiForceLogoutCustomer = async (req, res) => {
  const body = req.body || {};
  const result = await superAdminService.apiForceLogoutCustomer({ restaurantId: body.restaurantId });
  return res.json(result);
};

exports.apiGetSystemStatus = async (req, res) => {
  const result = await superAdminService.getSystemStatusForAdmin();
  return res.json(result);
};

exports.apiPostSystemStatus = async (req, res) => {
  const body = req.body || {};
  const result = await superAdminService.apiUpdateStripeConfig({ values: body.values || body });
  return res.json(result);
};

exports.apiGetCustomers = async (req, res) => {
  const q = req.query?.q || req.query?.search || "";
  const result = await superAdminService.apiGetCustomers({ q });
  return res.json(result);
};

exports.apiGetLicenses = async (req, res) => {
  const result = await superAdminService.apiGetLicenses();
  return res.json(result);
};

/**
 * Imposta il tenant su cui operano le API/pagine successive (sessione express).
 * Solo super-admin autenticato. Necessario per entrare in Sala/Cassa/Supervisor del cliente.
 */
exports.apiSetWorkingTenant = async (req, res) => {
  const body = req.body || {};
  const rid = String(body.restaurantId || body.tenantId || "").trim();
  if (!rid) return res.status(400).json({ ok: false, error: "restaurantId_obbligatorio" });

  req.session = req.session || {};
  req.session.restaurantId = rid;
  req.session.user = req.session.user || {};
  req.session.user.role = req.session.user.role || "owner";
  req.session.user.username = req.session.user.username || "superadmin";
  req.session.user.restaurantId = rid;

  return res.json({ ok: true, workingTenant: rid });
};

exports.apiGetWorkingTenant = async (req, res) => {
  const rid = req.session?.restaurantId || null;
  const userRid = req.session?.user?.restaurantId || null;
  return res.json({
    ok: true,
    workingTenant: rid || userRid || null,
  });
};

exports.apiLicenseMarkTrusted = async (req, res) => {
  const body = req.body || {};
  const result = await superAdminService.apiLicenseMarkTrusted({ restaurantId: body.restaurantId });
  if (!result.ok) return res.status(400).json(result);
  return res.json(result);
};

exports.apiGetPayments = async (req, res) => {
  const result = await superAdminService.apiGetPayments();
  return res.json(result);
};

exports.apiGetGsMirrorConsole = async (req, res) => {
  const result = await superAdminService.apiGetGsMirrorConsole();
  return res.json(result);
};

exports.apiPostGenerateGsCodes = async (req, res) => {
  const body = req.body || {};
  const result = await superAdminService.apiPostGenerateGsCodes({ count: body.count });
  if (!result.ok) return res.status(400).json(result);
  return res.json(result);
};

exports.apiGetConsoleContacts = async (req, res) => {
  const result = await superAdminService.apiGetConsoleContacts();
  return res.json(result);
};

exports.apiPostConsoleContact = async (req, res) => {
  const body = req.body || {};
  const result = await superAdminService.apiPostConsoleContact(body);
  if (!result.ok) return res.status(400).json(result);
  return res.json(result);
};

exports.apiGetConsoleUsers = async (req, res) => {
  const result = await superAdminService.apiGetConsoleUsers();
  return res.json(result);
};

exports.apiPostResetUserPassword = async (req, res) => {
  const body = req.body || {};
  const result = await superAdminService.apiPostResetUserPassword({
    userId: body.userId,
    forceMustChange: body.forceMustChange,
  });
  if (!result.ok) return res.status(400).json(result);
  return res.json(result);
};

