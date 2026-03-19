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

function showError(msg) {
  const box = $("sa-login-error");
  if (!box) return;
  box.style.display = "block";
  box.textContent = msg || "Errore di login";
}

document.addEventListener("DOMContentLoaded", () => {
  const form = $("sa-login-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = ($("sa-username").value || "").trim();
    const password = ($("sa-password").value || "");

    showError("");
    const out = await postJson("/api/super-admin/login", { username, password });
    if (!out.ok) {
      showError(
        out.data?.message ||
          out.data?.error ||
          (out.status >= 500 ? "Errore server. Controlla che backend/.env sia caricato e riavvia il server." : "Credenziali non valide")
      );
      return;
    }

    const mustChange = !!out.data?.mustChangePassword;
    if (mustChange) {
      window.location.href = "/super-admin-change-password";
    } else {
      window.location.href = "/super-admin-dashboard";
    }
  });
});

