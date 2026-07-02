// build-multilingual-names.mjs blanket-replaced COALESCE(u.name_ar,u.name) -> "+dexpr+", which
// ALSO clobbered the false branch of the dexpr definition, so for Arabic (lang!=en) dexpr became
// the literal string "+dexpr+" -> broke every doctor-assigning booking SQL. Restore that branch.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const BAD  = "const dexpr = _en ? 'COALESCE(u.name,u.name_ar)' : '\"+dexpr+\"';";
const GOOD = "const dexpr = _en ? 'COALESCE(u.name,u.name_ar)' : 'COALESCE(u.name_ar,u.name)';";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const prep = wf.nodes.find(n => n.name === "Prep Booking Params");
  let pc = prep.parameters.jsCode;
  if (!pc.includes(BAD)) { console.error("broken dexpr def not found (already fixed?)"); process.exit(1); }
  pc = pc.replace(BAD, GOOD);
  if (pc.includes("'\"+dexpr+\"'")) { console.error("still contains broken single-quoted +dexpr+"); process.exit(1); }
  try { new Function(pc); } catch(e){ console.error("invalid JS:", e.message); process.exit(1); }
  prep.parameters.jsCode = pc;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,400)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ dexpr Arabic branch restored — Arabic bookings fixed");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
