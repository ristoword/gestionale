/**
 * Ping MySQL opzionale all'avvio: non modifica il flusso dati (resta JSON).
 * Attivo solo se MYSQL_PING_ON_START=true e la config DB sembra intenzionale.
 */

function shouldAttemptPing() {
  if (String(process.env.MYSQL_PING_ON_START || "").toLowerCase() !== "true") {
    return false;
  }
  const url = String(process.env.DATABASE_URL || process.env.MYSQL_URL || "").trim();
  if (url.startsWith("mysql:") || url.startsWith("mysql2:")) {
    return true;
  }
  const host = String(process.env.MYSQLHOST || process.env.MYSQL_HOST || "").trim();
  if (host && host !== "127.0.0.1" && host !== "localhost") {
    return true;
  }
  return false;
}

/**
 * Prova SELECT 1 sul pool; in caso di errore logga un warning e l'app continua.
 * Chiude il pool dopo il ping così non restano connessioni aperte se non usi ancora MySQL in app.
 */
async function maybePingMysqlOnStart() {
  if (!shouldAttemptPing()) {
    return;
  }

  try {
    const { getPool, closePool } = require("./mysql-pool");
    const pool = getPool();
    const [rows] = await pool.query("SELECT 1 AS ok");
    const row = rows && rows[0];
    // eslint-disable-next-line no-console
    console.log("[MySQL] Ping avvio OK (solo verifica; persistenza resta JSON).", row);
    await closePool();
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.warn("[MySQL] Ping avvio fallito — server attivo comunque (JSON):", msg);
    try {
      const { closePool } = require("./mysql-pool");
      await closePool();
    } catch (_) {
      /* ignore */
    }
  }
}

module.exports = { maybePingMysqlOnStart, shouldAttemptPing };
