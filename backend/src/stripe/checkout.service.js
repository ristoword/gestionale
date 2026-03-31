const Stripe = require("stripe");
const stripeMockRepository = require("./stripeMock.repository");

const STRIPE_API_VERSION = "2024-11-20.acacia";

function normalizeRestaurantId(id) {
  return String(id || "").trim();
}

/**
 * Checkout reale Stripe se STRIPE_SECRET_KEY + almeno uno STRIPE_PRICE_* sono impostati.
 * Altrimenti mock locale (stripe-mock.json).
 */
function useLiveStripeCheckout() {
  const sk = process.env.STRIPE_SECRET_KEY && String(process.env.STRIPE_SECRET_KEY).trim();
  if (!sk) return false;
  const pm = process.env.STRIPE_PRICE_RISTOWORD_MONTHLY && String(process.env.STRIPE_PRICE_RISTOWORD_MONTHLY).trim();
  const pa = process.env.STRIPE_PRICE_RISTOWORD_ANNUAL && String(process.env.STRIPE_PRICE_RISTOWORD_ANNUAL).trim();
  return !!(pm || pa);
}

function resolvePriceId(billingPeriod) {
  const p = String(billingPeriod || "monthly").toLowerCase();
  const annual = p === "annual" || p === "year" || p === "yearly";
  const annualId = process.env.STRIPE_PRICE_RISTOWORD_ANNUAL && String(process.env.STRIPE_PRICE_RISTOWORD_ANNUAL).trim();
  const monthlyId = process.env.STRIPE_PRICE_RISTOWORD_MONTHLY && String(process.env.STRIPE_PRICE_RISTOWORD_MONTHLY).trim();

  if (annual) {
    if (!annualId) {
      throw new Error("STRIPE_PRICE_RISTOWORD_ANNUAL mancante per fatturazione annuale");
    }
    return annualId;
  }
  if (!monthlyId) {
    throw new Error("STRIPE_PRICE_RISTOWORD_MONTHLY mancante");
  }
  return monthlyId;
}

function resolveCheckoutUrls() {
  const explicitSuccess = process.env.STRIPE_CHECKOUT_SUCCESS_URL && String(process.env.STRIPE_CHECKOUT_SUCCESS_URL).trim();
  const explicitCancel = process.env.STRIPE_CHECKOUT_CANCEL_URL && String(process.env.STRIPE_CHECKOUT_CANCEL_URL).trim();
  const base = process.env.PUBLIC_APP_URL && String(process.env.PUBLIC_APP_URL).trim();
  const defSuccess = base ? `${base.replace(/\/$/, "")}/owner-activate?checkout=success` : "";
  const defCancel = base ? `${base.replace(/\/$/, "")}/owner-activate?checkout=cancel` : "";
  return {
    success: explicitSuccess || defSuccess,
    cancel: explicitCancel || defCancel,
  };
}

function appendSessionIdPlaceholder(successUrl) {
  let u = String(successUrl || "").trim();
  if (!u) return u;
  if (u.includes("{CHECKOUT_SESSION_ID}")) return u;
  u += u.includes("?") ? "&" : "?";
  u += "session_id={CHECKOUT_SESSION_ID}";
  return u;
}

async function startCheckoutLive({
  restaurantId,
  plan,
  mode = "subscription",
  customerEmail,
  customerName,
  billingPeriod,
  licenseCode,
} = {}) {
  const rid = normalizeRestaurantId(restaurantId);
  if (!rid) throw new Error("restaurantId_obbligatorio");

  const { success, cancel } = resolveCheckoutUrls();
  if (!success || !cancel) {
    throw new Error(
      "stripe_checkout_urls_missing: imposta STRIPE_CHECKOUT_SUCCESS_URL e STRIPE_CHECKOUT_CANCEL_URL oppure PUBLIC_APP_URL"
    );
  }

  const stripe = new Stripe(String(process.env.STRIPE_SECRET_KEY).trim(), {
    apiVersion: STRIPE_API_VERSION,
  });

  const priceId = resolvePriceId(billingPeriod);
  const planVal = plan || "ristoword_pro";
  const modeVal = mode === "trial" ? "trial" : "subscription";

  const metadata = {
    restaurantId: rid,
    plan: planVal,
    mode: modeVal,
  };
  if (licenseCode) {
    metadata.licenseCode = String(licenseCode).trim().slice(0, 200);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: appendSessionIdPlaceholder(success),
    cancel_url: cancel,
    client_reference_id: rid,
    customer_email: customerEmail ? String(customerEmail).trim() : undefined,
    metadata,
  });

  return {
    sessionId: session.id,
    url: session.url,
    checkoutMode: "live",
    session: {
      id: session.id,
      restaurantId: rid,
      plan: planVal,
      mode: modeVal,
      status: session.status || "open",
      customerEmail: customerEmail ? String(customerEmail).trim().toLowerCase() : null,
      customerName: customerName ? String(customerName).trim().slice(0, 200) : null,
    },
  };
}

async function startCheckout({
  restaurantId,
  plan,
  mode = "subscription",
  customerEmail,
  customerName,
  billingPeriod,
  licenseCode,
} = {}) {
  const rid = normalizeRestaurantId(restaurantId);
  if (!rid) throw new Error("restaurantId_obbligatorio");

  if (useLiveStripeCheckout()) {
    return startCheckoutLive({
      restaurantId: rid,
      plan,
      mode,
      customerEmail,
      customerName,
      billingPeriod,
      licenseCode,
    });
  }

  const session = stripeMockRepository.createCheckoutSession({
    restaurantId: rid,
    plan: plan || "ristoword_pro",
    mode: mode === "trial" ? "trial" : "subscription",
    customerEmail,
    customerName,
  });

  return {
    sessionId: session.id,
    url: null,
    checkoutMode: "mock",
    session,
  };
}

const { processWebhookEvent } = require("./stripeWebhook.service");
const licensesRepository = require("../repositories/licenses.repository");
const mailService = require("../service/mail.service");

async function mockCompleteCheckout({ sessionId, outcome = "paid" } = {}) {
  const id = String(sessionId || "").trim();
  if (!id) throw new Error("sessionId_obbligatorio");

  if (outcome === "failed") {
    const session = stripeMockRepository.markSessionFailed({ sessionId: id });
    return { outcome: "failed", session };
  }

  const session = stripeMockRepository.markSessionPaid({ sessionId: id });
  const stateAfter = stripeMockRepository.readState();
  const event =
    [...(stateAfter.events || [])].reverse().find((e) => String(e.sessionId) === String(id)) || null;

  let webhookResult = null;
  let activationCode = null;
  let ownerActivateUrl = null;
  let emailSent = false;
  let emailError = null;

  if (event) {
    try {
      webhookResult = await processWebhookEvent({ eventId: event.id });
      const lic = await licensesRepository.findByRestaurantId(session.restaurantId);
      activationCode = lic?.activationCode || webhookResult?.activationCode || null;
      ownerActivateUrl =
        webhookResult?.ownerActivateUrl || mailService.buildOwnerActivateLink(activationCode, session.customerEmail);
      emailSent = !!webhookResult?.emailSent;
      emailError = webhookResult?.emailError || null;
    } catch (err) {
      webhookResult = { ok: false, error: err && err.message ? err.message : String(err) };
    }
  }

  return {
    outcome: "paid",
    session,
    event,
    webhook: webhookResult,
    activationCode,
    /** true se il codice è stato preso dal pool batch (mirror) invece che generato random */
    poolClaimed: !!webhookResult?.poolClaimed,
    ownerActivateUrl,
    emailSent,
    emailError,
    /** Scadenza licenza (ISO) dopo sync Stripe */
    expiresAt: webhookResult?.expiresAt || null,
    /** Piano e tenant per display su GS */
    plan: session?.plan || null,
    restaurantId: session?.restaurantId || null,
    nextStep:
      "Apri il link ownerActivateUrl (o controlla email) e completa l'attivazione con codice + password.",
  };
}

module.exports = {
  startCheckout,
  mockCompleteCheckout,
  useLiveStripeCheckout,
};
