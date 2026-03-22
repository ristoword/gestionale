const path = require("path");
const crypto = require("crypto");

const paths = require("../config/paths");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const STRIPE_MOCK_FILE = path.join(paths.DATA, "stripe-mock.json");

function createId(prefix) {
  const rand = crypto.randomBytes(8).toString("hex");
  return `${prefix}_${Date.now().toString(36)}_${rand.slice(0, 10)}`;
}

function normalizeRestaurantId(id) {
  return String(id || "").trim();
}

function defaultState() {
  return {
    sessions: [],
    events: [],
    webhook: {
      lastProcessedEventId: null,
      lastProcessedAt: null,
      processedCount: 0,
    },
  };
}

function readState() {
  const st = safeReadJson(STRIPE_MOCK_FILE, defaultState());
  if (!st || typeof st !== "object") return defaultState();
  if (!Array.isArray(st.sessions)) st.sessions = [];
  if (!Array.isArray(st.events)) st.events = [];
  if (!st.webhook || typeof st.webhook !== "object") st.webhook = defaultState().webhook;
  return st;
}

function writeState(state) {
  atomicWriteJson(STRIPE_MOCK_FILE, state);
}

function getLatestSessionForRestaurant(state, restaurantId) {
  const rid = normalizeRestaurantId(restaurantId);
  if (!rid) return null;
  const list = (state.sessions || []).filter((s) => normalizeRestaurantId(s.restaurantId) === rid);
  if (!list.length) return null;
  list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  return list[0] || null;
}

function listUnprocessedEvents(state) {
  const events = Array.isArray(state.events) ? state.events : [];
  return events.filter((e) => !e.processedAt);
}

function createCheckoutSession({ restaurantId, plan, mode, customerEmail, customerName } = {}) {
  const state = readState();
  const rid = normalizeRestaurantId(restaurantId);
  if (!rid) {
    throw new Error("restaurantId_obbligatorio");
  }

  const sessionId = createId("cs");
  const nowIso = new Date().toISOString();
  const email = customerEmail != null ? String(customerEmail).trim().toLowerCase() : "";
  const name = customerName != null ? String(customerName).trim().slice(0, 200) : "";
  const session = {
    id: sessionId,
    restaurantId: rid,
    plan: plan || "ristoword_pro",
    mode: mode || "subscription", // subscription|trial
    status: "created", // created|paid|failed
    createdAt: nowIso,
    paidAt: null,
    failedAt: null,
    processedAt: null,
    customerEmail: email || null,
    customerName: name || null,
    // Parità con Checkout Stripe (metadata + client_reference_id)
    metadata: {
      restaurantId: rid,
      plan: plan || "ristoword_pro",
      mode: mode || "subscription",
    },
    client_reference_id: rid,
  };

  state.sessions.push(session);
  writeState(state);
  return session;
}

function markSessionPaid({ sessionId }) {
  const state = readState();
  const id = String(sessionId || "").trim();
  if (!id) throw new Error("sessionId_obbligatorio");

  const session = (state.sessions || []).find((s) => String(s.id) === id);
  if (!session) throw new Error("session_non_trovata");

  if (session.status === "paid") return session;

  const nowIso = new Date().toISOString();
  session.status = "paid";
  session.paidAt = nowIso;

  const eventId = createId("evt");
  const event = {
    id: eventId,
    type: "checkout.session.completed",
    createdAt: nowIso,
    restaurantId: session.restaurantId,
    sessionId: session.id,
    paymentStatus: "paid",
    processedAt: null,
  };

  state.events.push(event);
  writeState(state);
  return session;
}

function markSessionFailed({ sessionId }) {
  const state = readState();
  const id = String(sessionId || "").trim();
  if (!id) throw new Error("sessionId_obbligatorio");

  const session = (state.sessions || []).find((s) => String(s.id) === id);
  if (!session) throw new Error("session_non_trovata");

  if (session.status === "failed") return session;

  const nowIso = new Date().toISOString();
  session.status = "failed";
  session.failedAt = nowIso;
  session.processedAt = null;

  const eventId = createId("evt");
  const event = {
    id: eventId,
    type: "checkout.session.payment_failed",
    createdAt: nowIso,
    restaurantId: session.restaurantId,
    sessionId: session.id,
    paymentStatus: "failed",
    processedAt: null,
  };

  state.events.push(event);
  writeState(state);
  return session;
}

function getEventById(state, eventId) {
  const id = String(eventId || "").trim();
  if (!id) return null;
  return (state.events || []).find((e) => String(e.id) === id) || null;
}

function markEventProcessed({ eventId }) {
  const state = readState();
  const event = getEventById(state, eventId);
  if (!event) return null;
  if (event.processedAt) return event;

  const nowIso = new Date().toISOString();
  event.processedAt = nowIso;

  // Optionally mark session processed
  const session = (state.sessions || []).find((s) => s.id === event.sessionId);
  if (session) session.processedAt = nowIso;

  state.webhook.lastProcessedEventId = event.id;
  state.webhook.lastProcessedAt = nowIso;
  state.webhook.processedCount = Number(state.webhook.processedCount || 0) + 1;

  writeState(state);
  return event;
}

function listSessions({ restaurantId } = {}) {
  const state = readState();
  if (restaurantId) {
    const rid = normalizeRestaurantId(restaurantId);
    return (state.sessions || []).filter((s) => normalizeRestaurantId(s.restaurantId) === rid);
  }
  return state.sessions || [];
}

module.exports = {
  STRIPE_MOCK_FILE,
  createCheckoutSession,
  markSessionPaid,
  markSessionFailed,
  listUnprocessedEvents,
  markEventProcessed,
  readState,
  writeState,
  getLatestSessionForRestaurant,
  listSessions,
};

