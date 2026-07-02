// Bulletproof Parse AI Output: state-machine escaper handles literal newlines inside JSON
// string values (the real cause of raw-JSON leaks), then multi-strategy fallback.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const PARSE = String.raw`const out = $json.output;
const ctx = $('Build AI Context').first().json;

// escape raw control chars that appear INSIDE quoted strings (keeps structural JSON intact)
function escInStr(s){
  let o = '', q = false, e = false;
  for (let i = 0; i < s.length; i++){
    const ch = s[i];
    if (e){ o += ch; e = false; continue; }
    if (ch === '\\'){ o += ch; e = true; continue; }
    if (ch === '"'){ q = !q; o += ch; continue; }
    if (q && ch === '\n'){ o += '\\n'; continue; }
    if (q && ch === '\r'){ o += '\\r'; continue; }
    if (q && ch === '\t'){ o += '\\t'; continue; }
    o += ch;
  }
  return o;
}

function toObj(x){
  if (x && typeof x === 'object') return x;
  let s = String(x == null ? '' : x).trim();
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);          // strip any prose/fences around the JSON
  try { return JSON.parse(s); } catch (e) {}
  try { return JSON.parse(escInStr(s)); } catch (e) {} // fix literal newlines inside strings
  const m = s.match(/"response_ar"\s*:\s*"([\s\S]*?)"\s*[,}]/);
  return { intent:'inquiry', response_ar: m ? m[1].replace(/\\n/g, '\n') : s, confidence:0.7, booking:{} };
}

const parsed = toObj(out) || {};
const bk = (parsed.booking && typeof parsed.booking === 'object') ? parsed.booking : {};
return [{ json: {
  ...ctx,
  intent: parsed.intent || 'unclear',
  response_ar: parsed.response_ar || '',
  confidence: parsed.confidence ?? 0.0,
  is_sensitive: parsed.is_sensitive ?? false,
  requires_hitl: parsed.requires_hitl ?? false,
  booking_confirmed: bk.confirmed === true,
  b_service_ar: bk.service_ar || '', b_date: bk.date || '', b_time: bk.time || '', b_patient_name: bk.patient_name || '',
  raw_ai_output: (typeof out === 'string' ? out : JSON.stringify(out))
}}];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  wf.nodes.find(n => n.name === "Parse AI Output").parameters.jsCode = PARSE;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status);
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ bulletproof state-machine parser applied");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
