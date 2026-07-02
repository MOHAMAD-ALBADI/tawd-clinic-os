// Fix S1 "Human-like Delay" Code node: robust passthrough + delay (run-once-for-all-items).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "0Aq11NOwPChsSzZ8"; // S1 Send WhatsApp
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const CODE = `// Anti-spam human-like delay, then pass items through unchanged.
const t = $('Trigger').first().json;
const body = String(t.message_text || t.body || '');
const totalDelay = Math.min(800 + body.length * 12 + Math.floor(Math.random() * 800), 6000);
await new Promise(r => setTimeout(r, totalDelay));
return $input.all();`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  for (const n of wf.nodes) {
    if (/Human.?like Delay|Delay/i.test(n.name) && n.type.includes("code")) {
      n.parameters.jsCode = CODE;
      n.parameters.mode = "runOnceForAllItems";
      console.log("patched:", n.name);
    }
  }
  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) console.log("err:", (await put.text()).slice(0, 400));
  const act = await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
  console.log("activate:", act.status);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
