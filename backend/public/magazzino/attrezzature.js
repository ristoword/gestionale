// Modulo Attrezzature – solo frontend, localStorage
// Chiave di persistenza separata dal magazzino ingredienti
const LS_KEY_ATTREZZATURE = "ristoword_attrezzature";

// Categorie di base
const BASE_CATEGORIES = [
  "Posate",
  "Bicchieri",
  "Piatti",
  "Pentole e padelle",
  "Attrezzatura cucina",
  "Attrezzatura sala",
  "Elettrodomestici",
  "Arredi",
  "Altro",
];

let equipmentItems = [];
let editingId = null;

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(LS_KEY_ATTREZZATURE);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((it) => ({
      id: it.id || String(Date.now()) + Math.random(),
      name: it.name || "",
      category: it.category || "Altro",
      subcategory: it.subcategory || "",
      quantity: Number(it.quantity) || 0,
      unit: it.unit || "pezzi",
      status: it.status || "attivo",
      location: it.location || "magazzino",
      unitValue: Number(it.unitValue) || 0,
      totalValue: Number(it.totalValue) || 0,
      notes: it.notes || "",
      createdAt: it.createdAt || new Date().toISOString(),
      updatedAt: it.updatedAt || new Date().toISOString(),
    }));
  } catch (_) {
    return [];
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(LS_KEY_ATTREZZATURE, JSON.stringify(equipmentItems));
  } catch (_) {
    // best effort
  }
}

function toMoney(n) {
  const v = Number(n) || 0;
  return "€ " + v.toFixed(2);
}

// =========================
//   KPI
// =========================

function updateKPI() {
  const totalItems = equipmentItems.length;
  const totalPieces = equipmentItems.reduce(
    (sum, it) => sum + (Number(it.quantity) || 0),
    0
  );
  const totalValue = equipmentItems.reduce(
    (sum, it) => sum + (Number(it.totalValue) || 0),
    0
  );
  const brokenCount = equipmentItems.filter(
    (it) => String(it.status) === "rotto"
  ).length;

  document.getElementById("kpi-eq-count").textContent = String(totalItems);
  document.getElementById("kpi-eq-qty").textContent = String(totalPieces);
  document.getElementById("kpi-eq-value").textContent = toMoney(totalValue);
  document.getElementById("kpi-eq-broken").textContent = String(brokenCount);
}

// =========================
//   FILTRI & RENDER
// =========================

function getFilterCategory() {
  const sel = document.getElementById("filter-category");
  return sel ? sel.value : "";
}

function getFilterSearch() {
  const inp = document.getElementById("filter-search");
  return inp ? inp.value.toLowerCase().trim() : "";
}

function buildCategoryOptions() {
  const selCat = document.getElementById("eq-category");
  const selFilter = document.getElementById("filter-category");
  if (!selCat || !selFilter) return;

  const catsFromData = [...new Set(equipmentItems.map((it) => it.category).filter(Boolean))];
  const allCats = [...BASE_CATEGORIES];

  catsFromData.forEach((c) => {
    if (c && !allCats.includes(c)) allCats.push(c);
  });

  selCat.innerHTML = "";
  allCats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    selCat.appendChild(opt);
  });

  // Filtro
  selFilter.innerHTML = "";
  const optAll = document.createElement("option");
  optAll.value = "";
  optAll.textContent = "Tutte le categorie";
  selFilter.appendChild(optAll);

  allCats.forEach((c) => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    selFilter.appendChild(opt);
  });
}

function applyFilters(items) {
  const cat = getFilterCategory();
  const search = getFilterSearch();
  let res = items.slice();

  if (cat) {
    res = res.filter((it) => String(it.category) === cat);
  }
  if (search) {
    res = res.filter((it) => {
      const hay = (
        (it.name || "") +
        " " +
        (it.subcategory || "") +
        " " +
        (it.location || "") +
        " " +
        (it.category || "")
      ).toLowerCase();
      return hay.includes(search);
    });
  }
  return res;
}

function renderList() {
  const container = document.getElementById("eq-list");
  if (!container) return;

  updateKPI();
  buildCategoryOptions();

  if (!equipmentItems.length) {
    container.innerHTML =
      "<p class='muted'>Nessuna attrezzatura censita. Aggiungila dal form sopra.</p>";
    return;
  }

  const items = applyFilters(equipmentItems).sort((a, b) =>
    (a.category || "").localeCompare(b.category || "") ||
    (a.name || "").localeCompare(b.name || "")
  );

  if (!items.length) {
    container.innerHTML =
      "<p class='muted'>Nessun risultato per i filtri impostati.</p>";
    return;
  }

  const rowsHtml = items
    .map((it) => {
      const statusLabel = String(it.status);
      const qty = Number(it.quantity) || 0;
      const unitVal = Number(it.unitValue) || 0;
      const totalVal = Number(it.totalValue) || qty * unitVal;
      const isBroken = statusLabel === "rotto";

      const badge =
        statusLabel === "attivo"
          ? ""
          : `<span class="badge ${
              isBroken ? "danger" : "warning"
            }">${statusLabel}</span>`;

      return `
      <div class="inventory-row" data-id="${it.id}">
        <div class="inv-main">
          <div class="inv-name">
            <strong>${escapeHtml(it.name || "Senza nome")}</strong>
            <span class="inv-unit">(${escapeHtml(it.unit || "pezzi")})</span>
          </div>
          <div class="inv-qty ${isBroken ? "low" : ""}">
            Q.tà: <strong>${qty}</strong> ${badge}
          </div>
          <div class="inv-meta">
            ${it.category ? `<span class="inv-cat">${escapeHtml(it.category)}</span>` : ""}
            ${it.subcategory ? `<span class="inv-lot">${escapeHtml(it.subcategory)}</span>` : ""}
            ${it.location ? `<span class="inv-lot">${escapeHtml(it.location)}</span>` : ""}
          </div>
          <div class="inv-cost">
            Valore unitario: ${toMoney(unitVal)} · Valore totale: ${toMoney(totalVal)}
          </div>
          ${it.notes ? `<div class="inv-notes">${escapeHtml(it.notes)}</div>` : ""}
        </div>
        <div class="inv-actions">
          <button class="btn small" data-action="dec" data-id="${it.id}">−1</button>
          <button class="btn small" data-action="inc" data-id="${it.id}">+1</button>
          <button class="btn small" data-action="edit" data-id="${it.id}">Modifica</button>
          <button class="btn small btn-delete" data-action="delete" data-id="${it.id}">Elimina</button>
        </div>
      </div>`;
    })
    .join("");

  container.innerHTML = rowsHtml;
  attachRowListeners(container);
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

// =========================
//   OPERAZIONI CRUD
// =========================

function resetForm() {
  editingId = null;
  document.getElementById("form-title").textContent = "Nuova attrezzatura";
  document.getElementById("eq-name").value = "";
  document.getElementById("eq-subcategory").value = "";
  document.getElementById("eq-quantity").value = "";
  document.getElementById("eq-unit").value = "pezzi";
  document.getElementById("eq-status").value = "attivo";
  document.getElementById("eq-location").value = "magazzino";
  document.getElementById("eq-unit-value").value = "";
  document.getElementById("eq-notes").value = "";
  const catSel = document.getElementById("eq-category");
  if (catSel && BASE_CATEGORIES.length) {
    catSel.value = BASE_CATEGORIES[0];
  }
}

function fillFormForEdit(item) {
  editingId = item.id;
  document.getElementById("form-title").textContent = "Modifica attrezzatura";
  document.getElementById("eq-name").value = item.name || "";
  document.getElementById("eq-subcategory").value = item.subcategory || "";
  document.getElementById("eq-quantity").value = item.quantity || "";
  document.getElementById("eq-unit").value = item.unit || "pezzi";
  document.getElementById("eq-status").value = item.status || "attivo";
  document.getElementById("eq-location").value = item.location || "magazzino";
  document.getElementById("eq-unit-value").value =
    item.unitValue != null ? String(item.unitValue) : "";
  document.getElementById("eq-notes").value = item.notes || "";

  const catSel = document.getElementById("eq-category");
  if (catSel) {
    if (
      item.category &&
      Array.from(catSel.options).some((o) => o.value === item.category)
    ) {
      catSel.value = item.category;
    } else if (BASE_CATEGORIES.length) {
      catSel.value = BASE_CATEGORIES[0];
    }
  }
}

function handleSave(e) {
  e.preventDefault();
  const name = document.getElementById("eq-name").value.trim();
  const catSel = document.getElementById("eq-category");
  const category = catSel ? catSel.value : "Altro";
  const subcategory = document
    .getElementById("eq-subcategory")
    .value.trim();
  const quantity = Number(
    document.getElementById("eq-quantity").value || 0
  );
  const unit = document.getElementById("eq-unit").value || "pezzi";
  const status = document.getElementById("eq-status").value || "attivo";
  const location = document.getElementById("eq-location").value || "magazzino";
  const unitValue = Number(
    document.getElementById("eq-unit-value").value || 0
  );
  const notes = document.getElementById("eq-notes").value.trim();

  if (!name) {
    alert("Il nome è obbligatorio.");
    return;
  }
  if (quantity < 0) {
    alert("La quantità non può essere negativa.");
    return;
  }
  if (unitValue < 0) {
    alert("Il valore unitario non può essere negativo.");
    return;
  }

  const now = new Date().toISOString();
  const totalValue = quantity * unitValue;

  if (editingId) {
    equipmentItems = equipmentItems.map((it) =>
      it.id === editingId
        ? {
            ...it,
            name,
            category,
            subcategory,
            quantity,
            unit,
            status,
            location,
            unitValue,
            totalValue,
            notes,
            updatedAt: now,
          }
        : it
    );
  } else {
    const id = String(Date.now()) + "-" + Math.random().toString(16).slice(2);
    equipmentItems.push({
      id,
      name,
      category,
      subcategory,
      quantity,
      unit,
      status,
      location,
      unitValue,
      totalValue,
      notes,
      createdAt: now,
      updatedAt: now,
    });
  }

  saveToStorage();
  resetForm();
  renderList();
}

function handleRowAction(action, id) {
  const idx = equipmentItems.findIndex((it) => it.id === id);
  if (idx === -1) return;

  const it = equipmentItems[idx];

  if (action === "inc" || action === "dec") {
    const delta = action === "inc" ? 1 : -1;
    const newQty = (Number(it.quantity) || 0) + delta;
    if (newQty < 0) return;
    it.quantity = newQty;
    it.totalValue = newQty * (Number(it.unitValue) || 0);
    it.updatedAt = new Date().toISOString();
    equipmentItems.splice(idx, 1, it);
    saveToStorage();
    renderList();
    return;
  }

  if (action === "delete") {
    if (!confirm("Eliminare questa attrezzatura dall'elenco?")) return;
    equipmentItems.splice(idx, 1);
    saveToStorage();
    renderList();
    return;
  }

  if (action === "edit") {
    fillFormForEdit(it);
    return;
  }
}

function attachRowListeners(container) {
  container.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      handleRowAction(action, id);
    });
  });
}

// =========================
//   INIT
// =========================

function initAttrezzature() {
  equipmentItems = loadFromStorage();
  buildCategoryOptions();
  updateKPI();
  renderList();

  document
    .getElementById("eq-save")
    .addEventListener("click", handleSave);

  document.getElementById("eq-cancel").addEventListener("click", () => {
    resetForm();
  });

  document
    .getElementById("filter-category")
    .addEventListener("change", renderList);

  document
    .getElementById("filter-search")
    .addEventListener("input", () => {
      renderList();
    });

  // Prima impostazione form
  const catSel = document.getElementById("eq-category");
  if (catSel && BASE_CATEGORIES.length) {
    catSel.value = BASE_CATEGORIES[0];
  }
}

document.addEventListener("DOMContentLoaded", initAttrezzature);

