// qr-tables.js – QR Tavoli management page

(function () {
  const API_BASE = "/api/qr";
  const PRINT_ALL = API_BASE + "/tables/print-all";
  const PRINT_TABLE = (id) => API_BASE + "/tables/" + encodeURIComponent(id) + "/print";

  function getBaseUrl() {
    return window.location.origin;
  }

  function buildQrUrl(tableId) {
    return getBaseUrl() + "/qr/" + tableId;
  }

  function renderQr(el, url) {
    if (!el || typeof QRCode === "undefined") return;
    el.innerHTML = "";
    try {
      new QRCode(el, { text: url, width: 120, height: 120 });
    } catch (e) {
      el.textContent = "QR err";
    }
  }

  function escapeHtml(s) {
    if (s == null) return "";
    const div = document.createElement("div");
    div.textContent = String(s);
    return div.innerHTML;
  }

  function renderTableCard(table) {
    const url = buildQrUrl(table.id);
    const card = document.createElement("div");
    card.className = "table-card";
    card.innerHTML = `
      <h3>${escapeHtml(table.label || "Tavolo " + table.id)}</h3>
      <div class="qr-preview" data-url="${escapeHtml(url)}"></div>
      <div class="qr-url" title="${escapeHtml(url)}">${escapeHtml(url)}</div>
      <div class="actions">
        <button class="btn primary" data-action="print" data-id="${escapeHtml(String(table.id))}">Stampa</button>
      </div>
    `;
    const qrEl = card.querySelector(".qr-preview");
    renderQr(qrEl, url);
    card.querySelector("[data-action=print]").addEventListener("click", () => {
      window.open(PRINT_TABLE(table.id), "_blank", "width=400,height=500");
    });
    return card;
  }

  function loadTables() {
    const loading = document.getElementById("tables-loading");
    const grid = document.getElementById("tables-grid");
    if (!grid) return;
    if (loading) loading.style.display = "block";
    grid.innerHTML = "";

    fetch(API_BASE + "/tables", { credentials: "same-origin" })
      .then((r) => {
        if (!r.ok) throw new Error("Errore caricamento tavoli");
        return r.json();
      })
      .then((tables) => {
        if (loading) loading.style.display = "none";
        if (!Array.isArray(tables) || tables.length === 0) {
          grid.innerHTML = "<p class=\"loading-msg\">Nessun tavolo configurato. Verifica il numero di tavoli nella configurazione.</p>";
          return;
        }
        tables.forEach((t) => grid.appendChild(renderTableCard(t)));
      })
      .catch((err) => {
        if (loading) loading.style.display = "none";
        grid.innerHTML = "<p class=\"loading-msg\" style=\"color:var(--accent-danger);\">Errore: " + escapeHtml(err.message) + "</p>";
      });
  }

  function init() {
    document.getElementById("btn-print-all")?.addEventListener("click", () => {
      window.open(PRINT_ALL, "_blank", "width=900,height=700");
    });
    document.getElementById("btn-refresh")?.addEventListener("click", loadTables);
    loadTables();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
