const { v4: uuid } = require("uuid");
const { getJson, setJson } = require("./tenant-module.mysql");
const json = require("../recipes.repository.json");

const MODULE_KEY = "recipes";
let recipes = [];

async function readRecipes() {
  const data = await getJson(MODULE_KEY, { recipes: [] });
  let list = Array.isArray(data) ? data : (data && Array.isArray(data.recipes) ? data.recipes : null);
  if (list == null && data && typeof data === "object" && !Array.isArray(data)) list = [data];
  if (!Array.isArray(list)) list = [];
  return list.map((r) => ({ ...r }));
}
async function writeRecipes(list) {
  await setJson(MODULE_KEY, { recipes: list });
}
async function ensureLoaded(){ if(!recipes.length) recipes = await readRecipes(); }
async function getAll(){ await ensureLoaded(); return recipes; }
async function getAllRecipes(){ return getAll(); }
async function getById(id){ await ensureLoaded(); return recipes.find((r)=>String(r.id)===String(id)) || null; }
async function getByMenuItemName(name){ await ensureLoaded(); const n=String(name||'').trim().toLowerCase(); if(!n) return null; return recipes.find((r)=> String(r.menuItemName||r.menu_item_name||'').trim().toLowerCase()===n) || null; }
async function findRecipeByMenuItemName(name){ return getByMenuItemName(name); }
async function getByDishId(dishId){ await ensureLoaded(); const id=String(dishId||'').trim(); return recipes.find((r)=>String(r.linkedDishId||r.linked_dish_id||'')===id) || null; }
async function create(data){ await ensureLoaded(); const errs = json.validateRecipe(data || {}); if(errs.length){ const e = new Error(errs.join('; ')); e.status=400; throw e; } const now = new Date().toISOString(); const item = { id:data.id||uuid(), name:String(data.name||data.menuItemName||data.menu_item_name||'').trim() || String(data.menuItemName||'').trim() || 'Ricetta', menuItemName:String(data.menuItemName||data.menu_item_name||data.name||'').trim() || 'Ricetta', menu_item_name:String(data.menuItemName||data.menu_item_name||data.name||'').trim() || 'Ricetta', category:String(data.category||'').trim(), department:data.department||data.area||'cucina', area:data.department||data.area||'cucina', description:String(data.description||'').trim(), yieldPortions:Number(data.yieldPortions??data.yield_portions??data.servings) || 1, yield_portions:Number(data.yieldPortions??data.yield_portions??data.servings) || 1, sellingPrice:Number(data.sellingPrice??data.selling_price) || 0, selling_price:Number(data.sellingPrice??data.selling_price) || 0, targetFoodCost:Number(data.targetFoodCost??data.target_food_cost) || 0, target_food_cost:Number(data.targetFoodCost??data.target_food_cost) || 0, ivaPercent:Number(data.ivaPercent??data.iva_percent) || 0, iva_percent:Number(data.ivaPercent??data.iva_percent) || 0, overheadPercent:Number(data.overheadPercent??data.overhead_percent) || 0, overhead_percent:Number(data.overheadPercent??data.overhead_percent) || 0, packagingCost:Number(data.packagingCost??data.packaging_cost) || 0, packaging_cost:Number(data.packagingCost??data.packaging_cost) || 0, laborCost:Number(data.laborCost??data.labor_cost) || 0, labor_cost:Number(data.laborCost??data.labor_cost) || 0, linkedDishId:data.linkedDishId??data.linked_dish_id??null, linked_dish_id:data.linkedDishId??data.linked_dish_id??null, notes:String(data.notes||data.note||'').trim(), note:String(data.notes||data.note||'').trim(), ingredients:(Array.isArray(data.ingredients)?data.ingredients:[]).map((i)=>json.normalizeIngredient(i)), createdAt:now, updatedAt:now }; recipes.push(item); await writeRecipes(recipes); return item; }
async function update(id,data){ await ensureLoaded(); const idx=recipes.findIndex((r)=>String(r.id)===String(id)); if(idx===-1) return null; const next = { ...recipes[idx], ...data, id: recipes[idx].id, updatedAt:new Date().toISOString() }; if(Array.isArray(data.ingredients)) next.ingredients = data.ingredients.map((i)=>json.normalizeIngredient(i)); const errs = json.validateRecipe(next); if(errs.length){ const e=new Error(errs.join('; ')); e.status=400; throw e; } recipes[idx]=next; await writeRecipes(recipes); return recipes[idx]; }
async function remove(id){ await ensureLoaded(); const idx=recipes.findIndex((r)=>String(r.id)===String(id)); if(idx===-1) return false; recipes.splice(idx,1); await writeRecipes(recipes); return true; }
async function getFoodCost(id, inventoryRepository){ const recipe = await getById(id); if(!recipe) return null; return json.getFoodCost(recipe.id, inventoryRepository); }
module.exports = { ...json, getAll, getAllRecipes, getById, getByMenuItemName, findRecipeByMenuItemName, getByDishId, create, update, remove, getFoodCost };
