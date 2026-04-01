// backend/src/modules/ai/ai.tools.js
// High-level data access helpers for the AI orchestrator.
// IMPORTANT: read-only helpers only. Never mutate core operational data here.

const ordersService = require("../../service/orders.service");
const reportsService = require("../../service/reports.service");
const inventoryRepository = require("../../repositories/inventory.repository");
const menuRepository = require("../../repositories/menu.repository");
const recipesRepository = require("../../repositories/recipes.repository");
const dailyMenuRepository = require("../../repositories/daily-menu.repository");
const bookingsRepository = require("../../repositories/bookings.repository");

async function getActiveOrdersSummary() {
  const orders = await ordersService.listActiveOrders();
  const total = orders.length;
  const byStatus = {};
  for (const o of orders) {
    const s = String(o.status || "in_attesa").toLowerCase();
    byStatus[s] = (byStatus[s] || 0) + 1;
  }
  return { total, byStatus };
}

async function getTodaySalesSummary(date = new Date()) {
  const dashboard = await reportsService.buildDashboardSummary(date);
  return dashboard?.kpi || {};
}

async function getInventorySnapshot() {
  const all = await inventoryRepository.getAll();
  return Array.isArray(all) ? all : [];
}

async function getLowStockItems() {
  const inv = await getInventorySnapshot();
  return inv.filter((item) => {
    const qty = Number(item.quantity ?? item.central ?? item.stock ?? 0);
    const min = Number(item.threshold ?? item.min_stock ?? 0);
    return min > 0 && qty <= min;
  });
}

async function getMenuItems() {
  return await menuRepository.getAll();
}

async function getRecipes() {
  return recipesRepository.getAllRecipes
    ? recipesRepository.getAllRecipes()
    : recipesRepository.getAll();
}

async function getDailyMenu() {
  try {
    const data = await dailyMenuRepository.getActive();
    return data || {};
  } catch {
    return {};
  }
}

async function getBookingsToday(date = new Date()) {
  try {
    const all = await bookingsRepository.getAll();
    const target = date.toISOString().slice(0, 10);
    return all.filter((b) =>
      String(b.date || b.time || "").slice(0, 10) === target
    );
  } catch {
    return [];
  }
}

module.exports = {
  getActiveOrdersSummary,
  getTodaySalesSummary,
  getInventorySnapshot,
  getLowStockItems,
  getMenuItems,
  getRecipes,
  getDailyMenu,
  getBookingsToday,
};

