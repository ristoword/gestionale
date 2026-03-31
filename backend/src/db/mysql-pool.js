/**
 * Pool MySQL (mysql2/promise) — SOLO per uso futuro o script CLI.
 * Il backend JSON attuale NON importa questo modulo.
 *
 * Dopo: npm install mysql2 (già in package.json in molte installazioni)
 */

const { loadEnv } = require("../config/loadEnv");

loadEnv();

let mysql2;
try {
  // eslint-disable-next-line global-require, import/no-extraneous-dependencies
  mysql2 = require("mysql2/promise");
} catch (e) {
  throw new Error(
    "[mysql-pool] Dipendenza mancante: eseguire dalla cartella backend: npm install mysql2"
  );
}

function parseDatabaseUrl(url) {
  try {
    const u = new URL(url);
    if (u.protocol !== "mysql:" && u.protocol !== "mysql2:") return null;
    return {
      host: u.hostname || "127.0.0.1",
      port: u.port ? Number(u.port) : 3306,
      user: decodeURIComponent(u.username || ""),
      password: decodeURIComponent(u.password || ""),
      database: (u.pathname || "/").replace(/^\//, "") || "mysql",
    };
  } catch {
    return null;
  }
}

function getMysqlConfig() {
  const fromUrl =
    parseDatabaseUrl(process.env.DATABASE_URL || "") ||
    parseDatabaseUrl(process.env.MYSQL_URL || "");
  if (fromUrl) {
    return {
      host: fromUrl.host,
      port: fromUrl.port,
      user: fromUrl.user,
      password: fromUrl.password,
      database: fromUrl.database,
    };
  }
  return {
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.MYSQL_USER || "root",
    password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "ristoword",
  };
}

let pool = null;

function getPool() {
  if (pool) return pool;
  const cfg = getMysqlConfig();
  pool = mysql2.createPool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    waitForConnections: true,
    connectionLimit: Number(process.env.MYSQL_POOL_SIZE || 10),
    queueLimit: 0,
    enableKeepAlive: true,
    namedPlaceholders: true,
  });
  return pool;
}

async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = {
  getMysqlConfig,
  getPool,
  closePool,
};
