// hardware.js – Devices, print routes, job monitor

const DEVICES_API = "/api/devices";
const ROUTES_API = "/api/print-routes";
const JOBS_API = "/api/print-jobs";

let devices = [];
let routes = [];
let jobs = [];

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

function showTab(tabName) {
  document.querySelectorAll(".hw-nav .nav-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tabName);
  });
  document.querySelectorAll(".tab-panel").forEach((p) => {
    p.classList.toggle("active", p.id === "tab-" + tabName);
  });
  if (tabName === "jobs") loadJobs();
}

function collectDeviceForm() {
  return {
    name: document.getElementById("device-name").value?.trim(),
    type: document.getElementById("device-type").value,
    department: document.getElementById("device-department").value,
    connectionType: document.getElementById("device-connection").value,
    ipAddress: document.getElementById("device-ip").value?.trim() || null,
    port: document.getElementById("device-port").value ? parseInt(document.getElementById("device-port").value, 10) : null,
    isDefault: document.getElementById("device-default").checked,
    isActive: document.getElementById("device-active").checked,
    notes: document.getElementById("device-notes").value?.trim() || "",
  };
}

function clearDeviceForm() {
  document.getElementById("device-id").value = "";
  document.getElementById("device-form-title").textContent = "Nuovo dispositivo";
  document.getElementById("device-name").value = "";
  document.getElementById("device-type").value = "thermal_printer";
  document.getElementById("device-department").value = "cucina";
  document.getElementById("device-connection").value = "usb";
  document.getElementById("device-ip").value = "";
  document.getElementById("device-port").value = "";
  document.getElementById("device-default").checked = false;
  document.getElementById("device-active").checked = true;
  document.getElementById("device-notes").value = "";
}

function loadDeviceIntoForm(d) {
  document.getElementById("device-id").value = d.id;
  document.getElementById("device-form-title").textContent = "Modifica dispositivo";
  document.getElementById("device-name").value = d.name || "";
  document.getElementById("device-type").value = d.type || "thermal_printer";
  document.getElementById("device-department").value = d.department || "cucina";
  document.getElementById("device-connection").value = d.connectionType || "usb";
  document.getElementById("device-ip").value = d.ipAddress || "";
  document.getElementById("device-port").value = d.port || "";
  document.getElementById("device-default").checked = Boolean(d.isDefault);
  document.getElementById("device-active").checked = d.isActive !== false;
  document.getElementById("device-notes").value = d.notes || "";
}

function renderDevicesList() {
  const el = document.getElementById("devices-list");
  if (!devices.length) {
    el.innerHTML = '<div class="empty-msg">Nessun dispositivo. Aggiungine uno.</div>';
    return;
  }
  el.innerHTML = devices.map((d) => `
    <div class="device-item ${d.isActive ? "" : "inactive"}" data-id="${d.id}">
      <div>
        <strong>${escapeHtml(d.name)}</strong>
        <span class="muted">${d.type} • ${d.department}</span>
        ${d.isDefault ? ' <span class="badge">Default</span>' : ""}
        ${!d.isActive ? ' <span class="badge danger">Inattivo</span>' : ""}
      </div>
      <div class="device-item-actions">
        <button data-action="test" data-id="${d.id}">Test</button>
        <button data-action="edit" data-id="${d.id}">Modifica</button>
        <button class="danger" data-action="delete" data-id="${d.id}">Elimina</button>
      </div>
    </div>
  `).join("");
  el.querySelectorAll("[data-action]").forEach((btn) => {
    const action = btn.dataset.action;
    const id = btn.dataset.id;
    const dev = devices.find((x) => x.id === id);
    if (!dev) return;
    btn.addEventListener("click", async () => {
      if (action === "edit") loadDeviceIntoForm(dev);
      if (action === "delete") {
        if (!confirm("Eliminare questo dispositivo?")) return;
        await fetchJSON(`${DEVICES_API}/${id}`, { method: "DELETE" });
        await loadDevices();
      }
      if (action === "test") {
        try {
          const r = await fetchJSON(`${DEVICES_API}/${id}/test-print`, { method: "POST" });
          alert(r.message || "Job di test creato.");
          await loadJobs();
        } catch (e) {
          alert("Errore: " + e.message);
        }
      }
    });
  });
}

async function loadDevices() {
  devices = await fetchJSON(DEVICES_API);
  if (!Array.isArray(devices)) devices = [];
  renderDevicesList();
  const sel = document.getElementById("route-device");
  if (sel) {
    sel.innerHTML = '<option value="">— Seleziona —</option>' + devices
      .filter((d) => d.isActive)
      .map((d) => `<option value="${d.id}">${escapeHtml(d.name)} (${d.department})</option>`)
      .join("");
  }
}

function renderRoutesList() {
  const el = document.getElementById("routes-list");
  if (!routes.length) {
    el.innerHTML = '<div class="empty-msg">Nessuna route. Le route associano eventi ai dispositivi.</div>';
    return;
  }
  el.innerHTML = routes.map((r) => {
    const dev = devices.find((d) => d.id === r.deviceId);
    const devName = dev ? dev.name : r.deviceId || "—";
    return `
    <div class="route-item">
      <div>
        <strong>${escapeHtml(r.eventType)}</strong> → ${escapeHtml(devName)}
        <br><small>${r.department || "-"}</small>
      </div>
      <div class="route-item-actions">
        <button class="danger" data-action="delete" data-id="${r.id}">Elimina</button>
      </div>
    </div>
  `;
  }).join("");
  el.querySelectorAll("[data-action=delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Eliminare questa route?")) return;
      await fetchJSON(`${ROUTES_API}/${btn.dataset.id}`, { method: "DELETE" });
      await loadRoutes();
    });
  });
}

async function loadRoutes() {
  routes = await fetchJSON(ROUTES_API);
  if (!Array.isArray(routes)) routes = [];
  renderRoutesList();
}

function renderJobsList() {
  const el = document.getElementById("jobs-list");
  const list = jobs.slice().reverse();
  if (!list.length) {
    el.innerHTML = '<div class="empty-msg">Nessun job.</div>';
    return;
  }
  el.innerHTML = list.slice(0, 50).map((j) => `
    <div class="job-item status-${j.status}">
      <div class="job-item-title">${escapeHtml(j.documentTitle || j.eventType)}</div>
      <div class="job-item-meta">
        ${j.eventType} • ${j.department} • ${j.status}
        ${j.sourceModule ? " • " + j.sourceModule : ""}
        ${j.errorMessage ? " • " + escapeHtml(j.errorMessage) : ""}
        <br>${new Date(j.createdAt).toLocaleString("it-IT")}
      </div>
      ${j.status === "failed" ? `<div class="job-item-actions"><button class="retry-job btn-xs" data-id="${j.id}">Riprova</button></div>` : ""}
    </div>
  `).join("");
  el.querySelectorAll(".retry-job").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await fetchJSON(`${JOBS_API}/${btn.dataset.id}/retry`, { method: "POST" });
        await loadJobs();
      } catch (e) {
        alert("Errore: " + e.message);
      }
    });
  });
}

async function loadJobs() {
  const status = document.getElementById("job-filter-status")?.value || "";
  const url = status ? `${JOBS_API}?status=${status}&limit=100` : `${JOBS_API}?limit=100`;
  jobs = await fetchJSON(url);
  if (!Array.isArray(jobs)) jobs = [];
  renderJobsList();
}

document.addEventListener("DOMContentLoaded", async () => {
  document.querySelectorAll(".hw-nav .nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  document.getElementById("btn-device-save")?.addEventListener("click", async () => {
    const data = collectDeviceForm();
    if (!data.name) {
      alert("Inserisci il nome.");
      return;
    }
    try {
      const id = document.getElementById("device-id").value;
      if (id) {
        await fetchJSON(`${DEVICES_API}/${id}`, { method: "PATCH", body: JSON.stringify(data) });
      } else {
        await fetchJSON(DEVICES_API, { method: "POST", body: JSON.stringify(data) });
      }
      clearDeviceForm();
      await loadDevices();
    } catch (e) {
      alert("Errore: " + e.message);
    }
  });

  document.getElementById("btn-device-clear")?.addEventListener("click", () => {
    clearDeviceForm();
  });

  document.getElementById("btn-route-add")?.addEventListener("click", async () => {
    const eventType = document.getElementById("route-event").value;
    const department = document.getElementById("route-department").value;
    const deviceId = document.getElementById("route-device").value;
    if (!deviceId) {
      alert("Seleziona un dispositivo.");
      return;
    }
    try {
      await fetchJSON(ROUTES_API, {
        method: "POST",
        body: JSON.stringify({ eventType, department, deviceId }),
      });
      await loadRoutes();
    } catch (e) {
      alert("Errore: " + e.message);
    }
  });

  document.getElementById("job-filter-status")?.addEventListener("change", () => loadJobs());

  document.getElementById("btn-refresh")?.addEventListener("click", async () => {
    await loadDevices();
    await loadRoutes();
    await loadJobs();
  });

  await loadDevices();
  await loadRoutes();
  await loadJobs();
});
