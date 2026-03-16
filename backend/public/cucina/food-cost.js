(function () {
  "use strict";

  const UNITS = ["gr", "kg", "ml", "cl", "lt", "pz"];
  let recipes = [];
  let currentRecipe = null;

  const selectEl = document.getElementById("recipe-select");
  const panelEl = document.getElementById("recipe-panel");
  const emptyEl = document.getElementById("empty-state");

  function showPanel(show) {
    panelEl.style.display = show ? "block" : "none";
    emptyEl.style.display = show ? "none" : "block";
  }

  function formatEuro(n) {
    return "€ " + (Number(n) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  async function loadRecipes() {
    const res = await fetch("/api/recipes", { credentials: "same-origin" });
    if (!res.ok) throw new Error("Errore caricamento ricette");
    recipes = await res.json();
    selectEl.innerHTML = '<option value="">-- Scegli ricetta --</option>';
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
    const production = raw + iva + overhead + (meta.packagingCost || 0) + (meta.laborCost || 0);
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
    if (!currentRecipe) {
      showPanel(false);
      return;
    }
    showPanel(true);
    document.getElementById("recipe-name").textContent = currentRecipe.name || currentRecipe.menuItemName || "Ricetta";

    document.getElementById("input-yield").value = currentRecipe.yieldPortions ?? currentRecipe.yield_portions ?? 1;
    document.getElementById("input-price").value = currentRecipe.sellingPrice ?? currentRecipe.selling_price ?? 0;
    document.getElementById("input-target-fc").value = currentRecipe.targetFoodCost ?? currentRecipe.target_food_cost ?? 0;
    document.getElementById("input-iva").value = currentRecipe.ivaPercent ?? currentRecipe.iva_percent ?? 0;
    document.getElementById("input-overhead").value = currentRecipe.overheadPercent ?? currentRecipe.overhead_percent ?? 0;
    document.getElementById("input-packaging").value = currentRecipe.packagingCost ?? currentRecipe.packaging_cost ?? 0;
    document.getElementById("input-labor").value = currentRecipe.laborCost ?? currentRecipe.labor_cost ?? 0;

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
      currentRecipe = null;
      showPanel(false);
      return;
    }
    currentRecipe = recipes.find((r) => r.id === id) || null;
    if (!currentRecipe) {
      showPanel(false);
      return;
    }
    await loadFoodCostAndRender();
  }

  async function saveRecipe() {
    if (!currentRecipe || !currentRecipe.id) return;
    const meta = getMetaValues();
    const ingredients = readIngredientRows();
    const payload = {
      yieldPortions: meta.yieldPortions,
      sellingPrice: meta.sellingPrice,
      targetFoodCost: meta.targetFoodCost,
      ivaPercent: meta.ivaPercent,
      overheadPercent: meta.overheadPercent,
      packagingCost: meta.packagingCost,
      laborCost: meta.laborCost,
      ingredients,
    };
    const res = await fetch("/api/recipes/" + currentRecipe.id, {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert("Errore salvataggio: " + (err.error || res.statusText));
      return;
    }
    currentRecipe = await res.json();
    const idx = recipes.findIndex((r) => r.id === currentRecipe.id);
    if (idx >= 0) recipes[idx] = currentRecipe;
    alert("Ricetta aggiornata.");
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

  ["input-yield", "input-price", "input-target-fc", "input-iva", "input-overhead", "input-packaging", "input-labor"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", updateTotals);
  });

  loadRecipes().then(() => {
    if (recipes.length === 0) {
      emptyEl.querySelector("p").textContent = "Nessuna ricetta presente. Crea ricette dalla sezione Ricette in Cucina.";
    }
  }).catch((e) => {
    console.error(e);
    emptyEl.querySelector("p").textContent = "Errore nel caricamento delle ricette.";
  });
})();
