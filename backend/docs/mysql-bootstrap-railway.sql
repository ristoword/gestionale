-- Ristoword — bootstrap schema MySQL (Railway / generico)
-- Coerente con strutture JSON attuali: users.json, restaurants.json, licenses.json,
-- data/tenants/{tenant}/orders.json (+ items annidati).
--
-- NOTA: il backend ATTUALE non usa ancora queste tabelle; servono per migrazione futura.
-- Charset consigliato Railway / utf8mb4.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Tenant / ristorante (equiv. restaurants.json + cartella tenants)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
  id              VARCHAR(64)  NOT NULL PRIMARY KEY,
  slug            VARCHAR(255) NULL,
  restaurant_name VARCHAR(500) NULL,
  company_name    VARCHAR(500) NULL,
  vat_number      VARCHAR(64)  NULL,
  address         TEXT         NULL,
  admin_email     VARCHAR(255) NULL,
  created_at      DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_restaurants_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Utenti login (equiv. data/users.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id              VARCHAR(64)  NOT NULL PRIMARY KEY,
  username        VARCHAR(255) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  role            VARCHAR(64)  NOT NULL,
  restaurant_id VARCHAR(64)  NOT NULL,
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  leave_balances  JSON         NULL,
  created_at      DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_username_restaurant (username, restaurant_id),
  KEY idx_users_restaurant (restaurant_id),
  CONSTRAINT fk_users_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Licenze globali (equiv. data/licenses.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS licenses (
  id               BIGINT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id    VARCHAR(64)  NOT NULL,
  plan             VARCHAR(64)  NULL,
  status           VARCHAR(64)  NULL,
  activation_code  VARCHAR(255) NULL,
  start_date       DATETIME(3)  NULL,
  end_date         DATETIME(3)  NULL,
  expires_at       DATETIME(3)  NULL,
  activated_at     DATETIME(3)  NULL,
  source           VARCHAR(128) NULL,
  created_at       DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  extra            JSON         NULL,
  UNIQUE KEY uq_licenses_restaurant (restaurant_id),
  CONSTRAINT fk_licenses_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Ordini (equiv. tenants/{id}/orders.json — id ordine univoco per tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  restaurant_id VARCHAR(64)  NOT NULL,
  id            BIGINT         NOT NULL,
  table_num     INT            NULL,
  covers        INT            NULL,
  area          VARCHAR(64)    NULL,
  waiter        VARCHAR(255)   NULL,
  notes         TEXT           NULL,
  status        VARCHAR(64)    NULL,
  created_at    DATETIME(3)    NULL,
  updated_at    DATETIME(3)    NULL,
  extra         JSON           NULL,
  PRIMARY KEY (restaurant_id, id),
  KEY idx_orders_status (restaurant_id, status),
  KEY idx_orders_created (restaurant_id, created_at),
  CONSTRAINT fk_orders_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Righe ordine (normalizzazione di orders[].items)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id             BIGINT AUTO_INCREMENT PRIMARY KEY,
  restaurant_id  VARCHAR(64)   NOT NULL,
  order_id       BIGINT        NOT NULL,
  line_index     INT           NOT NULL DEFAULT 0,
  name           VARCHAR(500)  NULL,
  qty            DECIMAL(12,3) NOT NULL DEFAULT 1,
  area           VARCHAR(64)   NULL,
  category       VARCHAR(128)  NULL,
  type           VARCHAR(64)   NULL,
  notes          TEXT          NULL,
  extra          JSON          NULL,
  KEY idx_order_items_order (restaurant_id, order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (restaurant_id, order_id)
    REFERENCES orders (restaurant_id, id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
