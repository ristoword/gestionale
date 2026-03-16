// =============================
//  MENU-ADMIN – wired to /api/menu
// =============================

async function fetchJSON(url, options = {}) {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...options,
  });
  if (!res.ok) {
    if (res.status === 401) {
      try { localStorage.removeItem("rw_auth"); } catch (_) {}
      const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
      window.location.href = "/login/login.html" + (returnTo ? "?return=" + returnTo : "");
      return;
    }
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function loadMenuItems() {
  const data = await fetchJSON("/api/menu");
  return Array.isArray(data) ? data : [];
}

async function loadAllRecipes() {
  const data = await fetchJSON("/api/recipes");
  return Array.isArray(data) ? data : [];
}

async function createMenuItem(item) {
  return fetchJSON("/api/menu", {
    method: "POST",
    body: JSON.stringify(item),
  });
}

async function updateMenuItem(id, item) {
  return fetchJSON(`/api/menu/${id}`, {
    method: "PATCH",
    body: JSON.stringify(item),
  });
}

async function deleteMenuItem(id) {
  return fetchJSON(`/api/menu/${id}`, { method: "DELETE" });
}

// =============================
//  RENDER
// =============================

async function renderMenuList() {
  const listEl = document.getElementById("menu-list");
  const statsEl = document.getElementById("menu-stats");
  if (!listEl) return;

  const search = document.getElementById("filter-search")?.value.trim().toLowerCase() || "";
  const areaFilter = document.getElementById("filter-area")?.value || "";
  const activeFilter = document.getElementById("filter-active")?.value || "";

  let items;
  try {
    items = await loadMenuItems();
  } catch (err) {
    console.error("Errore caricamento menu:", err);
    listEl.innerHTML = "<div class='menu-row' style='color:#c00'>Errore caricamento menu.</div>";
    return;
  }

  items = items.filter((it) => {
    if (search && !(it.name || "").toLowerCase().includes(search)) return false;
    if (areaFilter && it.area !== areaFilter) return false;
    if (activeFilter) {
      const isActive = it.active !== false;
      if (activeFilter === "true" && !isActive) return false;
      if (activeFilter === "false" && isActive) return false;
    }
    return true;
  });

  listEl.innerHTML = "";

  if (!items.length) {
    listEl.innerHTML =
      "<div style='padding:6px 4px;color:#7f8599;font-size:12px;'>Nessun piatto trovato con i filtri attuali.</div>";
  } else {
    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = "menu-row";

      const priceStr =
        typeof it.price === "number"
          ? "€ " + it.price.toFixed(2)
          : it.price != null
          ? "€ " + it.price
          : "-";

      const statusClass = it.active !== false ? "active" : "inactive";
      const statusLabel = it.active !== false ? "ATTIVO" : "NASCOSTO";

      row.innerHTML = `
        <div>
          <div class="menu-name">${(it.name || "").replace(/</g, "&lt;")}</div>
          <div class="menu-category">${(it.category || "").replace(/</g, "&lt;")}</div>
        </div>
        <div class="menu-area">${(it.area || "-").replace(/</g, "&lt;")}</div>
        <div class="menu-price">${priceStr}</div>
        <div class="menu-status ${statusClass}">${statusLabel}</div>
        <div class="menu-actions">
          <button class="toggle" data-id="${it.id}">${it.active !== false ? "Disattiva" : "Attiva"}</button>
          <button class="delete" data-id="${it.id}">Elimina</button>
        </div>
      `;
      listEl.appendChild(row);
    });

    listEl.querySelectorAll("button.toggle").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        try {
          const items = await loadMenuItems();
          const it = items.find((x) => String(x.id) === String(id));
          if (!it) return;
          await updateMenuItem(id, { active: !it.active });
          await renderMenuList();
        } catch (err) {
          console.error(err);
          alert("Errore: " + (err.message || "Aggiornamento fallito"));
        }
      });
    });

    listEl.querySelectorAll("button.delete").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const items = await loadMenuItems();
        const it = items.find((x) => String(x.id) === String(id));
        if (!it || !confirm(`Eliminare il piatto "${it.name}"?`)) return;
        try {
          await deleteMenuItem(id);
          await renderMenuList();
        } catch (err) {
          console.error(err);
          alert("Errore: " + (err.message || "Eliminazione fallita"));
        }
      });
    });
  }

  try {
    const all = await loadMenuItems();
    const activeCount = all.filter((x) => x.active !== false).length;
    if (statsEl) statsEl.textContent = `${all.length} piatti totali • ${activeCount} attivi`;
  } catch (_) {}
}

// =============================
//  FORM NUOVO PIATTO
// =============================

function clearForm() {
  document.getElementById("field-name").value = "";
  document.getElementById("field-category").value = "";
  document.getElementById("field-area").value = "cucina";
  document.getElementById("field-price").value = "";
  document.getElementById("field-code").value = "";
  document.getElementById("field-active").value = "true";
  document.getElementById("field-notes").value = "";
  const linkedSel = document.getElementById("field-linked-recipe");
  if (linkedSel) linkedSel.value = "";
  const recipeIdInput = document.getElementById("field-recipe-id");
  if (recipeIdInput) recipeIdInput.value = "";
}

function setupForm() {
  const btnAdd = document.getElementById("btn-add-item");
  const btnClear = document.getElementById("btn-clear-form");

  if (btnAdd) {
    btnAdd.addEventListener("click", async () => {
      const name = document.getElementById("field-name").value.trim();
      const category = document.getElementById("field-category").value.trim();
      const area = document.getElementById("field-area").value;
      const priceStr = document.getElementById("field-price").value.trim();
      const code = document.getElementById("field-code").value.trim();
      const activeStr = document.getElementById("field-active").value;
      const notes = document.getElementById("field-notes").value.trim();
      const linkedRecipeSelect = document.getElementById("field-linked-recipe");
      const explicitRecipeIdInput = document.getElementById("field-recipe-id");
      const saveAsRecipe = document.getElementById("fc-save-as-recipe")?.checked;
      const updateLinkedRecipe =
        document.getElementById("fc-update-linked-recipe")?.checked;


      if (!name) {
        alert("Inserisci il nome del piatto.");
        return;
      }

      let price = null;
      if (priceStr) {
        const p = Number(priceStr);
        if (Number.isFinite(p) && p >= 0) price = p;
      }

      try {
        // Costruisci payload food cost avanzato dal pannello
        const fcPayload = collectFoodCostPayload();

        // Se richiesto, salva/aggiorna anche la ricetta corrispondente prima del piatto.
        let recipeIdForDish = null;
        const selectedLinkedRecipeId =
          (linkedRecipeSelect && linkedRecipeSelect.value) || "";
        const explicitRecipeId = explicitRecipeIdInput?.value || "";

        if (selectedLinkedRecipeId || explicitRecipeId) {
          recipeIdForDish = selectedLinkedRecipeId || explicitRecipeId;
          if (updateLinkedRecipe && recipeIdForDish && fcPayload) {
            try {
              await saveOrUpdateRecipeFromDishPayload(recipeIdForDish, {
                name,
                category,
                area,
                notes,
                ...fcPayload,
              });
            } catch (e) {
              console.warn("Aggiornamento ricetta collegata fallito:", e.message);
            }
          }
        } else if (saveAsRecipe && fcPayload) {
          try {
            const createdRecipe = await saveOrUpdateRecipeFromDishPayload(null, {
              name,
              category,
              area,
              notes,
              ...fcPayload,
            });
            if (createdRecipe && createdRecipe.id) {
              recipeIdForDish = createdRecipe.id;
              if (explicitRecipeIdInput) {
                explicitRecipeIdInput.value = createdRecipe.id;
              }
            }
          } catch (e) {
            console.warn("Salvataggio ricetta da piatto fallito:", e.message);
          }
        }

        const recipeId = recipeIdForDish || null;

        await createMenuItem({
          name,
          category: category || "Generale",
          area,
          price,
          code: code || null,
          notes: notes || null,
          active: activeStr === "true",
          // Collega il piatto a una ricetta esistente per food cost / scarico magazzino.
          recipeId,
          // Food cost avanzato (opzionale – il backend calcola i derivati)
          ...(fcPayload || {}),
        });
        clearForm();
        await renderMenuList();
      } catch (err) {
        console.error(err);
        alert("Errore: " + (err.message || "Salvataggio fallito"));
      }
    });
  }

  if (btnClear) {
    btnClear.addEventListener("click", clearForm);
  }
}

// =============================
//  FILTRI
// =============================

function setupFilters() {
  const searchInput = document.getElementById("filter-search");
  const areaSel = document.getElementById("filter-area");
  const activeSel = document.getElementById("filter-active");
  const btnReset = document.getElementById("btn-reset-filters");

  if (searchInput) searchInput.addEventListener("input", renderMenuList);
  if (areaSel) areaSel.addEventListener("change", renderMenuList);
  if (activeSel) activeSel.addEventListener("change", renderMenuList);
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (areaSel) areaSel.value = "";
      if (activeSel) activeSel.value = "true";
      renderMenuList();
    });
  }
}

// =============================
//  CLEAR TUTTO – non supportato (nessun endpoint bulk delete)
// =============================

function setupClearAll() {
  const btn = document.getElementById("btn-clear-all");
  if (!btn) return;
  btn.addEventListener("click", () => {
    alert("Per svuotare il menu, elimina i piatti uno per uno.");
  });
}

// =============================
//  INIT
// =============================

async function hydrateFromRecipeParams() {
  // Se arriviamo da "Usa come piatto" su una ricetta, precompila il form.
  const params = new URLSearchParams(window.location.search || "");
  const fromRecipe = params.get("fromRecipe");
  if (!fromRecipe) return;

  const name = params.get("name") || "";
  const category = params.get("category") || "";
  const department = params.get("department") || "";
  const price = params.get("price") || "";

  const nameInput = document.getElementById("field-name");
  const catInput = document.getElementById("field-category");
  const areaSel = document.getElementById("field-area");
  const priceInput = document.getElementById("field-price");
  const recipeIdInput = document.getElementById("field-recipe-id");

  if (nameInput && !nameInput.value) nameInput.value = name;
  if (catInput && !catInput.value) catInput.value = category;
  if (areaSel && department) {
    const dep = department.toLowerCase();
    if (["cucina", "pizzeria", "bar"].includes(dep)) {
      areaSel.value = dep;
    }
  }
  if (priceInput && !priceInput.value && price) priceInput.value = price;
  if (recipeIdInput) recipeIdInput.value = fromRecipe;
}

async function populateLinkedRecipeSelect() {
  const sel = document.getElementById("field-linked-recipe");
  if (!sel) return;
  let recipes = [];
  try {
    recipes = await loadAllRecipes();
  } catch (err) {
    console.warn("Impossibile caricare l'elenco ricette per il collegamento piatto:", err.message);
    return;
  }
  sel.innerHTML = "";
  const emptyOpt = document.createElement("option");
  emptyOpt.value = "";
  emptyOpt.textContent = "Nessuna ricetta";
  sel.appendChild(emptyOpt);

  recipes
    .slice()
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    .forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      const label = r.name || r.menuItemName || `Ricetta ${r.id}`;
      opt.textContent = label;
      sel.appendChild(opt);
    });

  // Se esiste già un recipeId esplicito (da redirect da ricette), seleziona la relativa option.
  const recipeIdInput = document.getElementById("field-recipe-id");
  const currentId = recipeIdInput?.value || "";
  if (currentId) {
    sel.value = currentId;
  }
}

function getNumberValue(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const v = Number(el.value);
  return Number.isFinite(v) ? v : null;
}

function collectFoodCostPayload() {
  const tbody = document.getElementById("fc-ingredients-body");
  if (!tbody) return null;
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const ingredients = rows
    .map((tr) => {
      const name = tr.querySelector(".fc-ing-name")?.value.trim() || "";
      const qtyStr = tr.querySelector(".fc-ing-qty")?.value;
      const unit = tr.querySelector(".fc-ing-unit")?.value || "";
      const unitCostStr = tr.querySelector(".fc-ing-unit-cost")?.value;
      const wastageStr = tr.querySelector(".fc-ing-wastage")?.value;
      const quantity = Number(qtyStr) || 0;
      const unitCost = Number(unitCostStr) || 0;
      const wastagePercent = Number(wastageStr) || 0;
      if (!name || quantity <= 0) return null;
      return {
        name,
        quantity,
        unit,
        unitCost,
        wastagePercent,
      };
    })
    .filter(Boolean);

  if (!ingredients.length) return null;

  return {
    ingredients,
    ivaPercent: getNumberValue("fc-iva"),
    overheadPercent: getNumberValue("fc-overhead"),
    packagingCost: getNumberValue("fc-packaging"),
    laborCost: getNumberValue("fc-labor"),
    energyCost: getNumberValue("fc-energy"),
    extraCost: getNumberValue("fc-extra"),
    yield: getNumberValue("fc-yield"),
    sellingPrice: getNumberValue("fc-price"),
    foodCostTarget: getNumberValue("fc-target"),
    marginTarget: getNumberValue("fc-margin-target"),
  };
}

function recalcFoodCostSummary() {
  const payload = collectFoodCostPayload();
  const sumIngredientsEl = document.getElementById("fc-sum-ingredients");
  const sumProductionEl = document.getElementById("fc-sum-production");
  const costPortionEl = document.getElementById("fc-cost-portion");
  const percentEl = document.getElementById("fc-percent-live");
  const marginValEl = document.getElementById("fc-margin-value");
  const marginPctEl = document.getElementById("fc-margin-percent");
  const suggestedEl = document.getElementById("fc-suggested-price");

  const fmt = (v, suffix = "") =>
    v == null || Number.isNaN(v) ? "—" : `${suffix} ${v.toFixed(2)}`.trim();

  if (!payload) {
    if (sumIngredientsEl) sumIngredientsEl.textContent = "€ 0,00";
    if (sumProductionEl) sumProductionEl.textContent = "€ 0,00";
    if (costPortionEl) costPortionEl.textContent = "€ 0,00";
    if (percentEl) percentEl.textContent = "—";
    if (marginValEl) marginValEl.textContent = "—";
    if (marginPctEl) marginPctEl.textContent = "—";
    if (suggestedEl) suggestedEl.textContent = "—";
    return;
  }

  // Replica lato client la stessa logica usata nel backend (in sintesi).
  let rawIngredientCost = 0;
  payload.ingredients.forEach((ing) => {
    const line = (ing.quantity || 0) * (ing.unitCost || 0);
    const w = ing.wastagePercent || 0;
    const after = w > 0 ? line * (1 + w / 100) : line;
    rawIngredientCost += after;
  });
  const ivaPercent = payload.ivaPercent || 0;
  const overheadPercent = payload.overheadPercent || 0;
  const ivaAmount = rawIngredientCost * (ivaPercent / 100);
  const overheadAmount = rawIngredientCost * (overheadPercent / 100);
  const packaging = payload.packagingCost || 0;
  const labor = payload.laborCost || 0;
  const energy = payload.energyCost || 0;
  const extra = payload.extraCost || 0;
  const finalProductionCost =
    rawIngredientCost + ivaAmount + overheadAmount + packaging + labor + energy + extra;

  const yieldPortions = payload.yield || 1;
  const costPerPortion =
    yieldPortions > 0 ? finalProductionCost / yieldPortions : 0;
  const price = payload.sellingPrice || 0;

  let foodCostPercent = null;
  if (price > 0 && costPerPortion > 0) {
    foodCostPercent = (costPerPortion / price) * 100;
  }

  let marginValue = null;
  let marginPercent = null;
  if (price > 0 && costPerPortion > 0) {
    marginValue = price - costPerPortion;
    marginPercent = (marginValue / price) * 100;
  }

  const targetFc = payload.foodCostTarget || 0;
  const targetMargin = payload.marginTarget || 0;
  let suggestedFromFc = null;
  if (targetFc > 0 && costPerPortion > 0) {
    suggestedFromFc = costPerPortion / (targetFc / 100);
  }
  let suggestedFromMargin = null;
  if (targetMargin > 0 && targetMargin < 100 && costPerPortion > 0) {
    const div = 1 - targetMargin / 100;
    if (div > 0) {
      suggestedFromMargin = costPerPortion / div;
    }
  }
  const suggested =
    suggestedFromFc != null ? suggestedFromFc : suggestedFromMargin;

  if (sumIngredientsEl) sumIngredientsEl.textContent = fmt(rawIngredientCost, "€");
  if (sumProductionEl) sumProductionEl.textContent = fmt(finalProductionCost, "€");
  if (costPortionEl) costPortionEl.textContent = fmt(costPerPortion, "€");
  if (percentEl)
    percentEl.textContent =
      foodCostPercent != null ? `${foodCostPercent.toFixed(1)}%` : "—";
  if (marginValEl) marginValEl.textContent = marginValue != null ? fmt(marginValue, "€") : "—";
  if (marginPctEl)
    marginPctEl.textContent =
      marginPercent != null ? `${marginPercent.toFixed(1)}%` : "—";
  if (suggestedEl)
    suggestedEl.textContent =
      suggested != null ? `€ ${suggested.toFixed(2)}` : "—";
}

function addFoodCostRow(initial = {}) {
  const tbody = document.getElementById("fc-ingredients-body");
  if (!tbody) return;
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td><input type="text" class="fc-ing-name" value="${initial.name || ""}"/></td>
    <td><input type="number" step="0.01" min="0" class="fc-ing-qty" value="${initial.quantity ?? ""}"/></td>
    <td>
      <select class="fc-ing-unit">
        <option value="gr"${initial.unit === "gr" ? " selected" : ""}>gr</option>
        <option value="kg"${initial.unit === "kg" ? " selected" : ""}>kg</option>
        <option value="ml"${initial.unit === "ml" ? " selected" : ""}>ml</option>
        <option value="cl"${initial.unit === "cl" ? " selected" : ""}>cl</option>
        <option value="lt"${initial.unit === "lt" ? " selected" : ""}>lt</option>
        <option value="pz"${initial.unit === "pz" ? " selected" : ""}>pz</option>
      </select>
    </td>
    <td><input type="number" step="0.01" min="0" class="fc-ing-unit-cost" value="${initial.unitCost ?? ""}"/></td>
    <td><input type="number" step="0.1" min="0" class="fc-ing-wastage" value="${initial.wastagePercent ?? ""}"/></td>
    <td class="fc-ing-total">€ 0,00</td>
    <td><button type="button" class="btn ghost btn-sm fc-row-remove">✕</button></td>
  `;
  tbody.appendChild(tr);

  const recalcRow = () => {
    const qty = Number(tr.querySelector(".fc-ing-qty")?.value || 0);
    const unitCost = Number(tr.querySelector(".fc-ing-unit-cost")?.value || 0);
    const wastage = Number(tr.querySelector(".fc-ing-wastage")?.value || 0);
    let line = qty * unitCost;
    if (line < 0) line = 0;
    const after = wastage > 0 ? line * (1 + wastage / 100) : line;
    const cell = tr.querySelector(".fc-ing-total");
    if (cell) cell.textContent = `€ ${after.toFixed(2)}`;
    recalcFoodCostSummary();
  };

  tr.querySelectorAll("input,select").forEach((el) => {
    el.addEventListener("input", recalcRow);
  });
  tr.querySelector(".fc-row-remove")?.addEventListener("click", () => {
    tr.remove();
    recalcFoodCostSummary();
  });

  recalcRow();
}

async function loadRecipeIntoFoodCost(recipeId) {
  if (!recipeId) return;
  try {
    const recipe = await fetchJSON(`/api/recipes/${encodeURIComponent(recipeId)}`);
    const tbody = document.getElementById("fc-ingredients-body");
    if (tbody) tbody.innerHTML = "";
    const ings = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
    ings.forEach((ing) => {
      addFoodCostRow({
        name: ing.name || ing.ingredientName || "",
        quantity: ing.quantity || ing.qty || 0,
        unit: ing.unit || "gr",
        unitCost: ing.costPerUnit ?? ing.unitCost ?? 0,
        wastagePercent: ing.wastagePercent ?? 0,
      });
    });

    if (recipe.yieldPortions || recipe.yield_portions) {
      const el = document.getElementById("fc-yield");
      if (el) el.value = recipe.yieldPortions || recipe.yield_portions || "";
    }
    if (recipe.sellingPrice || recipe.selling_price) {
      const el = document.getElementById("fc-price");
      if (el) el.value = recipe.sellingPrice || recipe.selling_price || "";
    }
    if (recipe.targetFoodCost || recipe.target_food_cost) {
      const el = document.getElementById("fc-target");
      if (el) el.value = recipe.targetFoodCost || recipe.target_food_cost || "";
    }
    if (recipe.ivaPercent || recipe.iva_percent) {
      const el = document.getElementById("fc-iva");
      if (el) el.value = recipe.ivaPercent || recipe.iva_percent || "";
    }
    if (recipe.overheadPercent || recipe.overhead_percent) {
      const el = document.getElementById("fc-overhead");
      if (el) el.value = recipe.overheadPercent || recipe.overhead_percent || "";
    }
    if (recipe.packagingCost || recipe.packaging_cost) {
      const el = document.getElementById("fc-packaging");
      if (el) el.value = recipe.packagingCost || recipe.packaging_cost || "";
    }
    if (recipe.laborCost || recipe.labor_cost) {
      const el = document.getElementById("fc-labor");
      if (el) el.value = recipe.laborCost || recipe.labor_cost || "";
    }
    recalcFoodCostSummary();
  } catch (err) {
    console.warn("Impossibile caricare ricetta per food cost avanzato:", err.message);
  }
}

async function saveOrUpdateRecipeFromDishPayload(existingRecipeId, payload) {
  const body = {
    name: payload.name,
    menuItemName: payload.name,
    category: payload.category || "",
    department: payload.area || "cucina",
    description: payload.notes || "",
    yieldPortions: payload.yield || 1,
    sellingPrice: payload.sellingPrice || 0,
    targetFoodCost: payload.foodCostTarget || 0,
    ivaPercent: payload.ivaPercent || 0,
    overheadPercent: payload.overheadPercent || 0,
    packagingCost: payload.packagingCost || 0,
    laborCost: payload.laborCost || 0,
    ingredients: Array.isArray(payload.ingredients) ? payload.ingredients : [],
  };

  if (existingRecipeId) {
    return fetchJSON(`/api/recipes/${encodeURIComponent(existingRecipeId)}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  return fetchJSON("/api/recipes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupForm();
  setupFilters();
  setupClearAll();
  hydrateFromRecipeParams();
  populateLinkedRecipeSelect();
  // Inizializza almeno una riga ingredienti vuota
  addFoodCostRow();

  const btnAddRow = document.getElementById("btn-fc-add-row");
  if (btnAddRow) {
    btnAddRow.addEventListener("click", () => addFoodCostRow());
  }

  // Input che influenzano il riepilogo
  [
    "fc-iva",
    "fc-overhead",
    "fc-packaging",
    "fc-labor",
    "fc-energy",
    "fc-extra",
    "fc-yield",
    "fc-price",
    "fc-target",
    "fc-margin-target",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", recalcFoodCostSummary);
  });

  // Se abbiamo già un recipeId (da "Usa come piatto") prova a precompilare anche il food cost
  const recipeIdInput = document.getElementById("field-recipe-id");
  if (recipeIdInput && recipeIdInput.value) {
    loadRecipeIntoFoodCost(recipeIdInput.value);
  }

  renderMenuList();
});
