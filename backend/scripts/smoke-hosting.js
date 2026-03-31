#!/usr/bin/env node
/**
 * Smoke test verso un'istanza deployata (Railway, staging, locale in ascolto).
 *
 * Uso (dalla cartella backend/):
 *   node scripts/smoke-hosting.js https://tuodominio.com
 *   SMOKE_BASE_URL=https://... node scripts/smoke-hosting.js
 *   node scripts/smoke-hosting.js https://... --with-mysql   # dopo HTTP, ping MySQL da .env locale (serve URL DB raggiungibile)
 *
 * Opzioni:
 *   --http-only     solo GET /api/health e GET /api/setup/status
 *   --mysql-only    solo SELECT 1 (ignora HTTP; richiede USE_MYSQL_DATABASE=true e credenziali in .env)
 *
 * Exit: 0 ok, 1 errore.
 */

const { loadEnv } = require("../src/config/loadEnv");

loadEnv();

const TIMEOUT_MS = 20000;

function parseArgs(argv) {
  const flags = new Set();
  const pos = [];
  for (const a of argv) {
    if (a.startsWith("--")) flags.add(a);
    else pos.push(a);
  }
  return {
    base: pos[0] || String(process.env.SMOKE_BASE_URL || "").trim() || String(process.env.PUBLIC_APP_URL || "").trim() || String(process.env.APP_URL || "").trim(),
    httpOnly: flags.has("--http-only"),
    mysqlOnly: flags.has("--mysql-only"),
    withMysql: flags.has("--with-mysql") || String(process.env.SMOKE_WITH_MYSQL || "").toLowerCase() === "true",
  };
}

async function fetchJson(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    let body;
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { _raw: text };
    }
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

async function runHttp(baseRaw) {
  const base = String(baseRaw || "").replace(/\/$/, "");
  if (!base || !/^https?:\/\//i.test(base)) {
    console.error("[smoke] URL base non valido. Esempio: node scripts/smoke-hosting.js https://app.railway.app");
    return false;
  }

  console.log("[smoke] HTTP →", base);

  const healthUrl = `${base}/api/health`;
  const h = await fetchJson(healthUrl);
  if (!h.ok || h.body.status !== "ok") {
    console.error("[smoke] FAIL", healthUrl, "status=", h.status, "body=", h.body);
    return false;
  }
  console.log("[smoke] OK ", healthUrl, "→ status ok");

  const setupUrl = `${base}/api/setup/status`;
  const s = await fetchJson(setupUrl);
  if (!s.ok || typeof s.body.setupComplete !== "boolean") {
    console.error("[smoke] FAIL", setupUrl, "status=", s.status, "body=", s.body);
    return false;
  }
  console.log("[smoke] OK ", setupUrl, "→ setupComplete=", s.body.setupComplete);

  return true;
}

async function runMysql() {
  const useMysql = String(process.env.USE_MYSQL_DATABASE || "").toLowerCase() === "true";
  if (!useMysql) {
    console.error("[smoke] MySQL: USE_MYSQL_DATABASE non è true — imposta nel .env o ometti --mysql-only / --with-mysql");
    return false;
  }

  let closePool;
  try {
    const { getPool, closePool: close } = require("../src/db/mysql-pool");
    closePool = close;
    const pool = getPool();
    const [rows] = await pool.query("SELECT 1 AS ok");
    const ok = rows && rows[0] && Number(rows[0].ok) === 1;
    if (!ok) {
      console.error("[smoke] MySQL: risposta inattesa", rows);
      return false;
    }
    console.log("[smoke] OK  MySQL SELECT 1");
    return true;
  } catch (e) {
    console.error("[smoke] MySQL FAIL:", e.message || e);
    return false;
  } finally {
    if (typeof closePool === "function") {
      try {
        await closePool();
      } catch (_) {
        /* ignore */
      }
    }
  }
}

async function main() {
  const { base, httpOnly, mysqlOnly, withMysql } = parseArgs(process.argv.slice(2));

  if (mysqlOnly) {
    const ok = await runMysql();
    process.exit(ok ? 0 : 1);
  }

  if (!base) {
    console.error(
      "[smoke] Serve URL base (primo argomento) oppure SMOKE_BASE_URL / PUBLIC_APP_URL / APP_URL.\n" +
        "  node scripts/smoke-hosting.js https://tuodominio.com\n" +
        "  node scripts/smoke-hosting.js --mysql-only"
    );
    process.exit(1);
  }

  const httpOk = await runHttp(base);
  if (!httpOk) process.exit(1);

  if (httpOnly) process.exit(0);

  if (withMysql) {
    const myOk = await runMysql();
    process.exit(myOk ? 0 : 1);
  }

  console.log("[smoke] MySQL skip (aggiungi --with-mysql per ping DB da questa macchina)");
  process.exit(0);
}

main().catch((e) => {
  console.error("[smoke] errore:", e);
  process.exit(1);
});
