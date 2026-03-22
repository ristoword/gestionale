// backend/src/service/tenantEmailSettings.service.js
// SMTP operativo per tenant (lista spesa, email magazzino) — password cifrata a riposo.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const paths = require("../config/paths");

const ALGO = "aes-256-gcm";

function getKey() {
  const s =
    process.env.TENANT_SMTP_SECRET ||
    process.env.SESSION_SECRET ||
    "ristoword-tenant-smtp-dev-do-not-use-prod";
  return crypto.createHash("sha256").update(String(s)).digest();
}

function encryptPassword(plain) {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptPassword(b64) {
  if (!b64) return "";
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length < 29) return "";
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

function emailPath(restaurantId) {
  return paths.tenant(restaurantId, "email-smtp.json");
}

function readRaw(restaurantId) {
  const rid = String(restaurantId || "").trim();
  if (!rid) return null;
  const fp = emailPath(rid);
  if (!fs.existsSync(fp)) return null;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
}

function maskUser(u) {
  const s = String(u || "");
  if (s.length <= 4) return "•••";
  return s.slice(0, 3) + "•••" + s.slice(-2);
}

/**
 * Dati sicuri da mostrare in UI (nessuna password).
 */
function getPublicSettings(restaurantId) {
  const raw = readRaw(restaurantId);
  if (!raw || !raw.host) {
    return { configured: false };
  }
  return {
    configured: true,
    host: raw.host,
    port: raw.port || 587,
    secure: !!raw.secure,
    userMasked: maskUser(raw.user),
    /** Solo console owner: utente SMTP in chiaro per modificare il campo */
    userFull: raw.user || "",
    from: raw.from || "",
    hasPassword: !!raw.passEnc,
  };
}

/**
 * Salva SMTP tenant. Se pass è vuota e c’è già una password salvata, la mantiene.
 */
function saveSettings(restaurantId, body) {
  const rid = String(restaurantId || "").trim();
  if (!rid) {
    const err = new Error("Tenant mancante");
    err.status = 400;
    throw err;
  }
  const prev = readRaw(rid) || {};
  const host = String(body.host || "").trim();
  const port = Number(body.port) || 587;
  const secure = body.secure === true || body.secure === "true";
  const user = String(body.user || "").trim();
  const from = String(body.from || "").trim();
  const passNew = body.pass != null ? String(body.pass).trim() : "";

  if (!host || !user) {
    const err = new Error("Host e utente SMTP obbligatori");
    err.status = 400;
    throw err;
  }

  let passEnc = prev.passEnc;
  if (passNew) {
    passEnc = encryptPassword(passNew);
  }
  if (!passEnc) {
    const err = new Error("Inserisci la password SMTP (o app password)");
    err.status = 400;
    throw err;
  }

  const dir = path.dirname(emailPath(rid));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const data = {
    host,
    port,
    secure,
    user,
    from: from || user,
    passEnc,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(emailPath(rid), JSON.stringify(data, null, 2), "utf8");
  return true;
}

function clearSettings(restaurantId) {
  const rid = String(restaurantId || "").trim();
  if (!rid) return;
  const fp = emailPath(rid);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
}

/**
 * Oggetto per nodemailer, o null se non configurato.
 */
function getSmtpForSend(restaurantId) {
  const raw = readRaw(restaurantId);
  if (!raw || !raw.host || !raw.user || !raw.passEnc) return null;
  const pass = decryptPassword(raw.passEnc);
  if (!pass) return null;
  const port = Number(raw.port) || 587;
  return {
    host: raw.host,
    port,
    secure: raw.secure === true || port === 465,
    user: raw.user,
    pass,
    from: raw.from || raw.user,
  };
}

module.exports = {
  getPublicSettings,
  saveSettings,
  clearSettings,
  getSmtpForSend,
};
