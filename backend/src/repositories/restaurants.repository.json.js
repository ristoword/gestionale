// JSON — stesso contratto async del cutover MySQL.

const path = require("path");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");
const { v4: uuidv4 } = require("uuid");

const DATA_FILE = path.join(__dirname, "..", "..", "data", "restaurants.json");

async function readRestaurants() {
  const data = safeReadJson(DATA_FILE, { restaurants: [] });
  return Array.isArray(data.restaurants) ? data.restaurants : [];
}

async function writeRestaurants(restaurants) {
  const dir = path.dirname(DATA_FILE);
  require("fs").mkdirSync(dir, { recursive: true });
  const data = { restaurants: Array.isArray(restaurants) ? restaurants : [] };
  atomicWriteJson(DATA_FILE, data);
}

function generateId() {
  return uuidv4().replace(/-/g, "").slice(0, 12);
}

async function findBySlug(slug) {
  const s = String(slug || "").trim().toLowerCase();
  const list = await readRestaurants();
  return list.find((r) => (r.slug || "").toLowerCase() === s);
}

async function findById(id) {
  const list = await readRestaurants();
  return list.find((r) => r.id === id);
}

async function findByAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  const list = await readRestaurants();
  return list.find((r) => (r.adminEmail || "").toLowerCase() === e);
}

async function create(restaurant) {
  const restaurants = await readRestaurants();
  const id = restaurant.id || generateId();
  const record = {
    id,
    slug: restaurant.slug,
    restaurantName: restaurant.restaurantName,
    companyName: restaurant.companyName || "",
    vatNumber: restaurant.vatNumber || "",
    address: restaurant.address || "",
    city: restaurant.city || "",
    postalCode: restaurant.postalCode || "",
    province: restaurant.province || "",
    country: restaurant.country || "IT",
    adminEmail: restaurant.adminEmail || "",
    phone: restaurant.phone || "",
    contactName: restaurant.contactName || "",
    plan: restaurant.plan || "ristoword_pro",
    language: restaurant.language || "it",
    currency: restaurant.currency || "EUR",
    status: restaurant.status || "active",
    tablesCount: restaurant.tablesCount ?? 20,
    createdAt: restaurant.createdAt || new Date().toISOString(),
  };
  restaurants.push(record);
  await writeRestaurants(restaurants);
  return record;
}

module.exports = {
  readRestaurants,
  writeRestaurants,
  findBySlug,
  findById,
  findByAdminEmail,
  create,
  generateId,
};
