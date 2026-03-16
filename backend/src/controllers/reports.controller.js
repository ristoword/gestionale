const reportsRepository = require("../repositories/reports.repository");
const reportsService = require("../service/reports.service");

// GET /api/reports
exports.listReports = async (req, res) => {
  const data = await reportsRepository.getAll();
  res.json(data);
};

// GET /api/reports/:id
exports.getReportById = async (req, res) => {
  const report = await reportsRepository.getById(req.params.id);

  if (!report) {
    return res.status(404).json({ error: "Report non trovato" });
  }

  res.json(report);
};

// POST /api/reports
exports.createReport = async (req, res) => {
  const report = await reportsRepository.create(req.body);
  res.status(201).json(report);
};

// DELETE /api/reports/:id
exports.deleteReport = async (req, res) => {
  const ok = await reportsRepository.remove(req.params.id);

  if (!ok) {
    return res.status(404).json({ error: "Report non trovato" });
  }

  res.json({ success: true });
};

// GET /api/reports/daily/summary
exports.getDailySummary = async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const summary = await reportsService.buildDailyReport(date);
  res.json(summary);
};

// GET /api/reports/dashboard-summary
exports.getDashboardSummary = async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const summary = await reportsService.buildDashboardSummary(date);
  res.json(summary);
};

// GET /api/reports/accountant?dateFrom=&dateTo=
exports.getAccountantReport = async (req, res) => {
  const { dateFrom, dateTo } = req.query || {};
  const from = dateFrom ? new Date(dateFrom) : new Date();
  const to = dateTo ? new Date(dateTo) : new Date(from);
  if (dateTo) to.setTime(new Date(dateTo).getTime());
  const report = await reportsService.buildAccountantReport(from, to);
  res.json(report);
};

// GET /api/reports/top-dishes?date=&limit=
exports.getTopDishes = async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
  const data = await reportsService.getTopDishes(date, limit);
  res.json(data);
};

// GET /api/reports/dish-margins?date=
exports.getDishMargins = async (req, res) => {
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const data = await reportsService.getDishMargins(date);
  res.json(data);
};

// GET /api/reports/foodcost-alerts?threshold=
exports.getFoodCostAlerts = async (req, res) => {
  const threshold = Math.min(100, Math.max(0, parseFloat(req.query.threshold) || 35));
  const data = await reportsService.getFoodCostAlerts(threshold);
  res.json(data);
};