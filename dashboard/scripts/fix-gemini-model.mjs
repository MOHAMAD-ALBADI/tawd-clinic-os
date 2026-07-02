// One-off: update deprecated Gemini model names in WF-05 via n8n API.
// Node handles UTF-8 natively so Arabic node content is preserved.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };

const REPLACEMENTS = [
  ["gemini-2.5-pro-latest", "gemini-2.5-pro"],
  ["gemini-2.0-flash", "gemini-2.5-flash"],
];

const j = (r) => r.json();

const ALLOWED_SETTINGS = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(j);
  const settings = {};
  for (const k of ALLOWED_SETTINGS) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  let body = JSON.stringify({
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings,
  });

  let total = 0;
  for (const [from, to] of REPLACEMENTS) {
    const count = body.split(from).length - 1;
    if (count) body = body.split(from).join(to);
    total += count;
    console.log(`  ${from} -> ${to}: ${count} occurrence(s)`);
  }
  if (total === 0) { console.log("No deprecated model strings found — nothing to change."); return; }

  // PUT on an active workflow returns 400 — deactivate first.
  const de = await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers, body: "{}" });
  console.log("deactivate:", de.status);

  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) {
    console.log("PUT error body:", (await put.text()).slice(0, 600));
    const re = await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
    console.log("re-activate after failure:", re.status);
    return;
  }

  const act = await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
  console.log("activate:", act.status);
  console.log("DONE. Updated", total, "model reference(s).");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
