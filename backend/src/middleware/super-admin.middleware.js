const superAdminRepository = require("../modules/super-admin/super-admin.repository");

function parseCookies(req) {
  const header = req.headers && req.headers.cookie ? String(req.headers.cookie) : "";
  if (!header) return {};
  return header.split(";").reduce((acc, part) => {
    const [k, ...rest] = part.trim().split("=");
    if (!k) return acc;
    acc[k] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function isApiRequest(req) {
  return String(req.path || "").startsWith("/api/super-admin");
}

function isHtmlRequest(req) {
  return req.method === "GET" && !isApiRequest(req);
}

async function requireSuperAdmin(req, res, next) {
  try {
    const cookies = parseCookies(req);
    const token = cookies.super_admin_session;
    const session = await superAdminRepository.verifySessionToken(token);
    if (!session) {
      if (isApiRequest(req)) {
        return res.status(401).json({ ok: false, error: "non_autorizzato" });
      }
      return res.redirect("/super-admin-login");
    }

    if (token) await superAdminRepository.touchSession(token);

    req.superAdmin = {
      username: session.username,
      mustChangePassword: await superAdminRepository.getAuthMustChangePassword(),
    };
    req.superAdminSessionToken = token;
    return next();
  } catch (e) {
    if (isApiRequest(req)) {
      return res.status(500).json({ ok: false, error: "super_admin_error", message: e?.message || String(e) });
    }
    return res.redirect("/super-admin-login");
  }
}

module.exports = { requireSuperAdmin };

