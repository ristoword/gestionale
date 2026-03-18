const form = document.getElementById("oa-form");
const messageBox = document.getElementById("oa-message");
const submitBtn = document.getElementById("oa-submit");

function showMessage(text, type = "") {
  messageBox.textContent = text || "";
  messageBox.className = "login-message";
  if (type) messageBox.classList.add(type);
}

function getInitialLicenseCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("licenseCode") || params.get("code") || "";
}

async function activateOwner(licenseCode) {
  const res = await fetch("/api/licenses/owner-activate", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseCode }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data) {
    const status = data && data.status;
    let msg = (data && data.message) || "Errore durante l'attivazione.";
    return { ok: false, status: status || "error", message: msg };
  }
  return data;
}

document.getElementById("oa-license").value = getInitialLicenseCode();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const licenseCode = document.getElementById("oa-license").value.trim();
  if (!licenseCode) {
    showMessage("Inserisci un codice licenza valido.", "error");
    return;
  }

  submitBtn.disabled = true;
  showMessage("Verifica licenza in corso...");

  try {
    const result = await activateOwner(licenseCode);

    if (!result.ok) {
      switch (result.status) {
        case "invalid":
          showMessage("Licenza non valida.", "error");
          break;
        case "used":
          showMessage("Licenza già utilizzata.", "error");
          break;
        case "inactive":
          showMessage("Licenza non attiva.", "error");
          break;
        case "expired":
          showMessage("Licenza scaduta.", "error");
          break;
        case "no_owner":
          showMessage("Nessun utente owner associato a questa licenza.", "error");
          break;
        case "no_restaurant":
          showMessage("Ristorante associato alla licenza non trovato.", "error");
          break;
        default:
          showMessage(result.message || "Errore durante l'attivazione.", "error");
      }
      return;
    }

    showMessage("Licenza attivata correttamente. Reindirizzamento al login...", "success");
    const redirectTo = result.redirectTo || "/login?ownerActivated=1";
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 1200);
  } catch (err) {
    console.error("Errore owner-activate:", err);
    showMessage("Errore interno durante l'attivazione.", "error");
  } finally {
    submitBtn.disabled = false;
  }
});

