// Fix S3/S5 sub-workflows: the supabase search filters use $('Trigger').item.json.*
// which breaks inside an executeWorkflow sub-workflow (item pairing lost) -> phone filter
// resolves empty -> returns an arbitrary patient/session for EVERY phone. Use .first().json.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

async function fix(id, searchNodeName) {
  const wf = await fetch(`${B}/workflows/${id}`, { headers: H }).then(r => r.json());
  const node = wf.nodes.find(n => n.name === searchNodeName);
  if (!node) { console.log("!! node not found:", searchNodeName); return; }
  let changed = 0;
  for (const c of (node.parameters.filters?.conditions || [])) {
    if (typeof c.keyValue === "string" && c.keyValue.includes(".item.json")) {
      c.keyValue = c.keyValue.replace(/\.item\.json/g, ".first().json");
      changed++;
    }
  }
  console.log(searchNodeName, "conditions fixed:", changed);
  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  const wasActive = wf.active;
  if (wasActive) await fetch(`${B}/workflows/${id}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${id}`, { method:"PUT", headers:H, body });
  console.log("  PUT", id, "->", put.status);
  if (put.status >= 300) console.log("  err:", (await put.text()).slice(0,400));
  if (wasActive) await fetch(`${B}/workflows/${id}/activate`, { method:"POST", headers:H, body:"{}" });
}

(async () => {
  await fix("44lmYECx1xkG0Cir", "Search Patient");   // S3
  await fix("LhLhOblkCwLWWQlt", "Search Session");    // S5
  console.log("✓ S3/S5 phone lookup fixed");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
