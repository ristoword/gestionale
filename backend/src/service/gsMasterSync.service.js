/**
 * Notifica GS quando un codice è stato attivato su Ristoword (GS resta master).
 * Se env non configurata, operazione viene saltata senza errori.
 */

const gsCodesMirror = require("../repositories/gsCodesMirror.repository");

function getNotifyUrl() {
  return String(process.env.GS_WEBHOOK_ACTIVATION_URL || "").trim();
}

function getSharedSecret() {
  return String(process.env.GS_RW_SHARED_SECRET || "").trim();
}

/**
 * POST verso GS: { code, email, activatedAt, expiresAt?, source: "ristoword" }
 */
async function notifyGsCodeActivated({ code, email, activatedAt, expiresAt } = {}) {
  const url = getNotifyUrl();
  if (!url) {
    return { ok: true, skipped: true, reason: "GS_WEBHOOK_ACTIVATION_URL non impostata" };
  }

  const secret = getSharedSecret();
  const body = {
    code: gsCodesMirror.normalizeCode(code),
    email: email != null ? String(email).trim() : null,
    activatedAt: activatedAt || new Date().toISOString(),
    expiresAt: expiresAt || null,
    source: "ristoword",
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { "X-RW-Sync-Secret": secret } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { raw: text.slice(0, 500) };
    }
    gsCodesMirror.touchNotifyToGs();
    if (!res.ok) {
      return { ok: false, status: res.status, data };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

module.exports = {
  notifyGsCodeActivated,
};
