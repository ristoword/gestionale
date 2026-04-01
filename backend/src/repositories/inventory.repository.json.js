// Magazzino — persistenza JSON per tenant.

const paths = require("../config/paths");
const tenantContext = require("../context/tenantContext");
const { safeReadJson, atomicWriteJson } = require("../utils/safeFileIO");
const { createInventoryApi } = require("./inventory.repository.logic");

function getDataPath() {
  return paths.tenant(tenantContext.getRestaurantId(), "inventory.json");
}

module.exports = createInventoryApi({
  loadItems: async () => safeReadJson(getDataPath(), []),
  saveItems: async (items) => {
    atomicWriteJson(getDataPath(), items);
  },
});
