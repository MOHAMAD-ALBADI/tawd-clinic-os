// Comprehensive WF-05 fix: webhook responseMode + Gemini model names.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());

  // Inspect + fix webhook responseMode
  for (const n of wf.nodes) {
    if (n.type === "n8n-nodes-base.webhook") {
      console.log(`webhook "${n.name}" responseMode = ${n.parameters?.responseMode}`);
      n.parameters = n.parameters || {};
      n.parameters.responseMode = "responseNode"; // use the "Respond 200" node in the main path
    }
  }

  // Fix model names (deep, via string replace on the nodes JSON)
  let nodesStr = JSON.stringify(wf.nodes);
  const before = nodesStr;
  nodesStr = nodesStr.split("deep-research-pro-preview-12-2025").join("gemini-2.5-pro")
                     .split("gemini-2.5-pro-latest").join("gemini-2.5-pro")
                     .split("gemini-2.0-flash").join("gemini-2.5-flash");
  console.log("model strings changed:", before !== nodesStr);
  const nodes = JSON.parse(nodesStr);

  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];

  const body = JSON.stringify({ name: wf.name, nodes, connections: wf.connections, settings });

  const de = await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers, body: "{}" });
  console.log("deactivate:", de.status);
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) console.log("PUT err:", (await put.text()).slice(0, 500));
  const act = await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
  console.log("activate:", act.status);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
