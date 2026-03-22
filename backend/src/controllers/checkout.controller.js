const checkoutService = require("../stripe/checkout.service");
const { getWebhookStatus } = require("../stripe/stripeWebhook.service");

// POST /api/checkout
// Starts a local mock checkout session.
// Body:
// - restaurantId (required) — stesso ID tenant usato in gestionale / GS
// - plan (optional, default ristoword_pro)
// - mode (optional: subscription|trial, default subscription)
// - customerEmail / email / adminEmail (optional) — per email con codice dopo pagamento
// - customerName (optional)
async function startCheckout(req, res) {
  const body = req.body || {};
  const restaurantId = body.restaurantId || body.tenantId;
  const plan = body.plan || body.product || "ristoword_pro";
  const mode = body.mode || body.checkoutMode || "subscription";
  const customerEmail = body.customerEmail || body.email || body.adminEmail || null;
  const customerName = body.customerName || body.name || null;
  const billingPeriod = body.billingPeriod || body.interval || "monthly";
  const licenseCode = body.licenseCode || body.activationCode || null;

  try {
    const { sessionId, session, url, checkoutMode } = await checkoutService.startCheckout({
      restaurantId,
      plan,
      mode,
      customerEmail,
      customerName,
      billingPeriod,
      licenseCode,
    });
    return res.json({
      ok: true,
      sessionId,
      checkoutMode: checkoutMode || "mock",
      url: url || null,
      status: session.status,
      restaurantId: session.restaurantId,
      mode: session.mode,
      customerEmail: session.customerEmail || null,
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
      restaurantId: result?.restaurantId || result?.session?.restaurantId || null,
      plan: result?.plan || result?.session?.plan || null,
      mode: result?.session?.mode || null,
      expiresAt: result?.expiresAt || null,
      activationCode: result?.activationCode || null,
      poolClaimed: !!result?.poolClaimed,
      ownerActivateUrl: result?.ownerActivateUrl || null,
      emailSent: !!result?.emailSent,
      emailError: result?.emailError || null,
      nextStep: result?.nextStep || null,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err && err.message ? err.message : String(err) });
  }
}

module.exports = {
  startCheckout,
  mockCompleteCheckout,
};

