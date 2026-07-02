// Remove the unreliable output parser; restore JSON-string parsing in Parse AI Output.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const PARSE = String.raw`const rawOutput = $json.output || $json.text || '';
const ctx = $('Build AI Context').first().json;
let parsed;
try {
  const cleaned = String(rawOutput).replace(/` + "```json" + String.raw`\n?/gi,'').replace(/` + "```" + String.raw`\n?/g,'').trim();
  parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || parsed.response_ar === undefined) throw new Error('x');
} catch (e) {
  const txt = String(rawOutput).trim();
  parsed = { intent:'inquiry', response_ar: txt || 'كيف أقدر أساعدك؟', confidence: txt ? 0.8 : 0, is_sensitive:false, requires_hitl:false };
}
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
  raw_ai_output: rawOutput
}}];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  wf.nodes = wf.nodes.filter(n => n.name !== "Structured Output");
  delete wf.connections["Structured Output"];
  const agent = wf.nodes.find(n => n.name === "???? Agent");
  if (agent && agent.parameters) delete agent.parameters.hasOutputParser;
  wf.nodes.find(n => n.name === "Parse AI Output").parameters.jsCode = PARSE;

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers: H, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers: H, body });
  console.log("PUT:", put.status); if (put.status >= 300) { console.log("err:", (await put.text()).slice(0, 500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers: H, body: "{}" });
  console.log("✓ Output parser removed, JSON-string parsing restored");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
