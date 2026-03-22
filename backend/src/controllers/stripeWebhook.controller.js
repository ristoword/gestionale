const Stripe = require("stripe");
const { processVerifiedStripeEvent, syncPendingWebhooks, getWebhookStatus } = require("../stripe/stripeWebhook.service");

// Stripe SDK needs an API key to construct the client; webhook verification uses only STRIPE_WEBHOOK_SECRET.
const STRIPE_API_VERSION = "2024-11-20.acacia";
const PLACEHOLDER_SECRET_KEY =
  "sk_test_51234567890123456789012345678901234567890123456789012";

function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY && String(process.env.STRIPE_SECRET_KEY).trim();
  return new Stripe(key || PLACEHOLDER_SECRET_KEY, { apiVersion: STRIPE_API_VERSION });
}

// POST /api/stripe/webhook
// Raw body required (mounted before express.json in app.js). Verified with stripe-signature + STRIPE_WEBHOOK_SECRET.
async function handleStripeWebhook(req, res) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET && String(process.env.STRIPE_WEBHOOK_SECRET).trim();
  if (!webhookSecret) {
    return res.status(503).json({ error: "Stripe webhook not configured" });
  }

  let sig = req.headers["stripe-signature"];
  if (Array.isArray(sig)) sig = sig[0];
  if (!sig || typeof sig !== "string") {
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  let event;
  try {
    const stripe = getStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (_err) {
    return res.status(400).json({ error: "Invalid Stripe signature" });
  }

  try {
    const result = await processVerifiedStripeEvent(event);
    return res.json({ ok: true, result });
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    return res.status(400).json({ ok: false, error: msg });
  }
}

// POST /api/stripe/webhook/sync
// Admin/dev helper: process any pending unprocessed events (JSON body; not a Stripe-signed webhook).
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
