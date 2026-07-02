// Polish multilingual: show English service + doctor names in English replies. (1) S4 Load Context
// services aggregate gains the English `name`. (2) Prep computes a lang-aware service_name and uses
// a lang-aware COALESCE order for doctor names. (3) Format uses prep.service_name.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

async function put(id, mutate) {
  const wf = await fetch(`${B}/workflows/${id}`, { headers: H }).then(r => r.json());
  mutate(wf);
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${id}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const r = await fetch(`${B}/workflows/${id}`, { method:"PUT", headers:H, body });
  if (r.status>=300) { console.log(id, "err:", (await r.text()).slice(0,400)); process.exit(1); }
  await fetch(`${B}/workflows/${id}/activate`, { method:"POST", headers:H, body:"{}" });
}

(async () => {
  // 1) S4 Load Context: add English name to services aggregate
  await put("MSsHC3t4qbzqWzlk", wf => {
    const n = wf.nodes.find(x => x.name === "Load Context");
    if (!n.parameters.query.includes("'name',sv.name")) {
      if (!n.parameters.query.includes("'dur',sv.duration_minutes)")) throw new Error("S4 services anchor missing");
      n.parameters.query = n.parameters.query.replace("'dur',sv.duration_minutes)", "'dur',sv.duration_minutes,'name',sv.name)");
      console.log("• S4: services aggregate now includes English name");
    } else console.log("• S4: already has name");
  });

  // 2+3) WF-05 Prep + Format
  await put("arZRfHPPTytcMSR5", wf => {
    const prep = wf.nodes.find(x => x.name === "Prep Booking Params");
    let pc = prep.parameters.jsCode;
    if (!pc.includes("const dexpr")) {
      const anchor = "let svc = services.find(s=>s.name_ar===want) || services.find(s=>want&&s.name_ar&&(want.includes(s.name_ar)||s.name_ar.includes(want))) || null;";
      if (!pc.includes(anchor)) throw new Error("Prep svc anchor missing");
      pc = pc.replace(anchor, anchor + "\nconst _en = c.lang==='en'; const dexpr = _en ? 'COALESCE(u.name,u.name_ar)' : 'COALESCE(u.name_ar,u.name)'; const svcName = (_en ? (svc && (svc.name||svc.name_ar)) : (svc && svc.name_ar)) || (c.b_service_ar||'');");
      // lang-aware doctor names in all SQL branches
      pc = pc.split("COALESCE(u.name_ar,u.name)").join('"+dexpr+"');
      // expose service_name
      pc = pc.replace("service_name_ar: svc?svc.name_ar:(c.b_service_ar||''),", "service_name_ar: svc?svc.name_ar:(c.b_service_ar||''), service_name: svcName,");
      try { new Function(pc); } catch(e){ throw new Error("Prep invalid: "+e.message); }
      prep.parameters.jsCode = pc;
      console.log("• Prep: lang-aware service + doctor names");
    } else console.log("• Prep: already patched");

    const fmt = wf.nodes.find(x => x.name === "Format Booking Reply");
    if (fmt.parameters.jsCode.includes("const svc = prep.service_name_ar || '';")) {
      fmt.parameters.jsCode = fmt.parameters.jsCode.replace("const svc = prep.service_name_ar || '';", "const svc = prep.service_name || prep.service_name_ar || '';");
      console.log("• Format: uses lang-aware service_name");
    } else console.log("• Format: service_name anchor not found");
  });

  console.log("✓ Multilingual names localized");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
