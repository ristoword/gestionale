// Centralized mapping for DEV BRIDGE.
// Key = `:module` in `/dev-access/open/:module`
// Value = where the user should land (real module entrypoint).

const DEV_BRIDGE_MODULES = {
  dashboard: { targetPath: "/" },

  // Core modules
  sala: { targetPath: "/sala/sala.html" },
  cucina: { targetPath: "/cucina/cucina.html" },
  pizzeria: { targetPath: "/pizzeria/pizzeria.html" },
  cassa: { targetPath: "/cassa/cassa.html" },
  magazzino: { targetPath: "/magazzino/magazzino.html" },
  prenotazioni: { targetPath: "/prenotazioni/prenotazioni.html" },
  catering: { targetPath: "/catering/catering.html" },
  staff: { targetPath: "/staff/staff.html" },

  // Views embedded in `cucina` (no dedicated HTML pages).
  ricette: { targetPath: "/cucina/cucina.html" },
  spesa: { targetPath: "/cucina/cucina.html" },
  haccp: { targetPath: "/cucina/cucina.html" },
};

function normalizeModuleName(name) {
  return String(name || "").trim().toLowerCase();
}

function getModuleTarget(moduleName) {
  const key = normalizeModuleName(moduleName);
  return DEV_BRIDGE_MODULES[key] || null;
}

module.exports = { DEV_BRIDGE_MODULES, normalizeModuleName, getModuleTarget };

