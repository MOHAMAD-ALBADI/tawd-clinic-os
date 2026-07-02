// Attendance confirmation: patient replies "نعم بحضر" to a reminder -> action='confirm' sets their
// next upcoming 'scheduled' appointment to 'confirmed'. Targeted edits to Parse/Prep/Format/Build AI
// Context on WF-05 (all anchors verified against the current multi-doctor code).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const PREP_BRANCH = `} else if (action==='confirm' && CID && PID) {
  sql = "WITH tgt AS (SELECT id, slot_time, doctor_id, status FROM public.appointments WHERE clinic_id='"+CID+"'::uuid AND patient_id='"+PID+"'::uuid AND deleted_at IS NULL AND status IN ('scheduled','confirmed') AND slot_time > now() ORDER BY slot_time LIMIT 1), " +
        "upd AS (UPDATE public.appointments SET status='confirmed', updated_at=now() WHERE id=(SELECT id FROM tgt) AND (SELECT status FROM tgt)='scheduled' RETURNING id) " +
        "SELECT CASE WHEN EXISTS(SELECT 1 FROM tgt) THEN 'attendance_confirmed' ELSE 'nothing_to_confirm' END AS booking_status, (SELECT id::text FROM tgt) AS appointment_id, (SELECT slot_time::text FROM tgt) AS slot_time_out, NULL::text AS alternatives, (SELECT COALESCE(u.name_ar,u.name) FROM public.tawd_staff_users u WHERE u.id=(SELECT doctor_id FROM tgt)) AS doctor_name;";
} else if (action==='waitlist' && svc && svc.id && CID && PID) {`;

const FORMAT_BRANCH = `} else if (r.booking_status === 'attendance_confirmed') {
  msg = 'تمام، سجّلنا تأكيد حضورك ✅🌿' + (dateAr ? ('\\nموعدك: ' + dateAr + ' الساعة ' + timeAr) : '') + (r.doctor_name ? ('\\nمع ' + r.doctor_name) : '') + '\\nنشوفك على خير! 🦷';
} else if (r.booking_status === 'nothing_to_confirm') {
  msg = 'ما لقيت لك موعد قادم لتأكيده 🌿. تحب أحجز لك موعداً جديداً؟';
} else if (r.booking_status === 'nothing_to_cancel') {`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const g = n => wf.nodes.find(x => x.name === n);

  // Parse AI Output: add 'confirm' to valid actions + intent derivation
  const parse = g("Parse AI Output");
  let pc = parse.parameters.jsCode;
  if (!pc.includes("'confirm'")) {
    pc = pc.replace("if (!['book','cancel','reschedule','waitlist'].includes(act)) act = '';",
                    "if (!['book','cancel','reschedule','waitlist','confirm'].includes(act)) act = '';");
    pc = pc.replace("if (act === 'book' && it.includes('wait')) act = 'waitlist';",
                    "if (act === 'book' && it.includes('wait')) act = 'waitlist';\nif (act === 'book' && (it.includes('attend') || it.includes('confirm_attend'))) act = 'confirm';");
    parse.parameters.jsCode = pc;
    console.log("• Parse: confirm action added");
  } else console.log("• Parse: already has confirm");

  // Prep Booking Params: insert confirm branch before waitlist branch
  const prep = g("Prep Booking Params");
  if (!prep.parameters.jsCode.includes("attendance_confirmed")) {
    const anchor = "} else if (action==='waitlist' && svc && svc.id && CID && PID) {";
    if (!prep.parameters.jsCode.includes(anchor)) throw new Error("Prep waitlist anchor missing");
    prep.parameters.jsCode = prep.parameters.jsCode.replace(anchor, PREP_BRANCH);
    console.log("• Prep: confirm branch inserted");
  } else console.log("• Prep: already has confirm branch");

  // Format Booking Reply: insert attendance branches before nothing_to_cancel
  const fmt = g("Format Booking Reply");
  if (!fmt.parameters.jsCode.includes("attendance_confirmed")) {
    const anchor = "} else if (r.booking_status === 'nothing_to_cancel') {";
    if (!fmt.parameters.jsCode.includes(anchor)) throw new Error("Format nothing_to_cancel anchor missing");
    fmt.parameters.jsCode = fmt.parameters.jsCode.replace(anchor, FORMAT_BRANCH);
    console.log("• Format: attendance branches inserted");
  } else console.log("• Format: already has attendance branches");

  // Build AI Context: add 'confirm' to the action enum
  const bc = g("Build AI Context");
  const enumAnchor = "عند رغبته حين يكون الوقت المطلوب محجوزاً (الافتراضي";
  if (!bc.parameters.jsCode.includes('"confirm" لتأكيد')) {
    if (!bc.parameters.jsCode.includes(enumAnchor)) throw new Error("BC enum anchor missing");
    bc.parameters.jsCode = bc.parameters.jsCode.replace(enumAnchor, 'عند رغبته حين يكون الوقت المطلوب محجوزاً، أو "confirm" لتأكيد حضور المريض لموعده القائم رداً على تذكير (الافتراضي');
    try { new Function(bc.parameters.jsCode); } catch(e){ throw new Error("BC invalid JS: " + e.message); }
    console.log("• Build AI Context: confirm added to enum");
  } else console.log("• Build AI Context: already has confirm enum");

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,600)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Attendance confirmation wired (action='confirm' -> scheduled->confirmed)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
