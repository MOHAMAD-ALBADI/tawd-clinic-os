// The [حقل booking] description in Build AI Context never documented the `action` field, so the
// model only learned 'cancel' from a buried rule and defaulted reschedule to 'book'. Add `action`
// to the authoritative field description (enumerated values) so the model emits it reliably.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const FIND = "patient_name. اتركي ما لم يُذكر بعد فارغاً";
const REPL = "patient_name، و action بإحدى القيم فقط: 'book' لحجز جديد، أو 'cancel' لإلغاء موعد قائم، أو 'reschedule' لتغيير/تأجيل موعد قائم إلى وقت جديد (الافتراضي 'book' — لا تستخدمي 'reschedule' إلا إذا كان للمريض موعد قائم يريد نقله). اتركي ما لم يُذكر بعد فارغاً";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const bc = wf.nodes.find(n => n.name === "Build AI Context");
  const code = bc.parameters.jsCode;
  if (!code.includes(FIND)) { console.error("FIND string not present — aborting (already patched?)"); process.exit(1); }
  if (code.includes("action بإحدى القيم")) { console.error("Already patched — aborting"); process.exit(1); }
  bc.parameters.jsCode = code.replace(FIND, REPL);

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ action field enumerated in booking schema (book|cancel|reschedule)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
