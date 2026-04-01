const { v4: uuid } = require("uuid");
const { getJson, setJson } = require("./tenant-module.mysql");
const MODULE_KEY = "print-jobs";
const STATUSES = ["queued","sent","failed","printed"];
function normalizeJob(j){ return { id:j.id||uuid(), restaurantId:j.restaurantId||null, eventType:j.eventType||"", department:j.department||"", deviceId:j.deviceId||null, documentTitle:j.documentTitle||"", content:j.content||"", sourceModule:j.sourceModule||"", status:STATUSES.includes(j.status)?j.status:"queued", errorMessage:j.errorMessage||null, relatedOrderId:j.relatedOrderId||null, relatedTable:j.relatedTable||null, createdAt:j.createdAt||new Date().toISOString(), updatedAt:j.updatedAt||new Date().toISOString() }; }
async function readAll(){ const data=await getJson(MODULE_KEY,{jobs:[]}); const list=Array.isArray(data)?data:(data.jobs||[]); return list.map(normalizeJob); }
async function writeAll(jobs){ await setJson(MODULE_KEY,{jobs}); }
async function getAll(filters={}){ let list=await readAll(); if(filters.status) list=list.filter((j)=>j.status===filters.status); if(filters.sourceModule) list=list.filter((j)=>j.sourceModule===filters.sourceModule); if(filters.limit) list=list.slice(-filters.limit); return list; }
async function getById(id){ const list=await readAll(); return list.find((j)=>j.id===id)||null; }
async function create(data){ const job=normalizeJob({...data,id:data.id||uuid()}); const list=await readAll(); list.push(job); await writeAll(list); return job; }
async function updateStatus(id,status,errorMessage=null){ const list=await readAll(); const i=list.findIndex((j)=>j.id===id); if(i===-1) return null; list[i].status=STATUSES.includes(status)?status:list[i].status; list[i].errorMessage=errorMessage ?? list[i].errorMessage; list[i].updatedAt=new Date().toISOString(); await writeAll(list); return list[i]; }
module.exports={STATUSES,getAll,getById,create,updateStatus};
