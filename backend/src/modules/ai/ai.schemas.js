// backend/src/modules/ai/ai.schemas.js
// Shared AI request/response shapes for all departments.

const DEPARTMENTS = ["kitchen", "supervisor", "warehouse", "cash", "creative"];
const MODES = ["read", "suggest", "act"];

function normalizeDepartment(value) {
  const v = String(value || "").toLowerCase();
  return DEPARTMENTS.includes(v) ? v : "supervisor";
}

function normalizeMode(value) {
  const v = String(value || "").toLowerCase();
  return MODES.includes(v) ? v : "read";
}

function buildBaseResponse({ mode, department }) {
  return {
    mode: normalizeMode(mode),
    department: normalizeDepartment(department),
    title: "",
    summary: "",
    insights: [],
    actions: [],
    warnings: [],
    dataPoints: {},
    notes: [],
  };
}

module.exports = {
  DEPARTMENTS,
  MODES,
  normalizeDepartment,
  normalizeMode,
  buildBaseResponse,
};

