// Harden Merge & Continue: abort if merged text is empty (prevents stray empty AI calls).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const MERGE = `const rows = $input.all();
if (rows.length === 0) return [];
const ctx = $('Prep Buffer SQL').first().json;
const merged = rows.map(r => r.json)
  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  .map(r => (r.message_text || '').trim())
  .filter(Boolean)
  .join('\\n');
if (!merged) return [];                                  // nothing real to process -> stop
const { sql, ...clean } = ctx;
return [{ json: { ...clean, message_text: merged, original_message_text: ctx.message_text } }];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const node = wf.nodes.find(n => n.name === "Merge & Continue");
  if (!node) { console.log("Merge & Continue not found"); process.exit(1); }
  node.parameters.jsCode = MERGE;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers: H, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers: H, body });
  console.log("PUT:", put.status); if (put.status >= 300) console.log("err:", (await put.text()).slice(0,400));
  await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers: H, body: "{}" });
  console.log("✓ Merge guard added");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
