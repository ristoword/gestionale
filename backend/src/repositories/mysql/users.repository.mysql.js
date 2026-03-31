/**
 * Utenti su MySQL — attivo solo con USE_MYSQL_DATABASE=true (vedi users.repository.js).
 */

const bcrypt = require("bcrypt");
const { getPool } = require("../../db/mysql-pool");

const BCRYPT_ROUNDS = 10;

const DEFAULT_LEAVE_BALANCES = {
  ferieMaturate: 0,
  ferieUsate: 0,
  permessiUsati: 0,
  malattiaGiorni: 0,
};

function normalizeUsername(u) {
  return String(u || "").trim().toLowerCase();
}

function isBcryptHash(str) {
  return typeof str === "string" && (str.startsWith("$2a$") || str.startsWith("$2b$") || str.startsWith("$2y$"));
}

function parseLeaveBalances(raw) {
  if (raw == null) return null;
  if (typeof raw === "object" && !Buffer.isBuffer(raw)) return raw;
  try {
    return typeof raw === "string" ? JSON.parse(raw) : JSON.parse(String(raw));
  } catch {
    return null;
  }
}

function rowToUser(row, includePassword = true) {
  if (!row) return null;
  const lb = parseLeaveBalances(row.leave_balances);
  const u = {
    id: String(row.id),
    username: row.username,
    name: row.name || "",
    surname: row.surname || "",
    email: row.email || undefined,
    role: row.role,
    restaurantId: row.restaurant_id || null,
    is_active: row.is_active === 1 || row.is_active === true,
    mustChangePassword: row.must_change_password === 1 || row.must_change_password === true,
    hourlyRate: row.hourly_rate != null ? Number(row.hourly_rate) : undefined,
    employmentType: row.employment_type || undefined,
    leaveBalances: lb && typeof lb === "object" ? { ...DEFAULT_LEAVE_BALANCES, ...lb } : { ...DEFAULT_LEAVE_BALANCES },
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : undefined,
  };
  if (includePassword) u.password = row.password_hash;
  return u;
}

function ensureLeaveBalances(user) {
  if (!user) return user;
  if (user.leaveBalances && typeof user.leaveBalances === "object") return user;
  return { ...user, leaveBalances: { ...DEFAULT_LEAVE_BALANCES } };
}

async function readUsers() {
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM users ORDER BY id");
  return (rows || []).map((r) => rowToUser(r, true));
}

async function writeUsers(users) {
  const pool = getPool();
  const list = Array.isArray(users) ? users : [];
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (list.length === 0) {
      await conn.query("DELETE FROM users");
      await conn.commit();
      return;
    }
    for (const u of list) {
      await upsertFullUser(conn, u);
    }
    const ids = list.map((u) => String(u.id));
    const placeholders = ids.map(() => "?").join(",");
    await conn.query(`DELETE FROM users WHERE id NOT IN (${placeholders})`, ids);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function upsertFullUser(conn, u) {
  const id = String(u.id || "").trim();
  if (!id) return;
  let ph = u.password != null ? String(u.password) : "";
  if (!ph) {
    const [existing] = await conn.query("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [id]);
    if (!existing || !existing.length) {
      throw new Error(`[users.mysql] writeUsers: utente ${id} senza password`);
    }
    ph = existing[0].password_hash;
  }
  const lb =
    u.leaveBalances && typeof u.leaveBalances === "object"
      ? JSON.stringify({ ...DEFAULT_LEAVE_BALANCES, ...u.leaveBalances })
      : JSON.stringify(DEFAULT_LEAVE_BALANCES);
  await conn.query(
    `INSERT INTO users (
      id, username, password_hash, name, surname, email, role, restaurant_id, is_active, must_change_password,
      hourly_rate, employment_type, leave_balances, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(3))
    ON DUPLICATE KEY UPDATE
      username=VALUES(username), password_hash=VALUES(password_hash), name=VALUES(name), surname=VALUES(surname),
      email=VALUES(email), role=VALUES(role), restaurant_id=VALUES(restaurant_id), is_active=VALUES(is_active),
      must_change_password=VALUES(must_change_password), hourly_rate=VALUES(hourly_rate),
      employment_type=VALUES(employment_type), leave_balances=VALUES(leave_balances), updated_at=NOW(3)`,
    [
      id,
      String(u.username || ""),
      ph,
      u.name != null ? String(u.name) : "",
      u.surname != null ? String(u.surname) : "",
      u.email != null ? String(u.email).trim() : null,
      String(u.role || "staff"),
      u.restaurantId != null ? String(u.restaurantId) : null,
      u.is_active !== false ? 1 : 0,
      u.mustChangePassword === true ? 1 : 0,
      u.hourlyRate != null && u.hourlyRate !== "" ? Number(u.hourlyRate) : null,
      u.employmentType != null ? String(u.employmentType).trim() : null,
      lb,
      u.createdAt ? new Date(u.createdAt) : new Date(),
    ]
  );
}

async function findByCredentials(username, password) {
  const pool = getPool();
  const u = normalizeUsername(username);
  const p = String(password || "");
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE LOWER(TRIM(username)) = ? AND is_active = 1 LIMIT 1",
    [u]
  );
  const row = rows && rows[0];
  if (!row) return null;
  const user = rowToUser(row, true);
  const stored = user.password || "";
  if (isBcryptHash(stored)) {
    const match = await bcrypt.compare(p, stored);
    if (match) {
      const { password: _pw, ...rest } = user;
      return { ...rest, password: stored };
    }
    return null;
  }
  if (stored === p) {
    const hash = await bcrypt.hash(p, BCRYPT_ROUNDS);
    await pool.query("UPDATE users SET password_hash = ?, updated_at = NOW(3) WHERE id = ?", [hash, user.id]);
    return { ...user, password: hash };
  }
  return null;
}

async function findByUsername(username) {
  const pool = getPool();
  const u = normalizeUsername(username);
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE LOWER(TRIM(username)) = ? AND is_active = 1 LIMIT 1",
    [u]
  );
  const user = rowToUser(rows && rows[0], false);
  return user;
}

async function findById(id) {
  const pool = getPool();
  const sid = String(id || "").trim();
  if (!sid) return null;
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [sid]);
  const user = rowToUser(rows && rows[0], true);
  return user ? ensureLeaveBalances(user) : null;
}

async function findByRestaurantId(restaurantId) {
  const rid = String(restaurantId || "").trim();
  if (!rid) return [];
  const pool = getPool();
  const [rows] = await pool.query("SELECT * FROM users WHERE restaurant_id = ? ORDER BY id", [rid]);
  return (rows || []).map((r) => ensureLeaveBalances(rowToUser(r, true)));
}

async function nextNumericId(pool) {
  const [rows] = await pool.query("SELECT id FROM users");
  const nums = (rows || []).map((r) => parseInt(String(r.id), 10)).filter((n) => Number.isFinite(n));
  return nums.length ? Math.max(...nums) + 1 : 1;
}

async function createUser(userData) {
  const pool = getPool();
  const username = normalizeUsername(userData.username);
  const [dup] = await pool.query("SELECT id FROM users WHERE LOWER(TRIM(username)) = ? LIMIT 1", [username]);
  if (dup && dup.length) return null;

  const id = String(await nextNumericId(pool));
  const now = new Date();
  const lb =
    userData.leaveBalances && typeof userData.leaveBalances === "object"
      ? JSON.stringify({ ...DEFAULT_LEAVE_BALANCES, ...userData.leaveBalances })
      : JSON.stringify(DEFAULT_LEAVE_BALANCES);

  await pool.query(
    `INSERT INTO users (
      id, username, password_hash, name, surname, email, role, restaurant_id, is_active, must_change_password,
      hourly_rate, employment_type, leave_balances, created_at, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?, NOW(3))`,
    [
      id,
      String(userData.username || "").trim(),
      String(userData.password || ""),
      userData.name != null ? String(userData.name).trim() : "",
      userData.surname != null ? String(userData.surname).trim() : "",
      userData.email != null ? String(userData.email).trim() : null,
      userData.role || "staff",
      userData.restaurantId || null,
      userData.is_active !== false ? 1 : 0,
      userData.mustChangePassword === true ? 1 : 0,
      userData.hourlyRate != null ? Number(userData.hourlyRate) : null,
      userData.employmentType != null ? String(userData.employmentType).trim() : null,
      lb,
      userData.createdAt ? new Date(userData.createdAt) : now,
    ]
  );
  return findById(id);
}

async function updateUser(id, patch) {
  const pool = getPool();
  const sid = String(id || "").trim();
  const [rows] = await pool.query("SELECT * FROM users WHERE id = ? LIMIT 1", [sid]);
  if (!rows || !rows.length) return null;

  const sets = [];
  const vals = [];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    vals.push(String(patch.name));
  }
  if (patch.surname !== undefined) {
    sets.push("surname = ?");
    vals.push(String(patch.surname));
  }
  if (patch.role !== undefined) {
    sets.push("role = ?");
    vals.push(String(patch.role));
  }
  if (patch.is_active !== undefined) {
    sets.push("is_active = ?");
    vals.push(patch.is_active !== false ? 1 : 0);
  }
  if (patch.mustChangePassword !== undefined) {
    sets.push("must_change_password = ?");
    vals.push(patch.mustChangePassword === true ? 1 : 0);
  }
  if (patch.hourlyRate !== undefined) {
    sets.push("hourly_rate = ?");
    vals.push(patch.hourlyRate != null ? Number(patch.hourlyRate) : null);
  }
  if (patch.employmentType !== undefined) {
    sets.push("employment_type = ?");
    vals.push(patch.employmentType != null ? String(patch.employmentType).trim() : null);
  }
  if (patch.leaveBalances !== undefined && typeof patch.leaveBalances === "object") {
    const cur = parseLeaveBalances(rows[0].leave_balances) || {};
    const next = { ...DEFAULT_LEAVE_BALANCES, ...cur, ...patch.leaveBalances };
    sets.push("leave_balances = ?");
    vals.push(JSON.stringify(next));
  }
  if (sets.length) {
    sets.push("updated_at = NOW(3)");
    vals.push(sid);
    await pool.query(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, vals);
  }
  const u = await findById(sid);
  if (!u) return null;
  const { password, ...out } = u;
  return out;
}

async function findOwnerByRestaurantId(restaurantId) {
  const rid = String(restaurantId || "").trim();
  if (!rid) return null;
  const pool = getPool();
  const [rows] = await pool.query(
    "SELECT * FROM users WHERE restaurant_id = ? AND role = ? LIMIT 1",
    [rid, "owner"]
  );
  return rowToUser(rows && rows[0], true);
}

async function setUserPassword(userId, hashedPassword, opts = {}) {
  const pool = getPool();
  const idx = String(userId);
  const must = opts && Object.prototype.hasOwnProperty.call(opts, "mustChangePassword");
  const mcp = must ? (opts.mustChangePassword === true ? 1 : 0) : 0;
  const [r] = await pool.query("SELECT id FROM users WHERE id = ? LIMIT 1", [idx]);
  if (!r || !r.length) return false;
  if (must) {
    await pool.query(
      "UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = NOW(3) WHERE id = ?",
      [String(hashedPassword), mcp, idx]
    );
  } else {
    await pool.query("UPDATE users SET password_hash = ?, must_change_password = 0, updated_at = NOW(3) WHERE id = ?", [
      String(hashedPassword),
      idx,
    ]);
  }
  return true;
}

module.exports = {
  readUsers,
  writeUsers,
  findByCredentials,
  findByUsername,
  findById,
  findByRestaurantId,
  createUser,
  updateUser,
  findOwnerByRestaurantId,
  setUserPassword,
  ensureLeaveBalances,
  DEFAULT_LEAVE_BALANCES,
};
