// Complaint/anger detection: Parse surfaces is_complaint (intent='complaint'); the Prep Emergency
// branch (fan-out off Parse AI Output) now logs kind='complaint' (severity medium) as well as
// kind='emergency' (high) into sura_alerts. Sura's empathetic de-escalation reply is prompt-driven.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const PREP_EMG = String.raw`const c = $json;
let rc = {}; try { rc = $('Resolve Clinic ID').first().json || {}; } catch(e){}
const esc = s => String(s||'').replace(/'/g, "''");
const CID = c.clinic_id || rc.clinic_id;
const PID = c.patient_id || rc.patient_id;
const kind = c.is_emergency ? 'emergency' : (c.is_complaint ? 'complaint' : '');
const sev = c.is_emergency ? 'high' : 'medium';
if (kind && CID && PID) {
  const um = c.message_text || rc.message_text || '';
  const combo = ('المريض: ' + um + ' | ردّ سُرى: ' + (c.response_ar||'')).slice(0,600);
  const phone = rc.phone || c.phone || '';
  const pname = c.b_patient_name || c.patient_name || rc.sender_name || '';
  const sql = "INSERT INTO public.sura_alerts (clinic_id,patient_id,phone,patient_name,kind,severity,message,status) " +
              "VALUES ('"+CID+"'::uuid,'"+PID+"'::uuid,'"+esc(phone)+"','"+esc(pname)+"','"+kind+"','"+sev+"','"+esc(combo)+"','open');";
  return [{ json: { sql, kind } }];
}
return [{ json: { sql: "SELECT 1 WHERE false;", kind: '' } }];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  // Parse: add is_complaint
  const parse = wf.nodes.find(n => n.name === "Parse AI Output");
  let pc = parse.parameters.jsCode;
  if (!pc.includes("is_complaint")) {
    pc = pc.replace(
      "const is_emergency = (parsed.is_emergency===true) || it.includes('emerg') || it.includes('urgent');",
      "const is_emergency = (parsed.is_emergency===true) || it.includes('emerg') || it.includes('urgent');\nconst is_complaint = (parsed.is_complaint===true) || it.includes('complaint') || it.includes('شكو');"
    );
    pc = pc.replace("requires_hitl: parsed.requires_hitl??false, is_emergency,", "requires_hitl: parsed.requires_hitl??false, is_emergency, is_complaint,");
    if (!pc.includes("is_complaint,")) throw new Error("Parse return anchor missing");
    parse.parameters.jsCode = pc;
    console.log("• Parse: is_complaint added");
  } else console.log("• Parse: already has is_complaint");

  // Prep Emergency: log complaints too
  wf.nodes.find(n => n.name === "Prep Emergency").parameters.jsCode = PREP_EMG;
  console.log("• Prep Emergency: complaint logging added");

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,400)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Complaint detection wired (empathetic reply + logged to sura_alerts kind=complaint)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
