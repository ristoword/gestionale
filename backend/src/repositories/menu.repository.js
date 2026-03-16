// backend/src/repositories/menu.repository.js

const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");

function getMenuPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "menu.json");
}

function readMenu() {
  const data = safeReadJson(getMenuPath(), []);
  return Array.isArray(data) ? data : [];
}

function writeMenu(data) {
  atomicWriteJson(getMenuPath(), Array.isArray(data) ? data : []);
}

function getAll() {
  return readMenu();
}

function getById(id) {
  const menu = readMenu();
  return menu.find((item) => item.id === Number(id));
}

function getActive() {
  const menu = readMenu();
  return menu.filter((item) => item.active);
}

function add(itemData) {
  const menu = readMenu();
  const ids = menu.map((m) => m.id || 0).filter((n) => Number.isFinite(n));
  const nextId = ids.length ? Math.max(...ids) + 1 : 1;
  const now = new Date().toISOString();

  const newItem = {
    id: nextId,
    name: itemData.name,
    category: itemData.category || "Generale",
    price: Number(itemData.price) || 0,
    sellingPrice: Number(itemData.sellingPrice ?? itemData.price) || 0,
    recipe: itemData.recipe || null,
    recipeId: itemData.recipeId || itemData.recipe_id || null,
    active: itemData.active !== false,
    area: itemData.area || null,
    code: itemData.code || null,
    notes: itemData.notes || null,
    createdAt: now,
    updatedAt: now,
  };

  menu.push(newItem);
  writeMenu(menu);
  return newItem;
}

function update(id, updates) {
  const menu = readMenu();
  const index = menu.findIndex((m) => String(m.id) === String(id));
  if (index === -1) return null;
  const next = { ...menu[index], ...updates };
  if (updates.recipeId !== undefined) next.recipeId = updates.recipeId || null;
  if (updates.recipe_id !== undefined) next.recipeId = updates.recipe_id || null;
  if (updates.sellingPrice !== undefined) next.sellingPrice = Number(updates.sellingPrice) || 0;
  next.updatedAt = new Date().toISOString();
  menu[index] = next;
  writeMenu(menu);
  return menu[index];
}

function remove(id) {
  const menu = readMenu();
  const index = menu.findIndex((m) => String(m.id) === String(id));
  if (index === -1) return false;
  menu.splice(index, 1);
  writeMenu(menu);
  return true;
}

function getByRecipeId(recipeId) {
  const menu = readMenu();
  const id = String(recipeId || "").trim();
  if (!id) return null;
  return menu.find((m) => String(m.recipeId || m.recipe_id || "") === id) || null;
}

module.exports = {
  getAll,
  getActive,
  getById,
  getByRecipeId,
  add,
  update,
  remove,
};