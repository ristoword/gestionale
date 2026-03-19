const stripeMockRepository = require("./stripeMock.repository");
const { syncLicenseFromPaidSession } = require("./stripeLicenseSync.service");

function normalizeRestaurantId(id) {
  return String(id || "").trim();
}

async function processWebhookEvent({ eventId } = {}) {
  const id = String(eventId || "").trim();
  if (!id) throw new Error("eventId_obbligatorio");

  const state = stripeMockRepository.readState();
  const event = (state.events || []).find((e) => String(e.id) === id) || null;
  if (!event) {
    throw new Error("event_non_trovato");
  }

  if (event.processedAt) {
    return { processed: true, event };
  }

  const session = (state.sessions || []).find((s) => String(s.id) === String(event.sessionId)) || null;

  let paidMeta = {};
  // Only on paid events we update licenses.
  if (String(event.paymentStatus || "").toLowerCase() === "paid") {
    paidMeta = await syncLicenseFromPaidSession({
      session,
      event,
      restaurantName: session?.customerName || event.restaurantId,
      source: "stripe_webhook",
    });
  }

  stripeMockRepository.markEventProcessed({ eventId: id });

  return {
    processed: true,
    eventId: id,
    paymentStatus: event.paymentStatus || null,
    ...paidMeta,
  };
}

async function syncPendingWebhooks({ tenantId = null } = {}) {
  const rid = tenantId ? normalizeRestaurantId(tenantId) : null;
  const state = stripeMockRepository.readState();
  const unprocessed = stripeMockRepository.listUnprocessedEvents(state);

  const toProcess = rid
    ? unprocessed.filter((e) => normalizeRestaurantId(e.restaurantId) === rid)
    : unprocessed;

  const results = [];
  for (const e of toProcess) {
    try {
      const r = await processWebhookEvent({ eventId: e.id });
      results.push({ ok: true, ...r });
    } catch (err) {
      results.push({ ok: false, eventId: e.id, error: err && err.message ? err.message : String(err) });
    }
  }

  const after = stripeMockRepository.readState();
  return {
    processed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
    pendingRemaining: stripeMockRepository.listUnprocessedEvents(after).length,
  };
}

function getWebhookStatus() {
  const state = stripeMockRepository.readState();
  return state.webhook || {};
}

module.exports = {
  processWebhookEvent,
  syncPendingWebhooks,
  getWebhookStatus,
};

