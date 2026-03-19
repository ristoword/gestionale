const stripeMockRepository = require("./stripeMock.repository");

function normalizeRestaurantId(id) {
  return String(id || "").trim();
}

async function startCheckout({
  restaurantId,
  plan,
  mode = "subscription",
  customerEmail,
  customerName,
} = {}) {
  const rid = normalizeRestaurantId(restaurantId);
  if (!rid) throw new Error("restaurantId_obbligatorio");

  const session = stripeMockRepository.createCheckoutSession({
    restaurantId: rid,
    plan: plan || "ristoword_pro",
    mode: mode === "trial" ? "trial" : "subscription",
    customerEmail,
    customerName,
  });

  return { sessionId: session.id, session };
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
      const lic = licensesRepository.findByRestaurantId(session.restaurantId);
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
    ownerActivateUrl,
    emailSent,
    emailError,
    nextStep:
      "Apri il link ownerActivateUrl (o controlla email) e completa l'attivazione con codice + password.",
  };
}

module.exports = {
  startCheckout,
  mockCompleteCheckout,
};

