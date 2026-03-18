// Redirect to /change-password when user must change password and is not already there.

function requireMustChangePassword(req, res, next) {
  // DEV bridge: bypass forced password change.
  if (req.devOwner === true) return next();
  const sessionUser = req.session && req.session.user;
  if (!sessionUser || sessionUser.mustChangePassword !== true) {
    return next();
  }
  const p = (req.path || "").split("?")[0];
  if (p === "/change-password" || p.startsWith("/change-password/")) {
    return next();
  }
  if (p === "/api/auth/change-password" || p === "/api/auth/me") {
    return next();
  }
  return res.redirect("/change-password");
}

module.exports = { requireMustChangePassword };
