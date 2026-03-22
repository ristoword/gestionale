// backend/src/stripe/stripeLiveWebhookDedup.js
// Idempotenza eventi Stripe live (evt_*) dopo verifica firma — evita doppie attivazioni.

const path = require("path");
const paths = require("../config/paths");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const FILE = path.join(paths.DATA, "stripe-live-webhook-events.json");
const MAX_IDS = 8000;

function readState() {
  const d = safeReadJson(FILE, { eventIds: [] });
  const list = Array.isArray(d.eventIds) ? d.eventIds : [];
  return { eventIds: list, extra: d };
}

function hasProcessedStripeEvent(eventId) {
  const id = String(eventId || "").trim();
  if (!id) return false;
  return readState().eventIds.includes(id);
}

function markStripeEventProcessed(eventId) {
  const id = String(eventId || "").trim();
  if (!id) return;

  const { eventIds } = readState();
  if (eventIds.includes(id)) return;

  const next = [...eventIds, id];
  const capped = next.length > MAX_IDS ? next.slice(-MAX_IDS) : next;

  atomicWriteJson(FILE, {
    eventIds: capped,
    updatedAt: new Date().toISOString(),
  });
}

module.exports = {
  hasProcessedStripeEvent,
  markStripeEventProcessed,
};
