function $(id) {
  return document.getElementById(id);
}

async function getJson(url) {
  const res = await fetch(url, { method: "GET", credentials: "same-origin" });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

async function postJson(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

function textOrDash(v) {
  if (v === null || v === undefined) return "—";
  const s = String(v);
  return s.trim().length ? s : "—";
}

function renderCustomers(customers) {
  const tbody = $("sa-customers-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const list = Array.isArray(customers) ? customers : [];
  for (const c of list) {
    const tenant = c.restaurantId || "";
    const fullName = [c.name, c.surname].filter(Boolean).join(" ");
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${tenant}</td>
      <td>${fullName || "—"}</td>
      <td class="mono">${textOrDash(c.phone)}</td>
      <td>
        <div class="row" style="gap:6px">
          <button type="button" class="btn primary" data-sa-act="enter-tenant" data-tenant="${tenant}">Entra</button>
          <button type="button" class="btn" data-sa-act="open-supervisor" data-tenant="${tenant}">Supervisor</button>
          <button type="button" class="btn" data-act="block" data-tenant="${tenant}">Blocca</button>
          <button type="button" class="btn" data-act="unblock" data-tenant="${tenant}">Sblocca</button>
          <button type="button" class="btn danger" data-act="force-logout" data-tenant="${tenant}">Logout</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderUsers(usersWrap) {
  const tbody = $("sa-users-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const users = usersWrap?.users || usersWrap || [];
  const list = Array.isArray(users) ? users : [];
  for (const u of list) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${textOrDash(u.username)}</td>
      <td>${textOrDash(u.role)}</td>
      <td class="mono">${textOrDash(u.restaurantId)}</td>
      <td class="mono">${u.is_active === false ? "false" : "true"}</td>
    `;
    tbody.appendChild(tr);
  }
}

function renderLicenses(licenses) {
  const tbody = $("sa-licenses-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const list = Array.isArray(licenses) ? licenses : [];
  for (const l of list) {
    const tenant = String(l.restaurantId || "").trim();
    const fileOnly = l.onlyInTenantFile ? ' <span class="muted" title="Presente in data/tenants/.../license.json ma non in licenses.json globale">(solo file tenant)</span>' : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${textOrDash(l.restaurantId)}${fileOnly}</td>
      <td>${textOrDash(l.plan)}</td>
      <td class="mono">${textOrDash(l.status)}${l.suspicious ? " (sospetto)" : ""}</td>
      <td class="mono">${textOrDash(l.expiresAt)}</td>
      <td class="mono" style="word-break:break-all;max-width:220px">${textOrDash(l.activationCode)}</td>
      <td>
        <div class="row" style="gap:6px">
          <button type="button" class="btn primary" data-sa-act="enter-tenant" data-tenant="${tenant}">Entra</button>
          <button type="button" class="btn" data-sa-act="open-supervisor" data-tenant="${tenant}">Supervisor</button>
          <button type="button" class="btn" data-sa-act="open-cassa" data-tenant="${tenant}">Cassa</button>
          <button type="button" class="btn" data-sa-act="open-sala" data-tenant="${tenant}">Sala</button>
          ${l.suspicious ? `<button type="button" class="btn" data-sa-act="mark-trusted" data-tenant="${tenant}">Approva</button>` : ""}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function renderPayments(payments) {
  const tbody = $("sa-payments-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const stripe = payments?.stripe || {};
  const sessions = stripe.sessionsSample || [];
  for (const s of sessions) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="mono">${textOrDash(s.id)}</td>
      <td class="mono">${textOrDash(s.restaurantId)}</td>
      <td class="mono">${textOrDash(s.plan)}</td>
      <td class="mono">${textOrDash(s.mode)}</td>
      <td class="mono">${textOrDash(s.status)}</td>
      <td class="mono">${textOrDash(s.createdAt)}</td>
    `;
    tbody.appendChild(tr);
  }
}

async function refreshWorkingTenantPill() {
  const el = $("sa-working-tenant");
  if (!el) return;
  const wt = await getJson("/api/super-admin/working-tenant");
  if (wt.ok && wt.data?.workingTenant) {
    el.textContent = "Tenant attivo: " + wt.data.workingTenant;
  } else {
    el.textContent = "Tenant attivo: default (imposta con Entra / Supervisor)";
  }
}

async function setWorkingTenant(tenant) {
  const rid = String(tenant || "").trim();
  if (!rid) return { ok: false };
  return postJson("/api/super-admin/working-tenant", { restaurantId: rid });
}

async function loadAll() {
  await refreshWorkingTenantPill();

  const statusOut = await getJson("/api/super-admin/system-status");
  if (statusOut.ok) {
    const s = statusOut.data || {};
    const k = s.kpis || {};
    $("kpi-customers").textContent = textOrDash(k.customersCount);
    $("kpi-licenses-active").textContent = textOrDash(k.licensesActive);
    $("kpi-licenses-expired").textContent = textOrDash(k.licensesExpired);
    $("kpi-trial-active").textContent = textOrDash(k.trialActive);
    $("kpi-payments-ok").textContent = textOrDash(k.paymentsSucceeded);
    $("kpi-payments-failed").textContent = textOrDash(k.paymentsFailed);
    $("kpi-support-open").textContent = textOrDash(k.supportOpen);
    $("kpi-sub-monthly").textContent = textOrDash(k.subscriptionsMonthly);
    $("kpi-sub-annual").textContent = textOrDash(k.subscriptionsAnnual);
    $("kpi-maintenance").textContent = s.maintenance?.enabled ? "ON" : "OFF";
    $("sa-maintenance-toggle") && ($("sa-maintenance-toggle").value = s.maintenance?.enabled ? "true" : "false");

    $("sys-time").textContent = textOrDash(s.server?.serverTime);
    $("sys-uptime").textContent = textOrDash((s.server?.uptimeSeconds ?? "—") + "s");
    $("sys-version").textContent = textOrDash(s.server?.version);

    const stripe = s.stripe || {};
    $("stripe-secret-key").textContent = textOrDash(stripe.masked?.STRIPE_SECRET_KEY);
    $("stripe-webhook-secret").textContent = textOrDash(stripe.masked?.STRIPE_WEBHOOK_SECRET);
    $("stripe-price-monthly").textContent = textOrDash(stripe.masked?.STRIPE_PRICE_RISTOWORD_MONTHLY);
    $("stripe-price-annual").textContent = textOrDash(stripe.masked?.STRIPE_PRICE_RISTOWORD_ANNUAL);

    const pres = stripe.keysPresence || {};
    const presText = `secret:${pres.STRIPE_SECRET_KEY ? "present" : "missing"} • webhook:${pres.STRIPE_WEBHOOK_SECRET ? "present" : "missing"} • priceMonthly:${pres.STRIPE_PRICE_RISTOWORD_MONTHLY ? "present" : "missing"} • priceAnnual:${pres.STRIPE_PRICE_RISTOWORD_ANNUAL ? "present" : "missing"}`;
    $("stripe-presence").textContent = presText;

    const wh = stripe.stripeMock || {};
    $("stripe-webhook-status").textContent = `pending:${textOrDash(wh.pendingEvents)} • lastAt:${textOrDash(wh.lastProcessedAt)} • processed:${textOrDash(wh.processedCount)}`;
  }

  const customersOut = await getJson("/api/super-admin/customers");
  if (customersOut.ok) {
    renderCustomers(customersOut.data?.customers || []);
    renderUsers(customersOut.data?.users || []);
  }

  const licensesOut = await getJson("/api/super-admin/licenses");
  if (licensesOut.ok) {
    renderLicenses(licensesOut.data?.licenses || []);
  }

  const paymentsOut = await getJson("/api/super-admin/payments");
  if (paymentsOut.ok) {
    const pd = paymentsOut.data || {};
    $("kpi-stripe-sessions").textContent = textOrDash(pd.stripe?.sessionsTotal);
    $("kpi-stripe-paid").textContent = textOrDash(pd.stripe?.byStatus?.paid);
    $("kpi-stripe-failed").textContent = textOrDash(pd.stripe?.byStatus?.failed);
    renderPayments(pd);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadAll().catch(() => {});

  $("sa-btn-logout")?.addEventListener("click", async () => {
    await postJson("/api/super-admin/logout", {});
    window.location.href = "/super-admin-login";
  });

  $("sa-btn-save-maintenance")?.addEventListener("click", async () => {
    const enabled = $("sa-maintenance-toggle").value === "true";
    $("sa-maintenance-msg").textContent = "Salvataggio...";
    const out = await postJson("/api/super-admin/maintenance/toggle", { enabled });
    if (!out.ok) {
      $("sa-maintenance-msg").textContent = out.data?.error || "Errore";
      return;
    }
    $("sa-maintenance-msg").textContent = "OK. Ricarico...";
    await loadAll();
  });

  $("sa-btn-search-customers")?.addEventListener("click", async () => {
    const q = $("sa-customers-search").value || "";
    const out = await getJson("/api/super-admin/customers?q=" + encodeURIComponent(q));
    if (out.ok) {
      renderCustomers(out.data?.customers || []);
      renderUsers(out.data?.users || []);
    }
  });

  $("sa-btn-refresh-customers")?.addEventListener("click", async () => {
    $("sa-customers-search").value = "";
    await loadAll();
  });

  // Customer actions: event delegation
  $("sa-customers-tbody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const tenant = btn.getAttribute("data-tenant");
    const act = btn.getAttribute("data-act");

    const map = {
      block: "/api/super-admin/customer/block",
      unblock: "/api/super-admin/customer/unblock",
      "force-logout": "/api/super-admin/customer/force-logout",
    };

    const url = map[act];
    if (!url) return;
    btn.disabled = true;
    const out = await postJson(url, { restaurantId: tenant });
    btn.disabled = false;
    if (!out.ok) {
      alert(out.data?.error || "Errore");
      return;
    }
    await loadAll();
  });

  $("sa-btn-create-temp-license")?.addEventListener("click", async () => {
    const rid = $("sa-license-tenant-id").value.trim();
    const plan = $("sa-license-plan").value.trim();
    const days = Number($("sa-license-days").value) || 30;
    const note = $("sa-support-note").value || "";
    const activateImmediately = $("sa-license-activate-now").checked;

    if (!rid) return alert("restaurantId obbligatorio");

    const out = await postJson("/api/super-admin/license/create-temp", {
      restaurantId: rid,
      plan,
      mode: "emergency",
      extendDays: days,
      activateImmediately,
      note,
    });
    if (!out.ok) return alert(out.data?.error || "Errore creazione licenza");
    await loadAll();
  });

  $("sa-btn-revoke-license")?.addEventListener("click", async () => {
    const rid = $("sa-license-revoke-tenant-id").value.trim();
    if (!rid) return alert("restaurantId obbligatorio");
    const reason = $("sa-license-revoke-reason").value || "";
    const suspicious = $("sa-license-revoke-suspicious").checked;

    const out = await postJson("/api/super-admin/license/revoke", { restaurantId: rid, reason, suspicious });
    if (!out.ok) return alert(out.data?.error || "Errore revoca licenza");
    await loadAll();
  });

  // Licenze: entra nel tenant / apri moduli
  $("sa-licenses-tbody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-sa-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-sa-act");
    const tenant = btn.getAttribute("data-tenant");
    if (!tenant) return;

    if (act === "mark-trusted") {
      btn.disabled = true;
      const out = await postJson("/api/super-admin/license/mark-trusted", { restaurantId: tenant });
      btn.disabled = false;
      if (!out.ok) return alert(out.data?.error || "Errore");
      await loadAll();
      return;
    }

    if (act === "enter-tenant") {
      btn.disabled = true;
      const out = await setWorkingTenant(tenant);
      btn.disabled = false;
      if (!out.ok) return alert(out.data?.error || "Errore contesto tenant");
      await refreshWorkingTenantPill();
      return;
    }

    const paths = {
      "open-supervisor": "/supervisor/supervisor.html",
      "open-cassa": "/cassa/cassa.html",
      "open-sala": "/sala/sala.html",
    };
    const dest = paths[act];
    if (!dest) return;

    btn.disabled = true;
    const out = await setWorkingTenant(tenant);
    btn.disabled = false;
    if (!out.ok) return alert(out.data?.error || "Errore contesto tenant");
    window.location.href = dest;
  });

  $("sa-customers-tbody")?.addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-sa-act]");
    if (!btn) return;
    const act = btn.getAttribute("data-sa-act");
    const tenant = btn.getAttribute("data-tenant");
    if (!tenant) return;

    if (act === "enter-tenant") {
      btn.disabled = true;
      const out = await setWorkingTenant(tenant);
      btn.disabled = false;
      if (!out.ok) return alert(out.data?.error || "Errore contesto tenant");
      await refreshWorkingTenantPill();
      return;
    }

    if (act === "open-supervisor") {
      btn.disabled = true;
      const out = await setWorkingTenant(tenant);
      btn.disabled = false;
      if (!out.ok) return alert(out.data?.error || "Errore contesto tenant");
      window.location.href = "/supervisor/supervisor.html";
    }
  });

  $("sa-btn-save-stripe-config")?.addEventListener("click", async () => {
    const values = {
      STRIPE_SECRET_KEY: $("sa-stripe-secret-key-input").value || "",
      STRIPE_WEBHOOK_SECRET: $("sa-stripe-webhook-secret-input").value || "",
      STRIPE_PRICE_RISTOWORD_MONTHLY: $("sa-stripe-price-monthly-input").value || "",
      STRIPE_PRICE_RISTOWORD_ANNUAL: $("sa-stripe-price-annual-input").value || "",
    };

    const out = await postJson("/api/super-admin/system-status", { values });
    if (!out.ok) {
      $("sa-stripe-save-msg").textContent = out.data?.error || "Errore";
      return;
    }
    $("sa-stripe-save-msg").textContent = "Config salvata (masked). Ricarico...";
    await loadAll();
  });
});

