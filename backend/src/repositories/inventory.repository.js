// Router: JSON (default) oppure MySQL se USE_MYSQL_DATABASE=true.

const { useMysqlPersistence } = require("../config/mysqlPersistence");
const json = require("./inventory.repository.json");
const mysql = require("./mysql/inventory.repository.mysql");

function impl() {
  return useMysqlPersistence() ? mysql : json;
}

module.exports = {
  DEPARTMENTS: json.DEPARTMENTS,
  getTotalValue: (...a) => impl().getTotalValue(...a),
  getAll: (...a) => impl().getAll(...a),
  getById: (...a) => impl().getById(...a),
  getByLocation: (...a) => impl().getByLocation(...a),
  update: (...a) => impl().update(...a),
  create: (...a) => impl().create(...a),
  remove: (...a) => impl().remove(...a),
  adjustQuantity: (...a) => impl().adjustQuantity(...a),
  load: (...a) => impl().load(...a),
  adjustLoadCorrection: (...a) => impl().adjustLoadCorrection(...a),
  transfer: (...a) => impl().transfer(...a),
  returnToCentral: (...a) => impl().returnToCentral(...a),
  readInventory: (...a) => impl().readInventory(...a),
  writeInventory: (...a) => impl().writeInventory(...a),
  findInventoryItemByName: (...a) => impl().findInventoryItemByName(...a),
  findInventoryItemByBarcode: (...a) => impl().findInventoryItemByBarcode(...a),
  getCostPerUnit: (...a) => impl().getCostPerUnit(...a),
  getStock: (...a) => impl().getStock(...a),
  getDepartmentStock: (...a) => impl().getDepartmentStock(...a),
  getMinStock: (...a) => impl().getMinStock(...a),
  deductInventoryItem: (...a) => impl().deductInventoryItem(...a),
  deductInventoryIngredients: (...a) => impl().deductInventoryIngredients(...a),
  deductFromDepartment: (...a) => impl().deductFromDepartment(...a),
};
