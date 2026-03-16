const inventoryRepository = require("../repositories/inventory.repository");
const inventoryTransfersRepository = require("../repositories/inventory-transfers.repository");
const stockMovementsRepository = require("../repositories/stock-movements.repository");
const tenantContext = require("../context/tenantContext");

// GET /api/inventory/value – total warehouse value (central stock × unit cost)
exports.getInventoryValue = async (req, res) => {
  const value = inventoryRepository.getTotalValue();
  res.json({ value, formatted: "€ " + value.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
};

// GET /api/inventory (query: ?location=central|cucina|sala|bar|proprieta)
exports.listInventory = async (req, res) => {
  const location = (req.query.location || "").toLowerCase();
  const validLocations = ["central", "cucina", "sala", "bar", "proprieta"];
  if (location && validLocations.includes(location)) {
    const data = inventoryRepository.getByLocation(location);
    return res.json(data);
  }
  const data = inventoryRepository.getAll();
  res.json(data);
};

// GET /api/inventory/transfers
exports.listTransfers = async (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 100));
  const data = inventoryTransfersRepository.getRecentTransfers(limit);
  res.json(data);
};

// GET /api/inventory/:id
exports.getInventoryById = async (req, res) => {
  const item = inventoryRepository.getById(req.params.id);
  if (!item) {
    return res.status(404).json({ error: "Prodotto magazzino non trovato" });
  }
  res.json(item);
};

// POST /api/inventory
exports.createInventory = async (req, res) => {
  const { name, unit, quantity, cost, threshold, category, lot, notes, barcode } = req.body || {};
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Nome obbligatorio" });
  }
  if (!unit || typeof unit !== "string") {
    return res.status(400).json({ error: "Unità obbligatoria" });
  }
  const item = inventoryRepository.create({
    name,
    unit,
    quantity,
    cost,
    threshold,
    category,
    lot,
    notes,
    barcode: barcode ? String(barcode).trim() : undefined,
  });
  res.status(201).json(item);
};

// PATCH /api/inventory/:id
exports.updateInventory = async (req, res) => {
  const item = inventoryRepository.update(req.params.id, req.body);
  if (!item) {
    return res.status(404).json({ error: "Prodotto magazzino non trovato" });
  }
  res.json(item);
};

// PATCH /api/inventory/:id/adjust
exports.adjustInventory = async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { delta } = req.body || {};
  if (!Number.isFinite(id)) {
    return res.status(400).json({ error: "ID non valido" });
  }
  const safeDelta = Number.isFinite(Number(delta)) ? Number(delta) : 0;
  const existing = inventoryRepository.getById(id);
  if (!existing) {
    return res.status(404).json({ error: "Prodotto non trovato" });
  }
  const currentQty = Number(existing.quantity) || 0;
  const newQty = currentQty + safeDelta;
  if (newQty < 0) {
    return res.status(400).json({
      error: "quantita_negativa",
      message: "La quantità non può essere inferiore a zero.",
    });
  }
  const item = inventoryRepository.adjustQuantity(id, safeDelta);
  res.json(item);
};

// POST /api/inventory/transfer
exports.transferInventory = async (req, res) => {
  const { productId, toDepartment, quantity, note, operator } = req.body || {};
  if (!productId) {
    return res.status(400).json({ error: "productId obbligatorio" });
  }
  if (!toDepartment || typeof toDepartment !== "string") {
    return res.status(400).json({ error: "toDepartment obbligatorio (cucina, sala, bar o proprieta)" });
  }
  const result = inventoryRepository.transfer(
    productId,
    toDepartment.trim().toLowerCase(),
    quantity,
    note || "",
    operator || ""
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  inventoryTransfersRepository.addTransfer({
    type: "transfer_to_department",
    productId: result.transfer.productId,
    productName: result.transfer.productName,
    unit: result.transfer.unit,
    quantity: result.transfer.quantity,
    from: result.transfer.from,
    to: result.transfer.to,
    note: result.transfer.note,
    operator: result.transfer.operator,
  });
  res.json({ success: true, item: result.item, transfer: result.transfer });
};

// POST /api/inventory/return
exports.returnToCentral = async (req, res) => {
  const { productId, fromDepartment, quantity, note, operator } = req.body || {};
  if (!productId) {
    return res.status(400).json({ error: "productId obbligatorio" });
  }
  if (!fromDepartment || typeof fromDepartment !== "string") {
    return res.status(400).json({ error: "fromDepartment obbligatorio (cucina, sala, bar o proprieta)" });
  }
  const result = inventoryRepository.returnToCentral(
    productId,
    fromDepartment.trim().toLowerCase(),
    quantity,
    note || "",
    operator || ""
  );
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  inventoryTransfersRepository.addTransfer({
    type: "return_to_central",
    productId: result.return.productId,
    productName: result.return.productName,
    unit: result.return.unit,
    quantity: result.return.quantity,
    from: result.return.from,
    to: result.return.to,
    note: result.return.note,
    operator: result.return.operator,
  });
  res.json({ success: true, item: result.item, return: result.return });
};

// DELETE /api/inventory/:id
exports.deleteInventory = async (req, res) => {
  const ok = inventoryRepository.remove(req.params.id);
  if (!ok) {
    return res.status(404).json({ error: "Prodotto magazzino non trovato" });
  }
  res.json({ success: true });
};

// =======================
//  RECEIVING (direct load)
// =======================

const VALID_DESTINATIONS = ["central", "cucina", "sala", "bar", "proprieta"];
const UNITS = ["kg", "lt", "g", "ml", "cl", "l", "unità", "pezzi", "pcs", "casse", "scatole"];

// GET /api/inventory/barcode/:code
exports.getByBarcode = async (req, res) => {
  const product = inventoryRepository.findInventoryItemByBarcode(req.params.code);
  if (!product) {
    return res.status(404).json({ error: "Barcode non trovato", found: false });
  }
  res.json(product);
};

// POST /api/inventory/receive – direct goods receiving
exports.receive = async (req, res) => {
  const body = req.body || {};
  const {
    productId,
    barcode,
    productName,
    quantity,
    unit,
    lot,
    unitCost,
    destinationWarehouse,
    receivedBy,
    supplier,
    notes,
    createIfUnknown,
  } = body;

  const dest = String(destinationWarehouse || "").trim().toLowerCase();
  if (!dest || !VALID_DESTINATIONS.includes(dest)) {
    return res.status(400).json({
      error: "destinationWarehouse obbligatorio (central, cucina, sala, bar, proprieta)",
    });
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return res.status(400).json({ error: "Quantità obbligatoria e deve essere > 0" });
  }

  const u = String(unit || "kg").trim().toLowerCase();
  if (!u) {
    return res.status(400).json({ error: "Unità obbligatoria" });
  }

  let product = null;
  if (productId) {
    product = inventoryRepository.getById(productId);
  }
  if (!product && barcode) {
    product = inventoryRepository.findInventoryItemByBarcode(barcode);
  }
  if (!product && productName && createIfUnknown === true) {
    const existing = inventoryRepository.findInventoryItemByName(productName);
    if (existing) {
      product = existing;
    } else {
      product = inventoryRepository.create({
        name: String(productName).trim(),
        unit: u,
        quantity: 0,
        cost: unitCost != null ? Number(unitCost) : 0,
        barcode: barcode ? String(barcode).trim() : undefined,
      });
    }
  }

  if (!product) {
    return res.status(400).json({
      error: "Prodotto non trovato. Fornire productId, barcode, oppure productName con createIfUnknown: true",
      hint: "Se il barcode non è registrato, usa createIfUnknown e productName per creare il prodotto",
    });
  }

  if (barcode && !product.barcode) {
    inventoryRepository.update(product.id, { barcode: String(barcode).trim() });
  }

  const result = inventoryRepository.load(product.id, dest, qty, {
    unitCost: unitCost != null ? Number(unitCost) : undefined,
    lot: lot ? String(lot).trim() : undefined,
  });

  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  const loadInfo = result.load;
  await stockMovementsRepository.createMovement({
    restaurantId: tenantContext.getRestaurantId(),
    type: "load",
    productId: product.id,
    productName: product.name,
    quantity: qty,
    unit: product.unit,
    before: loadInfo.before,
    after: loadInfo.after,
    fromWarehouse: null,
    toWarehouse: dest,
    sourceModule: "magazzino",
    reason: notes || "Ricezione merce",
    receivedBy: receivedBy || req.session?.user?.username || null,
    barcode: barcode || null,
    lot: lot || null,
    unitCost: unitCost != null ? Number(unitCost) : null,
  });

  inventoryTransfersRepository.addTransfer({
    type: "load",
    productId: product.id,
    productName: product.name,
    unit: product.unit,
    quantity: qty,
    from: null,
    to: dest,
    note: notes || "Ricezione merce",
    operator: receivedBy || req.session?.user?.username || "",
  });

  res.status(201).json({
    success: true,
    movement: { type: "load", ...loadInfo },
    item: result.item,
  });
};

// POST /api/inventory/receive/voice-preview – parse voice, return preview (no save)
exports.voicePreview = async (req, res) => {
  const { transcript } = req.body || {};
  const text = String(transcript || "").trim().toLowerCase();
  if (!text) {
    return res.json({
      parsed: false,
      hint: "Invia transcript con testo dettato",
      preview: null,
    });
  }

  const preview = parseVoiceReceiving(text);
  res.json({
    parsed: preview.parsed,
    preview: preview.parsed ? preview : null,
    raw: text,
  });
};

function parseVoiceReceiving(text) {
  const t = text.replace(/\s+/g, " ").trim();
  let productName = "";
  let quantity = null;
  let unit = "kg";
  let destination = "cucina";

  const qtyMatch = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|lt|litri?|litro|g|ml|cl|l|unita|unità|pezzi?|pz|casse?|scatole?)/i);
  if (qtyMatch) {
    quantity = parseFloat(qtyMatch[1].replace(",", "."));
    const u = qtyMatch[2].toLowerCase();
    if (["lt", "litri", "litro", "l"].includes(u)) unit = "lt";
    else if (["g", "gr"].includes(u)) unit = "g";
    else if (["ml", "cl"].includes(u)) unit = u;
    else if (["unita", "unità", "pezzi", "pezzo", "pz", "pcs"].includes(u)) unit = "unità";
    else if (["casse", "cassa"].includes(u)) unit = "casse";
    else if (["scatole", "scatola"].includes(u)) unit = "scatole";
    else unit = "kg";
  } else {
    const simpleQty = t.match(/(\d+(?:[.,]\d+)?)/);
    if (simpleQty) quantity = parseFloat(simpleQty[1].replace(",", "."));
  }

  if (t.includes("in cucina") || t.includes("alla cucina") || t.includes("cucina")) destination = "cucina";
  else if (t.includes("centrale") || t.includes("magazzino") || t.includes("centro")) destination = "central";
  else if (t.includes("al bar") || t.includes("nel bar") || t.includes("bar")) destination = "bar";
  else if (t.includes("in sala") || t.includes("alla sala") || t.includes("sala")) destination = "sala";

  const verbs = ["aggiungi", "carica", "ricevuto", "ricevuti", "caricare", "aggiungere", "mettere", "inserire"];
  let remainder = t;
  for (const v of verbs) {
    remainder = remainder.replace(new RegExp(v + "\\s*", "gi"), "").trim();
  }
  remainder = remainder.replace(/^(il |la |lo |i |le |gli |un |una |uno )/gi, "");
  remainder = remainder.replace(/\s*(in|nel|alla|al|in)\s+(cucina|centrale|magazzino|bar|sala)[^.]*/gi, "").trim();
  remainder = remainder.replace(/\s*\d+(?:[.,]\d+)?\s*(kg|lt|litri?|g|ml|cl|l|unita|unità|pezzi?|pz|casse?|scatole?)\s*/gi, "").trim();
  if (remainder.length > 1) productName = remainder;

  return {
    parsed: !!(productName && quantity && quantity > 0),
    productName: productName || null,
    quantity: quantity,
    unit,
    destinationWarehouse: destination,
  };
}
