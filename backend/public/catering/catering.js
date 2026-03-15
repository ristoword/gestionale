// catering.js – Menu Builder, Presets, Events, Print/PDF

const API = "/api/catering";
const PRESETS_API = "/api/catering/presets";
const EVENTS_API = "/api/catering/events";

const SECTION_TYPES = [
  { value: "buffet", label: "Buffet" },
  { value: "antipasti", label: "Antipasti" },
  { value: "primo", label: "Primo" },
  { value: "secondo", label: "Secondo" },
  { value: "dessert", label: "Dessert" },
  { value: "bevande", label: "Bevande" },
  { value: "custom", label: "Altro" },
];
const ITEM_MODES = [
  { value: "detailed", label: "Grammature" },
  { value: "priced", label: "Prezzo" },
];
const ITEM_UNITS = ["g", "kg", "ml", "cl", "l", "pcs"];

let presets = [];
let events = [];
let currentEvent = null;

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      try { localStorage.removeItem("rw_auth"); } catch (_) {}
      window.location.href = "/login/login.html?return=" + encodeURIComponent(location.pathname);
      return;
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function escapeHtml(s) {
  if (s == null) return "";
  const d = document.createElement("div");
  d.textContent = String(s);
  return d.innerHTML;
}

// --- VIEW SWITCHER ---
function showView(viewName) {
  document.querySelectorAll(".cat-nav .nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.view === viewName);
  });
  document.querySelectorAll("main .view").forEach((v) => {
    v.classList.toggle("active-view", v.id === "view-" + viewName);
  });
  if (viewName === "presets") loadPresetsAndRender();
  if (viewName === "events") loadEventsAndRender();
}

// --- PRESETS ---
function addPresetSection(container, data = {}) {
  const div = document.createElement("div");
  div.className = "cat-section";
  div.dataset.sectionId = data.id || "s_" + Date.now();
  const typeOpts = SECTION_TYPES.map((t) => `<option value="${t.value}" ${(data.type || "custom") === t.value ? "selected" : ""}>${escapeHtml(t.label)}</option>`).join("");
  div.innerHTML = `
    <div class="cat-section-header">
      <input type="text" class="section-name" placeholder="Nome sezione" value="${escapeHtml(data.name || "")}" />
      <select class="section-type">${typeOpts}</select>
      <button type="button" class="btn-xs danger section-remove">Elimina</button>
    </div>
    <div class="section-items"></div>
    <button type="button" class="btn ghost btn-sm add-item">+ Aggiungi voce</button>
  `;
  const itemsContainer = div.querySelector(".section-items");
  (data.items || []).forEach((it) => addPresetItemRow(itemsContainer, it));
  if ((data.items || []).length === 0) addPresetItemRow(itemsContainer);

  div.querySelector(".section-remove").addEventListener("click", () => div.remove());
  div.querySelector(".add-item").addEventListener("click", () => addPresetItemRow(itemsContainer));

  container.appendChild(div);
  return div;
}

function addPresetItemRow(container, data = {}) {
  const row = document.createElement("div");
  row.className = "cat-item-row";
  const modeOpts = ITEM_MODES.map((m) => `<option value="${m.value}" ${(data.mode || "priced") === m.value ? "selected" : ""}>${escapeHtml(m.label)}</option>`).join("");
  const unitOpts = ITEM_UNITS.map((u) => `<option value="${u}" ${(data.unit || "g") === u ? "selected" : ""}>${u}</option>`).join("");
  row.innerHTML = `
    <input type="text" class="item-name" placeholder="Nome piatto" value="${escapeHtml(data.name || "")}" />
    <select class="item-mode">${modeOpts}</select>
    <span class="item-detail">
      <input type="number" class="item-qty" step="0.01" min="0" placeholder="Qty/pax" value="${data.mode === "detailed" ? (data.quantityPerPerson ?? "") : ""}" />
      <select class="item-unit">${unitOpts}</select>
    </span>
    <span class="item-price-fields">
      <input type="number" class="item-price-pp" step="0.01" min="0" placeholder="€/pax" value="${data.mode === "priced" ? (data.pricePerPerson ?? "") : ""}" />
      <input type="number" class="item-price-fixed" step="0.01" min="0" placeholder="€ fisso" value="${data.mode === "priced" ? (data.fixedPrice ?? "") : ""}" style="width:70px;" />
    </span>
    <input type="text" class="item-notes" placeholder="Note" value="${escapeHtml(data.notes || "")}" style="width:100px;" />
    <button type="button" class="item-remove">✕</button>
  `;
  const modeSel = row.querySelector(".item-mode");
  const detailSpan = row.querySelector(".item-detail");
  const priceSpan = row.querySelector(".item-price-fields");
  function toggleMode() {
    const isDetail = modeSel.value === "detailed";
    detailSpan.style.display = isDetail ? "inline-flex" : "none";
    priceSpan.style.display = !isDetail ? "inline-flex" : "none";
  }
  modeSel.addEventListener("change", toggleMode);
  toggleMode();

  row.querySelector(".item-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function collectPresetData() {
  const sections = [];
  document.querySelectorAll("#preset-sections-list .cat-section").forEach((sec) => {
    const items = [];
    sec.querySelectorAll(".section-items .cat-item-row").forEach((r) => {
      const name = r.querySelector(".item-name")?.value?.trim();
      if (!name) return;
      const mode = r.querySelector(".item-mode")?.value || "priced";
      const item = { name, mode };
      if (mode === "detailed") {
        const qty = parseFloat(r.querySelector(".item-qty")?.value);
        const unit = r.querySelector(".item-unit")?.value || "g";
        if (Number.isFinite(qty) && qty > 0) {
          item.quantityPerPerson = qty;
          item.unit = unit;
        } else return;
      } else {
        const pp = parseFloat(r.querySelector(".item-price-pp")?.value);
        const fp = parseFloat(r.querySelector(".item-price-fixed")?.value);
        if (Number.isFinite(pp) && pp > 0) item.pricePerPerson = pp;
        else if (Number.isFinite(fp) && fp > 0) item.fixedPrice = fp;
        else return;
      }
      const notes = r.querySelector(".item-notes")?.value?.trim();
      if (notes) item.notes = notes;
      items.push(item);
    });
    const secName = sec.querySelector(".section-name")?.value?.trim() || "Sezione";
    const secType = sec.querySelector(".section-type")?.value || "custom";
    if (items.length > 0) sections.push({ name: secName, type: secType, items });
  });
  return sections;
}

function clearPresetForm() {
  document.getElementById("preset-id").value = "";
  document.getElementById("preset-form-title").textContent = "Nuovo preset";
  document.getElementById("preset-name").value = "";
  document.getElementById("preset-description").value = "";
  document.getElementById("preset-default-price").value = "";
  document.getElementById("preset-notes").value = "";
  const list = document.getElementById("preset-sections-list");
  list.innerHTML = "";
  addPresetSection(list);
}

function loadPresetIntoForm(p) {
  document.getElementById("preset-id").value = p.id || "";
  document.getElementById("preset-form-title").textContent = "Modifica preset";
  document.getElementById("preset-name").value = p.name || "";
  document.getElementById("preset-description").value = p.description || "";
  document.getElementById("preset-default-price").value = p.defaultPricePerPerson ?? "";
  document.getElementById("preset-notes").value = p.notes || "";
  const list = document.getElementById("preset-sections-list");
  list.innerHTML = "";
  (p.sections || []).forEach((s) => addPresetSection(list, s));
  if ((p.sections || []).length === 0) addPresetSection(list);
}

function renderPresetsList() {
  const container = document.getElementById("presets-list");
  if (!container) return;
  if (!presets.length) {
    container.innerHTML = '<div class="preset-empty">Nessun preset. Creane uno dal form.</div>';
    return;
  }
  container.innerHTML = presets.map((p) => `
    <div class="preset-item" data-id="${p.id}">
      <div class="preset-item-info">
        <strong>${escapeHtml(p.name)}</strong>
        ${p.description ? `<br><small>${escapeHtml(p.description)}</small>` : ""}
        <br><small>${(p.sections || []).length} sezioni</small>
      </div>
      <div class="preset-item-actions">
        <button data-action="use" data-id="${p.id}">Usa</button>
        <button data-action="edit" data-id="${p.id}">Modifica</button>
        <button data-action="duplicate" data-id="${p.id}">Duplica</button>
        <button class="danger" data-action="delete" data-id="${p.id}">Elimina</button>
      </div>
    </div>
  `).join("");

  container.querySelectorAll("[data-action]").forEach((btn) => {
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const p = presets.find((x) => x.id === id);
    if (!p) return;
    btn.addEventListener("click", () => {
      if (action === "edit") loadPresetIntoForm(p);
      if (action === "duplicate") duplicatePreset(p);
      if (action === "delete") deletePreset(id);
      if (action === "use") usePresetForEvent(p);
    });
  });
}

async function loadPresetsAndRender() {
  try {
    presets = await fetchJSON(PRESETS_API);
    if (!Array.isArray(presets)) presets = [];
    renderPresetsList();
    const sel = document.getElementById("select-preset-for-event");
    if (sel) {
      sel.innerHTML = '<option value="">Usa preset...</option>' + presets.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join("");
    }
  } catch (err) {
    console.error(err);
    document.getElementById("presets-list").innerHTML = '<div class="preset-empty" style="color:var(--accent-danger);">Errore caricamento preset.</div>';
  }
}

async function savePreset() {
  const id = document.getElementById("preset-id").value;
  const name = document.getElementById("preset-name").value?.trim();
  const sections = collectPresetData();
  if (!name) {
    alert("Inserisci il nome del preset.");
    return;
  }
  if (sections.length < 1) {
    alert("Aggiungi almeno una sezione con almeno una voce.");
    return;
  }
  const payload = {
    name,
    description: document.getElementById("preset-description").value?.trim(),
    defaultPricePerPerson: parseFloat(document.getElementById("preset-default-price").value) || 0,
    notes: document.getElementById("preset-notes").value?.trim(),
    sections,
  };
  try {
    if (id) {
      await fetchJSON(`${PRESETS_API}/${id}`, { method: "PATCH", body: JSON.stringify(payload) });
    } else {
      await fetchJSON(PRESETS_API, { method: "POST", body: JSON.stringify(payload) });
    }
    clearPresetForm();
    await loadPresetsAndRender();
  } catch (err) {
    alert("Errore salvataggio: " + err.message);
  }
}

async function duplicatePreset(p) {
  const payload = {
    name: (p.name || "") + " (copia)",
    description: p.description,
    defaultPricePerPerson: p.defaultPricePerPerson,
    notes: p.notes,
    sections: (p.sections || []).map((s) => ({
      name: s.name,
      type: s.type,
      items: (s.items || []).map((i) => ({ ...i })),
    })),
  };
  try {
    await fetchJSON(PRESETS_API, { method: "POST", body: JSON.stringify(payload) });
    await loadPresetsAndRender();
  } catch (err) {
    alert("Errore duplicazione: " + err.message);
  }
}

async function deletePreset(id) {
  if (!confirm("Eliminare questo preset?")) return;
  try {
    await fetchJSON(`${PRESETS_API}/${id}`, { method: "DELETE" });
    presets = presets.filter((x) => x.id !== id);
    renderPresetsList();
    clearPresetForm();
  } catch (err) {
    alert("Errore eliminazione: " + err.message);
  }
}

function usePresetForEvent(p) {
  showView("builder");
  createEventFromPreset(p.id);
}

// --- EVENTS ---
function addEventSection(container, data = {}) {
  const div = document.createElement("div");
  div.className = "cat-section";
  div.dataset.sectionId = data.id || "es_" + Date.now();
  const typeOpts = SECTION_TYPES.map((t) => `<option value="${t.value}" ${(data.type || "custom") === t.value ? "selected" : ""}>${escapeHtml(t.label)}</option>`).join("");
  div.innerHTML = `
    <div class="cat-section-header">
      <input type="text" class="section-name" placeholder="Nome sezione" value="${escapeHtml(data.name || "")}" />
      <select class="section-type">${typeOpts}</select>
      <button type="button" class="btn-xs danger section-remove">Elimina</button>
    </div>
    <div class="section-items"></div>
    <button type="button" class="btn ghost btn-sm add-item">+ Aggiungi voce</button>
  `;
  const itemsContainer = div.querySelector(".section-items");
  (data.items || []).forEach((it) => addEventItemRow(itemsContainer, it));
  if ((data.items || []).length === 0) addEventItemRow(itemsContainer);

  div.querySelector(".section-remove").addEventListener("click", () => div.remove());
  div.querySelector(".add-item").addEventListener("click", () => addEventItemRow(itemsContainer));

  container.appendChild(div);
}

function addEventItemRow(container, data = {}) {
  const row = document.createElement("div");
  row.className = "cat-item-row";
  const modeOpts = ITEM_MODES.map((m) => `<option value="${m.value}" ${(data.mode || "priced") === m.value ? "selected" : ""}>${escapeHtml(m.label)}</option>`).join("");
  const unitOpts = ITEM_UNITS.map((u) => `<option value="${u}" ${(data.unit || "g") === u ? "selected" : ""}>${u}</option>`).join("");
  row.innerHTML = `
    <input type="text" class="item-name" placeholder="Nome piatto" value="${escapeHtml(data.name || "")}" />
    <select class="item-mode">${modeOpts}</select>
    <span class="item-detail">
      <input type="number" class="item-qty" step="0.01" min="0" placeholder="Qty/pax" value="${data.mode === "detailed" ? (data.quantityPerPerson ?? "") : ""}" />
      <select class="item-unit">${unitOpts}</select>
    </span>
    <span class="item-price-fields">
      <input type="number" class="item-price-pp" step="0.01" min="0" placeholder="€/pax" value="${data.mode === "priced" ? (data.pricePerPerson ?? "") : ""}" />
      <input type="number" class="item-price-fixed" step="0.01" min="0" placeholder="€ fisso" value="${data.mode === "priced" ? (data.fixedPrice ?? "") : ""}" style="width:70px;" />
    </span>
    <input type="text" class="item-notes" placeholder="Note" value="${escapeHtml(data.notes || "")}" style="width:100px;" />
    <button type="button" class="item-remove">✕</button>
  `;
  const modeSel = row.querySelector(".item-mode");
  const detailSpan = row.querySelector(".item-detail");
  const priceSpan = row.querySelector(".item-price-fields");
  function toggleMode() {
    const isDetail = modeSel.value === "detailed";
    detailSpan.style.display = isDetail ? "inline-flex" : "none";
    priceSpan.style.display = !isDetail ? "inline-flex" : "none";
  }
  modeSel.addEventListener("change", toggleMode);
  toggleMode();

  row.querySelector(".item-remove").addEventListener("click", () => row.remove());
  container.appendChild(row);
}

function collectEventSections() {
  const sections = [];
  document.querySelectorAll("#event-sections-list .cat-section").forEach((sec) => {
    const items = [];
    sec.querySelectorAll(".section-items .cat-item-row").forEach((r) => {
      const name = r.querySelector(".item-name")?.value?.trim();
      if (!name) return;
      const mode = r.querySelector(".item-mode")?.value || "priced";
      const item = { name, mode };
      if (mode === "detailed") {
        const qty = parseFloat(r.querySelector(".item-qty")?.value);
        const unit = r.querySelector(".item-unit")?.value || "g";
        if (Number.isFinite(qty) && qty > 0) {
          item.quantityPerPerson = qty;
          item.unit = unit;
        } else return;
      } else {
        const pp = parseFloat(r.querySelector(".item-price-pp")?.value);
        const fp = parseFloat(r.querySelector(".item-price-fixed")?.value);
        if (Number.isFinite(pp) && pp > 0) item.pricePerPerson = pp;
        else if (Number.isFinite(fp) && fp > 0) item.fixedPrice = fp;
        else return;
      }
      const notes = r.querySelector(".item-notes")?.value?.trim();
      if (notes) item.notes = notes;
      items.push(item);
    });
    const secName = sec.querySelector(".section-name")?.value?.trim() || "Sezione";
    const secType = sec.querySelector(".section-type")?.value || "custom";
    sections.push({ name: secName, type: secType, items });
  });
  return sections;
}

function loadEventIntoBuilder(ev) {
  currentEvent = ev;
  document.getElementById("event-title").value = ev.title || ev.eventName || "";
  document.getElementById("event-client").value = ev.clientName || ev.customer || "";
  document.getElementById("event-date").value = (ev.eventDate || ev.date || "").slice(0, 10);
  document.getElementById("event-guests").value = ev.guestCount ?? ev.people ?? 50;
  document.getElementById("event-price-pp").value = ev.pricePerPerson ?? "";
  document.getElementById("event-notes").value = ev.notes || ev.note || "";

  const list = document.getElementById("event-sections-list");
  list.innerHTML = "";
  (ev.sections || []).forEach((s) => addEventSection(list, s));
  if ((ev.sections || []).length === 0) addEventSection(list);

  document.getElementById("event-sections-wrapper").style.display = "block";
}

function clearEventBuilder() {
  currentEvent = null;
  document.getElementById("event-title").value = "";
  document.getElementById("event-client").value = "";
  document.getElementById("event-date").value = "";
  document.getElementById("event-guests").value = 50;
  document.getElementById("event-price-pp").value = "";
  document.getElementById("event-notes").value = "";
  document.getElementById("event-sections-list").innerHTML = "";
  document.getElementById("event-sections-wrapper").style.display = "none";
}

async function createNewCustomEvent() {
  clearEventBuilder();
  currentEvent = { sections: [] };
  addEventSection(document.getElementById("event-sections-list"));
  document.getElementById("event-sections-wrapper").style.display = "block";
  showView("builder");
}

async function createEventFromPreset(presetId) {
  const sel = document.getElementById("select-preset-for-event");
  const id = presetId || (sel && sel.value);
  if (!id) {
    alert("Seleziona un preset.");
    return;
  }
  try {
    const ev = await fetchJSON(`${EVENTS_API}/from-preset/${id}`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    currentEvent = ev;
    loadEventIntoBuilder(ev);
    showView("builder");
  } catch (err) {
    alert("Errore: " + err.message);
  }
}

async function saveEvent() {
  const title = document.getElementById("event-title").value?.trim();
  const client = document.getElementById("event-client").value?.trim();
  const sections = collectEventSections();

  const payload = {
    title: title || "Evento",
    eventName: title || "Evento",
    clientName: client,
    eventDate: document.getElementById("event-date").value || "",
    guestCount: parseInt(document.getElementById("event-guests").value, 10) || 0,
    pricePerPerson: parseFloat(document.getElementById("event-price-pp").value) || 0,
    notes: document.getElementById("event-notes").value?.trim(),
    sections,
  };

  try {
    if (currentEvent && currentEvent.id) {
      await fetchJSON(`${EVENTS_API}/${currentEvent.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
    } else {
      const created = await fetchJSON(EVENTS_API, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      currentEvent = created;
    }
    await loadEventsAndRender();
  } catch (err) {
    alert("Errore salvataggio: " + err.message);
  }
}

function openPrint(eventId) {
  const url = `${EVENTS_API}/${eventId}/print`;
  window.open(url, "_blank", "width=800,height=900");
}

function openPdf(eventId) {
  openPrint(eventId);
}

function renderEventsList() {
  const container = document.getElementById("event-list");
  if (!container) return;
  const list = (events || []).slice().reverse();
  if (!list.length) {
    container.innerHTML = '<div class="event-empty">Nessun evento salvato.</div>';
    return;
  }
  container.innerHTML = list.map((e) => {
    const title = e.title || e.eventName || e.customer || "Senza nome";
    const date = e.eventDate || e.date || "-";
    const guests = e.guestCount ?? e.people ?? "-";
    const total = e.totalEstimatedPrice ?? e.price;
    const totalStr = total ? "€ " + Number(total).toFixed(2) : "—";
    return `
    <div class="event-item" data-id="${e.id}">
      <div class="event-item-info">
        <strong>${escapeHtml(title)}</strong> – ${escapeHtml(String(date))} – ${guests} pax – ${totalStr}
        ${e.notes ? `<br><small>${escapeHtml(e.notes)}</small>` : ""}
      </div>
      <div class="event-item-actions">
        <button data-action="edit" data-id="${e.id}">Modifica</button>
        <button data-action="print" data-id="${e.id}">Stampa</button>
        <button data-action="pdf" data-id="${e.id}">PDF</button>
        <button class="danger" data-action="delete" data-id="${e.id}">Elimina</button>
      </div>
    </div>
  `;
  }).join("");

  container.querySelectorAll("[data-action]").forEach((btn) => {
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const ev = events.find((x) => x.id === id);
    if (!ev) return;
    btn.addEventListener("click", () => {
      if (action === "edit") {
        loadEventIntoBuilder(ev);
        showView("builder");
      }
      if (action === "print") openPrint(id);
      if (action === "pdf") openPdf(id);
      if (action === "delete") deleteEvent(id);
    });
  });
}

async function loadEventsAndRender() {
  try {
    events = await fetchJSON(API);
    if (!Array.isArray(events)) events = [];
    renderEventsList();
  } catch (err) {
    console.error(err);
    document.getElementById("event-list").innerHTML = '<div class="event-empty" style="color:var(--accent-danger);">Errore caricamento eventi.</div>';
  }
}

async function deleteEvent(id) {
  if (!confirm("Eliminare questo evento?")) return;
  try {
    await fetchJSON(`${API}/${id}`, { method: "DELETE" });
    events = events.filter((x) => x.id !== id);
    renderEventsList();
    if (currentEvent && currentEvent.id === id) clearEventBuilder();
  } catch (err) {
    alert("Errore eliminazione: " + err.message);
  }
}

// --- CALCOLATORE (legacy) ---
function setMenuPortate(num) {
  const container = document.getElementById("menuContainer");
  container.innerHTML = "";
  for (let i = 1; i <= num; i++) {
    const div = document.createElement("div");
    div.innerHTML = `
      <label>Portata ${i} <input type="text" placeholder="Nome piatto"></label>
      <label>Costo per porzione € <input type="number" value="5" step="0.01"></label>
      <hr>
    `;
    container.appendChild(div);
  }
}

function calcolaCatering() {
  const previste = Number(document.getElementById("personePreviste").value) || 0;
  const effettive = Number(document.getElementById("personeEffettive").value) || 0;
  const prezzoPersona = Number(document.getElementById("prezzoPersona").value) || 0;
  const inputs = document.querySelectorAll("#menuContainer input[type='number']");
  let costoPerPersona = 0;
  inputs.forEach((i) => (costoPerPersona += Number(i.value) || 0));
  const costoPrevisto = costoPerPersona * previste;
  const costoReale = costoPerPersona * effettive;
  const incasso = prezzoPersona * effettive;
  const extra =
    Number(document.getElementById("spesaNoleggio").value) +
    Number(document.getElementById("spesaPersonale").value) +
    Number(document.getElementById("spesaTrasporto").value) +
    Number(document.getElementById("spesaAltro").value);
  const margine = incasso - (costoReale + extra);
  const fc = incasso > 0 ? ((costoReale / incasso) * 100).toFixed(1) : "—";
  document.getElementById("risultati").innerHTML = `
    Costo previsto: € ${costoPrevisto.toFixed(2)}<br>
    Costo reale: € ${costoReale.toFixed(2)}<br>
    Incasso: € ${incasso.toFixed(2)}<br>
    Spese extra: € ${extra.toFixed(2)}<br>
    Margine: € ${margine.toFixed(2)}<br>
    Food Cost: ${fc}%
  `;
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".cat-nav .nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showView(btn.dataset.view));
  });

  document.getElementById("btn-add-preset-section")?.addEventListener("click", () => {
    addPresetSection(document.getElementById("preset-sections-list"));
  });
  document.getElementById("btn-preset-clear")?.addEventListener("click", clearPresetForm);
  document.getElementById("btn-save-preset")?.addEventListener("click", savePreset);

  document.getElementById("btn-new-custom")?.addEventListener("click", createNewCustomEvent);
  document.getElementById("btn-use-preset")?.addEventListener("click", () => createEventFromPreset());
  document.getElementById("btn-add-event-section")?.addEventListener("click", () => {
    addEventSection(document.getElementById("event-sections-list"));
  });
  document.getElementById("btn-save-event")?.addEventListener("click", saveEvent);
  document.getElementById("btn-print-event")?.addEventListener("click", () => {
    if (currentEvent && currentEvent.id) openPrint(currentEvent.id);
    else alert("Salva prima l'evento per stampare.");
  });
  document.getElementById("btn-pdf-event")?.addEventListener("click", () => {
    if (currentEvent && currentEvent.id) openPdf(currentEvent.id);
    else alert("Salva prima l'evento per esportare in PDF.");
  });

  document.getElementById("btn-refresh-all")?.addEventListener("click", () => {
    loadPresetsAndRender();
    loadEventsAndRender();
  });

  document.querySelectorAll("#view-calcolatore .menu-type button").forEach((btn) => {
    btn.addEventListener("click", () => setMenuPortate(parseInt(btn.dataset.portate, 10)));
  });
  document.getElementById("btn-calcola")?.addEventListener("click", calcolaCatering);

  setMenuPortate(3);
  loadPresetsAndRender();
  loadEventsAndRender();
});
