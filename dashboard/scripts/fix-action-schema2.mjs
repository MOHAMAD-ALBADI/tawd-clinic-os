// Previous patch inserted single-quoted 'book'/'cancel'/'reschedule' inside a single-quoted JS
// string literal -> "Unexpected identifier 'book'" syntax error broke the whole workflow.
// Replace those with double-quoted values (safe inside the single-quoted string).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const BAD  = "action بإحدى القيم فقط: 'book' لحجز جديد، أو 'cancel' لإلغاء موعد قائم، أو 'reschedule' لتغيير/تأجيل موعد قائم إلى وقت جديد (الافتراضي 'book' — لا تستخدمي 'reschedule' إلا إذا كان للمريض موعد قائم يريد نقله).";
const GOOD = "action بإحدى القيم فقط: \"book\" لحجز جديد، أو \"cancel\" لإلغاء موعد قائم، أو \"reschedule\" لتغيير/تأجيل موعد قائم إلى وقت جديد (الافتراضي \"book\" — لا تستخدمي \"reschedule\" إلا إذا كان للمريض موعد قائم يريد نقله).";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const bc = wf.nodes.find(n => n.name === "Build AI Context");
  let code = bc.parameters.jsCode;
  if (!code.includes(BAD)) { console.error("BAD segment not found — aborting"); process.exit(1); }
  code = code.replace(BAD, GOOD);
  // sanity: ensure it now parses as a function body
  try { new Function(code); } catch(e){ console.error("Still not valid JS:", e.message); process.exit(1); }
  bc.parameters.jsCode = code;

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Build AI Context valid again — action values now double-quoted");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
