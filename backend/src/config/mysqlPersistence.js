/**
 * Cutover JSON → MySQL: con `true`, moduli migrati (users, restaurants, licenses, ordini, pagamenti, chiusure,
 * report salvati, storni, turni cassa, **menu** / `tenant_menus`) usano MySQL.
 * Migrazione dati: npm run migrate:mysql -- --step=… (menu: `--step=menus`, dopo `restaurants`).
 */

function useMysqlPersistence() {
  return String(process.env.USE_MYSQL_DATABASE || "").toLowerCase() === "true";
}

module.exports = {
  useMysqlPersistence,
};
