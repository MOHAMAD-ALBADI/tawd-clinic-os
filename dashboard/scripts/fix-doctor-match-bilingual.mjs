// The doctor-name FILTER must match reqDoctor against BOTH name_ar AND name (the model may output
// the doctor's name in either language). Only the DISPLAY name uses the lang-aware dexpr. My earlier
// dexpr change accidentally made the filter single-language -> English doctor requests failed.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const BAD  = `const drFilter = reqDoctor ? (" AND "+dexpr+" ILIKE '%"+reqDoctor+"%'") : "";`;
const GOOD = `const drFilter = reqDoctor ? (" AND (u.name_ar ILIKE '%"+reqDoctor+"%' OR u.name ILIKE '%"+reqDoctor+"%')") : "";`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const prep = wf.nodes.find(n => n.name === "Prep Booking Params");
  let pc = prep.parameters.jsCode;
  if (pc.includes("u.name_ar ILIKE '%\"+reqDoctor")) { console.log("already fixed"); process.exit(0); }
  if (!pc.includes(BAD)) { console.error("BAD drFilter not found — aborting"); process.exit(1); }
  pc = pc.replace(BAD, GOOD);
  try { new Function(pc); } catch(e){ console.error("invalid JS:", e.message); process.exit(1); }
  prep.parameters.jsCode = pc;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,400)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Doctor filter now matches both name_ar + name (language-agnostic)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
