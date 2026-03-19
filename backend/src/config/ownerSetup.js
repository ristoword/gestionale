// backend/src/config/ownerSetup.js
// Tenant-aware owner setup completion flag.

const path = require("path");
const fs = require("fs");
const paths = require("./paths");

function getOwnerSetupPath(restaurantId) {
  const rid = String(restaurantId || "").trim() || "default";
  return path.join(paths.DATA, "tenants", rid, "owner-setup.json");
}

function readOwnerSetup(restaurantId) {
  try {
    const fp = getOwnerSetupPath(restaurantId);
    if (!fs.existsSync(fp)) return { ownerSetupCompleted: false };
    const raw = fs.readFileSync(fp, "utf8");
    const data = JSON.parse(raw);
    return {
      ownerSetupCompleted: !!(data && data.ownerSetupCompleted === true),
      ...data,
    };
  } catch {
    return { ownerSetupCompleted: false };
  }
}

function setOwnerSetupCompleted(restaurantId) {
  const rid = String(restaurantId || "").trim() || "default";
  const dir = path.join(paths.DATA, "tenants", rid);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const fp = path.join(dir, "owner-setup.json");
  const data = { ownerSetupCompleted: true, completedAt: new Date().toISOString() };
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), "utf8");
  return true;
}

async function isOwnerSetupComplete(restaurantId) {
  return readOwnerSetup(restaurantId).ownerSetupCompleted;
}

module.exports = {
  readOwnerSetup,
  setOwnerSetupCompleted,
  isOwnerSetupComplete,
  getOwnerSetupPath,
};
