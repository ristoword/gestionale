/* global window, document, fetch, navigator */
(function () {
  const $ = (id) => document.getElementById(id);

  async function getJson(url) {
    const r = await fetch(url, { credentials: "include" });
    if (r.status === 401) {
      window.location.href = "/super-admin-login";
      throw new Error("401");
    }
    return r.json();
  }

  async function postJson(url, body) {
    const r = await fetch(url, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    if (r.status === 401) {
      window.location.href = "/super-admin-login";
      throw new Error("401");
    }
    return r.json();
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  // --- Tabs ---
  document.querySelectorAll("#sa-console-tabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-panel");
      document.querySelectorAll("#sa-console-tabs .tab").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const panel = document.getElementById(`panel-${id}`);
      if (panel) panel.classList.add("active");
    });
  });

  // --- GS codes ---
  function renderGsKpi(stats) {
    const el = $("gs-kpi");
    if (!stats) {
      el.innerHTML = "";
      return;
    }
    const rows = [
      ["Totale", stats.total],
      ["Disponibili (rimasti)", stats.available],
      ["Assegnati", stats.assigned],
      ["Usati", stats.used],
      ["Scaduti", stats.expired],
      ["Altri", stats.other],
    ];
    el.innerHTML = rows
      .map(
        ([k, v]) =>
          `<div><div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`
      )
      .join("");
    $("gs-meta").textContent = [
      stats.importedAt ? `Ultimo import/sync: ${stats.importedAt}` : "",
      stats.lastSyncFromGsAt ? `Sync GS: ${stats.lastSyncFromGsAt}` : "",
      stats.lastNotifyToGsAt ? `Notify GS: ${stats.lastNotifyToGsAt}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
  }

  function renderGsTable(codes) {
    const tb = $("gs-table-body");
    const list = Array.isArray(codes) ? codes : [];
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="5" class="muted">Nessun codice nel mirror.</td></tr>`;
      return;
    }
    tb.innerHTML = list
      .map((c) => {
        const st = String(c.status || "—");
        return `<tr>
          <td class="mono">${esc(c.code)}</td>
          <td><span class="pill">${esc(st)}</span></td>
          <td>${esc(c.assignedEmail || "—")}</td>
          <td>${esc(c.source || "—")}</td>
          <td class="mono" style="font-size:11px">${esc(c.rwSyncedAt || c.activatedAt || "—")}</td>
        </tr>`;
      })
      .join("");
  }

  async function loadGsCodes() {
    $("gs-gen-msg").textContent = "";
    const out = await getJson("/api/super-admin/console/gs-codes");
    if (!out.ok) return;
    renderGsKpi(out.stats);
    renderGsTable(out.codes);
  }

  async function genCodes(n) {
    $("gs-gen-msg").textContent = "Generazione…";
    const out = await postJson("/api/super-admin/console/gs-codes/generate", { count: n });
    if (!out.ok) {
      $("gs-gen-msg").textContent = out.message || out.error || "Errore";
      return;
    }
    let msg = `Generati ${out.generated} codici.`;
    if (out.gsSync) {
      if (out.gsSync.skipped) msg += ` GS: non configurato (${out.gsSync.reason || "GS_CODES_UPSERT_URL"}).`;
      else if (out.gsSync.ok) msg += " GS: batch sincronizzato.";
      else msg += ` GS: errore sync — ${out.gsSync.error || out.gsSync.status || "vedi log"}.`;
    }
    $("gs-gen-msg").textContent = msg;
    renderGsKpi(out.stats);
    await loadGsCodes();
  }

  $("btn-refresh-codes").addEventListener("click", () => loadGsCodes());
  $("btn-gen-1").addEventListener("click", () => genCodes(1));
  $("btn-gen-25").addEventListener("click", () => genCodes(25));

  // --- Contacts ---
  async function loadContacts() {
    const out = await getJson("/api/super-admin/console/contacts");
    const tb = $("contacts-table");
    const list = out.ok && Array.isArray(out.contacts) ? out.contacts : [];
    if (!list.length) {
      tb.innerHTML = `<tr><td colspan="4" class="muted">Nessun contatto.</td></tr>`;
      return;
    }
    tb.innerHTML = list
      .map(
        (c) => `<tr>
        <td>${esc(c.email)}</td>
        <td>${esc(c.category)}</td>
        <td>${esc(c.note || "—")}</td>
        <td class="mono" style="font-size:11px">${esc(c.createdAt || "")}</td>
      </tr>`
      )
      .join("");
  }

  $("btn-contact-add").addEventListener("click", async () => {
    $("contact-msg").textContent = "";
    const email = $("contact-email").value.trim();
    const category = $("contact-cat").value;
    const note = $("contact-note").value.trim();
    const out = await postJson("/api/super-admin/console/contacts", { email, category, note });
    if (!out.ok) {
      $("contact-msg").textContent = out.error || "Errore salvataggio";
      return;
    }
    $("contact-msg").textContent = "Salvato.";
    $("contact-email").value = "";
    $("contact-note").value = "";
    await loadContacts();
  });

  // --- Users ---
  let usersCache = [];

  function fieldRowPlain(label, value) {
    const hasVal = value != null && String(value) !== "";
    const display = hasVal ? esc(String(value)) : "—";
    return `<div class="field-row"><span class="field-label">${esc(label)}</span><span class="field-val">${display}</span></div>`;
  }

  /** Valore nascosto: usa data-full-value con encodeURIComponent */
  function fieldRowSecret(label, value) {
    const hasVal = value != null && String(value) !== "";
    if (!hasVal) {
      return `<div class="field-row"><span class="field-label">${esc(label)}</span><span class="field-val">—</span></div>`;
    }
    const id = `u-${Math.random().toString(36).slice(2)}`;
    const enc = encodeURIComponent(String(value));
    return `<div class="field-row" data-full-value="${enc}">
      <span class="field-label">${esc(label)}</span>
      <span class="field-val" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;flex-wrap:wrap">
        <span class="hidden-val" id="${id}-mask">••••••••</span>
        <button type="button" class="btn small" data-reveal-user="${id}">Mostra</button>
      </span>
    </div>`;
  }

  function bindUserReveals(root) {
    root.querySelectorAll("[data-reveal-user]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const uid = btn.getAttribute("data-reveal-user");
        const mask = document.getElementById(`${uid}-mask`);
        const row = btn.closest(".field-row");
        let full = "";
        try {
          const enc = row && row.dataset && row.dataset.fullValue != null ? row.dataset.fullValue : "";
          full = enc ? decodeURIComponent(enc) : "";
        } catch (_) {
          full = "";
        }
        if (!mask) return;
        if (mask.textContent.includes("•")) {
          mask.textContent = full;
          mask.classList.remove("hidden-val");
          btn.textContent = "Nascondi";
        } else {
          mask.textContent = "••••••••";
          mask.classList.add("hidden-val");
          btn.textContent = "Mostra";
        }
      });
    });
  }

  function openUserModal(u) {
    $("modal-user-title").textContent = `Utente ${esc(u.username || u.id)}`;
    const skip = new Set(["leaveBalances"]);
    const lines = [];
    const order = [
      "id",
      "username",
      "name",
      "surname",
      "email",
      "phone",
      "nationality",
      "vat",
      "partitaIva",
      "role",
      "department",
      "restaurantId",
      "is_active",
      "mustChangePassword",
      "createdAt",
    ];
    const keys = [...new Set([...order, ...Object.keys(u || {})])].filter((k) => k && !skip.has(k));
    for (const k of keys) {
      if (!(k in u)) continue;
      const v = u[k];
      if (typeof v === "object" && v !== null) continue;
      const sensitive = /email|phone|vat|piva|fiscal|codice|nationality|indirizzo|address|name|surname|username/i.test(
        k
      );
      if (sensitive) lines.push(fieldRowSecret(k, v));
      else lines.push(fieldRow(k, v, false));
    }
    const el = $("modal-user-fields");
    el.innerHTML = lines.join("");
    bindUserReveals(el);
    $("modal-user").classList.add("open");
  }

  function closeUserModal() {
    $("modal-user").classList.remove("open");
  }

  $("modal-user-close").addEventListener("click", closeUserModal);
  $("modal-user").addEventListener("click", (e) => {
    if (e.target === $("modal-user")) closeUserModal();
  });

  function openCustModal(c) {
    const t = `${c.name || ""} ${c.surname || ""}`.trim();
    $("modal-cust-title").textContent = t || "Cliente";
    const lines = [
      fieldRowSecret("Nome", c.name),
      fieldRowSecret("Cognome", c.surname),
      fieldRowSecret("Email", c.email),
      fieldRowSecret("Telefono", c.phone),
      fieldRowSecret("Nazionalità", c.nationality),
      fieldRowSecret("P.IVA / VAT", c.vat),
      fieldRowSecret("Codice fiscale", c.fiscalCode),
      fieldRowSecret("Indirizzo", c.address),
      fieldRowSecret("Categoria", c.category),
      fieldRowSecret("Note", c.notes),
      fieldRowPlain("Tenant", c.restaurantId),
      fieldRowPlain("ID record", c.id),
    ];
    const el = $("modal-cust-fields");
    el.innerHTML = lines.join("");
    bindUserReveals(el);
    $("modal-cust").classList.add("open");
  }

  function closeCustModal() {
    $("modal-cust").classList.remove("open");
  }

  $("modal-cust-close").addEventListener("click", closeCustModal);
  $("modal-cust").addEventListener("click", (e) => {
    if (e.target === $("modal-cust")) closeCustModal();
  });

  function openPwdModal(pwd) {
    $("modal-pwd-text").textContent = pwd;
    $("modal-pwd").classList.add("open");
    $("modal-pwd-copy").onclick = async () => {
      try {
        await navigator.clipboard.writeText(pwd);
        $("modal-pwd-text").textContent = pwd + " (copiato)";
      } catch (_) {
        window.prompt("Copia la password:", pwd);
      }
    };
  }

  function closePwdModal() {
    $("modal-pwd").classList.remove("open");
    $("modal-pwd-text").textContent = "";
  }

  $("modal-pwd-close").addEventListener("click", closePwdModal);
  $("modal-pwd").addEventListener("click", (e) => {
    if (e.target === $("modal-pwd")) closePwdModal();
  });

  async function loadUsers() {
    const out = await getJson("/api/super-admin/console/users");
    usersCache = out.ok && Array.isArray(out.users) ? out.users : [];
    const tb = $("users-table");
    if (!usersCache.length) {
      tb.innerHTML = `<tr><td colspan="5" class="muted">Nessun utente.</td></tr>`;
      return;
    }
    tb.innerHTML = usersCache
      .map((u) => {
        return `<tr>
        <td class="mono">${esc(u.id)}</td>
        <td>${esc(u.username)}</td>
        <td>${esc(u.role)}</td>
        <td class="mono">${esc(u.restaurantId || "—")}</td>
        <td class="row">
          <button type="button" class="btn small" data-user-detail="${esc(u.id)}">Scheda / campi</button>
          <button type="button" class="btn small primary" data-user-reset="${esc(u.id)}">Nuova password</button>
        </td>
      </tr>`;
      })
      .join("");

    tb.querySelectorAll("[data-user-detail]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-user-detail");
        const u = usersCache.find((x) => String(x.id) === String(id));
        if (u) openUserModal(u);
      });
    });

    tb.querySelectorAll("[data-user-reset]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-user-reset");
        if (!window.confirm("Generare una nuova password per questo utente?")) return;
        const out = await postJson("/api/super-admin/console/reset-password", { userId: id, forceMustChange: true });
        if (!out.ok) {
          window.alert(out.error || "Errore");
          return;
        }
        openPwdModal(out.temporaryPassword);
      });
    });
  }

  $("btn-refresh-users").addEventListener("click", () => loadUsers());

  // --- Customers ---
  async function loadCustomers(q) {
    const url = "/api/super-admin/customers" + (q ? `?q=${encodeURIComponent(q)}` : "");
    const out = await getJson(url);
    const customers = out.customers || [];
    const tb = $("cust-table");
    if (!customers.length) {
      tb.innerHTML = `<tr><td colspan="4" class="muted">Nessun cliente.</td></tr>`;
      return;
    }
    tb.innerHTML = customers
      .map((c, idx) => {
        const label = `${c.name || ""} ${c.surname || ""}`.trim() || "—";
        return `<tr>
        <td class="mono">${esc(c.restaurantId)}</td>
        <td class="mono">${esc(c.id)}</td>
        <td>${esc(label)}</td>
        <td><button type="button" class="btn small" data-cust-idx="${idx}">Apri scheda</button></td>
      </tr>`;
      })
      .join("");

    tb.querySelectorAll("[data-cust-idx]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.getAttribute("data-cust-idx"), 10);
        const c = customers[idx];
        if (c) openCustModal(c);
      });
    });
  }

  $("btn-cust-search").addEventListener("click", () => loadCustomers($("cust-q").value.trim()));
  $("btn-cust-refresh").addEventListener("click", () => {
    $("cust-q").value = "";
    loadCustomers("");
  });

  $("sa-console-logout").addEventListener("click", async () => {
    await postJson("/api/super-admin/logout", {});
    window.location.href = "/super-admin-login";
  });

  // init
  loadGsCodes();
  loadContacts();
  loadUsers();
  loadCustomers("");
})();
