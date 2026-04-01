const crypto = require("crypto");
const { getJson, setJson } = require("./tenant-module.mysql");
const MODULE_KEY = "pos-shifts";
function toNumber(v,fallback=0){ const n=Number(v); return Number.isFinite(n)?n:fallback; }
function normalizeString(v,fallback=''){ if(v==null) return fallback; return String(v).trim(); }
function createId(){ if(crypto.randomUUID) return crypto.randomUUID(); return `shift_${Date.now()}_${Math.floor(Math.random()*100000)}`; }
async function readShifts(){ const data=await getJson(MODULE_KEY,{shifts:[]}); return Array.isArray(data.shifts)?data.shifts:[]; }
async function writeShifts(shifts){ await setJson(MODULE_KEY,{shifts:Array.isArray(shifts)?shifts:[]}); }
async function getOpenShift(){ const shifts=await readShifts(); return shifts.find((s)=>String(s.status||'').toLowerCase()==='open')||null; }
async function createShift(shiftData){ const shifts=await readShifts(); const shift={ id:shiftData.id||createId(), opened_at:shiftData.opened_at||new Date().toISOString(), closed_at:shiftData.closed_at||null, operator:normalizeString(shiftData.operator,''), opening_float:toNumber(shiftData.opening_float,0), cash_total:toNumber(shiftData.cash_total,0), card_total:toNumber(shiftData.card_total,0), other_total:toNumber(shiftData.other_total,0), status:normalizeString(shiftData.status,'open')}; shifts.push(shift); await writeShifts(shifts); return shift; }
async function closeShift(id,updates){ const shifts=await readShifts(); const index=shifts.findIndex((s)=>String(s.id)===String(id)); if(index===-1) return null; const current=shifts[index]; const closed={...current,...updates,id:current.id,closed_at:updates.closed_at||new Date().toISOString(),status:'closed'}; shifts[index]=closed; await writeShifts(shifts); return closed; }
async function getShiftsByDate(dateStr){ const shifts=await readShifts(); const target=String(dateStr||'').slice(0,10); return shifts.filter((s)=>(s.opened_at||'').slice(0,10)===target); }
async function updateShift(id,updates){ const shifts=await readShifts(); const index=shifts.findIndex((s)=>String(s.id)===String(id)); if(index===-1) return null; const current=shifts[index]; const next={...current,...updates,id:current.id}; shifts[index]=next; await writeShifts(shifts); return next; }
module.exports={ readShifts,writeShifts,getOpenShift,createShift,closeShift,getShiftsByDate,updateShift,toNumber,normalizeString };
