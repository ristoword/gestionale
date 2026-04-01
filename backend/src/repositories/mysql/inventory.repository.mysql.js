// Magazzino — MySQL tenant_module_data (module_key inventory).

const { getJson, setJson } = require("./tenant-module.mysql");
const { createInventoryApi } = require("../inventory.repository.logic");

const MODULE_KEY = "inventory";

module.exports = createInventoryApi({
  loadItems: () => getJson(MODULE_KEY, []),
  saveItems: (items) => setJson(MODULE_KEY, items),
});
