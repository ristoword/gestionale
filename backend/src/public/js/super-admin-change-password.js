function $(id) {
  return document.getElementById(id);
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

function show(elId, txt) {
  const el = $(elId);
  if (!el) return;
  if (!txt) {
    el.style.display = "none";
    el.textContent = "";
    return;
  }
  el.style.display = "block";
  el.textContent = txt;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = $("sa-change-password-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newPassword = ($("sa-new-password").value || "").trim();
    const confirmPassword = ($("sa-confirm-password").value || "").trim();

    show("sa-change-error", "");
    show("sa-change-ok", "");

    if (!newPassword || !confirmPassword) {
      show("sa-change-error", "Inserisci password valide");
      return;
    }
    if (newPassword !== confirmPassword) {
      show("sa-change-error", "Conferma password non coincide");
      return;
    }

    const out = await postJson("/api/super-admin/change-password", { newPassword });
    if (!out.ok) {
      show("sa-change-error", out.data?.message || out.data?.error || "Errore cambio password");
      return;
    }

    show("sa-change-ok", "Password aggiornata. Reindirizzamento...");
    setTimeout(() => {
      window.location.href = "/super-admin-dashboard";
    }, 600);
  });
});

