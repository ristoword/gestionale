// backend/src/middleware/requireAuth.middleware.js
// Requires req.session.user. Use after express-session.

function requireAuth(req, res, next) {
  // DEV bridge: trusted session created via /dev-access/open/:module
  if (req.devOwner === true) return next();
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({ error: "Non autenticato", message: "Effettua il login." });
}

module.exports = { requireAuth };
