const setupConfig = require("../../config/setup");
const { getJson, setJson } = require("./tenant-module.mysql");
const MODULE_KEY = "qr-tables";
async function readOverrides(){ const data=await getJson(MODULE_KEY,{tables:[]}); return Array.isArray(data.tables)?data.tables:[]; }
async function writeOverrides(tables){ await setJson(MODULE_KEY,{tables:Array.isArray(tables)?tables:[]}); }
async function getTables(){ const config=setupConfig.readConfig(); const numTables=Math.max(1, Math.min(999, Number(config?.numTables)||20)); const overrides=await readOverrides(); const result=[]; for(let i=1;i<=numTables;i++){ const o=overrides.find((t)=>String(t.id)===String(i)||Number(t.id)===i); result.push({ id:i, tableId:String(i), label:o?.label||`Tavolo ${i}`, qrData:null, createdAt:o?.createdAt||null, updatedAt:o?.updatedAt||null }); } return result; }
async function getTableById(tableId){ const tables=await getTables(); const id=typeof tableId==='string'?parseInt(tableId,10):Number(tableId); return tables.find((t)=>t.id===id || t.tableId===String(tableId)) || null; }
module.exports={ getTables,getTableById,readOverrides,writeOverrides };
