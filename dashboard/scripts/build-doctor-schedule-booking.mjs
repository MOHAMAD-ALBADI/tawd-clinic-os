// WF-05 booking now respects doctor_schedules + doctor leaves (clinic_holidays):
// - cand (bookable doctors): must fit an active weekly window for that Muscat
//   day-of-week AND not be on leave that date. SAFE FALLBACK: a doctor with NO
//   schedule rows stays available all day (backward compatible).
// - altc (suggested alternatives): same per-slot availability, so Sura never
//   suggests times the doctor doesn't work.
// - reschedule reqchk: the kept doctor must also be working at the new time.
// day_of_week enum labels are lowercase english == to_char(ts,'fmday').
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const HELPERS = `const NIL='00000000-0000-0000-0000-000000000000';
const MCT = "'"+slot_time+"'::timestamptz AT TIME ZONE 'Asia/Muscat'";
const schedOkU = " AND (NOT EXISTS (SELECT 1 FROM public.doctor_schedules ss WHERE ss.doctor_id=u.id AND ss.is_active) OR EXISTS (SELECT 1 FROM public.doctor_schedules ss WHERE ss.doctor_id=u.id AND ss.is_active AND ss.day_of_week::text=to_char("+MCT+",'fmday') AND ("+MCT+")::time >= ss.start_time AND (("+MCT+")::time + ("+IV+")::interval) <= ss.end_time))";
const leaveOkU = " AND NOT EXISTS (SELECT 1 FROM public.clinic_holidays hh WHERE hh.clinic_id='"+CID+"'::uuid AND hh.holiday_date=("+MCT+")::date AND (hh.applies_to_all_doctors OR hh.doctor_id=u.id))";
const gsAvail = " AND (NOT EXISTS (SELECT 1 FROM public.doctor_schedules ss WHERE ss.doctor_id=c3.doctor_id AND ss.is_active) OR EXISTS (SELECT 1 FROM public.doctor_schedules ss WHERE ss.doctor_id=c3.doctor_id AND ss.is_active AND ss.day_of_week::text=to_char(gs AT TIME ZONE 'Asia/Muscat','fmday') AND (gs AT TIME ZONE 'Asia/Muscat')::time >= ss.start_time AND ((gs AT TIME ZONE 'Asia/Muscat')::time + ("+IV+")::interval) <= ss.end_time)) AND NOT EXISTS (SELECT 1 FROM public.clinic_holidays hh WHERE hh.clinic_id='"+CID+"'::uuid AND hh.holiday_date=(gs AT TIME ZONE 'Asia/Muscat')::date AND (hh.applies_to_all_doctors OR hh.doctor_id=c3.doctor_id))";`;

// book branch: candidate doctors must be on shift + not on leave
const CAND_OLD = `AND u.deleted_at IS NULL"+drFilter+"), "`;
const CAND_NEW = `AND u.deleted_at IS NULL"+drFilter+schedOkU+leaveOkU+"), "`;

// book branch: alternatives respect availability per generated slot
const ALTC_OLD = `AND a.slot_time + (a.duration_minutes||' minutes')::interval > gs))`;
const ALTC_NEW = `AND a.slot_time + (a.duration_minutes||' minutes')::interval > gs)"+gsAvail+")`;

// reschedule: the kept doctor must be working at the new time and not on leave
const REQ_OLD = `AND ex.slot_time + (ex.duration_minutes||' minutes')::interval > '"+slot_time+"'::timestamptz)) AS ok), "`;
const REQ_NEW = `AND ex.slot_time + (ex.duration_minutes||' minutes')::interval > '"+slot_time+"'::timestamptz)) AND (NOT EXISTS (SELECT 1 FROM public.doctor_schedules ss WHERE ss.doctor_id=(SELECT doctor_id FROM tgt) AND ss.is_active) OR EXISTS (SELECT 1 FROM public.doctor_schedules ss, newsvc WHERE ss.doctor_id=(SELECT doctor_id FROM tgt) AND ss.is_active AND ss.day_of_week::text=to_char("+MCT+",'fmday') AND ("+MCT+")::time >= ss.start_time AND (("+MCT+")::time + (newsvc.dur||' minutes')::interval) <= ss.end_time)) AND NOT EXISTS (SELECT 1 FROM public.clinic_holidays hh WHERE hh.clinic_id='"+CID+"'::uuid AND hh.holiday_date=("+MCT+")::date AND (hh.applies_to_all_doctors OR hh.doctor_id=(SELECT doctor_id FROM tgt))) AS ok), "`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const node = wf.nodes.find(n => n.name === "Prep Booking Params");
  let js = node.parameters.jsCode;

  if (js.includes("doctor_schedules")) { console.log("already patched — aborting"); process.exit(0); }

  const anchors = [
    ["const NIL='00000000-0000-0000-0000-000000000000';", HELPERS],
    [CAND_OLD, CAND_NEW],
    [ALTC_OLD, ALTC_NEW],
    [REQ_OLD, REQ_NEW],
  ];
  for (const [oldS, newS] of anchors) {
    if (!js.includes(oldS)) { console.error("ANCHOR NOT FOUND:", oldS.slice(0, 80)); process.exit(1); }
    js = js.replace(oldS, newS);
  }
  node.parameters.jsCode = js;

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,400)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Sura booking now respects doctor schedules + leaves (no-schedule = always available)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
