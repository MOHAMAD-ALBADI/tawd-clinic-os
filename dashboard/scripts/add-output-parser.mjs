// Force reliable structured output: attach a Structured Output Parser to the agent.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const EXAMPLE = JSON.stringify({
  intent: "book_appointment",
  response_ar: "نص الرد بالعربية",
  confidence: 0.9,
  is_sensitive: false,
  requires_hitl: false,
  booking: { confirmed: true, service_ar: "حشوة الأسنان", date: "2026-07-01", time: "16:00", patient_name: "ناصر" }
}, null, 2);

const PARSE = String.raw`let parsed = $json.output;
const ctx = $('Build AI Context').first().json;
if (typeof parsed === 'string') {
  try { parsed = JSON.parse(parsed.replace(/` + "```json" + String.raw`\n?/gi,'').replace(/` + "```" + String.raw`\n?/g,'').trim()); }
  catch (e) { parsed = { intent:'inquiry', response_ar: String(parsed).trim() || 'كيف أقدر أساعدك؟', confidence:0.8 }; }
}
parsed = parsed || {};
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
  raw_ai_output: JSON.stringify(parsed)
}}];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  if (wf.nodes.some(n => n.name === "Structured Output")) { console.log("parser already present"); return; }

  const agent = wf.nodes.find(n => n.name === "???? Agent");
  const ax = agent.position?.[0] ?? 0, ay = agent.position?.[1] ?? 0;
  wf.nodes.push({
    id: "struct-out", name: "Structured Output",
    type: "@n8n/n8n-nodes-langchain.outputParserStructured", typeVersion: 1.2,
    position: [ax + 60, ay + 220],
    parameters: { schemaType: "fromJson", jsonSchemaExample: EXAMPLE }
  });
  agent.parameters.hasOutputParser = true;

  // Gemini: clean options (responseMimeType unsupported), keep low temperature
  const gem = wf.nodes.find(n => n.name === "Gemini Flash");
  gem.parameters.options = { temperature: 0.2 };

  // Parse AI Output -> read parsed object
  wf.nodes.find(n => n.name === "Parse AI Output").parameters.jsCode = PARSE;

  // wire parser into agent
  wf.connections["Structured Output"] = { ai_outputParser: [[{ node: "???? Agent", type: "ai_outputParser", index: 0 }]] };

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers: H, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers: H, body });
  console.log("PUT:", put.status); if (put.status >= 300) { console.log("err:", (await put.text()).slice(0, 600)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers: H, body: "{}" });
  console.log("✓ Structured Output Parser attached to agent");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
