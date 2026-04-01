-- Ristoword — schema MySQL (Railway / generico)
-- File CANONICO per bootstrap futuro. Non è usato dal runtime JSON attuale.
-- Coerente con: data/restaurants.json, data/users.json, data/licenses.json,
--               … payments, closures, reports, storni, cassa-shifts.
--
-- Charset: utf8mb4 (Railway / MySQL 8+).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- Tenant / ristorante
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurants (
  id               VARCHAR(64)  NOT NULL PRIMARY KEY,
  slug             VARCHAR(255) NULL,
  restaurant_name  VARCHAR(500) NULL,
  company_name     VARCHAR(500) NULL,
  vat_number       VARCHAR(64)  NULL,
  address          TEXT         NULL,
  city             VARCHAR(255) NULL,
  postal_code      VARCHAR(32)  NULL,
  province         VARCHAR(64)  NULL,
  country          VARCHAR(8)   NULL DEFAULT 'IT',
  admin_email      VARCHAR(255) NULL,
  phone            VARCHAR(64)  NULL,
  contact_name     VARCHAR(255) NULL,
  plan             VARCHAR(64)  NULL,
  language         VARCHAR(16)  NULL,
  currency         VARCHAR(8)   NULL,
  status           VARCHAR(64)  NULL,
  tables_count     INT          NULL DEFAULT 20,
  extra_json       JSON         NULL,
  created_at       DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at       DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_restaurants_slug (slug(191))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Utenti (login / ruoli) — campi allineati a users.repository.js
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                   VARCHAR(64)  NOT NULL PRIMARY KEY,
  username             VARCHAR(255) NOT NULL,
  password_hash        VARCHAR(255) NOT NULL,
  name                 VARCHAR(255) NULL DEFAULT '',
  surname              VARCHAR(255) NULL DEFAULT '',
  email                VARCHAR(255) NULL,
  role                 VARCHAR(64)  NOT NULL,
  restaurant_id        VARCHAR(64)  NULL,
  is_active            TINYINT(1)   NOT NULL DEFAULT 1,
  must_change_password TINYINT(1)   NOT NULL DEFAULT 0,
  hourly_rate          DECIMAL(12,4) NULL,
  employment_type      VARCHAR(64)  NULL,
  leave_balances       JSON         NULL,
  created_at           DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at           DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_username (username(191)),
  KEY idx_users_restaurant (restaurant_id),
  CONSTRAINT fk_users_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Licenze globali — licenses.repository.js
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
  UNIQUE KEY uq_licenses_activation (activation_code(191)),
  CONSTRAINT fk_licenses_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Ordini (per tenant: chiave composta restaurant_id + id ordine)
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
-- Righe ordine (normalizzazione orders[].items)
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

-- ---------------------------------------------------------------------------
-- Pagamenti cassa (per tenant; order_ids JSON come in payments.json)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  restaurant_id    VARCHAR(64)   NOT NULL,
  id               VARCHAR(128)  NOT NULL,
  table_ref        VARCHAR(64)   NULL,
  order_ids        JSON          NOT NULL,
  subtotal         DECIMAL(14,4) NOT NULL DEFAULT 0,
  discount_amount  DECIMAL(14,4) NOT NULL DEFAULT 0,
  discount_type    VARCHAR(64)   NULL,
  discount_reason  TEXT          NULL,
  vat_percent      DECIMAL(10,4) NULL DEFAULT 0,
  vat_amount       DECIMAL(14,4) NOT NULL DEFAULT 0,
  total            DECIMAL(14,4) NOT NULL DEFAULT 0,
  payment_method   VARCHAR(64)   NULL,
  amount_received  DECIMAL(14,4) NOT NULL DEFAULT 0,
  change_amount    DECIMAL(14,4) NOT NULL DEFAULT 0,
  covers           INT           NULL DEFAULT 0,
  operator         VARCHAR(255)  NULL,
  note             TEXT          NULL,
  customer_name    VARCHAR(500)  NULL,
  customer_id      VARCHAR(255)  NULL,
  company_name     VARCHAR(500)  NULL,
  vat_number       VARCHAR(64)   NULL,
  status           VARCHAR(64)   NULL,
  created_at       DATETIME(3)   NULL,
  updated_at       DATETIME(3)   NULL,
  closed_at        DATETIME(3)   NULL,
  extra            JSON          NULL,
  PRIMARY KEY (restaurant_id, id),
  KEY idx_payments_closed (restaurant_id, closed_at),
  CONSTRAINT fk_payments_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Chiusure giornaliere Z (closures.json per tenant)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS closures (
  restaurant_id       VARCHAR(64)   NOT NULL,
  id                  VARCHAR(128)  NOT NULL,
  closure_date        DATE          NOT NULL,
  cash_total          DECIMAL(14,4) NOT NULL DEFAULT 0,
  card_total          DECIMAL(14,4) NOT NULL DEFAULT 0,
  other_total         DECIMAL(14,4) NOT NULL DEFAULT 0,
  grand_total         DECIMAL(14,4) NOT NULL DEFAULT 0,
  storni_total        DECIMAL(14,4) NOT NULL DEFAULT 0,
  net_total           DECIMAL(14,4) NOT NULL DEFAULT 0,
  payments_count      INT           NOT NULL DEFAULT 0,
  closed_orders_count INT           NOT NULL DEFAULT 0,
  covers              INT           NOT NULL DEFAULT 0,
  closed_at           DATETIME(3)   NULL,
  closed_by           VARCHAR(255)  NULL,
  notes               TEXT          NULL,
  created_at          DATETIME(3)   NULL,
  extra               JSON          NULL,
  PRIMARY KEY (restaurant_id, id),
  KEY idx_closures_date (restaurant_id, closure_date),
  CONSTRAINT fk_closures_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Report salvati (reports.json → chiave "reports")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_reports (
  restaurant_id VARCHAR(64)   NOT NULL,
  id              VARCHAR(128) NOT NULL,
  report_date     DATE         NULL,
  revenue         DECIMAL(14,4) NOT NULL DEFAULT 0,
  covers          INT          NOT NULL DEFAULT 0,
  note            TEXT         NULL,
  extra           JSON         NULL,
  PRIMARY KEY (restaurant_id, id),
  KEY idx_saved_reports_date (restaurant_id, report_date),
  CONSTRAINT fk_saved_reports_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Storni (storni.json → chiave "entries")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS storni_entries (
  restaurant_id VARCHAR(64)   NOT NULL,
  id              VARCHAR(128) NOT NULL,
  entry_date      DATE         NOT NULL,
  amount          DECIMAL(14,4) NOT NULL DEFAULT 0,
  reason          VARCHAR(500) NULL,
  table_ref       VARCHAR(64)  NULL,
  order_ref       VARCHAR(64)  NULL,
  note            TEXT         NULL,
  created_at      DATETIME(3)  NULL,
  extra           JSON         NULL,
  PRIMARY KEY (restaurant_id, id),
  KEY idx_storni_date (restaurant_id, entry_date),
  CONSTRAINT fk_storni_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Turni cassa (cassa-shifts.json → chiave "shifts")
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cassa_shifts (
  restaurant_id  VARCHAR(64)   NOT NULL,
  id             BIGINT        NOT NULL,
  opened_at      DATETIME(3)   NULL,
  closed_at      DATETIME(3)   NULL,
  opening_float  DECIMAL(14,4) NOT NULL DEFAULT 0,
  cash_total     DECIMAL(14,4) NOT NULL DEFAULT 0,
  card_total     DECIMAL(14,4) NOT NULL DEFAULT 0,
  other_total    DECIMAL(14,4) NOT NULL DEFAULT 0,
  status         VARCHAR(32)   NULL,
  extra          JSON          NULL,
  PRIMARY KEY (restaurant_id, id),
  KEY idx_cassa_shifts_opened (restaurant_id, opened_at),
  CONSTRAINT fk_cassa_shifts_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Menu (menu.json per tenant → array JSON)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_menus (
  restaurant_id VARCHAR(64)  NOT NULL PRIMARY KEY,
  items_json    JSON         NOT NULL,
  updated_at    DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_tenant_menus_restaurant FOREIGN KEY (restaurant_id) REFERENCES restaurants (id)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Payload generico JSON per moduli tenant ancora non modellati a tabelle dedicate
-- (inventory-transfers, stock-movements, order-food-costs, altri step progressivi).
-- Nota: restaurant_id = "__global__" per dati non tenantizzati.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenant_module_data (
  restaurant_id VARCHAR(64)  NOT NULL,
  module_key    VARCHAR(128) NOT NULL,
  payload_json  JSON         NOT NULL,
  updated_at    DATETIME(3)  NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (restaurant_id, module_key),
  KEY idx_tenant_module_key (module_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------------
-- Sessioni Express (express-mysql-session) — usata con USE_MYSQL_DATABASE=true
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
  expires      INT UNSIGNED NOT NULL,
  data         MEDIUMTEXT COLLATE utf8mb4_bin NULL,
  PRIMARY KEY (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;

SET FOREIGN_KEY_CHECKS = 1;
