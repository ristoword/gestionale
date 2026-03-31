#!/usr/bin/env node
/**
 * Crea le tabelle da db/schema.sql (multiple statements).
 * Uso: dalla cartella con package.json (stesso livello di src/ e scripts/):
 *   node scripts/db-bootstrap.js
 *
 * ATTENZIONE: esegue l'intero file SQL. Su DB già popolato verificare backup.
 */

const fs = require("fs");
const path = require("path");
const { loadEnv, getBackendRoot } = require("../src/config/loadEnv");

loadEnv();

let mysql2;
try {
  // eslint-disable-next-line global-require
  mysql2 = require("mysql2/promise");
} catch {
  console.error("[db-bootstrap] Installare mysql2: npm install mysql2");
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
  const backendRoot = getBackendRoot();
  const schemaPath = path.join(backendRoot, "db", "schema.sql");
  if (!fs.existsSync(schemaPath)) {
    console.error("[db-bootstrap] File mancante:", schemaPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(schemaPath, "utf8");
  const cfg = getConfig();

  console.info("[db-bootstrap] Esecuzione schema:", schemaPath);
  const conn = await mysql2.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: cfg.database,
    multipleStatements: true,
  });

  try {
    await conn.query(sql);
    console.info("[db-bootstrap] Completato.");
  } catch (e) {
    console.error("[db-bootstrap] ERRORE:", e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
