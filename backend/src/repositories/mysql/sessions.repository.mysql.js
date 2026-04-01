const crypto = require("crypto");
const { getJson, setJson } = require("./tenant-module.mysql");
const MODULE_KEY = "sessions";
function createId(){ if(crypto.randomUUID) return crypto.randomUUID(); return `sess_${Date.now()}_${Math.floor(Math.random()*100000)}`; }
function normalizeString(v,fallback=''){ if(v==null) return fallback; return String(v).trim(); }
async function readAllSessions(){ const data=await getJson(MODULE_KEY, []); return Array.isArray(data)?data:[]; }
async function writeAllSessions(sessions){ await setJson(MODULE_KEY, Array.isArray(sessions)?sessions:[]); }
async function createSession(payload){ const sessions=await readAllSessions(); const nowIso=new Date().toISOString(); const session={ id:payload.id||createId(), userId:normalizeString(payload.userId,''), name:normalizeString(payload.name,''), department:normalizeString(payload.department,''), loginTime:payload.loginTime||nowIso, logoutTime:payload.logoutTime||null, authorizedBy:payload.authorizedBy!=null?normalizeString(payload.authorizedBy,''):null, source:normalizeString(payload.source,'module')}; sessions.push(session); await writeAllSessions(sessions); return session; }
async function endSession(sessionId){ const sessions=await readAllSessions(); const idx=sessions.findIndex((s)=>s.id===sessionId); if(idx===-1) return null; sessions[idx].logoutTime=new Date().toISOString(); await writeAllSessions(sessions); return sessions[idx]; }
async function endSessionByUserId(userId){ const sessions=await readAllSessions(); const idx=sessions.findIndex((s)=>s.userId===userId && !s.logoutTime); if(idx===-1) return null; sessions[idx].logoutTime=new Date().toISOString(); await writeAllSessions(sessions); return sessions[idx]; }
async function getActiveSessions(department=null){ const sessions=await readAllSessions(); let active=sessions.filter((s)=>!s.logoutTime); if(department) active=active.filter((s)=>s.department===department); return active; }
module.exports={ readAllSessions, createSession, endSession, endSessionByUserId, getActiveSessions };
