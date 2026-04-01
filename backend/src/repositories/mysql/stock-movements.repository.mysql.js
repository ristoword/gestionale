const { v4: uuid } = require("uuid");
const { getJson, setJson } = require("./tenant-module.mysql");

const MODULE_KEY = "stock-movements";

async function readAll() {
  const data = await getJson(MODULE_KEY, []);
  return Array.isArray(data) ? data : [];
}

async function writeAll(data) {
  await setJson(MODULE_KEY, Array.isArray(data) ? data : []);
}

async function getAll() { return readAll(); }

async function findByOrderId(orderId) {
  const movements = await readAll();
  return movements.filter((m) => String(m.orderId) === String(orderId));
}

async function createMovement(data) {
  const movements = await readAll();
  const movement = {
    id: uuid(),
    restaurantId: data.restaurantId || null,
    type: data.type || "deduction",
    orderId: data.orderId || null,
    orderStatus: data.orderStatus || null,
    itemName: data.itemName || "",
    ingredientName: data.ingredientName || "",
    quantity: Number(data.quantity) || 0,
    unit: data.unit || "",
    before: Number(data.before) || 0,
    after: Number(data.after) || 0,
    note: data.note || "",
    fromWarehouse: data.fromWarehouse || null,
    toWarehouse: data.toWarehouse || null,
    productId: data.productId || null,
    productName: data.productName || "",
    recipeId: data.recipeId || null,
    sourceModule: data.sourceModule || null,
    reason: data.reason || null,
    receivedBy: data.receivedBy || null,
    barcode: data.barcode || null,
    lot: data.lot || null,
    unitCost: data.unitCost != null ? Number(data.unitCost) : null,
    supplier: data.supplier || null,
    createdAt: new Date().toISOString(),
  };
  movements.push(movement);
  await writeAll(movements);
  return movement;
}

module.exports = { getAll, createMovement, findByOrderId };
