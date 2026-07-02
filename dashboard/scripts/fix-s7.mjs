// Fix S7 "Insert HITL Queue" field mapping to match the real ai_review_queue schema.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "dK1T85wRcr8XPZSO"; // S7 Push to HITL
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const CORRECT_FIELDS = [
  { fieldId: "session_id",       fieldValue: "={{ $('Trigger').item.json.session_id }}" },
  { fieldId: "clinic_id",        fieldValue: "={{ $('Trigger').item.json.clinic_id }}" },
  { fieldId: "patient_id",       fieldValue: "={{ $('Trigger').item.json.patient_id ?? null }}" },
  { fieldId: "ai_draft",         fieldValue: "={{ $('Trigger').item.json.ai_draft ?? $('Trigger').item.json.original_message ?? '' }}" },
  { fieldId: "ai_intent",        fieldValue: "={{ $('Trigger').item.json.reason ?? null }}" },
  { fieldId: "confidence_score", fieldValue: "={{ $('Trigger').item.json.confidence_score ?? 0.5 }}" },
  { fieldId: "priority",         fieldValue: "={{ ({low:1, medium:2, high:3, urgent:4})[$('Trigger').item.json.priority] ?? (Number($('Trigger').item.json.priority) || 2) }}" },
  { fieldId: "status",           fieldValue: "pending" },
];

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  let fixed = false;
  for (const n of wf.nodes) {
    if (n.type === "n8n-nodes-base.supabase" && n.parameters?.tableId === "ai_review_queue") {
      n.parameters.fieldsUi = { fieldValues: CORRECT_FIELDS };
      fixed = true;
      console.log("patched node:", n.name);
    }
  }
  if (!fixed) { console.log("HITL insert node not found!"); return; }

  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });

  const de = await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers, body: "{}" });
  console.log("deactivate:", de.status);
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) { console.log("PUT err:", (await put.text()).slice(0, 500)); }
  const act = await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
  console.log("activate:", act.status);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
