(function () {
  "use strict";

  const UNITS = ["gr", "kg", "ml", "cl", "lt", "pz"];
  let recipes = [];
  let currentRecipe = null;

  const selectEl = document.getElementById("recipe-select");
  const panelEl = document.getElementById("recipe-panel");

  function buildNewDraftRecipe(name = "Nuovo calcolo") {
    return {
      id: null,
      name,
      ingredients: [],
      yieldPortions: 1,
      sellingPrice: 0,
      targetFoodCost: 0,
      ivaPercent: 0,
      overheadPercent: 0,
      packagingCost: 0,
      laborCost: 0,
      energyCost: 0,
      extraCost: 0,
    };
  }

  function formatEuro(n) {
    return "€ " + (Number(n) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function loadRecipes() {
    const res = await fetch("/api/recipes", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Errore caricamento ricette");
    recipes = await res.json();
    selectEl.innerHTML = '<option value="">-- Scegli ricetta --</option><option value="__new">+ Nuovo calcolo / nuova ricetta</option>';
    recipes.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = r.name || r.menuItemName || r.id;
      selectEl.appendChild(opt);
    });
  }

  function getMetaValues() {
    return {
      yieldPortions: parseInt(document.getElementById("input-yield").value, 10) || 1,
      sellingPrice: parseFloat(document.getElementById("input-price").value) || 0,
      targetFoodCost: parseFloat(document.getElementById("input-target-fc").value) || 0,
      ivaPercent: parseFloat(document.getElementById("input-iva").value) || 0,
      overheadPercent: parseFloat(document.getElementById("input-overhead").value) || 0,
      packagingCost: parseFloat(document.getElementById("input-packaging").value) || 0,
      laborCost: parseFloat(document.getElementById("input-labor").value) || 0,
      energyCost: parseFloat(document.getElementById("input-energy")?.value) || 0,
      extraCost: parseFloat(document.getElementById("input-extra")?.value) || 0,
    };
  }

  function buildIngredientRows() {
    const tbody = document.getElementById("ingredient-tbody");
    const ings = currentRecipe.ingredients || [];
    tbody.innerHTML = "";
    ings.forEach((ing, idx) => {
      const tr = document.createElement("tr");
      const qty = Number(ing.quantity) || 0;
      const unitCost = Number(ing.costPerUnit ?? ing.unitCost) || 0;
      const total = qty * unitCost;
      const unit = (ing.unit || "gr").toLowerCase();
      const unitOpts = UNITS.map((u) => `<option value="${u}" ${u === unit ? "selected" : ""}>${u}</option>`).join("");
      tr.innerHTML = `
        <td><input type="text" data-idx="${idx}" data-field="name" value="${escapeAttr(ing.name || ing.ingredientName || "")}" placeholder="es. farina" /></td>
        <td><input type="number" data-idx="${idx}" data-field="quantity" min="0" step="any" value="${qty}" /></td>
        <td><select data-idx="${idx}" data-field="unit">${unitOpts}</select></td>
        <td><input type="number" data-idx="${idx}" data-field="unitCost" min="0" step="0.01" value="${unitCost}" /></td>
        <td class="row-total">${formatEuro(total)}</td>
        <td><input type="number" data-idx="${idx}" data-field="wastagePercent" min="0" max="100" step="0.5" value="${Number(ing.wastagePercent) || 0}" /></td>
        <td><input type="text" data-idx="${idx}" data-field="notes" value="${escapeAttr(ing.notes || "")}" placeholder="Note" /></td>
        <td class="col-delete"><button type="button" class="btn-xs danger" data-idx="${idx}" data-action="delete">Elimina</button></td>
      `;
      tbody.appendChild(tr);
    });
    tbody.querySelectorAll("input, select").forEach((el) => {
      el.addEventListener("input", () => updateTotals());
    });
    tbody.querySelectorAll("[data-action='delete']").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        currentRecipe.ingredients.splice(idx, 1);
        renderRecipe();
      });
    });
  }

  function escapeAttr(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML.replace(/"/g, "&quot;");
  }

  function readIngredientRows() {
    const rows = document.querySelectorAll("#ingredient-tbody tr");
    const ings = [];
    rows.forEach((row, idx) => {
      const name = row.querySelector("[data-field='name']").value.trim();
      const quantity = parseFloat(row.querySelector("[data-field='quantity']").value) || 0;
      const unit = row.querySelector("[data-field='unit']").value || "gr";
      const unitCost = parseFloat(row.querySelector("[data-field='unitCost']").value) || 0;
      const wastagePercent = parseFloat(row.querySelector("[data-field='wastagePercent']").value) || 0;
      const notes = row.querySelector("[data-field='notes']").value.trim();
      ings.push({
        name: name || "Ingrediente",
        ingredientName: name || "Ingrediente",
        quantity,
        unit,
        unitCost,
        costPerUnit: unitCost,
        totalCost: quantity * unitCost,
        wastagePercent,
        notes,
      });
    });
    return ings;
  }

  function updateTotals() {
    const ings = readIngredientRows();
    let raw = 0;
    ings.forEach((ing) => {
      let line = (ing.quantity || 0) * (ing.unitCost || 0);
      if ((ing.wastagePercent || 0) > 0) line *= 1 + ing.wastagePercent / 100;
      raw += line;
    });
    const meta = getMetaValues();
    const iva = raw * (meta.ivaPercent / 100);
    const overhead = raw * (meta.overheadPercent / 100);
    const production =
      raw +
      iva +
      overhead +
      (meta.packagingCost || 0) +
      (meta.laborCost || 0) +
      (meta.energyCost || 0) +
      (meta.extraCost || 0);
    const portion = meta.yieldPortions > 0 ? production / meta.yieldPortions : 0;
    const selling = meta.sellingPrice || 0;
    const fcPercent = selling > 0 && portion > 0 ? (portion / selling) * 100 : null;
    const margin = selling - portion;
    const suggested = meta.targetFoodCost > 0 && portion > 0 ? portion / (meta.targetFoodCost / 100) : null;

    document.getElementById("sum-raw").textContent = formatEuro(raw);
    document.getElementById("sum-production").textContent = formatEuro(production);
    document.getElementById("sum-portion").textContent = formatEuro(portion);
    document.getElementById("sum-selling").textContent = formatEuro(selling);
    document.getElementById("sum-fc").textContent = fcPercent != null ? fcPercent.toFixed(1) + " %" : "–";
    document.getElementById("sum-margin").textContent = formatEuro(margin);
    document.getElementById("sum-suggested").textContent = suggested != null ? formatEuro(suggested) : "–";

    document.querySelectorAll("#ingredient-tbody .row-total").forEach((cell, i) => {
      const ing = ings[i];
      if (ing) cell.textContent = formatEuro((ing.quantity || 0) * (ing.unitCost || 0));
    });
  }

  function renderRecipe() {
    if (!currentRecipe) currentRecipe = buildNewDraftRecipe();
    if (panelEl) panelEl.style.display = "block";
    document.getElementById("recipe-name").textContent = currentRecipe.name || currentRecipe.menuItemName || "Ricetta";

    document.getElementById("input-yield").value = currentRecipe.yieldPortions ?? currentRecipe.yield_portions ?? 1;
    document.getElementById("input-price").value = currentRecipe.sellingPrice ?? currentRecipe.selling_price ?? 0;
    document.getElementById("input-target-fc").value = currentRecipe.targetFoodCost ?? currentRecipe.target_food_cost ?? 0;
    document.getElementById("input-iva").value = currentRecipe.ivaPercent ?? currentRecipe.iva_percent ?? 0;
    document.getElementById("input-overhead").value = currentRecipe.overheadPercent ?? currentRecipe.overhead_percent ?? 0;
    document.getElementById("input-packaging").value = currentRecipe.packagingCost ?? currentRecipe.packaging_cost ?? 0;
    document.getElementById("input-labor").value = currentRecipe.laborCost ?? currentRecipe.labor_cost ?? 0;
    const energyEl = document.getElementById("input-energy");
    const extraEl = document.getElementById("input-extra");
    if (energyEl) energyEl.value = currentRecipe.energyCost ?? currentRecipe.energy_cost ?? 0;
    if (extraEl) extraEl.value = currentRecipe.extraCost ?? currentRecipe.extra_cost ?? 0;

    buildIngredientRows();
    updateTotals();
  }

  async function loadFoodCostAndRender() {
    if (!currentRecipe || !currentRecipe.id) return;
    try {
      const res = await fetch("/api/recipes/" + currentRecipe.id + "/food-cost", { credentials: "same-origin" });
      if (res.ok) {
        const fc = await res.json();
        document.getElementById("sum-raw").textContent = formatEuro(fc.rawIngredientCost);
        document.getElementById("sum-production").textContent = formatEuro(fc.finalProductionCost);
        document.getElementById("sum-portion").textContent = formatEuro(fc.costPerPortion);
        document.getElementById("sum-selling").textContent = formatEuro(fc.sellingPrice);
        document.getElementById("sum-fc").textContent = fc.foodCostPercent != null ? fc.foodCostPercent.toFixed(1) + " %" : "–";
        document.getElementById("sum-margin").textContent = formatEuro(fc.grossMargin);
        document.getElementById("sum-suggested").textContent = fc.suggestedPrice != null ? formatEuro(fc.suggestedPrice) : "–";
      }
    } catch (_) {}
    renderRecipe();
  }

  async function onSelectRecipe() {
    const id = selectEl.value;
    if (!id) {
      currentRecipe = buildNewDraftRecipe();
      renderRecipe();
      return;
    }
    if (id === "__new") {
      currentRecipe = buildNewDraftRecipe("Nuovo calcolo");
      renderRecipe();
      return;
    }
    currentRecipe = recipes.find((r) => r.id === id) || null;
    if (!currentRecipe) {
      currentRecipe = buildNewDraftRecipe();
      renderRecipe();
      return;
    }
    await loadFoodCostAndRender();
  }

  async function saveRecipe() {
    if (!currentRecipe) return;
    const meta = getMetaValues();
    const ingredients = readIngredientRows();
    if (!ingredients.length) {
      alert("Aggiungi almeno un ingrediente.");
      return;
    }
    const payload = {
      yieldPortions: meta.yieldPortions,
      sellingPrice: meta.sellingPrice,
      targetFoodCost: meta.targetFoodCost,
      ivaPercent: meta.ivaPercent,
      overheadPercent: meta.overheadPercent,
      packagingCost: meta.packagingCost,
      laborCost: meta.laborCost,
      energyCost: meta.energyCost,
      extraCost: meta.extraCost,
      ingredients,
    };
    const isNew = !currentRecipe.id;
    const url = isNew ? "/api/recipes" : "/api/recipes/" + currentRecipe.id;
    const method = isNew ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        name: currentRecipe.name || currentRecipe.menuItemName || "Nuova ricetta",
        menuItemName: currentRecipe.menuItemName || currentRecipe.name || "Nuova ricetta",
        category: currentRecipe.category || "",
        department: currentRecipe.department || currentRecipe.area || "cucina",
        description: currentRecipe.description || "",
        notes: currentRecipe.notes || "",
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert("Errore salvataggio: " + (err.error || res.statusText));
      return;
    }
    currentRecipe = await res.json();
    if (isNew) {
      recipes.push(currentRecipe);
      const opt = document.createElement("option");
      opt.value = currentRecipe.id;
      opt.textContent = currentRecipe.name || currentRecipe.menuItemName || currentRecipe.id;
      selectEl.appendChild(opt);
      selectEl.value = currentRecipe.id;
    } else {
      const idx = recipes.findIndex((r) => r.id === currentRecipe.id);
      if (idx >= 0) recipes[idx] = currentRecipe;
    }
    alert(isNew ? "Ricetta creata." : "Ricetta aggiornata.");
  }

  document.getElementById("btn-add-ingredient").addEventListener("click", () => {
    if (!currentRecipe) return;
    if (!currentRecipe.ingredients) currentRecipe.ingredients = [];
    currentRecipe.ingredients.push({
      name: "",
      ingredientName: "",
      quantity: 0,
      unit: "gr",
      unitCost: 0,
      costPerUnit: 0,
      totalCost: 0,
      wastagePercent: 0,
      notes: "",
    });
    renderRecipe();
  });

  selectEl.addEventListener("change", onSelectRecipe);
  document.getElementById("btn-save").addEventListener("click", saveRecipe);

  const btnUseAsDish = document.getElementById("btn-use-as-dish");
  if (btnUseAsDish) {
    btnUseAsDish.addEventListener("click", () => {
      if (!currentRecipe || !currentRecipe.id) {
        alert("Salva prima la ricetta per poterla usare come piatto.");
        return;
      }
      const meta = getMetaValues();
      const params = new URLSearchParams({
        fromRecipe: currentRecipe.id,
        name: currentRecipe.name || currentRecipe.menuItemName || "",
        category: currentRecipe.category || "",
        department: currentRecipe.department || currentRecipe.area || "cucina",
        portions: String(meta.yieldPortions || ""),
        targetFc: String(meta.targetFoodCost || ""),
        price: String(meta.sellingPrice || ""),
      });
      window.location.href = `/menu-admin/menu-admin.html?${params.toString()}`;
    });
  }

  const btnDuplicate = document.getElementById("btn-duplicate");
  if (btnDuplicate) {
    btnDuplicate.addEventListener("click", () => {
      if (!currentRecipe) return;
      currentRecipe = {
        ...currentRecipe,
        id: null,
        name: (currentRecipe.name || currentRecipe.menuItemName || "Ricetta") + " (copia)",
      };
      renderRecipe();
    });
  }

  const btnReset = document.getElementById("btn-reset");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      if (!currentRecipe) return;
      if (currentRecipe.id) {
        const original = recipes.find((r) => r.id === currentRecipe.id);
        if (original) {
          currentRecipe = original;
          renderRecipe();
        }
      } else {
        currentRecipe = buildNewDraftRecipe();
        selectEl.value = "";
        renderRecipe();
      }
    });
  }

  [
    "input-yield",
    "input-price",
    "input-target-fc",
    "input-iva",
    "input-overhead",
    "input-packaging",
    "input-labor",
    "input-energy",
    "input-extra",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateTotals);
  });

  // Bootstrap: show full calculator immediately as an empty draft.
  currentRecipe = buildNewDraftRecipe();
  renderRecipe();

  loadRecipes().catch((e) => {
    console.error(e);
    // Calculator remains usable even if recipes list fails.
  });
})();
