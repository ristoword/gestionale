# Modulo `src/db/`

Contiene utilità MySQL (script, test, repository MySQL quando il flag è attivo).

- **`mysql-pool.js`**: factory del pool `mysql2/promise`. Usato dai repository `*.repository.mysql.js` con `USE_MYSQL_DATABASE=true`; i repository JSON non lo importano.
- **`mysql-startup-ping.js`**: opzionale; se `MYSQL_PING_ON_START=true` e c’è un URL `mysql://…` (o host remoto in `MYSQLHOST`), dopo l’avvio del server esegue `SELECT 1` e chiude il pool. Fallimento = solo log; i dati restano su JSON.

Quando attiverete la persistenza MySQL, potrete importare `getPool()` da `mysql-pool.js` (o spostare la logica in un layer dedicato) senza toccare i file JSON finché non sarete pronti alla cutover.

**Migrazione dati (incrementale, senza cambiare l’app):**  
`npm run migrate:mysql -- --step=restaurants` (poi **`menus`**, `users`, `licenses`, `orders`, … oppure `--step=all`). Opzione `--dry-run`. Vedi `scripts/db-migrate-json-to-mysql.js`.

**Flag applicativo:** `USE_MYSQL_DATABASE` — se `true`, i repository con implementazione MySQL (menu in `tenant_menus`, ordini, utenti, storni, turni cassa, …) usano il DB; altrimenti JSON.
