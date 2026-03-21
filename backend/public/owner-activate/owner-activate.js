// 1) GS validate — 2) POST /api/owner/complete-activation (sessione Ristoword)

const GS_VALIDATE_URL = "https://www.gestionesemplificata.com/api/licenses/validate";

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
const linkLoginWrap = document.getElementById("oa-link-login-wrap");

function showMessage(text, type = "") {
  messageBox.textContent = text || "";
  messageBox.className = "login-message";
  if (type) messageBox.classList.add(type);
}

function getInitialLicenseCode() {
  const params = new URLSearchParams(window.location.search);
  return params.get("licenseCode") || params.get("code") || "";
}

function gsSaysValid(data) {
  if (!data || typeof data !== "object") return false;
  if (data.data && data.data.valid === true) return true;
  if (data.valid === true) return true;
  return false;
}

function goToStep2(licenseCode) {
  showMessage("");
  inputLicenseHidden.value = licenseCode;
  step1.style.display = "none";
  step2.style.display = "block";
  if (linkLoginWrap) linkLoginWrap.style.display = "none";
  inputEmail.focus();
}

function goToStep1() {
  showMessage("");
  step2.style.display = "none";
  step1.style.display = "block";
  if (linkLoginWrap) linkLoginWrap.style.display = "";
  inputLicense.focus();
}

inputLicense.value = getInitialLicenseCode();
if (getInitialEmail()) inputEmail.value = getInitialEmail();

function getInitialEmail() {
  const params = new URLSearchParams(window.location.search);
  return params.get("email") || "";
}

formVerify.addEventListener("submit", async (e) => {
  e.preventDefault();
  const licenseCode = String(inputLicense.value || "").trim();
  if (!licenseCode) {
    showMessage("Inserisci un codice di attivazione valido.", "error");
    return;
  }

  btnVerify.disabled = true;
  showMessage("Verifica codice in corso...");

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

    if (gsSaysValid(data)) {
      showMessage("Codice valido. Crea la tua password per completare l'attivazione.", "success");
      goToStep2(licenseCode);
    } else {
      showMessage("Codice non valido.", "error");
    }
  } catch (err) {
    console.error(err);
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
    const res = await fetch("/api/owner/complete-activation", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: licenseCode.trim(),
        email,
        password,
      }),
    });
    const data = await res.json().catch(() => ({}));
    console.log("RISPOSTA RW:", data);

    if (!res.ok || !data.success) {
      showMessage(data.message || "Errore durante l'attivazione.", "error");
      return;
    }

    showMessage("Attivazione completata. Reindirizzamento...", "success");
    const redirectTo = data.redirectTo || "/dev-access/dashboard";
    setTimeout(() => {
      window.location.href = redirectTo;
    }, 600);
  } catch (err) {
    console.error(err);
    showMessage("Errore di connessione durante l'attivazione.", "error");
  } finally {
    btnCreate.disabled = false;
  }
});

linkBack.addEventListener("click", (e) => {
  e.preventDefault();
  goToStep1();
});
