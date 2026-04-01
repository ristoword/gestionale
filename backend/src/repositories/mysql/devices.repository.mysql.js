const { v4: uuid } = require("uuid");
const { getJson, setJson } = require("./tenant-module.mysql");

const MODULE_KEY = "devices";
const DEPARTMENTS = ["sala", "cucina", "bar", "pizzeria", "cassa", "magazzino"];
const DEVICE_TYPES = ["thermal_printer","kitchen_printer","bar_printer","pizzeria_printer","cashier_printer","label_printer","barcode_scanner","cash_drawer"];
const CONNECTION_TYPES = ["usb", "network", "bluetooth"];

function normalizeDevice(d) {
  return {
    id: d.id || uuid(), restaurantId: d.restaurantId || null, name: String(d.name || "").trim() || "Dispositivo",
    type: DEVICE_TYPES.includes(d.type) ? d.type : "thermal_printer",
    department: DEPARTMENTS.includes(d.department) ? d.department : "cassa",
    connectionType: CONNECTION_TYPES.includes(d.connectionType) ? d.connectionType : "usb",
    ipAddress: d.ipAddress || null, port: d.port || null, identifier: d.identifier || d.devicePath || null,
    devicePath: d.devicePath || d.identifier || null, isDefault: Boolean(d.isDefault), isActive: d.isActive !== false,
    notes: String(d.notes || "").trim(), createdAt: d.createdAt || new Date().toISOString(), updatedAt: d.updatedAt || new Date().toISOString(),
  };
}
async function readAll(){ const data=await getJson(MODULE_KEY,{devices:[]}); const list=Array.isArray(data)?data:(data.devices||[]); return list.map(normalizeDevice);}
async function writeAll(devices){ await setJson(MODULE_KEY,{devices}); }
async function getAll(){ return readAll(); }
async function getById(id){ const list=await readAll(); return list.find((d)=>d.id===id)||null; }
async function getByDepartment(department){ const list=await readAll(); return list.filter((d)=>d.department===department&&d.isActive); }
async function getDefaultForDepartment(department){ const list=await readAll(); return list.find((d)=>d.department===department&&d.isDefault&&d.isActive)||null; }
async function create(data){ const device=normalizeDevice({...data,id:data.id||uuid()}); const list=await readAll(); if(device.isDefault){ list.forEach((d)=>{ if(d.department===device.department) d.isDefault=false; }); } list.push(device); await writeAll(list); return device; }
async function update(id,data){ const list=await readAll(); const i=list.findIndex((d)=>d.id===id); if(i===-1) return null; const existing=list[i]; const device=normalizeDevice({...existing,...data,id:existing.id,updatedAt:new Date().toISOString()}); if(device.isDefault && !existing.isDefault){ list.forEach((d)=>{ if(d.department===device.department && d.id!==device.id) d.isDefault=false; }); } if(data.isActive===false && existing.isDefault) device.isDefault=false; list[i]=device; await writeAll(list); return device; }
async function remove(id){ const list=await readAll(); const i=list.findIndex((d)=>d.id===id); if(i===-1) return false; list.splice(i,1); await writeAll(list); return true; }
module.exports={DEPARTMENTS,DEVICE_TYPES,CONNECTION_TYPES,getAll,getById,getByDepartment,getDefaultForDepartment,create,update,remove};
