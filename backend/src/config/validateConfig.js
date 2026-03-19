// backend/src/config/validateConfig.js
// Centralized startup configuration checks for Ristoword.
// NOTE: This is a read-only validator: it never mutates config and
// only throws for truly mandatory settings (e.g. SESSION_SECRET).
// Other problems are logged as warnings so existing behaviour is preserved.

const env = require("./env");

function mask(value) {
  if (!value) return "(not set)";
  const str = String(value);
  if (str.length <= 4) return "****";
  return str.slice(0, 2) + "****" + str.slice(-2);
}

function validateSession() {
  const raw = process.env.SESSION_SECRET;
  if (!raw || String(raw).trim().length === 0) {
    // Hard fail: sessions are required for auth and multi-tenant isolation.
    throw new Error(
      "CONFIG ERROR: SESSION_SECRET is required but not set.\n" +
        "Set SESSION_SECRET in your environment (e.g. .env) to a secure random string.\n" +
        "Example:\n" +
        '  SESSION_SECRET="change-this-to-a-long-random-string"'
    );
  }
}

function validateAi() {
  if (!env.AI_ENABLED) {
    return;
  }

  const key = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
  if (!key || String(key).trim().length === 0) {
    // Do not crash; AI is optional. Just log a clear warning.
    console.warn(
      "[CONFIG][AI] AI_ENABLED=true ma OPENAI_API_KEY non è configurata. " +
        "Le funzionalità AI useranno solo le risposte di fallback. " +
        "Imposta OPENAI_API_KEY nel file .env (valore attuale:",
      mask(key),
      ")"
    );
  }
}

function validateSmtp() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // If nothing is set, assume email is not configured – this is allowed.
  if (!host && !user && !pass) {
    return;
  }

  // If some fields are set but not all, warn explicitly.
  if (!host || !user || !pass) {
    console.warn(
      "[CONFIG][SMTP] Configurazione SMTP parziale. " +
        "Verifica SMTP_HOST/SMTP_USER/SMTP_PASS in .env. " +
        "host:",
      mask(host),
      "user:",
      mask(user)
    );
  }
}

function validateLicenseAndOnboarding() {
  const licenseKey = process.env.LICENSE_KEY;
  const onboardingSecret = process.env.ONBOARDING_SECRET;

  // License: behaviour is implemented in requireLicense middleware.
  // Here we only emit a soft warning to help deployments.
  if (!licenseKey) {
    console.warn(
      "[CONFIG][LICENSE] Nessuna LICENSE_KEY trovata in .env. " +
        "Assicurati che la licenza sia attivata tramite l'UI se richiesto."
    );
  }

  // Onboarding secret is only used on specific setup routes.
  if (!onboardingSecret) {
    console.warn(
      "[CONFIG][ONBOARDING] ONBOARDING_SECRET non impostata. " +
        "Le API di onboarding protette potrebbero non essere accessibili dall'esterno."
    );
  }
}

function validateAppUrl() {
  const appUrl = process.env.APP_URL;
  const isProduction = env.NODE_ENV === "production";
  if (isProduction && !appUrl) {
    console.warn(
      "[CONFIG][APP_URL] APP_URL non impostata in produzione. " +
        "I link inviati via email potrebbero puntare ad un host non corretto."
    );
  }
}

function validateSuperAdmin() {
  const username = process.env.SUPER_ADMIN_USERNAME;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!username || String(username).trim().length === 0) {
    console.warn(
      "[CONFIG][SUPER_ADMIN] SUPER_ADMIN_USERNAME non impostata. " +
        "L'accesso a /super-admin-login non funzionerà fino a quando non la imposti."
    );
  }
  if (!password || String(password).trim().length === 0) {
    console.warn(
      "[CONFIG][SUPER_ADMIN] SUPER_ADMIN_PASSWORD non impostata. " +
        "L'accesso a /super-admin-login non funzionerà fino a quando non la imposti."
    );
  }
}

function validateConfig() {
  // Order matters: fail-fast on mandatory session,
  // then only warnings for optional integrations.
  validateSession();
  validateAi();
  validateSmtp();
  validateLicenseAndOnboarding();
  validateAppUrl();
  validateSuperAdmin();
}

module.exports = {
  validateConfig,
};