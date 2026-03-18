const { processWebhookEvent, syncPendingWebhooks, getWebhookStatus } = require("../stripe/stripeWebhook.service");

// POST /api/stripe/webhook
// In this project we support a local mock webhook (no Stripe SDK dependency).
// Expected body (mock):
// - { "eventId": "evt_...", "type": "...", "sessionId": "cs_..." }
// For safety we mainly trust eventId and pull the event from stripe-mock.json.
async function handleStripeWebhook(req, res) {
  const body = req.body || {};
  const eventId = body.eventId || body.id || body.event_id;

  if (!eventId) {
    return res.status(400).json({ ok: false, error: "eventId_obbligatorio" });
  }

  try {
    const result = await processWebhookEvent({ eventId });
    return res.json({ ok: true, result });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

// POST /api/stripe/webhook/sync
// Admin/dev helper: process any pending unprocessed events.
async function syncStripeWebhook(req, res) {
  const body = req.body || {};
  const tenantId = body.tenantId || body.restaurantId || null;
  const result = await syncPendingWebhooks({ tenantId });
  return res.json({ ok: true, result, webhookStatus: getWebhookStatus() });
}

module.exports = {
  handleStripeWebhook,
  syncStripeWebhook,
};

