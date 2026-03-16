// backend/src/server.js
// Route registration is in ./app.js (orders, menu, reports, ai, recipes, etc.)
require("dotenv").config();

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