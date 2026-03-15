// backend/src/repositories/catering.repository.js
// Catering events – editable copies when from preset. Supports legacy format migration.

const { v4: uuid } = require("uuid");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");
const cateringPresetsRepository = require("./catering-presets.repository");

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "catering-events.json");
}

function readRaw() {
  const data = safeReadJson(getDataPath(), []);
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.events)) return data.events;
  return [];
}

function writeAll(events) {
  atomicWriteJson(getDataPath(), events);
}

function isLegacyEvent(e) {
  return e && !e.sections && (e.customer != null || e.people != null || e.price != null);
}

function migrateLegacyToFull(legacy) {
  return {
    id: legacy.id || uuid(),
    restaurantId: tenantContext.getRestaurantId(),
    title: String(legacy.customer || "").trim() || "Evento",
    eventName: String(legacy.customer || "").trim() || "Evento",
    clientName: String(legacy.customer || "").trim() || "",
    eventDate: legacy.date || "",
    guestCount: Number(legacy.people) || 0,
    menuType: "custom",
    presetMenuId: null,
    sections: [],
    notes: String(legacy.note || "").trim(),
    pricePerPerson: legacy.price && legacy.people ? Number(legacy.price) / Number(legacy.people) : 0,
    totalEstimatedPrice: Number(legacy.price) || 0,
    status: "draft",
    createdAt: legacy.createdAt || new Date().toISOString(),
    updatedAt: legacy.updatedAt || new Date().toISOString(),
    // legacy fields kept for backward compat
    customer: legacy.customer,
    date: legacy.date,
    people: legacy.people,
    price: legacy.price,
    note: legacy.note,
  };
}

function deepCopySections(sections) {
  return (sections || []).map((s) => ({
    id: uuid(),
    name: String(s.name || "").trim() || "Sezione",
    type: cateringPresetsRepository.SECTION_TYPES.includes(s.type) ? s.type : "custom",
    items: (s.items || []).map((i) => ({
      id: uuid(),
      name: String(i.name || "").trim() || "Voce",
      mode: cateringPresetsRepository.ITEM_MODES.includes(i.mode) ? i.mode : "priced",
      quantityPerPerson: i.mode === "detailed" ? Number(i.quantityPerPerson) || 0 : null,
      unit: i.mode === "detailed" ? (i.unit || "g") : null,
      pricePerPerson: i.mode === "priced" ? Number(i.pricePerPerson) || 0 : null,
      fixedPrice: i.mode === "priced" ? Number(i.fixedPrice) || 0 : null,
      recipeId: i.recipeId || null,
      notes: String(i.notes || "").trim(),
    })),
  }));
}

function normalizeEvent(e) {
  if (isLegacyEvent(e)) return migrateLegacyToFull(e);
  const sections = Array.isArray(e.sections)
    ? e.sections.map((s) => ({
        id: s.id || uuid(),
        name: String(s.name || "").trim() || "Sezione",
        type: cateringPresetsRepository.SECTION_TYPES.includes(s.type) ? s.type : "custom",
        items: (s.items || []).map((i) => ({
          id: i.id || uuid(),
          name: String(i.name || "").trim() || "Voce",
          mode: cateringPresetsRepository.ITEM_MODES.includes(i.mode) ? i.mode : "priced",
          quantityPerPerson: i.mode === "detailed" ? Number(i.quantityPerPerson) || 0 : null,
          unit: i.mode === "detailed" ? (i.unit || "g") : null,
          pricePerPerson: i.mode === "priced" ? Number(i.pricePerPerson) || 0 : null,
          fixedPrice: i.mode === "priced" ? Number(i.fixedPrice) || 0 : null,
          recipeId: i.recipeId || null,
          notes: String(i.notes || "").trim(),
        })),
      }))
    : [];
  return {
    id: e.id || uuid(),
    restaurantId: e.restaurantId || tenantContext.getRestaurantId(),
    title: String(e.title || e.eventName || "").trim() || "Evento",
    eventName: String(e.eventName || e.title || "").trim() || "Evento",
    clientName: String(e.clientName || e.customer || "").trim(),
    eventDate: e.eventDate || e.date || "",
    guestCount: Number(e.guestCount ?? e.people) || 0,
    menuType: String(e.menuType || "custom").trim(),
    presetMenuId: e.presetMenuId || null,
    sections,
    notes: String(e.notes || e.note || "").trim(),
    pricePerPerson: Number(e.pricePerPerson) || 0,
    totalEstimatedPrice: Number(e.totalEstimatedPrice) || 0,
    status: String(e.status || "draft").trim(),
    createdAt: e.createdAt || new Date().toISOString(),
    updatedAt: e.updatedAt || new Date().toISOString(),
    customer: e.clientName || e.customer,
    date: e.eventDate || e.date,
    people: e.guestCount ?? e.people,
    price: e.totalEstimatedPrice ?? e.price,
    note: e.notes || e.note,
  };
}

function validateEvent(data) {
  const errs = [];
  const sections = Array.isArray(data.sections) ? data.sections : [];
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
          errs.push(`Sezione "${s.name}" – voce ${jdx + 1}: prezzo per persona o prezzo fisso obbligatorio`);
        }
      }
    });
  });
  return errs;
}

function recalcEventTotals(event) {
  const sections = event.sections || [];
  let totalFromItems = 0;
  const guestCount = Number(event.guestCount) || Number(event.people) || 0;

  for (const s of sections) {
    for (const it of s.items || []) {
      if (it.mode === "priced") {
        const pp = Number(it.pricePerPerson) || 0;
        const fp = Number(it.fixedPrice) || 0;
        if (pp > 0) totalFromItems += pp * guestCount;
        else if (fp > 0) totalFromItems += fp;
      }
    }
  }

  const pricePerPerson = guestCount > 0 && totalFromItems > 0 ? totalFromItems / guestCount : event.pricePerPerson || 0;
  return {
    ...event,
    totalEstimatedPrice: totalFromItems > 0 ? totalFromItems : event.totalEstimatedPrice,
    pricePerPerson: pricePerPerson || event.pricePerPerson,
  };
}

async function getAll() {
  const raw = readRaw();
  return raw.map(normalizeEvent);
}

async function getById(id) {
  const list = await getAll();
  return list.find((e) => e.id === id) || null;
}

async function create(data) {
  const event = normalizeEvent({ ...data, id: data.id || uuid() });
  const sections = event.sections || [];
  if (sections.length > 0) {
    const errs = validateEvent(event);
    if (errs.length > 0) {
      const err = new Error(errs.join("; "));
      err.validationErrors = errs;
      throw err;
    }
  }
  const list = readRaw().map(normalizeEvent);
  event.createdAt = new Date().toISOString();
  event.updatedAt = event.createdAt;
  list.push(event);
  writeAll(list);
  return event;
}

async function update(id, data) {
  const list = readRaw().map(normalizeEvent);
  const index = list.findIndex((e) => e.id === id);
  if (index === -1) return null;

  const existing = list[index];
  const sections = Array.isArray(data.sections) ? data.sections : existing.sections;
  const event = normalizeEvent({
    ...existing,
    ...data,
    id: existing.id,
    sections,
    updatedAt: new Date().toISOString(),
  });

  if (sections.length > 0) {
    const errs = validateEvent(event);
    if (errs.length > 0) {
      const err = new Error(errs.join("; "));
      err.validationErrors = errs;
      throw err;
    }
  }

  const final = recalcEventTotals(event);
  list[index] = final;
  writeAll(list);
  return final;
}

async function remove(id) {
  const list = readRaw();
  const index = list.findIndex((e) => (e.id || e).toString?.() === id || e.id === id);
  if (index === -1) return false;
  list.splice(index, 1);
  writeAll(list);
  return true;
}

async function createFromPreset(presetId, overrides = {}) {
  const preset = await cateringPresetsRepository.getById(presetId);
  if (!preset) return null;

  const sections = deepCopySections(preset.sections);
  const event = normalizeEvent({
    id: uuid(),
    restaurantId: tenantContext.getRestaurantId(),
    title: overrides.title || preset.name,
    eventName: overrides.eventName || preset.name,
    clientName: overrides.clientName || "",
    eventDate: overrides.eventDate || "",
    guestCount: Number(overrides.guestCount) || 0,
    menuType: "preset",
    presetMenuId: preset.id,
    sections,
    notes: overrides.notes || preset.notes,
    pricePerPerson: Number(overrides.pricePerPerson) || preset.defaultPricePerPerson || 0,
    totalEstimatedPrice: 0,
    status: "draft",
    ...overrides,
  });

  const final = recalcEventTotals(event);
  const list = readRaw().map(normalizeEvent);
  list.push(final);
  writeAll(list);
  return final;
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  createFromPreset,
  normalizeEvent,
  recalcEventTotals,
};
