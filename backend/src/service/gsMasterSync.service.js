/**
 * Notifica GS quando un codice è stato attivato su Ristoword (GS resta master).
 * Push batch codici RW → GS e riserva post-Stripe.
 * Se env non configurata, operazione viene saltata senza errori.
 */

const gsCodesMirror = require("../repositories/gsCodesMirror.repository");

function getNotifyUrl() {
  return String(process.env.GS_WEBHOOK_ACTIVATION_URL || "").trim();
}

function getSharedSecret() {
  return String(process.env.GS_RW_SHARED_SECRET || process.env.GS_RW_SYNC_SECRET || "").trim();
}

function getCodesUpsertUrl() {
  return String(process.env.GS_CODES_UPSERT_URL || "").trim();
}

function getCodesReserveUrl() {
  return String(process.env.GS_CODES_RESERVE_URL || "").trim();
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
    await gsCodesMirror.touchNotifyToGs();
    if (!res.ok) {
      return { ok: false, status: res.status, data };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

/**
 * Invia a GS un batch di codici (stesso schema mirror: code, status, assignedEmail, expiresAt, source, …).
 * Usato dopo generazione Super Admin così validate su GS li conosce.
 */
async function pushCodesBatchToGs(codesArray) {
  const url = getCodesUpsertUrl();
  if (!url) {
    return { ok: true, skipped: true, reason: "GS_CODES_UPSERT_URL non impostata" };
  }
  const list = Array.isArray(codesArray) ? codesArray : [];
  if (!list.length) return { ok: true, skipped: true, reason: "nessun_codice" };

  const secret = getSharedSecret();
  const body = {
    source: "ristoword",
    codes: list.map((c) => ({
      code: gsCodesMirror.normalizeCode(c.code),
      status: c.status || "available",
      assignedEmail: c.assignedEmail != null ? String(c.assignedEmail).trim() : null,
      activatedAt: c.activatedAt || null,
      expiresAt: c.expiresAt || null,
      source: c.source || "ristoword-batch",
    })),
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
    if (!res.ok) {
      return { ok: false, status: res.status, data };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

/**
 * Dopo pagamento Stripe: un codice del pool è stato assegnato su RW — notifica GS (stesso DB validate).
 */
async function notifyGsStripeReserved({ code, email, expiresAt } = {}) {
  const url = getCodesReserveUrl();
  if (!url) {
    return { ok: true, skipped: true, reason: "GS_CODES_RESERVE_URL non impostata" };
  }
  const secret = getSharedSecret();
  const body = {
    code: gsCodesMirror.normalizeCode(code),
    assignedEmail: email != null ? String(email).trim() : null,
    expiresAt: expiresAt || null,
    status: "assigned",
    source: "ristoword-stripe",
    reservedAt: new Date().toISOString(),
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
  pushCodesBatchToGs,
  notifyGsStripeReserved,
};
