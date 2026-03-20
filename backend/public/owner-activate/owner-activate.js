// Owner activation – two-step flow: verify code → create password
const step1 = document.getElementById("oa-step1");
const step2 = document.getElementById("oa-step2");
const messageBox = document.getElementById("oa-message");
const formVerify = document.getElementById("oa-form-verify");
const formPassword = document.getElementById("oa-form-password");
const inputLicense = document.getElementById("oa-license");
const inputLicenseHidden = document.getElementById("oa-license-hidden");
const inputEmail = document.getElementById("oa-email");
const inputPassword = document.getElementById("oa-password");
const inputConfirm = document.getElementById("oa-confirm");
const btnVerify = document.getElementById("oa-btn-verify");
const btnCreate = document.getElementById("oa-btn-create");
const linkBack = document.getElementById("oa-back");

function showMessage(text, type = "") {
  messageBox.textContent = text || "";
  messageBox.className = "login-message";
  if (type) messageBox.classList.add(type);
}

function getInitialLicenseCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("licenseCode") || params.get("code") || "";
}

function getInitialEmail() {
  const params = new URLSearchParams(window.location.search);
  return params.get("email") || "";
}

// Step 1: verifica codice
async function verifyCode(licenseCode) {
  const res = await fetch("/api/licenses/verify-code", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ licenseCode }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const status = (data && data.status) || "error";
    const msg = (data && data.message) || "Errore durante la verifica.";
    return { ok: false, status, message: msg };
  }
  return data;
}

// Step 2: completa attivazione
async function completeActivation(payload) {
  const res = await fetch("/api/licenses/complete-activation", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    const msg = (data && data.message) || "Errore durante l'attivazione.";
    return { ok: false, message: msg };
  }
  return data;
}

function goToStep2(licenseCode) {
  showMessage("");
  inputLicenseHidden.value = licenseCode;
  step1.style.display = "none";
  step2.style.display = "block";
  inputEmail.focus();
}

function goToStep1() {
  showMessage("");
  step2.style.display = "none";
  step1.style.display = "block";
  inputLicense.focus();
}

inputLicense.value = getInitialLicenseCode();
inputEmail.value = getInitialEmail();

formVerify.addEventListener("submit", async (e) => {
  e.preventDefault();
  // Normalizza spazi invisibili / doppi spazi (stesso criterio del backend)
  const licenseCode = String(inputLicense.value || "")
    .trim()
    .replace(/[\u00A0\u2000-\u200B\uFEFF]/g, " ")
    .replace(/\s+/g, " ");
  if (!licenseCode) {
    showMessage("Inserisci un codice di attivazione valido.", "error");
    return;
  }

  btnVerify.disabled = true;
  showMessage("Verifica codice in corso...");

  try {
    const result = await verifyCode(licenseCode);

    if (!result.ok) {
      switch (result.status) {
        case "invalid":
          showMessage("Codice non trovato.", "error");
          break;
        case "used":
          showMessage("Licenza già utilizzata.", "error");
          break;
        case "expired":
          showMessage("Licenza scaduta.", "error");
          break;
        default:
          showMessage(result.message || "Codice non valido.", "error");
      }
      return;
    }

    showMessage("Codice valido. Crea la tua password per completare l'attivazione.", "success");
    goToStep2(licenseCode);
  } catch (err) {
    console.error("Errore verify-code:", err);
    showMessage("Errore di connessione durante la verifica.", "error");
  } finally {
    btnVerify.disabled = false;
  }
});

formPassword.addEventListener("submit", async (e) => {
  e.preventDefault();
  const licenseCode = inputLicenseHidden.value.trim();
  const email = inputEmail.value.trim();
  const password = inputPassword.value;
  const confirmPassword = inputConfirm.value;

  if (!licenseCode) {
    showMessage("Codice mancante. Torna indietro e verifica di nuovo.", "error");
    return;
  }
  if (!email) {
    showMessage("Inserisci un indirizzo email.", "error");
    return;
  }
  if (password.length < 8) {
    showMessage("La password deve essere di almeno 8 caratteri.", "error");
    return;
  }
  if (password !== confirmPassword) {
    showMessage("La conferma password non coincide.", "error");
    return;
  }

  btnCreate.disabled = true;
  showMessage("Creazione accesso in corso...");

  try {
    const result = await completeActivation({
      licenseCode,
      email,
      password,
      confirmPassword,
    });

    if (!result.ok) {
      showMessage(result.message || "Errore durante l'attivazione.", "error");
      return;
    }

    showMessage("Attivazione completata. Reindirizzamento...", "success");
    const redirectTo = result.redirectTo || "/dev-access/dashboard";
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 800);
  } catch (err) {
    console.error("Errore complete-activation:", err);
    showMessage("Errore di connessione durante l'attivazione.", "error");
  } finally {
    btnCreate.disabled = false;
  }
});

linkBack.addEventListener("click", (e) => {
  e.preventDefault();
  goToStep1();
});
