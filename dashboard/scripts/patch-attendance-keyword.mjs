// The model won't reliably emit action='confirm' for attendance confirmations. Add a deterministic
// keyword override in Parse AI Output: explicit attendance phrases (بحضر/سأحضر/راح أجي/...) -> confirm,
// with a negation guard so "ما راح أحضر" is NOT treated as confirm.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const ANCHOR = "if (act === 'book' && (it.includes('attend') || it.includes('confirm_attend'))) act = 'confirm';";
const ADD = ANCHOR + "\n" + String.raw`const _um = String(ctx.message_text||'');
const _attNeg = /(ما|مو|مب|لن|ماني|ما\s*راح)\s*(راح\s*)?(ب?أ?حضر|سأحضر|أجي|بجي)/.test(_um);
const _attPos = /(بحضر|سأحضر|سوف أحضر|راح أجي|بجي|حاضر أجي|أكّد حضور|اكد حضور|أؤكد حضور|تأكيد الحضور|ثبّت موعد|ثبت موعد)/.test(_um);
if (act === 'book' && _attPos && !_attNeg) act = 'confirm';`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const parse = wf.nodes.find(n => n.name === "Parse AI Output");
  let pc = parse.parameters.jsCode;
  if (pc.includes("_attPos")) { console.log("already patched"); process.exit(0); }
  if (!pc.includes(ANCHOR)) { console.error("anchor missing"); process.exit(1); }
  pc = pc.replace(ANCHOR, ADD);
  try { new Function(pc); } catch(e){ console.error("invalid JS:", e.message); process.exit(1); }
  parse.parameters.jsCode = pc;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,400)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Attendance keyword override added to Parse (بحضر/... -> confirm, negation-guarded)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
