#!/usr/bin/env node
/**
 * Applica solo il DDL `db/tenant_menus.sql` (tabella menu per tenant).
 * Utile su Railway quando il DB esiste già e non vuoi rieseguire tutto schema.sql.
 *
 * Uso (dalla cartella backend/):
 *   npm run db:ensure-tenant-menus
 */

const fs = require("fs");
const path = require("path");
const { loadEnv, getBackendRoot } = require("../src/config/loadEnv");

loadEnv();

let mysql2;
try {
  mysql2 = require("mysql2/promise");
} catch {
  console.error("[db-ensure-tenant-menus] Installare mysql2: npm install mysql2");
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
  const sqlPath = path.join(backendRoot, "db", "tenant_menus.sql");
  if (!fs.existsSync(sqlPath)) {
    console.error("[db-ensure-tenant-menus] File mancante:", sqlPath);
    process.exit(1);
  }
  const sql = fs.readFileSync(sqlPath, "utf8");
  const cfg = getConfig();

  console.info("[db-ensure-tenant-menus] Esecuzione:", sqlPath);
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
    console.info("[db-ensure-tenant-menus] Completato (tabella tenant_menus presente o creata).");
  } catch (e) {
    console.error("[db-ensure-tenant-menus] ERRORE:", e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main();
