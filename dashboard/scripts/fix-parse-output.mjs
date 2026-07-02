// Make Parse AI Output robust: if Gemini returns plain text (not JSON),
// use that text as the reply with good confidence so Sura auto-replies.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const CODE = `const rawOutput = $json.output || $json.text || '';
const ctx = $('Build AI Context').first().json;

let parsed;
try {
  const cleaned = String(rawOutput).replace(/\`\`\`json\\n?/gi, '').replace(/\`\`\`\\n?/g, '').trim();
  parsed = JSON.parse(cleaned);
  // guard: parsed must be an object with response text
  if (!parsed || typeof parsed !== 'object' || !parsed.response_ar) throw new Error('no response_ar');
} catch (e) {
  // Gemini returned plain text instead of JSON — use it directly as the reply.
  const txt = String(rawOutput).trim();
  parsed = {
    intent:        'inquiry',
    response_ar:   txt || 'كيف أقدر أساعدك؟',
    confidence:    txt.length > 0 ? 0.8 : 0.0,
    is_sensitive:  false,
    requires_hitl: false,
  };
}

return [{ json: {
  ...ctx,
  intent:        parsed.intent       || 'unclear',
  response_ar:   parsed.response_ar  || '',
  confidence:    parsed.confidence   ?? 0.0,
  is_sensitive:  parsed.is_sensitive ?? false,
  requires_hitl: parsed.requires_hitl ?? false,
  raw_ai_output: rawOutput,
}}];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  const n = wf.nodes.find(x => x.name === "Parse AI Output");
  n.parameters.jsCode = CODE;
  console.log("patched Parse AI Output (plain-text fallback)");
  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) console.log("err:", (await put.text()).slice(0, 400));
  await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
  console.log("activated");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
