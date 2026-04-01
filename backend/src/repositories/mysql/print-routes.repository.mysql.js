const { v4: uuid } = require("uuid");
const { getJson, setJson } = require("./tenant-module.mysql");
const MODULE_KEY = "print-routes";
const EVENT_TYPES = ["order_ticket_bar","order_ticket_kitchen","order_ticket_pizzeria","invoice_print","receipt_prebill","receipt_final","inventory_label","inventory_report","catering_proposal_print","daily_menu_print","kitchen_production_print","shopping_list_print","closure_report_print"];
function normalizeRoute(r){ return { id:r.id||uuid(), restaurantId:r.restaurantId||null, eventType:String(r.eventType||"").trim(), department:String(r.department||"").trim(), deviceId:r.deviceId||null, isActive:r.isActive!==false, createdAt:r.createdAt||new Date().toISOString(), updatedAt:r.updatedAt||new Date().toISOString() }; }
async function readAll(){ const data=await getJson(MODULE_KEY,{routes:[]}); const list=Array.isArray(data)?data:(data.routes||[]); return list.map(normalizeRoute); }
async function writeAll(routes){ await setJson(MODULE_KEY,{routes}); }
async function getAll(){ return readAll(); }
async function getById(id){ const list=await readAll(); return list.find((r)=>r.id===id)||null; }
async function findByEventAndDepartment(eventType,department){ const list=await readAll(); return list.find((r)=>r.isActive&&r.eventType===eventType&&(r.department===department||!r.department))||null; }
async function create(data){ const route=normalizeRoute({...data,id:data.id||uuid()}); const list=await readAll(); list.push(route); await writeAll(list); return route; }
async function update(id,data){ const list=await readAll(); const i=list.findIndex((r)=>r.id===id); if(i===-1) return null; list[i]=normalizeRoute({...list[i],...data,id:list[i].id,updatedAt:new Date().toISOString()}); await writeAll(list); return list[i]; }
async function remove(id){ const list=await readAll(); const i=list.findIndex((r)=>r.id===id); if(i===-1) return false; list.splice(i,1); await writeAll(list); return true; }
module.exports={EVENT_TYPES,getAll,getById,findByEventAndDepartment,create,update,remove};
