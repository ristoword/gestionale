// Shared async inventory logic: inject loadItems/saveItems (JSON files or MySQL tenant_module_data).

const DEPARTMENTS = ["cucina", "sala", "bar", "proprieta"];

function normalizeItem(item) {
  const stocks = item.stocks && typeof item.stocks === "object" ? { ...item.stocks } : {};
  DEPARTMENTS.forEach((d) => {
    if (stocks[d] == null) stocks[d] = 0;
  });
  const central = item.central != null ? Number(item.central) : Number(item.quantity) ?? 0;
  return {
    ...item,
    quantity: central,
    central,
    stocks,
    category: item.category || "",
    lot: item.lot || "",
    notes: item.notes || "",
    threshold: Number(item.threshold) ?? 0,
    cost: Number(item.cost) ?? 0,
  };
}

function normalizeName(s) {
  return String(s || "").trim().toLowerCase();
}

function getCostPerUnit(item) {
  if (!item) return 0;
  const cpu = Number(item.cost_per_unit);
  if (Number.isFinite(cpu) && cpu >= 0) return cpu;
  const cost = Number(item.cost);
  const qty = Number(item.central ?? item.quantity) || 0;
  if (Number.isFinite(cost) && qty > 0) return cost / qty;
  return Number(item.cost) || 0;
}

function getStock(item) {
  if (!item) return 0;
  return Number(item.central ?? item.quantity ?? item.stock) || 0;
}

function getDepartmentStock(item, dept) {
  if (!item || !dept) return 0;
  return Number(item.stocks && item.stocks[dept]) || 0;
}

function getMinStock(item) {
  if (!item) return 0;
  const m = Number(item.min_stock);
  if (Number.isFinite(m)) return m;
  return Number(item.threshold) || 0;
}

function nextId(inventory) {
  const ids = (inventory || []).map((x) => Number(x && x.id)).filter((n) => Number.isFinite(n) && n > 0);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

/**
 * @param {{ loadItems: () => Promise<unknown>, saveItems: (items: unknown[]) => Promise<void> }} store
 */
function createInventoryApi(store) {
  const { loadItems, saveItems } = store;

  async function readInventory() {
    const data = await loadItems();
    let items = Array.isArray(data) ? data : data && Array.isArray(data.items) ? data.items : [];
    if (!Array.isArray(items)) items = [];
    return items.map(normalizeItem);
  }

  async function writeInventory(data) {
    const items = (Array.isArray(data) ? data : []).map((i) => {
      const { central, stocks, ...rest } = i;
      return { ...rest, quantity: central ?? i.quantity, central: central ?? i.quantity, stocks: stocks || {} };
    });
    await saveItems(items);
  }

  async function getAll() {
    return readInventory();
  }

  async function getById(id) {
    const inventory = await readInventory();
    return inventory.find((item) => String(item.id) === String(id)) || null;
  }

  async function getByLocation(location) {
    const items = await readInventory();
    if (location === "central" || !location) {
      return items.filter((i) => (Number(i.central) || 0) > 0);
    }
    if (DEPARTMENTS.includes(location)) {
      return items
        .map((i) => ({
          ...i,
          qtyDept: Number(i.stocks && i.stocks[location]) || 0,
        }))
        .filter((i) => i.qtyDept > 0);
    }
    return items;
  }

  async function findInventoryItemByName(name) {
    const inventory = await readInventory();
    const n = normalizeName(name);
    return inventory.find((item) => normalizeName(item.name) === n) || null;
  }

  async function findInventoryItemByBarcode(barcode) {
    if (!barcode || typeof barcode !== "string") return null;
    const code = String(barcode).trim();
    if (!code) return null;
    const inventory = await readInventory();
    return inventory.find((item) => String(item.barcode || "").trim() === code) || null;
  }

  async function deductFromDepartment(ingredientName, amount, department) {
    if (!DEPARTMENTS.includes(department)) {
      return { success: false, reason: "invalid_department" };
    }
    const inventory = await readInventory();
    const n = normalizeName(ingredientName);
    const index = inventory.findIndex((item) => normalizeName(item.name) === n);
    if (index === -1) return { success: false, reason: "not_found" };

    const item = inventory[index];
    const currentDept = getDepartmentStock(item, department);
    const deduct = Number(amount) || 0;
    if (deduct <= 0) return { success: false, reason: "invalid_amount" };
    if (currentDept < deduct) {
      return {
        success: false,
        reason: "insufficient_stock",
        available: currentDept,
        requested: deduct,
        ingredientName: item.name,
      };
    }

    const stocks = { ...(item.stocks || {}) };
    stocks[department] = Math.max(0, currentDept - deduct);

    inventory[index] = normalizeItem({
      ...item,
      stocks,
      updatedAt: new Date().toISOString(),
    });
    await writeInventory(inventory);

    const minS = getMinStock(item);
    const newDept = stocks[department];
    return {
      success: true,
      newStock: newDept,
      belowMin: minS > 0 && newDept < minS,
      ingredientName: item.name,
    };
  }

  async function deductInventoryItem(ingredientName, amount, unitHint) {
    const inventory = await readInventory();
    const n = normalizeName(ingredientName);
    const index = inventory.findIndex((item) => normalizeName(item.name) === n);
    if (index === -1) return { success: false, reason: "not_found" };

    const item = inventory[index];
    const current = getStock(item);
    const deduct = Number(amount) || 0;
    const newStock = Math.max(0, current - deduct);
    inventory[index] = {
      ...item,
      quantity: newStock,
      central: newStock,
      stock: newStock,
      updatedAt: new Date().toISOString(),
    };
    await writeInventory(inventory);

    const minS = getMinStock(item);
    return {
      success: true,
      newStock,
      belowMin: minS > 0 && newStock < minS,
      ingredientName: item.name,
    };
  }

  async function deductInventoryIngredients(deductions) {
    const results = [];
    for (const d of deductions) {
      const name = d.name || d.ingredientName;
      const qty = Number(d.qty) ?? Number(d.quantity) ?? 0;
      if (!name || qty <= 0) continue;
      const r = await deductInventoryItem(name, qty, d.unit);
      results.push({ name, qty, ...r });
    }
    return results;
  }

  async function update(id, updates = {}) {
    const inventory = await readInventory();
    const index = inventory.findIndex((item) => String(item.id) === String(id));
    if (index === -1) return null;

    const item = inventory[index];
    let { central, stocks } = item;
    if (updates.central != null) central = Number(updates.central) || 0;
    if (updates.stocks && typeof updates.stocks === "object") {
      stocks = { ...(item.stocks || {}), ...updates.stocks };
    }

    const updated = {
      ...item,
      ...updates,
      central: central ?? item.central,
      quantity: central ?? item.quantity,
      stocks: stocks || item.stocks,
      updatedAt: new Date().toISOString(),
    };
    inventory[index] = normalizeItem(updated);
    await writeInventory(inventory);
    return inventory[index];
  }

  async function create(data) {
    const inventory = await readInventory();
    const id = nextId(inventory);
    const now = new Date().toISOString();
    const stocks = {};
    DEPARTMENTS.forEach((d) => {
      stocks[d] = 0;
    });
    const central = Number(data.quantity) ?? Number(data.central) ?? 0;
    const newItem = normalizeItem({
      id,
      name: String(data.name || "").trim(),
      unit: String(data.unit || "").trim(),
      quantity: central,
      central,
      stocks,
      cost: Number(data.cost) ?? 0,
      threshold: Number(data.threshold) ?? 0,
      category: String(data.category || "").trim(),
      lot: String(data.lot || "").trim(),
      notes: String(data.notes || "").trim(),
      barcode: data.barcode ? String(data.barcode).trim() : "",
      createdAt: now,
      updatedAt: now,
    });
    inventory.push(newItem);
    await writeInventory(inventory);
    return newItem;
  }

  async function remove(id) {
    const inventory = await readInventory();
    const index = inventory.findIndex((item) => String(item.id) === String(id));
    if (index === -1) return false;
    inventory.splice(index, 1);
    await writeInventory(inventory);
    return true;
  }

  async function adjustQuantity(id, delta) {
    const inventory = await readInventory();
    const index = inventory.findIndex((item) => String(item.id) === String(id));
    if (index === -1) return null;
    const item = inventory[index];
    const current = Number(item.central ?? item.quantity) || 0;
    const newQty = Math.max(0, current + delta);
    inventory[index] = normalizeItem({
      ...item,
      quantity: newQty,
      central: newQty,
      stock: newQty,
      updatedAt: new Date().toISOString(),
    });
    await writeInventory(inventory);
    return inventory[index];
  }

  async function transfer(productId, toDepartment, quantity, note, operator) {
    if (!DEPARTMENTS.includes(toDepartment)) {
      return { success: false, error: "Reparto non valido" };
    }
    const qty = Number(quantity) || 0;
    if (qty <= 0) return { success: false, error: "Quantità non valida" };

    const inventory = await readInventory();
    const index = inventory.findIndex((item) => String(item.id) === String(productId));
    if (index === -1) return { success: false, error: "Prodotto non trovato" };

    const item = inventory[index];
    const centralQty = Number(item.central ?? item.quantity) || 0;
    if (qty > centralQty) {
      return { success: false, error: `Quantità insufficiente. Disponibile: ${centralQty}` };
    }

    const stocks = { ...(item.stocks || {}) };
    stocks[toDepartment] = (Number(stocks[toDepartment]) || 0) + qty;
    const newCentral = centralQty - qty;

    inventory[index] = normalizeItem({
      ...item,
      quantity: newCentral,
      central: newCentral,
      stocks,
      updatedAt: new Date().toISOString(),
    });
    await writeInventory(inventory);

    return {
      success: true,
      item: inventory[index],
      transfer: {
        productId,
        productName: item.name,
        unit: item.unit,
        quantity: qty,
        from: "central",
        to: toDepartment,
        note: note || "",
        operator: operator || "",
      },
    };
  }

  async function load(productId, destinationWarehouse, quantity, options = {}) {
    const dest = String(destinationWarehouse || "").trim().toLowerCase();
    const validDestinations = ["central", ...DEPARTMENTS];
    if (!validDestinations.includes(dest)) {
      return { success: false, error: "Destinazione non valida. Usa: central, cucina, sala, bar, proprieta" };
    }
    const qty = Number(quantity) || 0;
    if (qty <= 0) return { success: false, error: "Quantità non valida" };

    const inventory = await readInventory();
    const index = inventory.findIndex((item) => String(item.id) === String(productId));
    if (index === -1) return { success: false, error: "Prodotto non trovato" };

    const item = inventory[index];
    const cost = options.unitCost != null ? Number(options.unitCost) : Number(item.cost) ?? 0;
    const lot = options.lot != null ? String(options.lot).trim() : item.lot || "";

    if (dest === "central") {
      const before = Number(item.central ?? item.quantity) || 0;
      const after = before + qty;
      inventory[index] = normalizeItem({
        ...item,
        quantity: after,
        central: after,
        stock: after,
        cost: cost > 0 ? cost : item.cost,
        lot: lot || item.lot,
        updatedAt: new Date().toISOString(),
      });
    } else {
      const stocks = { ...(item.stocks || {}) };
      const before = Number(stocks[dest]) || 0;
      stocks[dest] = before + qty;
      inventory[index] = normalizeItem({
        ...item,
        stocks,
        cost: cost > 0 ? cost : item.cost,
        lot: lot || item.lot,
        updatedAt: new Date().toISOString(),
      });
    }
    await writeInventory(inventory);

    const updated = inventory[index];
    const afterQty =
      dest === "central"
        ? Number(updated.central ?? updated.quantity) || 0
        : Number(updated.stocks && updated.stocks[dest]) || 0;

    return {
      success: true,
      item: updated,
      load: {
        productId: item.id,
        productName: item.name,
        unit: item.unit,
        quantity: qty,
        fromWarehouse: null,
        toWarehouse: dest,
        before:
          dest === "central"
            ? Number(item.central ?? item.quantity) || 0
            : Number(item.stocks && item.stocks[dest]) || 0,
        after: afterQty,
      },
    };
  }

  async function adjustLoadCorrection(productId, destinationWarehouse, deltaQty) {
    const dest = String(destinationWarehouse || "").trim().toLowerCase();
    const validDestinations = ["central", ...DEPARTMENTS];
    if (!validDestinations.includes(dest)) {
      return { success: false, error: "Destinazione non valida" };
    }
    const delta = Number(deltaQty);
    if (!Number.isFinite(delta) || delta === 0) {
      return { success: false, error: "Variazione quantità non valida" };
    }

    const inventory = await readInventory();
    const index = inventory.findIndex((item) => String(item.id) === String(productId));
    if (index === -1) return { success: false, error: "Prodotto non trovato" };

    const item = inventory[index];
    if (dest === "central") {
      const before = Number(item.central ?? item.quantity) || 0;
      const after = before + delta;
      if (after < 0) {
        return {
          success: false,
          error: `Quantità insufficiente in centrale per la rettifica. Disponibile: ${before}`,
        };
      }
      inventory[index] = normalizeItem({
        ...item,
        quantity: after,
        central: after,
        stock: after,
        updatedAt: new Date().toISOString(),
      });
    } else {
      const stocks = { ...(item.stocks || {}) };
      const before = Number(stocks[dest]) || 0;
      const after = before + delta;
      if (after < 0) {
        return {
          success: false,
          error: `Quantità insufficiente nel reparto per la rettifica. Disponibile: ${before}`,
        };
      }
      stocks[dest] = after;
      inventory[index] = normalizeItem({
        ...item,
        stocks,
        updatedAt: new Date().toISOString(),
      });
    }
    await writeInventory(inventory);
    return { success: true, item: inventory[index] };
  }

  async function returnToCentral(productId, fromDepartment, quantity, note, operator) {
    if (!DEPARTMENTS.includes(fromDepartment)) {
      return { success: false, error: "Reparto non valido" };
    }
    const qty = Number(quantity) || 0;
    if (qty <= 0) return { success: false, error: "Quantità non valida" };

    const inventory = await readInventory();
    const index = inventory.findIndex((item) => String(item.id) === String(productId));
    if (index === -1) return { success: false, error: "Prodotto non trovato" };

    const item = inventory[index];
    const stocks = { ...(item.stocks || {}) };
    const deptQty = Number(stocks[fromDepartment]) || 0;
    if (qty > deptQty) {
      return { success: false, error: `Quantità insufficiente nel reparto. Disponibile: ${deptQty}` };
    }

    const centralQty = Number(item.central ?? item.quantity) || 0;
    stocks[fromDepartment] = Math.max(0, deptQty - qty);
    const newCentral = centralQty + qty;

    inventory[index] = normalizeItem({
      ...item,
      quantity: newCentral,
      central: newCentral,
      stocks,
      updatedAt: new Date().toISOString(),
    });
    await writeInventory(inventory);

    return {
      success: true,
      item: inventory[index],
      return: {
        productId,
        productName: item.name,
        unit: item.unit,
        quantity: qty,
        from: fromDepartment,
        to: "central",
        note: note || "",
        operator: operator || "",
      },
    };
  }

  async function getTotalValue() {
    const items = await readInventory();
    let total = 0;
    for (const item of items) {
      const qty = Number(item.central ?? item.quantity) || 0;
      const cpu = getCostPerUnit(item);
      total += qty * cpu;
    }
    return Math.round(total * 100) / 100;
  }

  return {
    DEPARTMENTS,
    getTotalValue,
    getAll,
    getById,
    getByLocation,
    update,
    create,
    remove,
    adjustQuantity,
    load,
    adjustLoadCorrection,
    transfer,
    returnToCentral,
    readInventory,
    writeInventory,
    findInventoryItemByName,
    findInventoryItemByBarcode,
    getCostPerUnit,
    getStock,
    getDepartmentStock,
    getMinStock,
    deductInventoryItem,
    deductInventoryIngredients,
    deductFromDepartment,
  };
}

module.exports = {
  createInventoryApi,
  DEPARTMENTS,
  getCostPerUnit,
  getStock,
  getDepartmentStock,
  getMinStock,
};
