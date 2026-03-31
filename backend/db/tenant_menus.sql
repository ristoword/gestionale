-- Solo tabella tenant_menus (menu per tenant in JSON).
-- Sicuro su DB già bootstrappato: CREATE TABLE IF NOT EXISTS.
-- Esegui: npm run db:ensure-tenant-menus  (dalla cartella backend/)

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS tenant_menus (
  restaurant_id VARCHAR(64)  NOT NULL PRIMARY KEY,
  items_json    JSON         NOT NULL,
  updated_at    DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_tenant_menus_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
