#!/usr/bin/env node
/**
 * Migrazione incrementale JSON → MySQL (idempotente: INSERT … ON DUPLICATE KEY UPDATE).
 * L’app RESTA su JSON finché USE_MYSQL_DATABASE non sarà attivato nel codice applicativo.
 *
 * Ordine consigliato (coerente con FK in db/schema.sql):
 *   … closures   7) reports (saved_reports)
 *
 * Uso (dalla cartella backend/):
 *   node scripts/db-migrate-json-to-mysql.js --step=restaurants
 *   node scripts/db-migrate-json-to-mysql.js --step=users
 *   node scripts/db-migrate-json-to-mysql.js --step=licenses
 *   node scripts/db-migrate-json-to-mysql.js --step=orders
 *   node scripts/db-migrate-json-to-mysql.js --step=payments
 *   node scripts/db-migrate-json-to-mysql.js --step=closures
 *   node scripts/db-migrate-json-to-mysql.js --step=reports
 *   node scripts/db-migrate-json-to-mysql.js --step=storni
 *   node scripts/db-migrate-json-to-mysql.js --step=cassa-shifts
 *   node scripts/db-migrate-json-to-mysql.js --step=menus
 *   node scripts/db-migrate-json-to-mysql.js --step=inventory-transfers
 *   node scripts/db-migrate-json-to-mysql.js --step=stock-movements
 *   node scripts/db-migrate-json-to-mysql.js --step=order-food-costs
 *   node scripts/db-migrate-json-to-mysql.js --step=bookings
 *   node scripts/db-migrate-json-to-mysql.js --step=customers
 *   node scripts/db-migrate-json-to-mysql.js --step=haccp
 *   node scripts/db-migrate-json-to-mysql.js --step=devices
 *   node scripts/db-migrate-json-to-mysql.js --step=print-routes
 *   node scripts/db-migrate-json-to-mysql.js --step=print-jobs
 *   node scripts/db-migrate-json-to-mysql.js --step=attendance
 *   node scripts/db-migrate-json-to-mysql.js --step=leave
 *   node scripts/db-migrate-json-to-mysql.js --step=staff
 *   node scripts/db-migrate-json-to-mysql.js --step=staff-shifts
 *   node scripts/db-migrate-json-to-mysql.js --step=staff-requests
 *   node scripts/db-migrate-json-to-mysql.js --step=sessions
 *   node scripts/db-migrate-json-to-mysql.js --step=pos-shifts
 *   node scripts/db-migrate-json-to-mysql.js --step=inventory
 *   node scripts/db-migrate-json-to-mysql.js --step=all
 *   node scripts/db-migrate-json-to-mysql.js --step=restaurants --dry-run
 *
 * Prerequisiti: tabelle create (node scripts/db-bootstrap.js), DATABASE_URL / credenziali MySQL.
 */

const fs = require("fs");
const path = require("path");
const { loadEnv, getBackendRoot } = require("../src/config/loadEnv");
const paths = require("../src/config/paths");
const { safeReadJson } = require("../src/utils/safeFileIO");
const {
  normalizePaymentInput,
  extraFromRawPayment,
} = require("../src/repositories/payments.repository.helpers");
const {
  normalizeClosureInput,
  extraFromRawClosure,
  resolveClosureDateOnly,
} = require("../src/repositories/closures.repository.helpers");
const {
  normalizeReportForCreate,
  extraFromRawReport,
  reportDateForSql,
} = require("../src/repositories/reports.repository.helpers");
const { dateOnly, extraFromRawStorno } = require("../src/repositories/storni.repository.helpers");
const { extraFromRawShift } = require("../src/repositories/cassa-shifts.repository.helpers");

loadEnv();

const { getPool, closePool } = require("../src/db/mysql-pool");

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const stepArg = argv.find((a) => a.startsWith("--step="));
  const step = stepArg ? String(stepArg.split("=").slice(1).join("=") || "").trim() : "";
  return { dryRun, step };
}

function printUsage() {
  console.info(`
Uso: node scripts/db-migrate-json-to-mysql.js --step=<restaurants|users|licenses|orders|payments|closures|reports|storni|cassa-shifts|menus|inventory-transfers|stock-movements|order-food-costs|all> [--dry-run]

Esegui dalla cartella backend (dove c'è package.json).
Prima: node scripts/db-bootstrap.js (schema)
`);
}

function toDateOrNull(v) {
  if (v == null || v === "") return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function ensureRestaurantStub(conn, id, dryRun) {
  const rid = String(id || "").trim();
  if (!rid) return;
  const [rows] = await conn.query("SELECT 1 AS ok FROM restaurants WHERE id = ? LIMIT 1", [rid]);
  if (rows && rows.length) return;
  if (dryRun) {
    console.info(`[migrate][dry-run] stub restaurant: ${rid}`);
    return;
  }
  await conn.query(
    `INSERT INTO restaurants (id, slug, restaurant_name, status, country, created_at, updated_at)
     VALUES (?, ?, ?, 'active', 'IT', NOW(3), NOW(3))`,
    [rid, rid, rid]
  );
  console.info(`[migrate] creato stub restaurant: ${rid}`);
}

async function migrateRestaurants(conn, dryRun) {
  const fp = path.join(paths.DATA, "restaurants.json");
  const data = safeReadJson(fp, { restaurants: [] });
  const list = Array.isArray(data.restaurants) ? data.restaurants : [];
  let n = 0;
  for (const r of list) {
    const id = String(r.id || "").trim();
    if (!id) continue;
    const row = [
      id,
      r.slug != null ? String(r.slug) : id,
      r.restaurantName != null ? String(r.restaurantName) : null,
      r.companyName != null ? String(r.companyName) : null,
      r.vatNumber != null ? String(r.vatNumber) : null,
      r.address != null ? String(r.address) : null,
      r.city != null ? String(r.city) : null,
      r.postalCode != null ? String(r.postalCode) : null,
      r.province != null ? String(r.province) : null,
      r.country != null ? String(r.country) : "IT",
      r.adminEmail != null ? String(r.adminEmail) : null,
      r.phone != null ? String(r.phone) : null,
      r.contactName != null ? String(r.contactName) : null,
      r.plan != null ? String(r.plan) : null,
      r.language != null ? String(r.language) : null,
      r.currency != null ? String(r.currency) : null,
      r.status != null ? String(r.status) : "active",
      r.tablesCount != null ? Number(r.tablesCount) : 20,
      null,
      toDateOrNull(r.createdAt),
      toDateOrNull(r.updatedAt || r.createdAt),
    ];
    if (dryRun) {
      console.info(`[migrate][dry-run] restaurant ${id}`);
      n += 1;
      continue;
    }
    await conn.query(
      `INSERT INTO restaurants (
        id, slug, restaurant_name, company_name, vat_number, address, city, postal_code, province, country,
        admin_email, phone, contact_name, plan, language, currency, status, tables_count, extra_json, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        slug=VALUES(slug), restaurant_name=VALUES(restaurant_name), company_name=VALUES(company_name),
        vat_number=VALUES(vat_number), address=VALUES(address), city=VALUES(city), postal_code=VALUES(postal_code),
        province=VALUES(province), country=VALUES(country), admin_email=VALUES(admin_email), phone=VALUES(phone),
        contact_name=VALUES(contact_name), plan=VALUES(plan), language=VALUES(language), currency=VALUES(currency),
        status=VALUES(status), tables_count=VALUES(tables_count), updated_at=VALUES(updated_at)`,
      row
    );
    n += 1;
  }
  console.info(`[migrate] restaurants: ${n} righe processate${dryRun ? " (dry-run)" : ""}`);
}

async function migrateMenus(conn, dryRun) {
  const tenantsDir = path.join(paths.DATA, "tenants");
  let count = 0;
  if (fs.existsSync(tenantsDir)) {
    const dirs = fs
      .readdirSync(tenantsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const dir of dirs) {
      const safe = path.basename(dir);
      const fp = path.join(tenantsDir, safe, "menu.json");
      if (!fs.existsSync(fp)) continue;
      const raw = safeReadJson(fp, []);
      const arr = Array.isArray(raw) ? raw : [];
      await ensureRestaurantStub(conn, safe, dryRun);
      if (dryRun) {
        console.info(`[migrate][dry-run] menus tenant "${safe}": ${arr.length} piatti`);
        count += 1;
        continue;
      }
      await conn.query(
        `INSERT INTO tenant_menus (restaurant_id, items_json, updated_at)
         VALUES (?, CAST(? AS JSON), NOW(3))
         ON DUPLICATE KEY UPDATE items_json = VALUES(items_json), updated_at = NOW(3)`,
        [safe, JSON.stringify(arr)]
      );
      console.info(`[migrate] menus tenant "${safe}": ${arr.length} piatti`);
      count += 1;
    }
  }
  const legacyFp = path.join(paths.DATA, "menu.json");
  const defaultTenantFp = path.join(paths.DATA, "tenants", "default", "menu.json");
  if (fs.existsSync(legacyFp) && !fs.existsSync(defaultTenantFp)) {
    const raw = safeReadJson(legacyFp, []);
    const arr = Array.isArray(raw) ? raw : [];
    await ensureRestaurantStub(conn, "default", dryRun);
    if (dryRun) {
      console.info(`[migrate][dry-run] menus legacy data/menu.json → default: ${arr.length} piatti`);
      count += 1;
    } else {
      await conn.query(
        `INSERT INTO tenant_menus (restaurant_id, items_json, updated_at)
         VALUES (?, CAST(? AS JSON), NOW(3))
         ON DUPLICATE KEY UPDATE items_json = VALUES(items_json), updated_at = NOW(3)`,
        ["default", JSON.stringify(arr)]
      );
      console.info(`[migrate] menus legacy data/menu.json → default: ${arr.length} piatti`);
      count += 1;
    }
  }
  console.info(`[migrate] menus: ${count} sorgenti processate${dryRun ? " (dry-run)" : ""}`);
}

async function migrateUsers(conn, dryRun) {
  const fp = path.join(paths.DATA, "users.json");
  const data = safeReadJson(fp, { users: [] });
  const list = Array.isArray(data.users) ? data.users : [];
  let n = 0;
  for (const u of list) {
    const id = String(u.id || "").trim();
    if (!id) continue;
    const restaurantId = u.restaurantId != null ? String(u.restaurantId).trim() : null;
    if (restaurantId) {
      await ensureRestaurantStub(conn, restaurantId, dryRun);
    }
    const passwordHash = u.password != null ? String(u.password) : "";
    if (!passwordHash) {
      console.warn(`[migrate] skip user ${id}: password mancante`);
      continue;
    }
    const leaveBalances =
      u.leaveBalances && typeof u.leaveBalances === "object" ? JSON.stringify(u.leaveBalances) : null;
    const row = [
      id,
      String(u.username || "").trim(),
      passwordHash,
      u.name != null ? String(u.name) : "",
      u.surname != null ? String(u.surname) : "",
      u.email != null ? String(u.email).trim() : null,
      String(u.role || "staff"),
      restaurantId || null,
      u.is_active !== false ? 1 : 0,
      u.mustChangePassword === true ? 1 : 0,
      u.hourlyRate != null && u.hourlyRate !== "" ? Number(u.hourlyRate) : null,
      u.employmentType != null ? String(u.employmentType).trim() : null,
      leaveBalances,
      toDateOrNull(u.createdAt) || new Date(),
      new Date(),
    ];
    if (dryRun) {
      console.info(`[migrate][dry-run] user ${id} @ ${restaurantId || "(nessun tenant)"}`);
      n += 1;
      continue;
    }
    await conn.query(
      `INSERT INTO users (
        id, username, password_hash, name, surname, email, role, restaurant_id, is_active, must_change_password,
        hourly_rate, employment_type, leave_balances, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        username=VALUES(username), password_hash=VALUES(password_hash), name=VALUES(name), surname=VALUES(surname),
        email=VALUES(email), role=VALUES(role), restaurant_id=VALUES(restaurant_id), is_active=VALUES(is_active),
        must_change_password=VALUES(must_change_password), hourly_rate=VALUES(hourly_rate),
        employment_type=VALUES(employment_type), leave_balances=VALUES(leave_balances), updated_at=VALUES(updated_at)`,
      row
    );
    n += 1;
  }
  console.info(`[migrate] users: ${n} righe processate${dryRun ? " (dry-run)" : ""}`);
}

async function migrateLicenses(conn, dryRun) {
  const fp = path.join(paths.DATA, "licenses.json");
  const data = safeReadJson(fp, { licenses: [] });
  const list = Array.isArray(data.licenses) ? data.licenses : [];
  let n = 0;
  for (const lic of list) {
    const restaurantId = lic.restaurantId != null ? String(lic.restaurantId).trim() : "";
    if (!restaurantId) continue;
    await ensureRestaurantStub(conn, restaurantId, dryRun);
    const extra = JSON.stringify(lic);
    const row = [
      restaurantId,
      lic.plan != null ? String(lic.plan) : "ristoword_pro",
      lic.status != null ? String(lic.status) : "active",
      lic.activationCode != null ? String(lic.activationCode) : null,
      toDateOrNull(lic.startDate),
      toDateOrNull(lic.endDate),
      toDateOrNull(lic.expiresAt),
      toDateOrNull(lic.activatedAt),
      lic.source != null ? String(lic.source) : null,
      extra,
      toDateOrNull(lic.createdAt) || new Date(),
      toDateOrNull(lic.updatedAt || lic.createdAt) || new Date(),
    ];
    if (dryRun) {
      console.info(`[migrate][dry-run] license ${restaurantId}`);
      n += 1;
      continue;
    }
    await conn.query(
      `INSERT INTO licenses (
        restaurant_id, plan, status, activation_code, start_date, end_date, expires_at, activated_at, source, extra, created_at, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        plan=VALUES(plan), status=VALUES(status), activation_code=VALUES(activation_code),
        start_date=VALUES(start_date), end_date=VALUES(end_date), expires_at=VALUES(expires_at),
        activated_at=VALUES(activated_at), source=VALUES(source), extra=VALUES(extra), updated_at=VALUES(updated_at)`,
      row
    );
    n += 1;
  }
  console.info(`[migrate] licenses: ${n} righe processate${dryRun ? " (dry-run)" : ""}`);
}

async function migrateOrdersForTenant(conn, tenantId, dryRun) {
  const safe = paths.sanitizeTenantId(tenantId);
  if (!safe) return 0;
  const fp = path.join(paths.DATA, "tenants", safe, "orders.json");
  if (!fs.existsSync(fp)) return 0;
  const raw = safeReadJson(fp, []);
  const orders = Array.isArray(raw) ? raw : [];
  if (orders.length === 0) return 0;

  await ensureRestaurantStub(conn, safe, dryRun);

  let count = 0;
  for (const o of orders) {
    const oid = Number(o.id);
    if (!Number.isFinite(oid)) continue;
    const tableNum = o.table != null ? Number(o.table) : null;
    const covers = o.covers != null ? Number(o.covers) : null;
    const items = Array.isArray(o.items) ? o.items : [];
    const orderExtra = { ...o };
    delete orderExtra.id;
    delete orderExtra.table;
    delete orderExtra.covers;
    delete orderExtra.area;
    delete orderExtra.waiter;
    delete orderExtra.notes;
    delete orderExtra.status;
    delete orderExtra.createdAt;
    delete orderExtra.updatedAt;
    delete orderExtra.items;

    if (dryRun) {
      console.info(`[migrate][dry-run] order ${safe}/${oid} (${items.length} righe)`);
      count += 1;
      continue;
    }

    await conn.query(
      `INSERT INTO orders (
        restaurant_id, id, table_num, covers, area, waiter, notes, status, created_at, updated_at, extra
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        table_num=VALUES(table_num), covers=VALUES(covers), area=VALUES(area), waiter=VALUES(waiter),
        notes=VALUES(notes), status=VALUES(status), created_at=VALUES(created_at), updated_at=VALUES(updated_at), extra=VALUES(extra)`,
      [
        safe,
        oid,
        Number.isFinite(tableNum) ? tableNum : null,
        Number.isFinite(covers) ? covers : null,
        o.area != null ? String(o.area) : null,
        o.waiter != null ? String(o.waiter) : null,
        o.notes != null ? String(o.notes) : null,
        o.status != null ? String(o.status) : null,
        toDateOrNull(o.createdAt),
        toDateOrNull(o.updatedAt || o.createdAt),
        Object.keys(orderExtra).length ? JSON.stringify(orderExtra) : null,
      ]
    );

    await conn.query("DELETE FROM order_items WHERE restaurant_id = ? AND order_id = ?", [safe, oid]);

    if (items.length > 0) {
      const bulk = items.map((line, idx) => [
        safe,
        oid,
        idx,
        line.name != null ? String(line.name) : null,
        line.qty != null ? Number(line.qty) : 1,
        line.area != null ? String(line.area) : null,
        line.category != null ? String(line.category) : null,
        line.type != null ? String(line.type) : null,
        line.notes != null ? String(line.notes) : null,
        null,
      ]);
      await conn.query(
        "INSERT INTO order_items (restaurant_id, order_id, line_index, name, qty, area, category, type, notes, extra) VALUES ?",
        [bulk]
      );
    }
    count += 1;
  }
  return count;
}

async function migrateOrders(conn, dryRun) {
  const tenantsDir = path.join(paths.DATA, "tenants");
  if (!fs.existsSync(tenantsDir)) {
    console.info("[migrate] orders: nessuna cartella tenants");
    return;
  }
  const dirs = fs
    .readdirSync(tenantsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let total = 0;
  for (const dir of dirs) {
    const c = await migrateOrdersForTenant(conn, dir, dryRun);
    if (c > 0) {
      console.info(`[migrate] orders tenant "${dir}": ${c} ordini${dryRun ? " (dry-run)" : ""}`);
      total += c;
    }
  }
  console.info(`[migrate] orders: totale ${total} ordini${dryRun ? " (dry-run)" : ""}`);
}

async function migratePaymentsForTenant(conn, tenantId, dryRun) {
  const safe = paths.sanitizeTenantId(tenantId);
  if (!safe) return 0;
  const fp = path.join(paths.DATA, "tenants", safe, "payments.json");
  if (!fs.existsSync(fp)) return 0;
  const raw = safeReadJson(fp, []);
  const payments = Array.isArray(raw) ? raw : [];
  if (payments.length === 0) return 0;

  await ensureRestaurantStub(conn, safe, dryRun);

  let count = 0;
  for (const rawPay of payments) {
    const p = normalizePaymentInput(rawPay);
    const id = String(p.id || "").trim();
    if (!id) continue;
    const extraObj = extraFromRawPayment(rawPay);
    if (dryRun) {
      console.info(`[migrate][dry-run] payment ${safe}/${id}`);
      count += 1;
      continue;
    }

    await conn.query(
      `INSERT INTO payments (
        restaurant_id, id, table_ref, order_ids, subtotal, discount_amount, discount_type, discount_reason,
        vat_percent, vat_amount, total, payment_method, amount_received, change_amount, covers,
        operator, note, customer_name, customer_id, company_name, vat_number, status,
        created_at, updated_at, closed_at, extra
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        table_ref=VALUES(table_ref), order_ids=VALUES(order_ids), subtotal=VALUES(subtotal),
        discount_amount=VALUES(discount_amount), discount_type=VALUES(discount_type), discount_reason=VALUES(discount_reason),
        vat_percent=VALUES(vat_percent), vat_amount=VALUES(vat_amount), total=VALUES(total),
        payment_method=VALUES(payment_method), amount_received=VALUES(amount_received), change_amount=VALUES(change_amount),
        covers=VALUES(covers), operator=VALUES(operator), note=VALUES(note), customer_name=VALUES(customer_name),
        customer_id=VALUES(customer_id), company_name=VALUES(company_name), vat_number=VALUES(vat_number),
        status=VALUES(status), created_at=VALUES(created_at), updated_at=VALUES(updated_at), closed_at=VALUES(closed_at), extra=VALUES(extra)`,
      [
        safe,
        id,
        p.table,
        JSON.stringify(p.orderIds || []),
        p.subtotal,
        p.discountAmount,
        p.discountType,
        p.discountReason,
        p.vatPercent,
        p.vatAmount,
        p.total,
        p.paymentMethod,
        p.amountReceived,
        p.changeAmount,
        p.covers,
        p.operator,
        p.note,
        p.customerName,
        p.customerId,
        p.companyName,
        p.vatNumber,
        p.status,
        toDateOrNull(p.createdAt),
        toDateOrNull(p.updatedAt || p.createdAt),
        toDateOrNull(p.closedAt || p.updatedAt || p.createdAt),
        extraObj ? JSON.stringify(extraObj) : null,
      ]
    );
    count += 1;
  }
  return count;
}

async function migratePayments(conn, dryRun) {
  const tenantsDir = path.join(paths.DATA, "tenants");
  if (!fs.existsSync(tenantsDir)) {
    console.info("[migrate] payments: nessuna cartella tenants");
    return;
  }
  const dirs = fs
    .readdirSync(tenantsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let total = 0;
  for (const dir of dirs) {
    const c = await migratePaymentsForTenant(conn, dir, dryRun);
    if (c > 0) {
      console.info(`[migrate] payments tenant "${dir}": ${c} pagamenti${dryRun ? " (dry-run)" : ""}`);
      total += c;
    }
  }
  console.info(`[migrate] payments: totale ${total} pagamenti${dryRun ? " (dry-run)" : ""}`);
}

async function migrateClosuresForTenant(conn, tenantId, dryRun) {
  const safe = paths.sanitizeTenantId(tenantId);
  if (!safe) return 0;
  const fp = path.join(paths.DATA, "tenants", safe, "closures.json");
  if (!fs.existsSync(fp)) return 0;
  const raw = safeReadJson(fp, []);
  const list = Array.isArray(raw) ? raw : [];
  if (list.length === 0) return 0;

  await ensureRestaurantStub(conn, safe, dryRun);

  let count = 0;
  for (const rawRow of list) {
    const c = normalizeClosureInput(rawRow);
    const id = String(c.id || "").trim();
    if (!id) continue;
    const dateOnly = resolveClosureDateOnly(c);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) continue;
    const extraObj = extraFromRawClosure(rawRow);
    if (dryRun) {
      console.info(`[migrate][dry-run] closure ${safe}/${id} ${dateOnly}`);
      count += 1;
      continue;
    }

    await conn.query(
      `INSERT INTO closures (
        restaurant_id, id, closure_date, cash_total, card_total, other_total, grand_total,
        storni_total, net_total, payments_count, closed_orders_count, covers,
        closed_at, closed_by, notes, created_at, extra
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        closure_date=VALUES(closure_date), cash_total=VALUES(cash_total), card_total=VALUES(card_total),
        other_total=VALUES(other_total), grand_total=VALUES(grand_total), storni_total=VALUES(storni_total),
        net_total=VALUES(net_total), payments_count=VALUES(payments_count), closed_orders_count=VALUES(closed_orders_count),
        covers=VALUES(covers), closed_at=VALUES(closed_at), closed_by=VALUES(closed_by), notes=VALUES(notes),
        created_at=VALUES(created_at), extra=VALUES(extra)`,
      [
        safe,
        id,
        dateOnly,
        c.cashTotal,
        c.cardTotal,
        c.otherTotal,
        c.grandTotal,
        c.storniTotal,
        c.netTotal,
        c.paymentsCount,
        c.closedOrdersCount,
        c.covers,
        toDateOrNull(c.closedAt),
        c.closedBy,
        c.notes,
        toDateOrNull(c.createdAt),
        extraObj ? JSON.stringify(extraObj) : null,
      ]
    );
    count += 1;
  }
  return count;
}

async function migrateClosures(conn, dryRun) {
  const tenantsDir = path.join(paths.DATA, "tenants");
  if (!fs.existsSync(tenantsDir)) {
    console.info("[migrate] closures: nessuna cartella tenants");
    return;
  }
  const dirs = fs
    .readdirSync(tenantsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let total = 0;
  for (const dir of dirs) {
    const c = await migrateClosuresForTenant(conn, dir, dryRun);
    if (c > 0) {
      console.info(`[migrate] closures tenant "${dir}": ${c} chiusure${dryRun ? " (dry-run)" : ""}`);
      total += c;
    }
  }
  console.info(`[migrate] closures: totale ${total} chiusure${dryRun ? " (dry-run)" : ""}`);
}

async function migrateReportsForTenant(conn, tenantId, dryRun) {
  const safe = paths.sanitizeTenantId(tenantId);
  if (!safe) return 0;
  const fp = path.join(paths.DATA, "tenants", safe, "reports.json");
  if (!fs.existsSync(fp)) return 0;
  const raw = safeReadJson(fp, { reports: [] });
  const list = Array.isArray(raw.reports) ? raw.reports : [];
  if (list.length === 0) return 0;

  await ensureRestaurantStub(conn, safe, dryRun);

  let count = 0;
  for (const rawRow of list) {
    const r = normalizeReportForCreate(rawRow);
    const id = String(r.id || "").trim();
    if (!id) continue;
    const extraObj = extraFromRawReport(rawRow);
    const rd = reportDateForSql(r.date);
    if (dryRun) {
      console.info(`[migrate][dry-run] report ${safe}/${id}`);
      count += 1;
      continue;
    }

    await conn.query(
      `INSERT INTO saved_reports (restaurant_id, id, report_date, revenue, covers, note, extra)
       VALUES (?,?,?,?,?,?,?)
       ON DUPLICATE KEY UPDATE
         report_date=VALUES(report_date), revenue=VALUES(revenue), covers=VALUES(covers), note=VALUES(note), extra=VALUES(extra)`,
      [safe, id, rd, r.revenue, r.covers, r.note, extraObj ? JSON.stringify(extraObj) : null]
    );
    count += 1;
  }
  return count;
}

async function migrateReports(conn, dryRun) {
  const tenantsDir = path.join(paths.DATA, "tenants");
  if (!fs.existsSync(tenantsDir)) {
    console.info("[migrate] reports: nessuna cartella tenants");
    return;
  }
  const dirs = fs
    .readdirSync(tenantsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let total = 0;
  for (const dir of dirs) {
    const c = await migrateReportsForTenant(conn, dir, dryRun);
    if (c > 0) {
      console.info(`[migrate] reports tenant "${dir}": ${c} report${dryRun ? " (dry-run)" : ""}`);
      total += c;
    }
  }
  console.info(`[migrate] reports: totale ${total} report${dryRun ? " (dry-run)" : ""}`);
}

async function migrateStorniForTenant(conn, tenantId, dryRun) {
  const safe = paths.sanitizeTenantId(tenantId);
  if (!safe) return 0;
  const fp = path.join(paths.DATA, "tenants", safe, "storni.json");
  if (!fs.existsSync(fp)) return 0;
  const raw = safeReadJson(fp, { entries: [] });
  const list = Array.isArray(raw.entries) ? raw.entries : [];
  if (list.length === 0) return 0;

  await ensureRestaurantStub(conn, safe, dryRun);

  let count = 0;
  for (const rawRow of list) {
    const id = String(rawRow.id || "").trim();
    if (!id) continue;
    let ed = dateOnly(rawRow.date || rawRow.createdAt);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ed)) ed = dateOnly(new Date().toISOString());
    const extraObj = extraFromRawStorno(rawRow);
    if (dryRun) {
      console.info(`[migrate][dry-run] storno ${safe}/${id}`);
      count += 1;
      continue;
    }

    await conn.query(
      `INSERT INTO storni_entries (
        restaurant_id, id, entry_date, amount, reason, table_ref, order_ref, note, created_at, extra
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        entry_date=VALUES(entry_date), amount=VALUES(amount), reason=VALUES(reason), table_ref=VALUES(table_ref),
        order_ref=VALUES(order_ref), note=VALUES(note), created_at=VALUES(created_at), extra=VALUES(extra)`,
      [
        safe,
        id,
        ed,
        Number(rawRow.amount) || 0,
        String(rawRow.reason || "").trim() || null,
        rawRow.table != null ? String(rawRow.table).trim() : null,
        rawRow.orderId != null ? String(rawRow.orderId).trim() : null,
        rawRow.note != null ? String(rawRow.note).trim() : null,
        toDateOrNull(rawRow.createdAt) || toDateOrNull(rawRow.date) || new Date(),
        extraObj ? JSON.stringify(extraObj) : null,
      ]
    );
    count += 1;
  }
  return count;
}

async function migrateStorni(conn, dryRun) {
  const tenantsDir = path.join(paths.DATA, "tenants");
  if (!fs.existsSync(tenantsDir)) {
    console.info("[migrate] storni: nessuna cartella tenants");
    return;
  }
  const dirs = fs
    .readdirSync(tenantsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let total = 0;
  for (const dir of dirs) {
    const c = await migrateStorniForTenant(conn, dir, dryRun);
    if (c > 0) {
      console.info(`[migrate] storni tenant "${dir}": ${c} righe${dryRun ? " (dry-run)" : ""}`);
      total += c;
    }
  }
  console.info(`[migrate] storni: totale ${total} righe${dryRun ? " (dry-run)" : ""}`);
}

async function migrateCassaShiftsForTenant(conn, tenantId, dryRun) {
  const safe = paths.sanitizeTenantId(tenantId);
  if (!safe) return 0;
  const fp = path.join(paths.DATA, "tenants", safe, "cassa-shifts.json");
  if (!fs.existsSync(fp)) return 0;
  const raw = safeReadJson(fp, { shifts: [] });
  const list = Array.isArray(raw.shifts) ? raw.shifts : [];
  if (list.length === 0) return 0;

  await ensureRestaurantStub(conn, safe, dryRun);

  let count = 0;
  for (const s of list) {
    const id = Number(s.id != null ? s.id : s.shift_id);
    if (!Number.isFinite(id)) continue;
    const extraObj = extraFromRawShift(s);
    if (dryRun) {
      console.info(`[migrate][dry-run] cassa-shift ${safe}/${id}`);
      count += 1;
      continue;
    }

    await conn.query(
      `INSERT INTO cassa_shifts (
        restaurant_id, id, opened_at, closed_at, opening_float, cash_total, card_total, other_total, status, extra
      ) VALUES (?,?,?,?,?,?,?,?,?,?)
      ON DUPLICATE KEY UPDATE
        opened_at=VALUES(opened_at), closed_at=VALUES(closed_at), opening_float=VALUES(opening_float),
        cash_total=VALUES(cash_total), card_total=VALUES(card_total), other_total=VALUES(other_total),
        status=VALUES(status), extra=VALUES(extra)`,
      [
        safe,
        id,
        toDateOrNull(s.opened_at) || new Date(),
        toDateOrNull(s.closed_at),
        Number(s.opening_float) || 0,
        Number(s.cash_total) || 0,
        Number(s.card_total) || 0,
        Number(s.other_total) || 0,
        String(s.status || "open").trim() || "open",
        extraObj ? JSON.stringify(extraObj) : null,
      ]
    );
    count += 1;
  }
  return count;
}

async function migrateCassaShifts(conn, dryRun) {
  const tenantsDir = path.join(paths.DATA, "tenants");
  if (!fs.existsSync(tenantsDir)) {
    console.info("[migrate] cassa-shifts: nessuna cartella tenants");
    return;
  }
  const dirs = fs
    .readdirSync(tenantsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let total = 0;
  for (const dir of dirs) {
    const c = await migrateCassaShiftsForTenant(conn, dir, dryRun);
    if (c > 0) {
      console.info(`[migrate] cassa-shifts tenant "${dir}": ${c} turni${dryRun ? " (dry-run)" : ""}`);
      total += c;
    }
  }
  console.info(`[migrate] cassa-shifts: totale ${total} turni${dryRun ? " (dry-run)" : ""}`);
}


async function migrateTenantModuleData(conn, dryRun, moduleKey, fileName) {
  const tenantsDir = path.join(paths.DATA, "tenants");
  if (!fs.existsSync(tenantsDir)) {
    console.info(`[migrate] ${moduleKey}: nessuna cartella tenants`);
    return;
  }
  const dirs = fs
    .readdirSync(tenantsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  let total = 0;
  for (const dir of dirs) {
    const safe = path.basename(dir);
    const fp = path.join(tenantsDir, safe, fileName);
    if (!fs.existsSync(fp)) continue;
    const payload = safeReadJson(fp, []);
    await ensureRestaurantStub(conn, safe, dryRun);
    if (dryRun) {
      console.info(`[migrate][dry-run] ${moduleKey} tenant "${safe}"`);
      total += 1;
      continue;
    }
    await conn.query(
      `INSERT INTO tenant_module_data (restaurant_id, module_key, payload_json, updated_at)
       VALUES (?, ?, CAST(? AS JSON), NOW(3))
       ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), updated_at = NOW(3)`,
      [safe, moduleKey, JSON.stringify(payload)]
    );
    total += 1;
  }
  console.info(`[migrate] ${moduleKey}: ${total} tenant processati${dryRun ? " (dry-run)" : ""}`);
}


async function migrateGlobalModuleData(conn, dryRun, moduleKey, fileName) {
  const fp = path.join(paths.DATA, fileName);
  if (!fs.existsSync(fp)) {
    console.info(`[migrate] ${moduleKey}: file non trovato (${fileName})`);
    return;
  }
  const payload = safeReadJson(fp, {});
  const rid = "__global__";
  if (dryRun) {
    console.info(`[migrate][dry-run] ${moduleKey} globale da ${fileName}`);
    return;
  }
  await conn.query(
    `INSERT INTO tenant_module_data (restaurant_id, module_key, payload_json, updated_at)
     VALUES (?, ?, CAST(? AS JSON), NOW(3))
     ON DUPLICATE KEY UPDATE payload_json = VALUES(payload_json), updated_at = NOW(3)`,
    [rid, moduleKey, JSON.stringify(payload)]
  );
  console.info(`[migrate] ${moduleKey}: payload globale migrato`);
}

async function runStep(step, dryRun) {
  const pool = getPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (step === "restaurants") {
      await migrateRestaurants(conn, dryRun);
    } else if (step === "menus") {
      await migrateMenus(conn, dryRun);
    } else if (step === "users") {
      await migrateUsers(conn, dryRun);
    } else if (step === "licenses") {
      await migrateLicenses(conn, dryRun);
    } else if (step === "orders") {
      await migrateOrders(conn, dryRun);
    } else if (step === "payments") {
      await migratePayments(conn, dryRun);
    } else if (step === "closures") {
      await migrateClosures(conn, dryRun);
    } else if (step === "reports") {
      await migrateReports(conn, dryRun);
    } else if (step === "storni") {
      await migrateStorni(conn, dryRun);
    } else if (step === "cassa-shifts") {
      await migrateCassaShifts(conn, dryRun);
    } else if (step === "inventory-transfers") {
      await migrateTenantModuleData(conn, dryRun, "inventory-transfers", "inventory-transfers.json");
    } else if (step === "stock-movements") {
      await migrateTenantModuleData(conn, dryRun, "stock-movements", "stock-movements.json");
    } else if (step === "order-food-costs") {
      await migrateTenantModuleData(conn, dryRun, "order-food-costs", "order-food-costs.json");
    } else if (step === "bookings") {
      await migrateTenantModuleData(conn, dryRun, "bookings", "bookings.json");
    } else if (step === "customers") {
      await migrateTenantModuleData(conn, dryRun, "customers", "customers.json");
    } else if (step === "haccp") {
      await migrateTenantModuleData(conn, dryRun, "haccp-checks", "haccp-checks.json");
    } else if (step === "devices") {
      await migrateTenantModuleData(conn, dryRun, "devices", "devices.json");
    } else if (step === "print-routes") {
      await migrateTenantModuleData(conn, dryRun, "print-routes", "print-routes.json");
    } else if (step === "print-jobs") {
      await migrateTenantModuleData(conn, dryRun, "print-jobs", "print-jobs.json");
    } else if (step === "attendance") {
      await migrateTenantModuleData(conn, dryRun, "attendance", "attendance.json");
    } else if (step === "leave") {
      await migrateTenantModuleData(conn, dryRun, "leave-requests", "leave-requests.json");
    } else if (step === "staff") {
      await migrateTenantModuleData(conn, dryRun, "staff", "staff.json");
    } else if (step === "staff-shifts") {
      await migrateTenantModuleData(conn, dryRun, "staff-shifts", "staff-shifts.json");
    } else if (step === "staff-requests") {
      await migrateTenantModuleData(conn, dryRun, "staff-requests", "staff-requests.json");
    } else if (step === "sessions") {
      await migrateTenantModuleData(conn, dryRun, "sessions", "sessions.json");
    } else if (step === "pos-shifts") {
      await migrateTenantModuleData(conn, dryRun, "pos-shifts", "pos-shifts.json");
    } else if (step === "recipes") {
      await migrateTenantModuleData(conn, dryRun, "recipes", "recipes.json");
    } else if (step === "daily-menu") {
      await migrateTenantModuleData(conn, dryRun, "daily-menu", "daily-menu.json");
    } else if (step === "qr-tables") {
      await migrateTenantModuleData(conn, dryRun, "qr-tables", "qr-tables.json");
    } else if (step === "catering-events") {
      await migrateTenantModuleData(conn, dryRun, "catering-events", "catering-events.json");
    } else if (step === "catering-presets") {
      await migrateTenantModuleData(conn, dryRun, "catering-presets", "catering-presets.json");
    } else if (step === "inventory") {
      await migrateTenantModuleData(conn, dryRun, "inventory", "inventory.json");
    } else if (step === "gs-codes-mirror") {
      await migrateGlobalModuleData(conn, dryRun, "gs-codes-mirror", "gs-codes-mirror.json");
    } else {
      throw new Error(`step sconosciuto: ${step}`);
    }
    if (!dryRun) {
      await conn.commit();
    } else {
      await conn.rollback();
    }
  } catch (e) {
    try {
      await conn.rollback();
    } catch (_) {}
    throw e;
  } finally {
    conn.release();
  }
}

async function main() {
  const { dryRun, step } = parseArgs(process.argv.slice(2));
  if (!step) {
    printUsage();
    process.exit(1);
  }

  const order = [
    "restaurants",
    "menus",
    "users",
    "licenses",
    "orders",
    "payments",
    "closures",
    "reports",
    "storni",
    "cassa-shifts",
    "inventory-transfers",
    "stock-movements",
    "order-food-costs",
    "bookings",
    "customers",
    "haccp",
    "devices",
    "print-routes",
    "print-jobs",
    "attendance",
    "leave",
    "staff",
    "staff-shifts",
    "staff-requests",
    "sessions",
    "pos-shifts",
    "recipes",
    "daily-menu",
    "qr-tables",
    "catering-events",
    "catering-presets",
    "inventory",
    "gs-codes-mirror",
  ];
  let steps;
  if (step === "all") {
    steps = order;
  } else if (order.includes(step)) {
    steps = [step];
  } else {
    printUsage();
    console.error("Step non valido:", step);
    process.exit(1);
  }

  console.info("[migrate] Backend root:", getBackendRoot());
  console.info("[migrate] Step:", steps.join(", "), dryRun ? "(dry-run)" : "");

  try {
    for (const s of steps) {
      await runStep(s, dryRun);
    }
    console.info("[migrate] Completato.");
  } catch (e) {
    console.error("[migrate] ERRORE:", e && e.message ? e.message : e);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();
