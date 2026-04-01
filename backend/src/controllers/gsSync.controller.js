/**
 * Import batch codici da GS → mirror locale (cache).
 * Protetto da GS_RW_SYNC_SECRET (header X-GS-Sync-Secret o Bearer).
 */
const gsCodesMirror = require("../repositories/gsCodesMirror.repository");

function requireSyncSecret(req, res, next) {
  const expected = String(process.env.GS_RW_SYNC_SECRET || "").trim();
  if (!expected || expected.length < 8) {
    return res.status(503).json({
      ok: false,
      error: "sync_not_configured",
      message: "Imposta GS_RW_SYNC_SECRET in .env (stesso valore concordato con GS).",
    });
  }
  const h =
    req.headers["x-gs-sync-secret"] ||
    (req.headers.authorization && String(req.headers.authorization).replace(/^Bearer\s+/i, "").trim()) ||
    "";
  if (h !== expected) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  next();
}

async function postImportCodes(req, res) {
  const body = req.body || {};
  const codes = Array.isArray(body.codes) ? body.codes : Array.isArray(body) ? body : null;
  if (!codes || !codes.length) {
    return res.status(400).json({ ok: false, message: "Body atteso: { codes: [ ... ] }" });
  }
  const state = await gsCodesMirror.upsertBatch(codes, { merge: true });
  return res.json({
    ok: true,
    imported: codes.length,
    totalInMirror: (state.codes || []).length,
    stats: await gsCodesMirror.computeStats(),
  });
}

async function getMirrorStats(req, res) {
  return res.json({ ok: true, stats: await gsCodesMirror.computeStats() });
}

module.exports = {
  requireSyncSecret,
  postImportCodes,
  getMirrorStats,
};
