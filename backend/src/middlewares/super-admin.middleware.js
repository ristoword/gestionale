// Compatibility re-export:
// The codebase uses `backend/src/middleware/*` (singular), but the requested file path is
// `backend/src/middlewares/*` (plural). Keep both to avoid integration confusion.

module.exports = require("../middleware/super-admin.middleware");

