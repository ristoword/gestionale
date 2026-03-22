// backend/src/utils/orderInventoryHelpers.js
// Minimal rules to exclude bar/beverage lines from kitchen recipe stock checks.

function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

/** Same category codes as sala inferAreaFromCategory → bar. */
const BAR_MENU_CATEGORIES = new Set(["bar", "vini", "dessert"]);

/** Extra hints on category/type for bevande / drink lines. */
const BAR_TEXT_HINTS = ["bevanda", "bevande", "cocktail", "vino", "birra", "caff", "liquore", "spirits", "drink"];

/**
 * True if this line should NOT participate in kitchen inventory consumption validation.
 * Food (cucina/pizzeria) on a bar ticket still participates if explicitly marked.
 */
function isBarItem(item, order = {}) {
  const iArea = normalize(item.area);
  const oArea = normalize(order.area);
  if (iArea === "cucina" || iArea === "pizzeria") return false;
  if (iArea === "bar") return true;
  if (oArea === "bar") return true;

  const cat = normalize(item.category);
  if (BAR_MENU_CATEGORIES.has(cat)) return true;
  if (cat && BAR_TEXT_HINTS.some((h) => cat.includes(h))) return true;

  const typ = normalize(item.type);
  if (typ && BAR_TEXT_HINTS.some((h) => typ.includes(h))) return true;

  return false;
}

/** Order payload with only lines that count for food/kitchen inventory. */
function filterOrderItemsForInventory(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const food = items.filter((it) => !isBarItem(it, order));
  return { ...order, items: food };
}

function orderHasFoodInventoryItems(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  return items.some((it) => !isBarItem(it, order));
}

module.exports = {
  isBarItem,
  filterOrderItemsForInventory,
  orderHasFoodInventoryItems,
};
