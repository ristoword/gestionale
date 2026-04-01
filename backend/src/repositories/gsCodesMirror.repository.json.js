/**
 * Cache/replica tecnica dei codici batch GS (GS è master dello stato).
 * File: data/gs-codes-mirror.json
 */
const path = require("path");
const crypto = require("crypto");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const DATA_FILE = path.join(__dirname, "..", "..", "data", "gs-codes-mirror.json");

function normalizeCode(c) {
  return String(c || "")
    .trim()
    .replace(/[\u00A0\u2000-\u200B\uFEFF]/g, " ")
    .replace(/\s+/g, " ");
}

function readState() {
  return safeReadJson(DATA_FILE, {
    importedAt: null,
    lastSyncFromGsAt: null,
    lastNotifyToGsAt: null,
    codes: [],
  });
}

function writeState(state) {
  atomicWriteJson(DATA_FILE, state);
}

/**
 * Upsert batch da GS (import). Non sostituisce l'intero file se vuoi merge: merge per code.
 */
function upsertBatch(codesArray, { merge = true } = {}) {
  const state = readState();
  const list = Array.isArray(state.codes) ? [...state.codes] : [];
  const map = new Map(list.map((x) => [normalizeCode(x.code).toUpperCase(), { ...x }]));

  for (const raw of codesArray || []) {
    const code = normalizeCode(raw.code);
    if (!code) continue;
    const key = code.toUpperCase();
    const prev = map.get(key);
    const row = {
      code,
      status: raw.status || prev?.status || "available",
      assignedEmail: raw.assignedEmail != null ? String(raw.assignedEmail).trim() : prev?.assignedEmail ?? null,
      activatedAt: raw.activatedAt ?? prev?.activatedAt ?? null,
      expiresAt: raw.expiresAt ?? prev?.expiresAt ?? null,
      source: raw.source || prev?.source || "GS-batch",
      rwSyncedAt: new Date().toISOString(),
    };
    map.set(key, row);
  }

  state.codes = [...map.values()];
  state.importedAt = new Date().toISOString();
  state.lastSyncFromGsAt = new Date().toISOString();
  writeState(state);
  return state;
}

function findByCode(code) {
  const needle = normalizeCode(code).toUpperCase();
  const state = readState();
  return (state.codes || []).find((x) => normalizeCode(x.code).toUpperCase() === needle) || null;
}

function markUsedLocal(code, { assignedEmail, activatedAt, expiresAt } = {}) {
  const state = readState();
  const codes = Array.isArray(state.codes) ? [...state.codes] : [];
  const needle = normalizeCode(code).toUpperCase();
  const idx = codes.findIndex((x) => normalizeCode(x.code).toUpperCase() === needle);
  const now = new Date().toISOString();
  if (idx === -1) {
    const row = {
      code: normalizeCode(code),
      status: "used",
      assignedEmail: assignedEmail || null,
      activatedAt: activatedAt || now,
      expiresAt: expiresAt || null,
      source: "GS-batch",
      rwSyncedAt: now,
    };
    codes.push(row);
    state.codes = codes;
    writeState(state);
    return row;
  }
  codes[idx] = {
    ...codes[idx],
    status: "used",
    assignedEmail: assignedEmail != null ? String(assignedEmail).trim() : codes[idx].assignedEmail,
    activatedAt: activatedAt || now,
    expiresAt: expiresAt != null ? expiresAt : codes[idx].expiresAt,
    rwSyncedAt: now,
  };
  state.codes = codes;
  writeState(state);
  return codes[idx];
}

function computeStats() {
  const state = readState();
  const codes = state.codes || [];
  const by = { available: 0, assigned: 0, used: 0, expired: 0, other: 0 };
  for (const c of codes) {
    const s = String(c.status || "").toLowerCase();
    if (s === "available") by.available += 1;
    else if (s === "assigned") by.assigned += 1;
    else if (s === "used") by.used += 1;
    else if (s === "expired") by.expired += 1;
    else by.other += 1;
  }
  return {
    total: codes.length,
    ...by,
    importedAt: state.importedAt,
    lastSyncFromGsAt: state.lastSyncFromGsAt,
    lastNotifyToGsAt: state.lastNotifyToGsAt,
  };
}

function touchNotifyToGs() {
  const state = readState();
  state.lastNotifyToGsAt = new Date().toISOString();
  writeState(state);
}

/**
 * Genera codici locali (super-admin) e li aggiunge al mirror come disponibili.
 * @param {number} count 1–25
 * @param {{ prefix?: string }} opts
 */
function generateLocalCodes(count, { prefix = "RW" } = {}) {
  const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 25);
  const state = readState();
  const list = Array.isArray(state.codes) ? [...state.codes] : [];
  const existing = new Set(list.map((x) => normalizeCode(x.code).toUpperCase()));
  const added = [];
  const now = new Date().toISOString();
  const pref = String(prefix || "RW").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 8) || "RW";

  for (let i = 0; i < n; i += 1) {
    let code;
    let guard = 0;
    do {
      const rand = crypto.randomBytes(5).toString("hex").toUpperCase();
      const ts = Date.now().toString(36).toUpperCase();
      code = `${pref}-${ts}-${rand}`;
      guard += 1;
    } while (existing.has(normalizeCode(code).toUpperCase()) && guard < 80);

    existing.add(normalizeCode(code).toUpperCase());
    const row = {
      code,
      status: "available",
      assignedEmail: null,
      activatedAt: null,
      expiresAt: null,
      source: "super-admin-local",
      rwSyncedAt: now,
    };
    list.push(row);
    added.push(row);
  }

  state.codes = list;
  if (!state.importedAt) state.importedAt = now;
  writeState(state);
  return { added, count: added.length };
}

/**
 * Prende il primo codice `available` dal mirror (dopo pagamento Stripe) e lo marca `assigned`.
 * @returns {{ code: string, row: object } | null}
 */
function claimAvailableForStripe({ assignedEmail, expiresAt } = {}) {
  const state = readState();
  const codes = Array.isArray(state.codes) ? [...state.codes] : [];
  const idx = codes.findIndex((x) => String(x.status || "").toLowerCase() === "available");
  if (idx === -1) return null;

  const now = new Date().toISOString();
  codes[idx] = {
    ...codes[idx],
    status: "assigned",
    assignedEmail: assignedEmail != null ? String(assignedEmail).trim() : codes[idx].assignedEmail,
    expiresAt: expiresAt != null ? expiresAt : codes[idx].expiresAt,
    rwSyncedAt: now,
  };
  state.codes = codes;
  state.lastStripePoolClaimAt = now;
  writeState(state);
  return { code: codes[idx].code, row: codes[idx] };
}

module.exports = {
  readState,
  upsertBatch,
  findByCode,
  markUsedLocal,
  computeStats,
  touchNotifyToGs,
  normalizeCode,
  generateLocalCodes,
  claimAvailableForStripe,
};
