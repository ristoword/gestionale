const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");

const { safeReadJson, atomicWriteJson } = require("../../utils/safeFileIO");
const paths = require("../../config/paths");

const BCRYPT_ROUNDS = 10;

function requireEnv(name) {
  const v = process.env[name];
  if (!v || String(v).trim().length === 0) {
    throw new Error(`${name} mancante. Set it in .env`);
  }
  return String(v).trim();
}

function normalizeUsername(u) {
  return String(u || "").trim().toLowerCase();
}

function nowIso() {
  return new Date().toISOString();
}

const DATA_DIR = path.join(paths.DATA, "super-admin");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
const SESSIONS_FILE = path.join(DATA_DIR, "sessions.json");
const STRIPE_CONFIG_FILE = path.join(DATA_DIR, "stripe-config.json");
const SUPPORT_FILE = path.join(DATA_DIR, "support-notes.json");
const CONSOLE_CONTACTS_FILE = path.join(DATA_DIR, "console-contacts.json");

let authCache = { state: null, atMs: 0 };
let sessionsCache = { list: null, atMs: 0 };
let stripeConfigCache = { data: null, atMs: 0 };

function sha256Hex(input) {
  return crypto.createHash("sha256").update(String(input || ""), "utf8").digest("hex");
}

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function defaultAuthState() {
  const username = requireEnv("SUPER_ADMIN_USERNAME");
  const password = requireEnv("SUPER_ADMIN_PASSWORD");
  const force = String(process.env.SUPER_ADMIN_FORCE_PASSWORD_CHANGE || "false").toLowerCase() === "true";
  return {
    username: normalizeUsername(username),
    passwordHash: null,
    mustChangePassword: !!force,
    passwordChangedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

function readAuthRaw() {
  return safeReadJson(AUTH_FILE, null);
}

function writeAuthRaw(state) {
  ensureDir();
  atomicWriteJson(AUTH_FILE, state);
}

async function ensureAuthInitialized() {
  const ageMs = Date.now() - authCache.atMs;
  if (authCache.state && ageMs < 1500) return authCache.state;

  ensureDir();
  let state = readAuthRaw();
  if (!state || typeof state !== "object") state = defaultAuthState();

  // Initialize hash on first boot.
  if (!state.passwordHash) {
    const password = requireEnv("SUPER_ADMIN_PASSWORD");
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    state.passwordHash = hash;
  }
  if (state.mustChangePassword == null) state.mustChangePassword = true;
  state.username = normalizeUsername(state.username || process.env.SUPER_ADMIN_USERNAME || "");
  state.updatedAt = nowIso();

  writeAuthRaw(state);
  authCache = { state, atMs: Date.now() };
  return state;
}

function readSessionsRaw() {
  return safeReadJson(SESSIONS_FILE, { sessions: [] });
}

function writeSessionsRaw(next) {
  ensureDir();
  atomicWriteJson(SESSIONS_FILE, next);
}

function normalizeToken(token) {
  return String(token || "").trim();
}

function safeExpireInDays() {
  const days = Number(process.env.SUPER_ADMIN_SESSION_DAYS || "30");
  if (!Number.isFinite(days) || days <= 0) return 30;
  return Math.min(days, 90);
}

function maskValue(v) {
  const s = String(v || "").trim();
  if (!s) return null;
  if (s.length <= 8) return "****";
  return s.slice(0, 4) + "-****-" + s.slice(-4);
}

function loadStripeConfigRaw() {
  return safeReadJson(STRIPE_CONFIG_FILE, { values: {} });
}

function writeStripeConfigRaw(next) {
  ensureDir();
  atomicWriteJson(STRIPE_CONFIG_FILE, next);
}

async function getStripeConfig() {
  const ageMs = Date.now() - stripeConfigCache.atMs;
  if (stripeConfigCache.data && ageMs < 1500) return stripeConfigCache.data;

  const raw = loadStripeConfigRaw();
  const values = raw && typeof raw === "object" ? raw.values || {} : {};
  // Merge with env presence (do not expose full keys; this is for masked preview only).
  const keys = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_RISTOWORD_MONTHLY",
    "STRIPE_PRICE_RISTOWORD_ANNUAL",
  ];
  const merged = {};
  for (const k of keys) {
    merged[k] = values[k] || process.env[k] || "";
  }

  stripeConfigCache = { data: { values: merged }, atMs: Date.now() };
  return stripeConfigCache.data;
}

async function setStripeConfig(nextValues) {
  const values = nextValues && typeof nextValues === "object" ? nextValues : {};
  const existing = (await getStripeConfig()).values || {};
  const merged = { ...existing, ...values };
  writeStripeConfigRaw({ values: merged, updatedAt: nowIso() });
  stripeConfigCache = { data: { values: merged }, atMs: Date.now() };
  return { values: merged };
}

function listStripeMaskedConfig(stripeConfig) {
  const values = stripeConfig?.values || {};
  return {
    STRIPE_SECRET_KEY: maskValue(values.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY),
    STRIPE_WEBHOOK_SECRET: maskValue(values.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET),
    STRIPE_PRICE_RISTOWORD_MONTHLY: maskValue(values.STRIPE_PRICE_RISTOWORD_MONTHLY || process.env.STRIPE_PRICE_RISTOWORD_MONTHLY),
    STRIPE_PRICE_RISTOWORD_ANNUAL: maskValue(values.STRIPE_PRICE_RISTOWORD_ANNUAL || process.env.STRIPE_PRICE_RISTOWORD_ANNUAL),
  };
}

function readSupportRaw() {
  return safeReadJson(SUPPORT_FILE, { notes: [] });
}

function writeSupportRaw(next) {
  ensureDir();
  atomicWriteJson(SUPPORT_FILE, next);
}

async function appendSupportNote({ restaurantId, createdBy, note }) {
  const support = readSupportRaw();
  const list = Array.isArray(support.notes) ? support.notes : [];
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : sha256Hex(nowIso() + Math.random()),
    restaurantId: restaurantId ? String(restaurantId).trim() : null,
    createdBy: createdBy ? String(createdBy).trim() : "super-admin",
    note: String(note || "").slice(0, 2000),
    createdAt: nowIso(),
  };
  list.push(entry);
  const next = { notes: list.slice(-200) };
  writeSupportRaw(next);
  return entry;
}

function readConsoleContactsRaw() {
  return safeReadJson(CONSOLE_CONTACTS_FILE, { contacts: [] });
}

function writeConsoleContactsRaw(next) {
  ensureDir();
  atomicWriteJson(CONSOLE_CONTACTS_FILE, next);
}

async function listConsoleContacts() {
  const raw = readConsoleContactsRaw();
  const list = Array.isArray(raw.contacts) ? raw.contacts : [];
  return list.slice().reverse();
}

const CONSOLE_CATEGORIES = new Set(["assistenza", "info", "amministrazione", "altro"]);

async function appendConsoleContact({ email, category, note }) {
  const em = String(email || "").trim().toLowerCase();
  if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
    return { ok: false, error: "email_non_valida" };
  }
  const cat = CONSOLE_CATEGORIES.has(String(category || "").toLowerCase())
    ? String(category).toLowerCase()
    : "altro";
  const raw = readConsoleContactsRaw();
  const list = Array.isArray(raw.contacts) ? raw.contacts : [];
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : sha256Hex(nowIso() + Math.random()),
    email: em,
    category: cat,
    note: String(note || "").slice(0, 1000),
    createdAt: nowIso(),
  };
  list.push(entry);
  writeConsoleContactsRaw({ contacts: list.slice(-500) });
  return { ok: true, contact: entry };
}

async function verifySessionToken(token) {
  const t = normalizeToken(token);
  if (!t) return null;

  const ageMs = Date.now() - sessionsCache.atMs;
  if (!sessionsCache.list || ageMs >= 1500) {
    sessionsCache.list = readSessionsRaw().sessions || [];
    sessionsCache.atMs = Date.now();
  }

  const tokenHash = sha256Hex(t);
  const list = Array.isArray(sessionsCache.list) ? sessionsCache.list : [];
  const hit = list.find((s) => s && s.tokenHash === tokenHash);
  if (!hit) return null;

  // Expired?
  if (hit.expiresAt && new Date(hit.expiresAt).getTime() < Date.now()) return null;
  return hit;
}

async function createSessionToken({ username }) {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + safeExpireInDays() * 24 * 60 * 60 * 1000).toISOString();

  const raw = readSessionsRaw();
  const list = Array.isArray(raw.sessions) ? raw.sessions : [];
  const next = {
    sessions: [
      ...list,
      {
        tokenHash,
        username: normalizeUsername(username),
        createdAt: nowIso(),
        lastSeenAt: nowIso(),
        expiresAt,
      },
    ].slice(-200),
  };

  writeSessionsRaw(next);
  sessionsCache = { list: next.sessions, atMs: Date.now() };
  return { token, expiresAt };
}

async function touchSession(token) {
  const t = normalizeToken(token);
  if (!t) return;
  const tokenHash = sha256Hex(t);
  const raw = readSessionsRaw();
  const list = Array.isArray(raw.sessions) ? raw.sessions : [];
  const idx = list.findIndex((s) => s?.tokenHash === tokenHash);
  if (idx === -1) return;
  list[idx].lastSeenAt = nowIso();
  writeSessionsRaw({ sessions: list });
  sessionsCache = { list, atMs: Date.now() };
}

async function deleteSessionToken(token) {
  const t = normalizeToken(token);
  if (!t) return false;
  const tokenHash = sha256Hex(t);
  const raw = readSessionsRaw();
  const list = Array.isArray(raw.sessions) ? raw.sessions : [];
  const nextList = list.filter((s) => s?.tokenHash !== tokenHash);
  writeSessionsRaw({ sessions: nextList });
  sessionsCache = { list: nextList, atMs: Date.now() };
  return nextList.length !== list.length;
}

async function verifyLogin({ username, password }) {
  // Prima carica auth: se esiste auth.json (username già salvato), non dipendere da .env per lo username
  // (utile quando il server non trova .env ma i dati super-admin ci sono già su disco).
  const auth = await ensureAuthInitialized();

  const envUser = process.env.SUPER_ADMIN_USERNAME && String(process.env.SUPER_ADMIN_USERNAME).trim();
  const wantedUsername = normalizeUsername(envUser || auth.username || "");
  if (!wantedUsername) {
    return {
      ok: false,
      message:
        "Super Admin non configurato: imposta SUPER_ADMIN_USERNAME e SUPER_ADMIN_PASSWORD nel file backend/.env e riavvia il server.",
      mustChangePassword: false,
    };
  }

  const u = normalizeUsername(username);
  if (u !== wantedUsername) {
    return { ok: false, message: "Credenziali non valide", mustChangePassword: false };
  }
  const pwdInput = String(password ?? "").trim();
  let match = auth.passwordHash && await bcrypt.compare(pwdInput, auth.passwordHash);

  // Se bcrypt fallisce ma la password coincide con quella in .env, l'hash salvato è obsoleto
  // (es. auth.json creato con un'altra password). Allinea l'hash e accetta il login.
  const envPassword = process.env.SUPER_ADMIN_PASSWORD;
  if (!match && envPassword != null && String(envPassword).trim() !== "" && pwdInput === String(envPassword).trim()) {
    const newHash = await bcrypt.hash(pwdInput, BCRYPT_ROUNDS);
    auth.passwordHash = newHash;
    auth.updatedAt = nowIso();
    writeAuthRaw(auth);
    authCache = { state: auth, atMs: Date.now() };
    match = true;
  }

  if (!match) return { ok: false, message: "Credenziali non valide", mustChangePassword: false };

  return { ok: true, mustChangePassword: !!auth.mustChangePassword };
}

async function setNewPassword(newPassword) {
  const auth = await ensureAuthInitialized();
  const pwd = String(newPassword || "").trim();
  if (pwd.length < 8) {
    return { ok: false, message: "La nuova password deve essere di almeno 8 caratteri" };
  }
  const hash = await bcrypt.hash(pwd, BCRYPT_ROUNDS);
  auth.passwordHash = hash;
  auth.mustChangePassword = false;
  auth.passwordChangedAt = nowIso();
  auth.updatedAt = nowIso();
  writeAuthRaw(auth);
  authCache = { state: auth, atMs: Date.now() };
  return { ok: true };
}

async function getAuthMustChangePassword() {
  const auth = await ensureAuthInitialized();
  return !!auth.mustChangePassword;
}

async function getAuthStateForUi() {
  const auth = await ensureAuthInitialized();
  return {
    username: auth.username,
    mustChangePassword: !!auth.mustChangePassword,
    passwordChangedAt: auth.passwordChangedAt,
    updatedAt: auth.updatedAt,
  };
}

module.exports = {
  // Auth
  ensureAuthInitialized,
  verifyLogin,
  setNewPassword,
  getAuthMustChangePassword,
  getAuthStateForUi,
  // Session tokens
  createSessionToken,
  verifySessionToken,
  deleteSessionToken,
  touchSession,
  // Stripe config (masked)
  getStripeConfig,
  setStripeConfig,
  listStripeMaskedConfig,
  // Support
  appendSupportNote,
  // Console contatti (email rubrica interna SA)
  listConsoleContacts,
  appendConsoleContact,
};

