// Create a new n8n Gemini credential with the PAID-tier key and repoint the model nodes.
const KEY = process.env.N8N_API_KEY;
const GKEY = process.env.GKEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  // model nodes that carry a Gemini credential
  const geminiNodes = wf.nodes.filter(n => n.credentials && (n.credentials.googlePalmApi || n.credentials.googleGeminiApi));
  if (!geminiNodes.length) { console.log("no gemini-cred nodes found"); process.exit(1); }
  const credKey = geminiNodes[0].credentials.googlePalmApi ? "googlePalmApi" : "googleGeminiApi";
  console.log("cred type:", credKey, "| nodes:", geminiNodes.map(n=>n.name).join(", "));

  // 1) create new credential
  const created = await fetch(`${B}/credentials`, {
    method: "POST", headers: H,
    body: JSON.stringify({ name: "TAWD Gemini Paid", type: credKey, data: { apiKey: GKEY, host: "https://generativelanguage.googleapis.com", allowedDomains: "" } })
  });
  const cj = await created.json();
  if (created.status >= 300) { console.log("create cred FAILED:", created.status, JSON.stringify(cj).slice(0,300)); process.exit(1); }
  const newId = cj.id;
  console.log("new credential id:", newId);

  // 2) repoint all gemini nodes to the new credential
  for (const n of geminiNodes) n.credentials[credKey] = { id: newId, name: "TAWD Gemini Paid" };

  // 3) PUT workflow
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status);
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Sura now uses the PAID Gemini key");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
