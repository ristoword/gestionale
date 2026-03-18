// Enables `req.devOwner` based on a short-lived technical dev session.
// This keeps normal user behavior unchanged unless `session.devOwner === true`.

const DEV_OWNER_FLAG_KEY = "devOwner";
const DEV_OWNER_EXPIRES_AT_KEY = "devOwnerExpiresAt";

// Saved previous session (so dev logout can restore).
const DEV_PREV_USER_KEY = "_devPrevUser";
const DEV_PREV_RESTAURANT_ID_KEY = "_devPrevRestaurantId";

const DEFAULT_TTL_MINUTES = 15;

function restorePrevSession(req) {
  if (!req.session) return;

  const hasPrevUser = Object.prototype.hasOwnProperty.call(req.session, DEV_PREV_USER_KEY);
  const hasPrevRestaurantId = Object.prototype.hasOwnProperty.call(req.session, DEV_PREV_RESTAURANT_ID_KEY);

  if (hasPrevUser) {
    req.session.user = req.session[DEV_PREV_USER_KEY];
  } else {
    delete req.session.user;
  }

  if (hasPrevRestaurantId) {
    req.session.restaurantId = req.session[DEV_PREV_RESTAURANT_ID_KEY];
  } else {
    delete req.session.restaurantId;
  }

  delete req.session[DEV_PREV_USER_KEY];
  delete req.session[DEV_PREV_RESTAURANT_ID_KEY];
}

function devOwnerSession(req, res, next) {
  try {
    if (!req.session) return next();

    if (req.session[DEV_OWNER_FLAG_KEY] !== true) return next();

    const expiresAt = req.session[DEV_OWNER_EXPIRES_AT_KEY];
    if (typeof expiresAt === "number" && Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      // Dev session expired -> restore previous user context (if any)
      restorePrevSession(req);
      delete req.session[DEV_OWNER_FLAG_KEY];
      delete req.session[DEV_OWNER_EXPIRES_AT_KEY];
      return next();
    }

    // Expose to middlewares/controllers
    req.devOwner = true;

    // Safety: ensure a TTL exists even if upstream forgot to set it.
    if (typeof req.session[DEV_OWNER_EXPIRES_AT_KEY] !== "number") {
      req.session[DEV_OWNER_EXPIRES_AT_KEY] = Date.now() + DEFAULT_TTL_MINUTES * 60 * 1000;
    }

    return next();
  } catch {
    return next();
  }
}

module.exports = { devOwnerSession, DEV_OWNER_FLAG_KEY, DEV_OWNER_EXPIRES_AT_KEY };

