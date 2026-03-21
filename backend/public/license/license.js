// Pagina licenza — validazione solo tramite API Gestione Semplificata (POST JSON).
const GS_VALIDATE_URL = "https://www.gestionesemplificata.com/api/licenses/validate";

const form = document.getElementById("license-form");
const messageEl = document.getElementById("license-message");
const btnActivate = document.getElementById("btn-activate");

function showMessage(text, type) {
  messageEl.textContent = text || "";
  messageEl.className = "login-message" + (type ? " " + type : "");
}

const params = new URLSearchParams(window.location.search);
if (params.get("expired") === "1") {
  showMessage("La licenza è scaduta. Inserisci un nuovo codice per continuare.", "error");
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const licenseCode = document.getElementById("licenseCode").value.trim();

  if (!licenseCode) {
    showMessage("Inserisci il codice licenza.", "error");
    return;
  }

  btnActivate.disabled = true;
  showMessage("Verifica in corso...");

  try {
    const res = await fetch(GS_VALIDATE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: licenseCode.trim(),
      }),
    });
    const data = await res.json().catch(() => ({}));
    console.log("RISPOSTA GS:", data);

    if (data.valid) {
      showMessage("Accesso consentito. Reindirizzamento al login...", "success");
      setTimeout(() => {
        window.location.href = "/login/login.html";
      }, 1500);
    } else {
      showMessage("Codice non valido.", "error");
      btnActivate.disabled = false;
    }
  } catch (err) {
    console.error(err);
    showMessage("Errore di rete. Riprova.", "error");
    btnActivate.disabled = false;
  }
});
