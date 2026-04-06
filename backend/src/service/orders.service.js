// backend/src/service/orders.service.js
// Business logic for orders. Data access via orders.repository only.
//
// Multi-corso (courseFlowVersion / courseStates):
// - Ogni numero corso presente nelle righe ha uno stato in order.courseStates["n"].
// - Valori: queued | in_attesa | in_preparazione | pronto | servito
// - activeCourse = corso operativo in cucina (primo non servito dopo avanzamenti).
// - All'invio: primo corso con piatti (min course) = in_attesa, gli altri queued.
// - Pronto in cucina: completa la portata corrente; se non è l’ultima → avanza corso,
//   order.status = in_attesa. Ultima portata → corso in stato pronto, order in_attesa.
// - Servito: solo ultimo corso già pronto → chiude l’ordine (order.status = servito).

const ordersRepository = require("../repositories/orders.repository");

function courseKey(n) {
  return String(Math.floor(Number(n)));
}

function getSortedCourseNumsFromItems(items) {
  const list = Array.isArray(items) ? items : [];
  const set = new Set();
  for (const it of list) {
    const c = Number(it && it.course);
    const cn = Number.isFinite(c) && c >= 1 ? Math.floor(c) : 1;
    set.add(cn);
  }
  return [...set].sort((a, b) => a - b);
}

function getCourseState(order, n) {
  const cs = order && order.courseStates && typeof order.courseStates === "object" ? order.courseStates : {};
  const v = cs[courseKey(n)];
  if (v != null && v !== "") return String(v).toLowerCase();
  return "queued";
}

function setCourseState(order, n, state) {
  if (!order.courseStates || typeof order.courseStates !== "object") order.courseStates = {};
  order.courseStates[courseKey(n)] = String(state).toLowerCase();
}

/** Migrazione ordini senza courseStates (JSON vecchio / MySQL solo items). */
function migrateLegacyCourseStates(order, nums) {
  const cs = {};
  const st = String(order.status || "").toLowerCase();
  let ac = Number(order.activeCourse);
  if (!Number.isFinite(ac) || ac < 1) ac = nums.length ? nums[0] : 1;
  if (nums.length) {
    const maxN = nums[nums.length - 1];
    if (ac > maxN) ac = maxN;
    if (ac < nums[0]) ac = nums[0];
  }

  if (st === "servito") {
    nums.forEach((n) => {
      cs[courseKey(n)] = "servito";
    });
    return cs;
  }

  for (const n of nums) {
    if (n < ac) {
      cs[courseKey(n)] = "servito";
    } else if (n === ac) {
      if (st === "in_preparazione" || st === "pronto" || st === "in_attesa") {
        cs[courseKey(n)] = st;
      } else {
        cs[courseKey(n)] = "in_attesa";
      }
    } else {
      cs[courseKey(n)] = "queued";
    }
  }
  return cs;
}

/**
 * Garantisce order.courseStates coerente con items. Mutua l'ordine passato.
 */
function ensureCourseStatesForOrder(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const nums = getSortedCourseNumsFromItems(items);
  if (!nums.length) {
    if (!order.courseStates || typeof order.courseStates !== "object") order.courseStates = {};
    return;
  }
  if (!order.courseStates || typeof order.courseStates !== "object") {
    order.courseStates = migrateLegacyCourseStates(order, nums);
    return;
  }
  for (const n of nums) {
    const k = courseKey(n);
    if (order.courseStates[k] == null || order.courseStates[k] === "") {
      order.courseStates[k] = "queued";
    }
  }
}

function buildCourseStatesForNewOrder(items) {
  const nums = getSortedCourseNumsFromItems(items);
  const cs = {};
  if (!nums.length) return cs;
  const first = nums[0];
  for (const n of nums) {
    cs[courseKey(n)] = n === first ? "in_attesa" : "queued";
  }
  return cs;
}

function throwOrderBadRequest(message) {
  const err = new Error(message);
  err.status = 400;
  throw err;
}

/**
 * Pronto: completa la portata in preparazione.
 * - Non ultimo corso → corso marcato servito (portata uscita), successivo in_attesa, ordine in_attesa.
 * - Ultimo corso → corso pronto (in attesa di Servito in sala), ordine in_attesa.
 */
function applyProntoAdvance(target) {
  const items = Array.isArray(target.items) ? target.items : [];
  ensureCourseStatesForOrder(target);
  const nums = getSortedCourseNumsFromItems(items);
  if (!nums.length) {
    target.status = "servito";
    return;
  }
  const current = nums.find((n) => getCourseState(target, n) !== "servito");
  if (current == null) {
    target.status = "servito";
    return;
  }
  const lastN = nums[nums.length - 1];
  const st = getCourseState(target, current);
  if (current === lastN && st === "pronto") {
    throwOrderBadRequest("Ultimo corso già pronto: usa Servito per chiudere l'ordine.");
  }
  if (st !== "in_preparazione") {
    throwOrderBadRequest("Pronto solo dopo In preparazione sul corso attivo.");
  }
  if (current !== lastN) {
    setCourseState(target, current, "servito");
    const next = nums.find((n) => getCourseState(target, n) !== "servito");
    if (next != null) {
      target.activeCourse = next;
      setCourseState(target, next, "in_attesa");
    }
    target.status = "in_attesa";
    return;
  }
  setCourseState(target, current, "pronto");
  target.activeCourse = current;
  target.status = "in_attesa";
}

/** Servito: solo ultimo corso già pronto → chiude l'ordine. */
function applyServitoLastCourseOnly(target) {
  const items = Array.isArray(target.items) ? target.items : [];
  ensureCourseStatesForOrder(target);
  const nums = getSortedCourseNumsFromItems(items);
  if (!nums.length) {
    target.status = "servito";
    return;
  }
  const current = nums.find((n) => getCourseState(target, n) !== "servito");
  if (current == null) {
    target.status = "servito";
    return;
  }
  const lastN = nums[nums.length - 1];
  if (current !== lastN) {
    throwOrderBadRequest("Servito solo sull'ultima portata.");
  }
  if (getCourseState(target, current) !== "pronto") {
    throwOrderBadRequest("Servito solo quando l'ultimo corso è Pronto.");
  }
  setCourseState(target, current, "servito");
  target.status = "servito";
}

async function listOrders() {
  try {
    const orders = await ordersRepository.getAllOrders();
    return Array.isArray(orders) ? orders : [];
  } catch (err) {
    return [];
  }
}

async function getOrderById(id) {
  const o = await ordersRepository.getOrderById(id);
  if (!o) return null;
  return normalizeOrderForRead({ ...o, items: Array.isArray(o.items) ? o.items.map((i) => ({ ...i })) : [] });
}

function getOrderDateStr(order) {
  const d = order.updatedAt || order.createdAt || order.date;
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function listActiveOrders() {
  let all = [];
  try {
    all = await ordersRepository.getAllOrders();
  } catch (err) {
    all = [];
  }
  const excludeStatuses = ["chiuso", "annullato", "closed", "cancelled", "archived", "pagato", "paid"];
  const filtered = all.filter((o) => {
    const status = String(o.status || "").toLowerCase().trim();
    return !excludeStatuses.includes(status);
  });
  return filtered.map((o) =>
    normalizeOrderForRead({
      ...o,
      items: Array.isArray(o.items) ? o.items.map((i) => ({ ...i })) : [],
    })
  );
}

async function listOrdersByDate(dateStr) {
  const all = await ordersRepository.getAllOrders();
  const target = String(dateStr || "").slice(0, 10);
  if (!target) return [];

  return all.filter((o) => {
    const d = getOrderDateStr(o);
    return d === target;
  });
}

function normalizeItemCourse(it) {
  const c = Number(it && it.course);
  const course = Number.isFinite(c) && c >= 1 ? Math.floor(c) : 1;
  return { ...it, course };
}

/** Ordine vuoto: activeCourse dal body o 1. Con piatti: ignorare body — primo corso con piatti (min). */
function deriveInitialActiveCourse(items) {
  const nums = getSortedCourseNumsFromItems(items);
  if (nums.length) return nums[0];
  return 1;
}

function getMaxCourseFromOrder(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) return null;
  let m = 1;
  for (const it of items) {
    const c = Number(it && it.course);
    const cn = Number.isFinite(c) && c >= 1 ? Math.floor(c) : 1;
    if (cn > m) m = cn;
  }
  return m;
}

function normalizeOrderActiveCourseForRead(order) {
  if (!order || typeof order !== "object") return order;
  const maxC = getMaxCourseFromOrder(order);
  if (maxC == null) return order;
  let ac = Number(order.activeCourse);
  if (!Number.isFinite(ac) || ac < 1) ac = 1;
  if (ac > maxC) ac = maxC;

  const nums = getSortedCourseNumsFromItems(order.items);
  if (nums.length && getCourseState(order, ac) === "servito") {
    const next = nums.find((n) => getCourseState(order, n) !== "servito");
    if (next != null) ac = next;
  }

  const prev = order.activeCourse;
  if (prev === ac || Number(prev) === ac) return { ...order, activeCourse: ac };
  if (String(process.env.DEBUG_ORDER_FLOW || "").toLowerCase() === "true") {
    // eslint-disable-next-line no-console
    console.warn("[orders] normalizeOrderActiveCourseForRead", {
      orderId: order.id,
      table: order.table,
      before: prev,
      after: ac,
      maxCourse: maxC,
    });
  }
  return { ...order, activeCourse: ac };
}

function normalizeOrderForRead(order) {
  if (!order || typeof order !== "object") return order;
  const o = { ...order };
  ensureCourseStatesForOrder(o);
  return normalizeOrderActiveCourseForRead(o);
}

async function createOrder(payload) {
  const body = payload || {};
  const orders = await ordersRepository.getAllOrders();
  const id = ordersRepository.getNextId(orders);
  const now = new Date().toISOString();

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems.map(normalizeItemCourse);

  const courseStates = buildCourseStatesForNewOrder(items);
  const activeCourse = deriveInitialActiveCourse(items);

  const newOrder = {
    id,
    table: body.table ?? null,
    covers: body.covers ?? null,
    area: body.area || "sala",
    waiter: body.waiter || "",
    notes: body.notes || "",
    items,
    activeCourse,
    courseStates,
    courseFlowVersion: 1,
    status: "in_attesa",
    createdAt: now,
    updatedAt: now,
  };

  orders.push(newOrder);
  await ordersRepository.saveAllOrders(orders);
  return normalizeOrderForRead({ ...newOrder });
}

async function setStatus(id, status) {
  const orders = await ordersRepository.getAllOrders();
  const target = orders.find((o) => String(o.id) === String(id));
  if (!target) {
    const err = new Error("Ordine non trovato");
    err.status = 404;
    throw err;
  }

  const lower = String(status || "").toLowerCase();
  const now = new Date().toISOString();

  ensureCourseStatesForOrder(target);

  if (lower === "servito") {
    applyServitoLastCourseOnly(target);
    target.updatedAt = now;
    await ordersRepository.saveAllOrders(orders);
    return normalizeOrderForRead({ ...target });
  }

  if (lower === "pronto") {
    applyProntoAdvance(target);
    target.updatedAt = now;
    await ordersRepository.saveAllOrders(orders);
    return normalizeOrderForRead({ ...target });
  }

  if (lower === "in_preparazione" || lower === "in_attesa") {
    const nums = getSortedCourseNumsFromItems(target.items);
    const current = nums.find((n) => getCourseState(target, n) !== "servito");
    if (current == null) {
      target.status = "servito";
      target.updatedAt = now;
      await ordersRepository.saveAllOrders(orders);
      return normalizeOrderForRead({ ...target });
    }
    setCourseState(target, current, lower);
    target.activeCourse = current;
    target.status = lower;
    target.updatedAt = now;
    await ordersRepository.saveAllOrders(orders);
    return normalizeOrderForRead({ ...target });
  }

  target.status = status;
  target.updatedAt = now;
  await ordersRepository.saveAllOrders(orders);
  return normalizeOrderForRead({ ...target });
}

async function setActiveCourse(id, activeCourse) {
  let n = Number(activeCourse);
  if (!Number.isFinite(n) || n < 1) {
    const err = new Error("activeCourse deve essere un numero intero >= 1");
    err.status = 400;
    throw err;
  }
  const orders = await ordersRepository.getAllOrders();
  const target = orders.find((o) => String(o.id) === String(id));
  if (!target) {
    const err = new Error("Ordine non trovato");
    err.status = 404;
    throw err;
  }
  n = Math.floor(n);
  ensureCourseStatesForOrder(target);
  const nums = getSortedCourseNumsFromItems(target.items);
  const maxC = getMaxCourseFromOrder(target);
  if (maxC != null && n > maxC) n = maxC;

  const prev = Number(target.activeCourse) >= 1 ? Math.floor(Number(target.activeCourse)) : 1;
  if (n > prev) {
    if (n !== prev + 1 && n !== 1) {
      const err = new Error(
        "Marcia: avanza un solo corso alla volta (corso attuale " +
          prev +
          "). Un salto diretto al corso successivo non è consentito."
      );
      err.status = 400;
      throw err;
    }
  }
  if (n < prev) {
    if (n !== 1 && n !== prev - 1) {
      const err = new Error(
        "Marcia: puoi solo tornare al corso precedente o reimpostare al corso 1."
      );
      err.status = 400;
      throw err;
    }
  }

  target.activeCourse = n;
  if (nums.includes(n) && getCourseState(target, n) === "queued") {
    setCourseState(target, n, "in_attesa");
  }
  target.updatedAt = new Date().toISOString();
  await ordersRepository.saveAllOrders(orders);
  return normalizeOrderForRead({ ...target });
}

async function tryMarkOrderInventoryProcessed(id) {
  const orders = await ordersRepository.getAllOrders();
  const target = orders.find((o) => String(o.id) === String(id));
  if (!target) return false;
  if (target.inventoryProcessedAt) return false;

  target.inventoryProcessedAt = new Date().toISOString();
  await ordersRepository.saveAllOrders(orders);
  return true;
}

module.exports = {
  listOrders,
  getOrderById,
  listActiveOrders,
  listOrdersByDate,
  createOrder,
  setStatus,
  setActiveCourse,
  tryMarkOrderInventoryProcessed,
  getOrderDateStr,
};
