/**
 * CORS opzionale per chiamate API da Gestione Semplificata (origine diversa da Ristoword).
 * Senza variabile d'ambiente il middleware non modifica nulla (comportamento attuale).
 *
 * @example CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3001,https://gs.tuodominio.it
 */
function corsOptional(req, res, next) {
  const raw = process.env.CORS_ALLOWED_ORIGINS;
  if (!raw || !String(raw).trim()) {
    return next();
  }

  const allowed = String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin;

  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,POST,OPTIONS");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With, X-Onboarding-Key"
    );
    res.setHeader("Access-Control-Max-Age", "86400");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  return next();
}

module.exports = { corsOptional };
