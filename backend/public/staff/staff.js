// Gestione utenti staff – API /api/staff (owner only) + /api/attendance (presenze) + /api/leave (assenze)

let staffList = [];
let dailySummary = null;
let attendanceList = [];
let leaveList = [];

function api(path, opts = {}) {
  const url = path.startsWith("/") ? path : "/api/staff" + (path ? "/" + path : "");
  return fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
}

function attendanceApi(path, opts = {}) {
  const base = "/api/attendance";
  const suffix = path.startsWith("/") ? path : (path ? "/" + path : "");
  const url = base + suffix;
  return fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
}

function leaveApi(path, opts = {}) {
  const base = "/api/leave";
  const suffix = path.startsWith("/") ? path : (path ? "/" + path : "");
  const url = base + suffix;
  return fetch(url, {
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });
}

function showFormMessage(text, type = "") {
  const el = document.getElementById("form-message");
  if (!el) return;
  el.textContent = text || "";
  el.className = "login-message" + (type ? " " + type : "");
}

function showListMessage(text, type = "") {
  const el = document.getElementById("staff-message");
  if (!el) return;
  el.textContent = text || "";
  el.className = "login-message" + (type ? " " + type : "");
}

function renderKpi() {
  document.getElementById("kpi-total").textContent = staffList.length;
  document.getElementById("kpi-active").textContent = staffList.filter((u) => u.active).length;
  const present = dailySummary ? (dailySummary.openShiftsCount || 0) : 0;
  document.getElementById("kpi-present").textContent = present;
  document.getElementById("kpi-open").textContent = dailySummary ? (dailySummary.openShiftsCount || 0) : 0;
  document.getElementById("kpi-anomaly").textContent = dailySummary ? (dailySummary.anomaliesCount || 0) : 0;
  const hours = dailySummary ? (dailySummary.totalWorkedHours != null ? dailySummary.totalWorkedHours : 0) : 0;
  document.getElementById("kpi-hours").textContent = typeof hours === "number" ? hours.toFixed(1) : hours;
}

function roleLabel(role) {
  const r = (role || "").toLowerCase();
  const map = { sala: "Sala", cucina: "Cucina", bar: "Bar", magazzino: "Magazzino", pizzeria: "Pizzeria", cassa: "Cassa", supervisor: "Supervisor", staff: "Staff", owner: "Owner" };
  return map[r] || role || "—";
}

function renderTable() {
  const tbody = document.getElementById("staff-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";

  staffList.forEach((u) => {
    const tr = document.createElement("tr");
    const name = [u.name, u.surname].filter(Boolean).join(" ") || "—";
    tr.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(roleLabel(u.role))}</td>
      <td>${escapeHtml(u.username || "—")}</td>
      <td><span class="tag ${u.active ? "active" : "inactive"}">${u.active ? "Attivo" : "Sospeso"}</span></td>
      <td class="actions">
        <button class="btn-xs" data-action="toggle" data-id="${escapeHtml(u.id)}">${u.active ? "Disattiva" : "Attiva"}</button>
        <button class="btn-xs" data-action="reset" data-id="${escapeHtml(u.id)}">Reset password</button>
      </td>
    `;
    tr.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const action = btn.getAttribute("data-action");
        if (action === "toggle") toggleActive(id);
        else if (action === "reset") resetPassword(id);
        else if (action === "saldi") showSaldi(id);
      });
    });
    tbody.appendChild(tr);
  });
}

function escapeHtml(s) {
  if (s == null) return "";
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

async function loadStaff() {
  showListMessage("Caricamento...");
  try {
    const res = await api("");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showListMessage(err.error || "Errore caricamento", "error");
      staffList = [];
    } else {
      staffList = await res.json();
      showListMessage("");
    }
  } catch (e) {
    showListMessage("Errore di connessione.", "error");
    staffList = [];
  }
  await loadPresenze();
  await loadLeaveRequests();
  fillLeaveFilterUser();
  renderKpi();
  renderTable();
}

function userNameById(id) {
  const u = staffList.find((x) => String(x.id) === String(id));
  if (!u) return "—";
  return [u.name, u.surname].filter(Boolean).join(" ") || u.username || "—";
}

function anomalyLabel(type) {
  const t = (type || "").toLowerCase();
  const map = {
    missing_logout: "Uscita mancante",
    missing_login: "Entrata mancante",
    double_clockin: "Doppia entrata",
    double_clockout: "Doppia uscita",
    shift_too_long: "Turno troppo lungo",
  };
  return map[t] || type || "—";
}

function formatTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  } catch (_) {
    return iso;
  }
}

function formatMinutes(mins) {
  if (mins == null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h > 0) return h + "h " + (m > 0 ? m + "m" : "");
  return m + "m";
}

async function loadPresenze() {
  const dateEl = document.getElementById("presenze-date");
  const date = (dateEl && dateEl.value) || new Date().toISOString().slice(0, 10);
  const msgEl = document.getElementById("presenze-message");
  if (msgEl) msgEl.textContent = "Caricamento presenze...";
  try {
    const [sumRes, listRes] = await Promise.all([
      attendanceApi("/daily-summary?date=" + encodeURIComponent(date)),
      attendanceApi("/?dateFrom=" + date + "&dateTo=" + date),
    ]);
    if (!sumRes.ok) {
      dailySummary = null;
      if (msgEl) msgEl.textContent = "Errore riepilogo presenze.";
      return;
    }
    dailySummary = await sumRes.json();
    attendanceList = listRes.ok ? await listRes.json() : [];
    if (msgEl) msgEl.textContent = "";
  } catch (e) {
    dailySummary = null;
    attendanceList = [];
    if (msgEl) msgEl.textContent = "Errore di connessione presenze.";
  }
  renderPresenzeTable();
  renderPresenzeSummary();
  renderKpi();
}

function renderPresenzeTable() {
  const tbody = document.getElementById("presenze-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  const records = dailySummary && Array.isArray(dailySummary.records) ? dailySummary.records : attendanceList;
  if (!records || records.length === 0) {
    tbody.innerHTML = "<tr><td colspan=\"7\">Nessuna presenza per la data selezionata.</td></tr>";
    return;
  }
  records.forEach((r) => {
    const tr = document.createElement("tr");
    const name = userNameById(r.userId);
    const status = r.status === "open" ? "Aperto" : r.status === "closed" ? "Chiuso" : "Anomalia";
    const statusClass = r.status === "open" ? "open" : r.status === "anomaly" ? "anomaly" : "";
    const entrata = formatTime(r.clockInAt);
    const uscita = formatTime(r.clockOutAt);
    const ore = formatMinutes(r.workedMinutes);
    const anom = r.anomalyType ? anomalyLabel(r.anomalyType) : "—";
    tr.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td><span class="tag status ${statusClass}">${escapeHtml(status)}</span></td>
      <td>${entrata}</td>
      <td>${uscita}</td>
      <td>${ore}</td>
      <td>${escapeHtml(anom)}</td>
      <td class="actions">
        ${r.status === "open" ? `<button class="btn-xs" data-action="close" data-id="${escapeHtml(r.id)}">Chiudi turno</button>` : ""}
        ${(r.anomalyType || r.status === "anomaly") ? `<button class="btn-xs" data-action="reset-anomaly" data-id="${escapeHtml(r.id)}">Reset anomalia</button>` : ""}
      </td>
    `;
    tr.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (btn.getAttribute("data-action") === "close") closeShift(id);
        else resetAnomaly(id);
      });
    });
    tbody.appendChild(tr);
  });
}

function renderPresenzeSummary() {
  const el = document.getElementById("presenze-summary");
  if (!el) return;
  if (!dailySummary) {
    el.innerHTML = "";
    return;
  }
  const cost = dailySummary.estimatedLaborCost != null ? dailySummary.estimatedLaborCost.toFixed(2) : "—";
  el.innerHTML = `
    <p class="summary-line">
      Ore lavorate oggi: <strong>${(dailySummary.totalWorkedHours != null ? dailySummary.totalWorkedHours : 0).toFixed(1)}</strong> h
      · Costo stimato: <strong>€ ${cost}</strong>
    </p>
  `;
}

async function closeShift(id) {
  try {
    const res = await attendanceApi("/" + id + "/close", {
      method: "PATCH",
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Errore chiusura turno.");
      return;
    }
    await loadPresenze();
    renderKpi();
  } catch (e) {
    alert("Errore di connessione.");
  }
}

async function resetAnomaly(id) {
  try {
    const res = await attendanceApi("/" + id + "/anomaly", {
      method: "PATCH",
      body: JSON.stringify({ clear: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Errore reset anomalia.");
      return;
    }
    await loadPresenze();
    renderKpi();
  } catch (e) {
    alert("Errore di connessione.");
  }
}

async function addStaff() {
  const name = document.getElementById("field-name").value.trim();
  const surname = document.getElementById("field-surname").value.trim();
  const role = document.getElementById("field-role").value;
  const username = document.getElementById("field-username").value.trim();
  const password = document.getElementById("field-password").value;

  if (!username) {
    showFormMessage("Inserisci username.", "error");
    return;
  }
  if (!password || password.length < 6) {
    showFormMessage("Password almeno 6 caratteri.", "error");
    return;
  }

  showFormMessage("Creazione in corso...");
  try {
    const res = await api("", {
      method: "POST",
      body: JSON.stringify({ name, surname, role, username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showFormMessage(data.error || "Errore creazione.", "error");
      return;
    }
    showFormMessage("Dipendente creato. Può accedere con username e password iniziale.", "success");
    document.getElementById("field-name").value = "";
    document.getElementById("field-surname").value = "";
    document.getElementById("field-username").value = "";
    document.getElementById("field-password").value = "";
    await loadStaff();
  } catch (e) {
    showFormMessage("Errore di connessione.", "error");
  }
}

async function toggleActive(id) {
  const u = staffList.find((x) => String(x.id) === String(id));
  if (!u) return;
  const newActive = !u.active;
  try {
    const res = await api(id, {
      method: "PATCH",
      body: JSON.stringify({ active: newActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Errore aggiornamento.");
      return;
    }
    await loadStaff();
  } catch (e) {
    alert("Errore di connessione.");
  }
}

async function resetPassword(id) {
  try {
    const res = await api(id + "/reset-password", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Errore reset password.");
      return;
    }
    const pwd = data.temporaryPassword || "";
    alert("Nuova password temporanea: " + pwd + "\n\nL'utente dovrà cambiarla al primo accesso.");
    await loadStaff();
  } catch (e) {
    alert("Errore di connessione.");
  }
}

// ——— Leave / Assenze ———

function leaveTypeLabel(t) {
  const map = { ferie: "Ferie", permesso: "Permesso", malattia: "Malattia" };
  return map[t] || t || "—";
}

function leaveStatusLabel(s) {
  const map = { pending: "In attesa", approved: "Approvata", rejected: "Rifiutata", cancelled: "Annullata" };
  return map[s] || s || "—";
}

function fillLeaveFilterUser() {
  const sel = document.getElementById("leave-filter-user");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = "<option value=\"\">Tutti</option>";
  staffList.forEach((u) => {
    const name = [u.name, u.surname].filter(Boolean).join(" ") || u.username || u.id;
    const opt = document.createElement("option");
    opt.value = u.id;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  if (prev) sel.value = prev;
}

async function loadLeaveRequests() {
  const msgEl = document.getElementById("leave-message");
  if (msgEl) msgEl.textContent = "Caricamento richieste...";
  try {
    const q = new URLSearchParams();
    const status = document.getElementById("leave-filter-status")?.value;
    const type = document.getElementById("leave-filter-type")?.value;
    const userId = document.getElementById("leave-filter-user")?.value;
    if (status) q.set("status", status);
    if (type) q.set("type", type);
    if (userId) q.set("userId", userId);
    const res = await leaveApi("/?" + q.toString());
    if (!res.ok) {
      leaveList = [];
      if (msgEl) msgEl.textContent = "Errore caricamento richieste.";
      return;
    }
    leaveList = await res.json();
    if (msgEl) msgEl.textContent = "";
  } catch (e) {
    leaveList = [];
    const msgEl = document.getElementById("leave-message");
    if (msgEl) msgEl.textContent = "Errore di connessione.";
  }
  renderLeaveTable();
}

function renderLeaveTable() {
  const tbody = document.getElementById("leave-tbody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!leaveList.length) {
    tbody.innerHTML = "<tr><td colspan=\"7\">Nessuna richiesta.</td></tr>";
    return;
  }
  leaveList.forEach((r) => {
    const tr = document.createElement("tr");
    const name = [r.name, r.surname].filter(Boolean).join(" ") || r.username || r.userId;
    const periodo = (r.startDate && r.endDate) ? r.startDate + " → " + r.endDate : "—";
    const stato = leaveStatusLabel(r.status);
    const statoClass = r.status === "pending" ? "pending" : r.status === "approved" ? "approved" : r.status === "rejected" ? "rejected" : "";
    tr.innerHTML = `
      <td>${escapeHtml(name)}</td>
      <td>${escapeHtml(leaveTypeLabel(r.type))}</td>
      <td>${escapeHtml(periodo)}</td>
      <td>${r.days != null ? r.days : "—"}</td>
      <td><span class="tag leave-status ${statoClass}">${escapeHtml(stato)}</span></td>
      <td>${escapeHtml((r.reason || "—").slice(0, 40))}${(r.reason && r.reason.length > 40) ? "…" : ""}</td>
      <td class="actions">
        ${r.status === "pending" ? `
          <button class="btn-xs" data-action="approve" data-id="${escapeHtml(r.id)}">Approva</button>
          <button class="btn-xs danger" data-action="reject" data-id="${escapeHtml(r.id)}">Rifiuta</button>
        ` : ""}
      </td>
    `;
    tr.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        if (btn.getAttribute("data-action") === "approve") approveLeave(id);
        else rejectLeave(id);
      });
    });
    tbody.appendChild(tr);
  });
}

async function approveLeave(id) {
  try {
    const res = await leaveApi("/" + id + "/approve", { method: "POST", body: JSON.stringify({}) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Errore approvazione.");
      return;
    }
    await loadLeaveRequests();
  } catch (e) {
    alert("Errore di connessione.");
  }
}

async function rejectLeave(id) {
  try {
    const res = await leaveApi("/" + id + "/reject", { method: "POST", body: JSON.stringify({}) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Errore rifiuto.");
      return;
    }
    await loadLeaveRequests();
  } catch (e) {
    alert("Errore di connessione.");
  }
}

async function showSaldi(userId) {
  const panel = document.getElementById("saldi-panel");
  const nameEl = document.getElementById("saldi-user-name");
  const listEl = document.getElementById("saldi-list");
  if (!panel || !listEl) return;
  const u = staffList.find((x) => String(x.id) === String(userId));
  nameEl.textContent = u ? ([u.name, u.surname].filter(Boolean).join(" ") || u.username) : "—";
  listEl.innerHTML = "<li>Caricamento...</li>";
  panel.classList.remove("hidden");
  try {
    const res = await leaveApi("/balances/" + userId);
    if (!res.ok) {
      listEl.innerHTML = "<li>Errore caricamento saldi.</li>";
      return;
    }
    const b = await res.json();
    listEl.innerHTML = `
      <li>Ferie maturate: <strong>${b.ferieMaturate != null ? b.ferieMaturate : 0}</strong></li>
      <li>Ferie usate: <strong>${b.ferieUsate != null ? b.ferieUsate : 0}</strong></li>
      <li>Permessi usati: <strong>${b.permessiUsati != null ? b.permessiUsati : 0}</strong></li>
      <li>Malattia (giorni): <strong>${b.malattiaGiorni != null ? b.malattiaGiorni : 0}</strong></li>
    `;
  } catch (e) {
    listEl.innerHTML = "<li>Errore di connessione.</li>";
  }
}

function showLeaveFormMessage(text, type) {
  const el = document.getElementById("leave-form-message");
  if (!el) return;
  el.textContent = text || "";
  el.className = "login-message" + (type ? " " + type : "");
}

async function submitLeaveRequest() {
  const start = document.getElementById("leave-start")?.value;
  const end = document.getElementById("leave-end")?.value;
  if (!start || !end) {
    showLeaveFormMessage("Inserisci data inizio e fine.", "error");
    return;
  }
  if (new Date(start) > new Date(end)) {
    showLeaveFormMessage("Date non valide: la data di inizio deve essere prima della fine.", "error");
    return;
  }
  const type = document.getElementById("leave-type")?.value || "ferie";
  const reason = document.getElementById("leave-reason")?.value?.trim() || "";
  showLeaveFormMessage("Invio in corso...");
  try {
    const res = await leaveApi("/me", {
      method: "POST",
      body: JSON.stringify({ type, startDate: start, endDate: end, reason }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      showLeaveFormMessage(data.error || "Errore invio richiesta.", "error");
      return;
    }
    showLeaveFormMessage("Richiesta inviata.", "success");
    document.getElementById("leave-start").value = "";
    document.getElementById("leave-end").value = "";
    document.getElementById("leave-reason").value = "";
    await loadLeaveRequests();
    renderLeaveTable();
  } catch (e) {
    showLeaveFormMessage("Errore di connessione.", "error");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.getElementById("presenze-date");
  if (dateInput) dateInput.value = new Date().toISOString().slice(0, 10);
  loadStaff();
  document.getElementById("btn-refresh").addEventListener("click", loadStaff);
  document.getElementById("btn-add-staff").addEventListener("click", addStaff);
  const btnPresenze = document.getElementById("btn-presenze-refresh");
  if (btnPresenze) btnPresenze.addEventListener("click", loadPresenze);
  if (dateInput) dateInput.addEventListener("change", loadPresenze);
  const btnLeaveRefresh = document.getElementById("btn-leave-refresh");
  if (btnLeaveRefresh) btnLeaveRefresh.addEventListener("click", loadLeaveRequests);
  const btnLeaveSubmit = document.getElementById("btn-leave-submit");
  if (btnLeaveSubmit) btnLeaveSubmit.addEventListener("click", submitLeaveRequest);
  ["leave-filter-status", "leave-filter-type", "leave-filter-user"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", loadLeaveRequests);
  });
});
