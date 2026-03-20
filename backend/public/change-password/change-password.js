// change-password.js – Primo accesso (solo nuova password) o cambio password (attuale + nuova)

const form = document.getElementById("change-form");
const successPanel = document.getElementById("success-panel");
const messageBox = document.getElementById("change-message");
const btnSubmit = document.getElementById("btn-submit");
const fieldCurrent = document.getElementById("field-current");
const inputCurrent = document.getElementById("current-password");

let mustChangePassword = true;

async function loadMe() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (!res.ok) return;
    const data = await res.json();
    mustChangePassword = data.mustChangePassword === true;
    if (!mustChangePassword && fieldCurrent) {
      fieldCurrent.style.display = "";
      if (inputCurrent) inputCurrent.setAttribute("required", "required");
    }
  } catch (_) {}
}

function showMessage(text, type = "") {
  messageBox.textContent = text || "";
  messageBox.className = "login-message";
  if (type) messageBox.classList.add(type);
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const newPassword = document.getElementById("new-password").value;
  const confirmPassword = document.getElementById("confirm-password").value;
  const minLen = mustChangePassword ? 6 : 8;

  if (!newPassword || !confirmPassword) {
    showMessage("Compila tutti i campi.", "error");
    return;
  }

  if (newPassword.length < minLen) {
    showMessage("La password deve essere di almeno " + minLen + " caratteri.", "error");
    return;
  }

  if (newPassword !== confirmPassword) {
    showMessage("Le due password non coincidono.", "error");
    return;
  }

  btnSubmit.disabled = true;
  showMessage("Aggiornamento in corso...");

  try {
    const body = mustChangePassword
      ? { password: newPassword }
      : {
          currentPassword: document.getElementById("current-password").value,
          newPassword,
        };

    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      showMessage(data.message || "Errore durante l'aggiornamento.", "error");
      btnSubmit.disabled = false;
      return;
    }

    showMessage("Password aggiornata.", "success");
    if (form) form.style.display = "none";
    if (successPanel) successPanel.style.display = "block";
    // Fallback: dopo 12s porta alla dashboard se non si clicca
    setTimeout(() => {
      if (successPanel && successPanel.style.display !== "none") {
        window.location.href = "/";
      }
    }, 12000);
  } catch (err) {
    console.error("Errore cambio password:", err);
    showMessage("Errore di connessione. Riprova.", "error");
    btnSubmit.disabled = false;
  }
});

loadMe();
