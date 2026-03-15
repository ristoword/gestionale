// backend/src/repositories/catering-presets.repository.js
// Preset catering menus – templates never modified when used for events.

const { v4: uuid } = require("uuid");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

const SECTION_TYPES = [
  "buffet",
  "antipasti",
  "primo",
  "secondo",
  "dessert",
  "bevande",
  "custom",
];

const ITEM_MODES = ["detailed", "priced"];
const ITEM_UNITS = ["g", "kg", "ml", "cl", "l", "pcs"];

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "catering-presets.json");
}

function readAll() {
  const data = safeReadJson(getDataPath(), { presets: [] });
  const list = Array.isArray(data) ? data : (data.presets || []);
  return list.map(normalizePreset);
}

function writeAll(presets) {
  atomicWriteJson(getDataPath(), { presets });
}

function normalizeSection(s) {
  const items = Array.isArray(s.items) ? s.items.map(normalizeItem) : [];
  return {
    id: s.id || uuid(),
    name: String(s.name || "").trim() || "Sezione",
    type: SECTION_TYPES.includes(s.type) ? s.type : "custom",
    items,
  };
}

function normalizeItem(i) {
  const mode = ITEM_MODES.includes(i.mode) ? i.mode : "priced";
  return {
    id: i.id || uuid(),
    name: String(i.name || "").trim() || "Voce",
    mode,
    quantityPerPerson: mode === "detailed" ? Number(i.quantityPerPerson) || 0 : null,
    unit: mode === "detailed" && ITEM_UNITS.includes(i.unit) ? i.unit : null,
    pricePerPerson: mode === "priced" ? Number(i.pricePerPerson) || 0 : null,
    fixedPrice: mode === "priced" ? Number(i.fixedPrice) || 0 : null,
    recipeId: i.recipeId || null,
    notes: String(i.notes || "").trim(),
  };
}

function normalizePreset(p) {
  const sections = Array.isArray(p.sections) ? p.sections.map(normalizeSection) : [];
  return {
    id: p.id || uuid(),
    restaurantId: p.restaurantId || tenantContext.getRestaurantId(),
    name: String(p.name || "").trim() || "Preset",
    description: String(p.description || "").trim(),
    defaultPricePerPerson: Number(p.defaultPricePerPerson) || 0,
    sections,
    notes: String(p.notes || "").trim(),
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  };
}

function validatePreset(data) {
  const errs = [];
  const sections = Array.isArray(data.sections) ? data.sections : [];
  if (sections.length < 1) {
    errs.push("Il preset deve avere almeno 1 sezione");
  }
  sections.forEach((s, idx) => {
    const items = Array.isArray(s.items) ? s.items : [];
    items.forEach((it, jdx) => {
      const mode = it.mode || "priced";
      if (mode === "detailed") {
        const qty = Number(it.quantityPerPerson);
        if (!Number.isFinite(qty) || qty <= 0) {
          errs.push(`Sezione "${s.name}" – voce ${jdx + 1}: quantità per persona obbligatoria`);
        }
        if (!it.unit) {
          errs.push(`Sezione "${s.name}" – voce ${jdx + 1}: unità obbligatoria`);
        }
      } else {
        const pp = Number(it.pricePerPerson) || 0;
        const fp = Number(it.fixedPrice) || 0;
        if (pp <= 0 && fp <= 0) {
          errs.push(`Sezione "${s.name}" – voce ${jdx + 1}: inserire prezzo per persona o prezzo fisso`);
        }
      }
    });
  });
  return errs;
}

async function getAll() {
  return readAll();
}

async function getById(id) {
  const list = readAll();
  return list.find((p) => p.id === id) || null;
}

async function create(data) {
  const preset = normalizePreset({
    ...data,
    id: data.id || uuid(),
  });
  const errs = validatePreset(preset);
  if (errs.length > 0) {
    const err = new Error(errs.join("; "));
    err.validationErrors = errs;
    throw err;
  }
  const list = readAll();
  preset.createdAt = new Date().toISOString();
  preset.updatedAt = preset.createdAt;
  list.push(preset);
  writeAll(list);
  return preset;
}

async function update(id, data) {
  const list = readAll();
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const existing = list[index];
  const sections = Array.isArray(data.sections)
    ? data.sections.map(normalizeSection)
    : existing.sections;
  const preset = normalizePreset({
    ...existing,
    ...data,
    id: existing.id,
    sections,
    updatedAt: new Date().toISOString(),
  });
  const errs = validatePreset(preset);
  if (errs.length > 0) {
    const err = new Error(errs.join("; "));
    err.validationErrors = errs;
    throw err;
  }
  list[index] = preset;
  writeAll(list);
  return preset;
}

async function remove(id) {
  const list = readAll();
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  writeAll(list);
  return true;
}

module.exports = {
  SECTION_TYPES,
  ITEM_MODES,
  ITEM_UNITS,
  getAll,
  getById,
  create,
  update,
  remove,
  normalizePreset,
  normalizeSection,
  normalizeItem,
};
