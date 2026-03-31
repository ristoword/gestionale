#!/usr/bin/env node
/**
 * Test connessione MySQL (CLI).
 * Uso: dalla cartella che contiene package.json, src/ e scripts/ (es. …/ristoword/backend):
 *   node scripts/db-test-connection.js
 *
 * NON eseguire: node backend/scripts/db-test-connection.js da quella stessa cartella
 * (Node cercherebbe …/backend/backend/scripts/… e fallisce).
 *
 * Richiede: variabili in backend/.env (vedi docs/mysql-env.example.txt)
 * e dipendenza: mysql2
 */

const path = require("path");
const { loadEnv, getBackendRoot } = require("../src/config/loadEnv");

loadEnv();

let mysql2;
try {
  // eslint-disable-next-line global-require
  mysql2 = require("mysql2/promise");
} catch {
  console.error("[db-test] Installare mysql2: npm install mysql2");
  process.exit(1);
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

function getConfig() {
  const fromUrl =
    parseDatabaseUrl(process.env.DATABASE_URL || "") ||
    parseDatabaseUrl(process.env.MYSQL_URL || "");
  if (fromUrl) return fromUrl;
  return {
    host: process.env.MYSQLHOST || process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQLPORT || process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQLUSER || process.env.MYSQL_USER || "root",
    password: process.env.MYSQLPASSWORD || process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || "ristoword",
  };
}

async function main() {
  const cfg = getConfig();
  const label = path.join(getBackendRoot(), ".env");
  console.info("[db-test] Backend root:", getBackendRoot());
  console.info("[db-test] Connessione a", cfg.host + ":" + cfg.port, "DB:", cfg.database);

  let conn;
  try {
    conn = await mysql2.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
    });
    const [rows] = await conn.query("SELECT 1 AS ok, DATABASE() AS db, VERSION() AS v");
    console.info("[db-test] OK:", rows[0]);
  } catch (e) {
    console.error("[db-test] ERRORE:", e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

main();
