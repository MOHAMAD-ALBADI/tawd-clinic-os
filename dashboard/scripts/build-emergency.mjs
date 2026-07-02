// Emergency escalation: the model tags medical emergencies (intent="emergency"), Parse AI Output
// surfaces is_emergency, and a fan-out branch off Parse AI Output logs an alert row into
// public.sura_alerts (clinic dashboard reads it). The patient still gets Sura's urgent reply via
// the normal fast path (confidence>=0.6 -> not a booking -> Send Response). No gate changes.
import { randomUUID } from "crypto";
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

// Parse AI Output — stage-C version + is_emergency
const PARSE = String.raw`const out = $json.output;
const ctx = $('Build AI Context').first().json;
function escInStr(s){ let o='',q=false,e=false; for(let i=0;i<s.length;i++){const ch=s[i]; if(e){o+=ch;e=false;continue;} if(ch==='\\'){o+=ch;e=true;continue;} if(ch==='"'){q=!q;o+=ch;continue;} if(q&&ch==='\n'){o+='\\n';continue;} if(q&&ch==='\r'){o+='\\r';continue;} if(q&&ch==='\t'){o+='\\t';continue;} o+=ch; } return o; }
function toObj(x){ if(x&&typeof x==='object')return x; let s=String(x==null?'':x).trim(); const a=s.indexOf('{'),b=s.lastIndexOf('}'); if(a>=0&&b>a)s=s.slice(a,b+1); try{return JSON.parse(s);}catch(e){} try{return JSON.parse(escInStr(s));}catch(e){} const m=s.match(/"response_ar"\s*:\s*"([\s\S]*?)"\s*[,}]/); return {intent:'inquiry',response_ar:m?m[1].replace(/\\n/g,'\n'):s,confidence:0.7,booking:{}}; }
const parsed = toObj(out) || {};
const bk = (parsed.booking && typeof parsed.booking==='object') ? parsed.booking : {};
const it = String(parsed.intent||'').toLowerCase();
let act = String(bk.action||'').toLowerCase();
if (!['book','cancel','reschedule','waitlist'].includes(act)) act = '';
if (!act) act = it.includes('reschedul') ? 'reschedule' : (it.includes('cancel') ? 'cancel' : ((it.includes('wait')) ? 'waitlist' : 'book'));
if (act === 'book' && it.includes('reschedul')) act = 'reschedule';
if (act === 'book' && it.includes('cancel')) act = 'cancel';
if (act === 'book' && it.includes('wait')) act = 'waitlist';
const is_emergency = (parsed.is_emergency===true) || it.includes('emerg') || it.includes('urgent');
return [{ json: { ...ctx,
  intent: parsed.intent||'unclear', response_ar: parsed.response_ar||'', confidence: parsed.confidence??0.0,
  is_sensitive: parsed.is_sensitive??false, requires_hitl: parsed.requires_hitl??false, is_emergency,
  booking_confirmed: bk.confirmed===true, b_action: act,
  b_service_ar: bk.service_ar||'', b_date: bk.date||'', b_time: bk.time||'', b_patient_name: bk.patient_name||'',
  raw_ai_output: (typeof out==='string'?out:JSON.stringify(out)) } }];`;

// Prep Emergency — build a conditional INSERT into sura_alerts (no-op when not an emergency)
const PREP_EMG = String.raw`const c = $json;
let rc = {}; try { rc = $('Resolve Clinic ID').first().json || {}; } catch(e){}
const esc = s => String(s||'').replace(/'/g, "''");
const CID = c.clinic_id || rc.clinic_id;
const PID = c.patient_id || rc.patient_id;
if (c.is_emergency && CID && PID) {
  const um = c.message_text || rc.message_text || '';
  const combo = ('المريض: ' + um + ' | ردّ سُرى: ' + (c.response_ar||'')).slice(0,600);
  const phone = rc.phone || c.phone || '';
  const pname = c.b_patient_name || c.patient_name || rc.sender_name || '';
  const sql = "INSERT INTO public.sura_alerts (clinic_id,patient_id,phone,patient_name,kind,severity,message,status) " +
              "VALUES ('"+CID+"'::uuid,'"+PID+"'::uuid,'"+esc(phone)+"','"+esc(pname)+"','emergency','high','"+esc(combo)+"','open');";
  return [{ json: { sql, _emergency: true } }];
}
return [{ json: { sql: "SELECT 1 WHERE false;", _emergency: false } }];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const parse = wf.nodes.find(n => n.name === "Parse AI Output");
  parse.parameters.jsCode = PARSE;
  const [px, py] = parse.position || [4288, 480];

  if (wf.nodes.some(n => n.name === "Prep Emergency" || n.name === "Log Emergency")) {
    console.error("Emergency nodes already exist — aborting to avoid duplicates"); process.exit(1);
  }

  const prepNode = {
    id: randomUUID(), name: "Prep Emergency", type: "n8n-nodes-base.code", typeVersion: 2,
    position: [px, py + 260], parameters: { jsCode: PREP_EMG }
  };
  const logNode = {
    id: randomUUID(), name: "Log Emergency", type: "n8n-nodes-base.postgres", typeVersion: 2,
    position: [px + 220, py + 260],
    credentials: { postgres: { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" } },
    parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} }
  };
  wf.nodes.push(prepNode, logNode);

  // fan-out: Parse AI Output -> (existing) HITL Gate + (new) Prep Emergency
  const pc = wf.connections["Parse AI Output"].main[0];
  if (!pc.some(x => x.node === "Prep Emergency")) pc.push({ node: "Prep Emergency", type: "main", index: 0 });
  wf.connections["Prep Emergency"] = { main: [[{ node: "Log Emergency", type: "main", index: 0 }]] };

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,600)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Emergency escalation wired (Parse->Prep Emergency->Log Emergency; sura_alerts)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
