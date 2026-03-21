// backend/src/middleware/requireLicense.middleware.js
// Licenza: validazione solo lato Gestione Semplificata (API esterna).
// Nessuna lettura locale di license.json / licenses.json da questo middleware.

function requireLicense(req, res, next) {
  next();
}

module.exports = { requireLicense };
