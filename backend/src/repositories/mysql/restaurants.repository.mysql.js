/**
 * Ristoranti su MySQL — attivo con USE_MYSQL_DATABASE=true.
 */

const { v4: uuidv4 } = require("uuid");
const { getPool } = require("../../db/mysql-pool");

function rowToRestaurant(row) {
  if (!row) return null;
  return {
    id: row.id,
    slug: row.slug,
    restaurantName: row.restaurant_name,
    companyName: row.company_name || "",
    vatNumber: row.vat_number || "",
    address: row.address || "",
    city: row.city || "",
    postalCode: row.postal_code || "",
    province: row.province || "",
    country: row.country || "IT",
    adminEmail: row.admin_email || "",
    phone: row.phone || "",
    contactName: row.contact_name || "",
    plan: row.plan || "ristoword_pro",
    language: row.language || "it",
    currency: row.currency || "EUR",
    status: row.status || "active",
    tablesCount: row.tables_count != null ? Number(row.tables_count) : 20,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined,
  };
}

async function readRestaurants() {
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM restaurants ORDER BY id");
  return (rows || []).map(rowToRestaurant);
}

async function upsertRestaurant(conn, r) {
  const id = String(r.id || "").trim();
  if (!id) return;
  await conn.query(
    `INSERT INTO restaurants (
      id, slug, restaurant_name, company_name, vat_number, address, city, postal_code, province, country,
      admin_email, phone, contact_name, plan, language, currency, status, tables_count, extra_json, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(3))
    ON DUPLICATE KEY UPDATE
      slug=VALUES(slug), restaurant_name=VALUES(restaurant_name), company_name=VALUES(company_name),
      vat_number=VALUES(vat_number), address=VALUES(address), city=VALUES(city), postal_code=VALUES(postal_code),
      province=VALUES(province), country=VALUES(country), admin_email=VALUES(admin_email), phone=VALUES(phone),
      contact_name=VALUES(contact_name), plan=VALUES(plan), language=VALUES(language), currency=VALUES(currency),
      status=VALUES(status), tables_count=VALUES(tables_count), updated_at=NOW(3)`,
    [
      id,
      r.slug != null ? String(r.slug) : id,
      r.restaurantName != null ? String(r.restaurantName) : null,
      r.companyName != null ? String(r.companyName) : "",
      r.vatNumber != null ? String(r.vatNumber) : "",
      r.address != null ? String(r.address) : "",
      r.city != null ? String(r.city) : "",
      r.postalCode != null ? String(r.postalCode) : "",
      r.province != null ? String(r.province) : "",
      r.country != null ? String(r.country) : "IT",
      r.adminEmail != null ? String(r.adminEmail) : "",
      r.phone != null ? String(r.phone) : "",
      r.contactName != null ? String(r.contactName) : "",
      r.plan != null ? String(r.plan) : "ristoword_pro",
      r.language != null ? String(r.language) : "it",
      r.currency != null ? String(r.currency) : "EUR",
      r.status != null ? String(r.status) : "active",
      r.tablesCount != null ? Number(r.tablesCount) : 20,
      null,
      r.createdAt ? new Date(r.createdAt) : new Date(),
    ]
  );
}

async function writeRestaurants(restaurants) {
  const pool = getPool();
  const list = Array.isArray(restaurants) ? restaurants : [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (list.length === 0) {
      await conn.query("DELETE FROM restaurants");
      await conn.commit();
      return;
    }
    for (const r of list) {
      await upsertRestaurant(conn, r);
    }
    const ids = list.map((r) => String(r.id));
    const ph = ids.map(() => "?").join(",");
    await conn.query(`DELETE FROM restaurants WHERE id NOT IN (${ph})`, ids);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function findBySlug(slug) {
  const s = String(slug || "").trim().toLowerCase();
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM restaurants WHERE LOWER(TRIM(slug)) = ? LIMIT 1", [s]);
  return rowToRestaurant(rows && rows[0]);
}

async function findById(id) {
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM restaurants WHERE id = ? LIMIT 1", [String(id || "").trim()]);
  return rowToRestaurant(rows && rows[0]);
}

async function findByAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM restaurants WHERE LOWER(TRIM(admin_email)) = ? LIMIT 1", [e]);
  return rowToRestaurant(rows && rows[0]);
}

async function create(restaurant) {
  const pool = getPool();
  const id = restaurant.id || uuidv4().replace(/-/g, "").slice(0, 12);
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
  const conn = await pool.getConnection();
  try {
    await upsertRestaurant(conn, record);
  } finally {
    conn.release();
  }
  return findById(id);
}

module.exports = {
  readRestaurants,
  writeRestaurants,
  findBySlug,
  findById,
  findByAdminEmail,
  create,
};
