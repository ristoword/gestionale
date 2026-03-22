// backend/src/service/mail.service.js
// SMTP-based email sending for onboarding welcome emails.

let nodemailer = null;
try {
  nodemailer = require("nodemailer");
} catch (_) {
  nodemailer = null;
}

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT) || 587;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@ristoword.com";

function isConfigured() {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

/** Base URL pubblica (senza slash finale). Usata per link nelle email post-pagamento. */
function getAppBaseUrl() {
  let b = String(process.env.APP_URL || "").trim().replace(/\/$/, "");
  if (!b && process.env.RAILWAY_PUBLIC_DOMAIN) {
    b = `https://${String(process.env.RAILWAY_PUBLIC_DOMAIN).replace(/\/$/, "")}`;
  }
  return b || "";
}

/**
 * Link assoluto (se APP_URL impostata) o path relativo per /owner-activate con codice e email precompilati.
 */
function buildOwnerActivateLink(activationCode, email) {
  const params = new URLSearchParams();
  if (activationCode) params.set("code", String(activationCode).trim());
  if (email) params.set("email", String(email).trim());
  const qs = params.toString();
  const path = `/owner-activate${qs ? `?${qs}` : ""}`;
  const base = getAppBaseUrl();
  if (!base) return path;
  return `${base}${path}`;
}

function getLoginUrl(req) {
  if (req && req.get && req.get("host")) {
    const protocol = req.get("x-forwarded-proto") || (req.connection?.encrypted ? "https" : "http");
    return `${protocol}://${req.get("host")}/login/login.html`;
  }
  const base = getAppBaseUrl();
  if (base) return `${base}/login/login.html`;
  return "https://your-app.railway.app/login/login.html";
}

/**
 * Dopo pagamento Stripe (mock o reale): invia codice attivazione Ristoword + link onboarding owner.
 */
async function sendRistowordActivationEmail(options) {
  const {
    to,
    restaurantId,
    activationCode,
    plan,
    expiresAt,
    customerName,
  } = options || {};

  const adminEmail = String(to || "").trim();
  if (!adminEmail) {
    console.warn("[Mail] sendRistowordActivationEmail: destinatario mancante (nessuna email inviata)");
    return { sent: false, error: "recipient_missing" };
  }
  if (!activationCode) {
    return { sent: false, error: "activation_code_missing" };
  }

  if (!nodemailer) {
    console.warn("[Mail] nodemailer not installed. Run: npm install nodemailer");
    return { sent: false, error: "nodemailer_not_installed" };
  }

  if (!isConfigured()) {
    console.warn("[Mail] SMTP non configurato: il cliente riceverà il codice solo via pagina/API gestionale.");
    return { sent: false, error: "smtp_not_configured" };
  }

  const activateUrl = buildOwnerActivateLink(activationCode, adminEmail);
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const subject = "Ristoword – il tuo codice di attivazione";
  const nameLine = customerName ? `<p>Ciao <strong>${escapeHtml(customerName)}</strong>,</p>` : "<p>Ciao,</p>";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Attiva Ristoword</title></head>
<body style="font-family:system-ui,sans-serif;line-height:1.6;color:#333;max-width:560px;margin:0 auto;padding:20px;">
  <h1 style="color:#1a1a2e;">Attiva il tuo account Ristoword</h1>
  ${nameLine}
  <p>Il pagamento è andato a buon fine. Il tuo locale è identificato come <strong>${escapeHtml(String(restaurantId || ""))}</strong>.</p>
  <p><strong>Codice di attivazione:</strong></p>
  <p style="font-size:20px;font-weight:800;letter-spacing:1px;background:#f0f4ff;padding:14px 18px;border-radius:10px;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(String(activationCode))}</p>
  <p>Piano: <strong>${escapeHtml(String(plan || "ristoword_pro"))}</strong>${expiresAt ? ` • Valido fino al <strong>${escapeHtml(String(expiresAt).slice(0, 10))}</strong>` : ""}</p>
  <p><a href="${escapeHtml(activateUrl)}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;">Completa attivazione e password</a></p>
  <p style="color:#666;font-size:14px;">Oppure apri manualmente: <a href="${escapeHtml(activateUrl)}">${escapeHtml(activateUrl)}</a></p>
  <p style="color:#888;font-size:12px;margin-top:28px;">— Ristoword</p>
</body>
</html>
  `.trim();

  const text = `
Attiva Ristoword

Codice di attivazione: ${activationCode}
Locale (tenant): ${restaurantId || ""}
Piano: ${plan || "ristoword_pro"}${expiresAt ? ` — scadenza: ${expiresAt}` : ""}

Apri questo link per impostare la password e entrare:
${activateUrl}

— Ristoword
  `.trim();

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: adminEmail,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error("[Mail] sendRistowordActivationEmail failed:", err.message);
    return { sent: false, error: err.message };
  }
}

async function sendWelcomeEmail(options) {
  const { adminEmail, restaurantName, username, temporaryPassword, loginUrl } = options;

  if (!nodemailer) {
    console.warn("[Mail] nodemailer not installed. Run: npm install nodemailer");
    return { sent: false, error: "nodemailer_not_installed" };
  }

  if (!isConfigured()) {
    console.warn("[Mail] SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS.");
    return { sent: false, error: "smtp_not_configured" };
  }

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  const subject = "Benvenuto in Ristoword – Credenziali di accesso";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Benvenuto in Ristoword</title></head>
<body style="font-family:system-ui,sans-serif;line-height:1.6;color:#333;max-width:560px;margin:0 auto;padding:20px;">
  <h1 style="color:#1a1a2e;">Benvenuto in Ristoword</h1>
  <p>Ciao,</p>
  <p>Il tuo ristorante <strong>${escapeHtml(restaurantName)}</strong> è stato attivato con successo.</p>
  <p>Ecco le tue credenziali di accesso:</p>
  <ul style="background:#f5f5f5;padding:16px 24px;border-radius:8px;list-style:none;">
    <li><strong>URL:</strong> <a href="${escapeHtml(loginUrl)}">${escapeHtml(loginUrl)}</a></li>
    <li><strong>Utente:</strong> ${escapeHtml(username)}</li>
    <li><strong>Password temporanea:</strong> ${escapeHtml(temporaryPassword)}</li>
  </ul>
  <p><strong>Importante:</strong> Al primo accesso ti verrà chiesto di cambiare la password per motivi di sicurezza.</p>
  <p>Buon lavoro con Ristoword!</p>
  <p style="color:#888;font-size:12px;margin-top:32px;">— Il team Ristoword</p>
</body>
</html>
  `.trim();

  const text = `
Benvenuto in Ristoword

Il tuo ristorante ${restaurantName} è stato attivato.

Credenziali:
- URL: ${loginUrl}
- Utente: ${username}
- Password temporanea: ${temporaryPassword}

Importante: Al primo accesso dovrai cambiare la password.

— Il team Ristoword
  `.trim();

  try {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: adminEmail,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    console.error("[Mail] Send failed:", err.message);
    return { sent: false, error: err.message };
  }
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getTenantSmtpServiceSafe() {
  try {
    // eslint-disable-next-line global-require
    return require("./tenantEmailSettings.service");
  } catch {
    return null;
  }
}

/**
 * Email operativa magazzino / lista spesa → fornitore.
 * @param {object} options - fromName, fromEmail, toName, toEmail, subject, text, html
 * @param {string} [tenantRestaurantId] - se impostato, usa SMTP salvato in console owner per quel tenant; altrimenti SMTP globale .env
 */
async function sendSupplierEmail(options, tenantRestaurantId) {
  const {
    fromName,
    fromEmail,
    toName,
    toEmail,
    subject,
    text,
    html,
  } = options || {};

  const to = String(toEmail || "").trim();
  if (!to) {
    return { sent: false, error: "recipient_missing" };
  }
  if (!nodemailer) {
    return { sent: false, error: "nodemailer_not_installed" };
  }

  const tenantSvc = getTenantSmtpServiceSafe();
  const tenantSmtp =
    tenantRestaurantId && tenantSvc ? tenantSvc.getSmtpForSend(String(tenantRestaurantId).trim()) : null;

  const useGlobal = isConfigured();
  if (!tenantSmtp && !useGlobal) {
    return { sent: false, error: "smtp_not_configured" };
  }

  const subj = String(subject || "").trim() || "Ordine / nota magazzino";
  const bodyText = String(text || "").trim() || "(nessun testo)";
  const bodyHtml =
    html ||
    `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;">${escapeHtml(bodyText)}</pre>`;

  const smtpHost = tenantSmtp ? tenantSmtp.host : SMTP_HOST;
  const smtpPort = tenantSmtp ? tenantSmtp.port : SMTP_PORT;
  const smtpSecure = tenantSmtp ? tenantSmtp.secure : SMTP_PORT === 465;
  const smtpUser = tenantSmtp ? tenantSmtp.user : SMTP_USER;
  const smtpPass = tenantSmtp ? tenantSmtp.pass : SMTP_PASS;
  const smtpFrom = tenantSmtp ? tenantSmtp.from : SMTP_FROM;

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  const replyTo = String(fromEmail || "").trim() || undefined;
  const fromNameSafe = String(fromName || "").replace(/"/g, "").trim();
  const fromHeader = fromNameSafe ? `"${fromNameSafe}" <${smtpFrom}>` : smtpFrom;
  const toAddr = toName ? `"${String(toName).replace(/"/g, "")}" <${to}>` : to;

  try {
    await transporter.sendMail({
      from: fromHeader,
      to: toAddr,
      replyTo,
      subject: subj,
      text: bodyText,
      html: bodyHtml,
    });
    return { sent: true };
  } catch (err) {
    console.error("[Mail] sendSupplierEmail failed:", err.message);
    return { sent: false, error: err.message };
  }
}

module.exports = {
  isConfigured,
  sendWelcomeEmail,
  sendRistowordActivationEmail,
  sendSupplierEmail,
  getLoginUrl,
  getAppBaseUrl,
  buildOwnerActivateLink,
};
