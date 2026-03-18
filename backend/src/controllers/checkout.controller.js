const checkoutService = require("../stripe/checkout.service");
const { getWebhookStatus } = require("../stripe/stripeWebhook.service");

// POST /api/checkout
// Starts a local mock checkout session.
// Body:
// - restaurantId (required)
// - plan (optional, default ristoword_pro)
// - mode (optional: subscription|trial, default subscription)
async function startCheckout(req, res) {
  const body = req.body || {};
  const restaurantId = body.restaurantId || body.tenantId;
  const plan = body.plan || body.product || "ristoword_pro";
  const mode = body.mode || body.checkoutMode || "subscription";

  try {
    const { sessionId, session } = await checkoutService.startCheckout({ restaurantId, plan, mode });
    return res.json({
      ok: true,
      sessionId,
      status: session.status,
      webhookStatus: getWebhookStatus(),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

// POST /api/checkout/mock/complete
// Marks the mock session as paid/failed and creates an unprocessed webhook event.
async function mockCompleteCheckout(req, res) {
  const body = req.body || {};
  const sessionId = body.sessionId || body.id;
  const outcome = body.outcome || body.paymentOutcome || (body.success === true ? "paid" : "failed");

  try {
    const result = await checkoutService.mockCompleteCheckout({ sessionId, outcome });
    return res.json({
      ok: true,
      outcome,
      sessionId,
      eventId: result?.event?.id || null,
      status: result?.session?.status || null,
      webhookStatus: getWebhookStatus(),
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

module.exports = {
  startCheckout,
  mockCompleteCheckout,
};

