const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { normalizeReportForCreate } = require("./reports.repository.helpers");

const REPORTS_KEY = "reports";

function getDataDir() {
  const restaurantId = tenantContext.getRestaurantId();
  if (!restaurantId) return path.join(paths.DATA, "tenants", "default");
  return path.join(paths.DATA, "tenants", restaurantId);
}

function getReportsFilePath() {
  return path.join(getDataDir(), "reports.json");
}

async function ensureReportsFile() {
  const fp = getReportsFilePath();
  await fsp.mkdir(getDataDir(), { recursive: true });
  if (!fs.existsSync(fp)) {
    await fsp.writeFile(fp, JSON.stringify({ [REPORTS_KEY]: [] }, null, 2), "utf8");
    return;
  }
  const raw = await fsp.readFile(fp, "utf8");
  if (!raw.trim()) {
    await fsp.writeFile(fp, JSON.stringify({ [REPORTS_KEY]: [] }, null, 2), "utf8");
  }
}

async function readReportsList() {
  await ensureReportsFile();
  const raw = await fsp.readFile(getReportsFilePath(), "utf8");
  try {
    const data = JSON.parse(raw);
    const list = data[REPORTS_KEY];
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error("[Ristoword] reports.json parse error:", err.message);
    return [];
  }
}

async function writeReportsList(reports) {
  const fp = getReportsFilePath();
  await fsp.mkdir(getDataDir(), { recursive: true });
  const tmpPath = fp + "." + Date.now() + ".tmp";
  await fsp.writeFile(tmpPath, JSON.stringify({ [REPORTS_KEY]: reports }, null, 2), "utf8");
  await fsp.rename(tmpPath, fp);
}

async function getAll() {
  return readReportsList();
}

async function getById(id) {
  const reports = await readReportsList();
  return reports.find((r) => r.id === id) || null;
}

async function create(data) {
  const reports = await readReportsList();
  const report = normalizeReportForCreate(data);
  reports.push(report);
  await writeReportsList(reports);
  return report;
}

async function remove(id) {
  const reports = await readReportsList();
  const index = reports.findIndex((r) => r.id === id);
  if (index === -1) return false;
  reports.splice(index, 1);
  await writeReportsList(reports);
  return true;
}

module.exports = {
  getAll,
  getById,
  create,
  remove,
};
