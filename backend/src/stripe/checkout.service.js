const stripeMockRepository = require("./stripeMock.repository");

function normalizeRestaurantId(id) {
  return String(id || "").trim();
}

async function startCheckout({ restaurantId, plan, mode = "subscription" } = {}) {
  const rid = normalizeRestaurantId(restaurantId);
  if (!rid) throw new Error("restaurantId_obbligatorio");

  const session = stripeMockRepository.createCheckoutSession({
    restaurantId: rid,
    plan: plan || "ristoword_pro",
    mode: mode === "trial" ? "trial" : "subscription",
  });

  return { sessionId: session.id, session };
}

async function mockCompleteCheckout({ sessionId, outcome = "paid" } = {}) {
  const id = String(sessionId || "").trim();
  if (!id) throw new Error("sessionId_obbligatorio");

  if (outcome === "failed") {
    const session = stripeMockRepository.markSessionFailed({ sessionId: id });
    return { outcome: "failed", session };
  }

  const session = stripeMockRepository.markSessionPaid({ sessionId: id });
  const event = stripeMockRepository.readState().events.find((e) => e.sessionId === id);
  return { outcome: "paid", session, event };
}

module.exports = {
  startCheckout,
  mockCompleteCheckout,
};

