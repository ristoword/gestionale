// backend/src/server.js
// Route registration is in ./app.js (orders, menu, reports, ai, recipes, etc.)
require("./config/loadEnv").loadEnv();

// Centralized configuration validation (env, secrets, optional integrations).
// This runs before loading the main app/session modules so that configuration
// errors are reported clearly and early.
try {
  const { validateConfig } = require("./config/validateConfig");
  validateConfig();
} catch (err) {
  // Fail fast with a clear, human‑readable message.
  // Never log secret values.
  // eslint-disable-next-line no-console
  console.error(err && err.message ? err.message : err);
  throw err;
}

const http = require("http");
const app = require("./app");
const sessionMiddleware = require("./config/session");
const { initWebSocket } = require("./service/websocket.service");
const logger = require("./utils/logger");

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
initWebSocket(server, sessionMiddleware);

server.listen(PORT, () => {
  logger.info("Server started", { port: PORT, websocket: "/ws" });
});