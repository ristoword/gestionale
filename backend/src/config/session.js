// backend/src/config/session.js
// Shared session middleware for Express and WebSocket verifyClient.
// Con USE_MYSQL_DATABASE=true le sessioni vanno su MySQL (tabella `sessions`), niente file in data/sessions/.

const fs = require("fs");
const path = require("path");
const session = require("express-session");
const FileStore = require("session-file-store")(session);
const paths = require("./paths");
const { useMysqlPersistence } = require("./mysqlPersistence");
const { getMysqlConfig } = require("../db/mysql-pool");

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || String(sessionSecret).trim().length === 0) {
  throw new Error(
    "SESSION_SECRET is required. Set it in .env or environment. " +
      "Example: SESSION_SECRET=your-secure-random-string"
  );
}

const isProd = process.env.NODE_ENV === "production";
const forceFileSessions =
  String(process.env.USE_FILE_SESSION_STORE || "").toLowerCase() === "true";

const sessionDir = path.join(paths.DATA, "sessions");
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const SESSION_EXPIRATION_MS = SESSION_MAX_AGE_MS;

function buildMysqlSessionStore() {
  const MySQLStore = require("express-mysql-session")(session);
  const cfg = getMysqlConfig();
  if (!cfg.database || !String(cfg.host || "").trim()) {
    throw new Error(
      "[session] MySQL session store: DATABASE_URL / MYSQL_* incompleto. Imposta USE_FILE_SESSION_STORE=true per emergenza."
    );
  }
  const connectionLimit = Number(process.env.MYSQL_SESSION_POOL_SIZE || 5);
  const store = new MySQLStore({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    createDatabaseTable: true,
    clearExpired: true,
    checkExpirationInterval: 900000,
    expiration: SESSION_EXPIRATION_MS,
    connectionLimit: Number.isFinite(connectionLimit) && connectionLimit > 0 ? connectionLimit : 5,
  });
  store.onReady().catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[session] MySQL store init error:", err && err.message ? err.message : err);
  });
  return store;
}

function buildFileSessionStore() {
  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }
  return new FileStore({
    path: sessionDir,
    retries: 0,
    ttl: Math.floor(SESSION_EXPIRATION_MS / 1000),
  });
}

let store;
if (forceFileSessions) {
  store = isProd ? buildFileSessionStore() : undefined;
  // eslint-disable-next-line no-console
  console.info("[session] Store: file (USE_FILE_SESSION_STORE=true)");
} else if (useMysqlPersistence()) {
  store = buildMysqlSessionStore();
  // eslint-disable-next-line no-console
  console.info("[session] Store: MySQL (tabella sessions)");
} else if (isProd) {
  store = buildFileSessionStore();
  // eslint-disable-next-line no-console
  console.info("[session] Store: file (data/sessions)");
} else {
  store = undefined;
  // eslint-disable-next-line no-console
  console.info("[session] Store: memory (dev, USE_MYSQL_DATABASE=false)");
}

const sessionMiddleware = session({
  secret: sessionSecret,
  store: store || undefined,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS,
    secure: isProd,
    sameSite: "lax",
  },
});

module.exports = sessionMiddleware;
