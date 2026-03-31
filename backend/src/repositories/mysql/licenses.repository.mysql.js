/**
 * Licenze su MySQL — attivo con USE_MYSQL_DATABASE=true.
 */

const fs = require("fs");
const path = require("path");
const { getPool } = require("../../db/mysql-pool");
const paths = require("../../config/paths");
const { safeReadJson } = require("../../utils/safeFileIO");
const { codesMatch, normalizeActivationInput } = require("../licenses.repository.json");

function toDate(v) {
  if (v == null || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rowToLicense(row) {
  if (!row) return null;
  let base = {};
  try {
    if (row.extra != null) {
      base = typeof row.extra === "string" ? JSON.parse(row.extra) : row.extra;
    }
  } catch {
    base = {};
  }
  if (!base || typeof base !== "object") base = {};
  return {
    ...base,
    restaurantId: row.restaurant_id,
    plan: row.plan != null ? row.plan : base.plan,
    status: row.status != null ? row.status : base.status,
    activationCode: row.activation_code != null ? row.activation_code : base.activationCode,
    startDate: row.start_date ? new Date(row.start_date).toISOString() : base.startDate,
    endDate: row.end_date ? new Date(row.end_date).toISOString() : base.endDate,
    expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : base.expiresAt,
    activatedAt: row.activated_at ? new Date(row.activated_at).toISOString() : base.activatedAt,
    source: row.source != null ? row.source : base.source,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : base.createdAt,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : base.updatedAt,
  };
}

function mergedToRow(merged) {
  const extra = JSON.stringify(merged);
  return [
    merged.restaurantId,
    merged.plan || "ristoword_pro",
    merged.status || "active",
    merged.activationCode || null,
    toDate(merged.startDate),
    toDate(merged.endDate),
    toDate(merged.expiresAt),
    toDate(merged.activatedAt),
    merged.source || null,
    extra,
    toDate(merged.createdAt) || new Date(),
    toDate(merged.updatedAt) || new Date(),
  ];
}

async function readLicenses() {
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM licenses ORDER BY restaurant_id");
  return (rows || []).map(rowToLicense);
}

async function findByRestaurantId(restaurantId) {
  const id = String(restaurantId || "").trim();
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM licenses WHERE restaurant_id = ? LIMIT 1", [id]);
  return rowToLicense(rows && rows[0]);
}

async function syncFromTenantFileIfCodeMatches(userNeedle) {
  const tenantsDir = path.join(paths.DATA, "tenants");
  if (!fs.existsSync(tenantsDir)) return null;
  const dirs = fs
    .readdirSync(tenantsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const tid of dirs) {
    const fp = paths.tenantDataPath(tid, "license.json");
    if (!fs.existsSync(fp)) continue;
    const raw = safeReadJson(fp, null);
    if (!raw || typeof raw !== "object" || !raw.activationCode) continue;
    if (!codesMatch(raw.activationCode, userNeedle)) continue;
    const rid = String(raw.restaurantId || tid).trim();
    if (!rid) continue;
    const existing = await findByRestaurantId(rid);
    if (existing) {
      const merged = await updateLicense({
        restaurantId: rid,
        activationCode: raw.activationCode,
        plan: raw.plan || existing.plan,
        status: raw.status || existing.status,
        expiresAt: raw.expiresAt != null ? raw.expiresAt : existing.expiresAt,
        source: raw.source || existing.source || "tenant_license_sync",
        updatedAt: new Date().toISOString(),
      });
      return merged || existing;
    }
    return await create({
      restaurantId: rid,
      plan: raw.plan || "ristoword_pro",
      status: raw.status || "active",
      activationCode: raw.activationCode,
      expiresAt: raw.expiresAt || null,
      source: raw.source || "tenant_license_sync",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  return null;
}

async function findByActivationCode(activationCode) {
  const needle = normalizeActivationInput(activationCode);
  if (!needle) return null;

  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM licenses WHERE activation_code IS NOT NULL");
  const fromGlobal = (rows || []).find(
    (r) => typeof r.activation_code === "string" && codesMatch(r.activation_code, needle)
  );
  if (fromGlobal) return rowToLicense(fromGlobal);

  return syncFromTenantFileIfCodeMatches(needle);
}

async function hasUsedLicense(restaurantId) {
  const id = String(restaurantId || "").trim();
  if (!id) return false;
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT 1 AS ok FROM licenses WHERE restaurant_id = ? AND LOWER(TRIM(status)) = 'used' LIMIT 1",
    [id]
  );
  return rows && rows.length > 0;
}

async function updateLicense(updated) {
  const pool = getPool();
  let row = null;
  if (updated.restaurantId) {
    const [r] = await pool.query("SELECT * FROM licenses WHERE restaurant_id = ? LIMIT 1", [
      String(updated.restaurantId).trim(),
    ]);
    row = r && r[0];
  }
  if (!row && updated.activationCode) {
    const [all] = await pool.query("SELECT * FROM licenses WHERE activation_code IS NOT NULL");
    row = (all || []).find(
      (x) =>
        updated.activationCode &&
        typeof x.activation_code === "string" &&
        x.activation_code.trim() === String(updated.activationCode || "").trim()
    );
    if (!row) {
      row = (all || []).find(
        (x) => typeof x.activation_code === "string" && codesMatch(x.activation_code, updated.activationCode)
      );
    }
  }
  if (!row) return null;

  const current = rowToLicense(row);
  const merged = { ...current, ...updated };
  const vals = mergedToRow(merged);
  await pool.query(
    `UPDATE licenses SET
      plan=?, status=?, activation_code=?, start_date=?, end_date=?, expires_at=?, activated_at=?, source=?, extra=?, updated_at=NOW(3)
    WHERE id=?`,
    [
      vals[1],
      vals[2],
      vals[3],
      vals[4],
      vals[5],
      vals[6],
      vals[7],
      vals[8],
      vals[9],
      row.id,
    ]
  );
  const [again] = await pool.query("SELECT * FROM licenses WHERE id = ? LIMIT 1", [row.id]);
  return rowToLicense(again && again[0]);
}

async function create(license) {
  const pool = getPool();
  const record = {
    ...license,
    restaurantId: license.restaurantId,
    plan: license.plan || "ristoword_pro",
    status: license.status || "active",
    source: license.source || "manual_onboarding",
    createdAt: license.createdAt || new Date().toISOString(),
    updatedAt: license.updatedAt || license.createdAt || new Date().toISOString(),
  };
  const vals = mergedToRow(record);
  await pool.query(
    `INSERT INTO licenses (
      restaurant_id, plan, status, activation_code, start_date, end_date, expires_at, activated_at, source, extra, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON DUPLICATE KEY UPDATE
      plan=VALUES(plan), status=VALUES(status), activation_code=VALUES(activation_code),
      start_date=VALUES(start_date), end_date=VALUES(end_date), expires_at=VALUES(expires_at),
      activated_at=VALUES(activated_at), source=VALUES(source), extra=VALUES(extra), updated_at=VALUES(updated_at)`,
    vals
  );
  return findByRestaurantId(record.restaurantId);
}

module.exports = {
  readLicenses,
  findByRestaurantId,
  findByActivationCode,
  updateLicense,
  hasUsedLicense,
  create,
};
