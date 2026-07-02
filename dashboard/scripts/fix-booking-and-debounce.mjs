// (a) Prep Booking Params: resolve service dynamically from ctx.services (works for ANY clinic).
// (b) Format Booking Reply: friendlier conflict message (not an error-sounding one).
// (c) Debounce: 4s -> 3s.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];
const DOCTOR_ID = "e3e7fd39-158f-48a3-8ae4-ba56fa3a27f1";

const PREP = "const DOCTOR_ID = '" + DOCTOR_ID + "';\n" + String.raw`const c = $json;
const services = Array.isArray(c.services) ? c.services : [];
const want = String(c.b_service_ar || '').trim();
let svc = services.find(s => s.name_ar === want)
       || services.find(s => want && s.name_ar && (want.includes(s.name_ar) || s.name_ar.includes(want)))
       || null;

let t = String(c.b_time || '').trim();
let m = t.match(/^(\d{1,2})(?::(\d{2}))?$/);
let hh = m ? String(m[1]).padStart(2,'0') : '';
let mm = (m && m[2]) ? m[2] : '00';
const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(String(c.b_date||''));
const slot_time = (dateOk && hh) ? (c.b_date + 'T' + hh + ':' + mm + ':00+04:00') : '';
const future = slot_time ? (new Date(slot_time).getTime() > Date.now() - 3600000) : false;
const esc = s => String(s||'').replace(/'/g, "''");
const name = esc(c.b_patient_name);
const valid = !!(svc && svc.id && slot_time && future && c.clinic_id && c.patient_id);
let sql;
if (valid) {
  const dur = parseInt(svc.dur || 30, 10);
  sql =
    "WITH upd AS (UPDATE public.patients SET name='" + name + "', updated_at=now() " +
    "WHERE id='" + c.patient_id + "'::uuid AND '" + name + "'<>'' AND (name IS NULL OR btrim(name)='' OR name ILIKE '%واتساب%' OR name ILIKE '%whatsapp%' OR name ILIKE '%مريض%') RETURNING 1), " +
    "ins AS (INSERT INTO public.appointments (clinic_id,patient_id,doctor_id,service_id,slot_time,duration_minutes,status,type,notes) " +
    "SELECT '" + c.clinic_id + "'::uuid,'" + c.patient_id + "'::uuid,'" + DOCTOR_ID + "'::uuid,'" + svc.id + "'::uuid,'" + slot_time + "'::timestamptz," + dur + ",'scheduled','consultation','حجز عبر سُرى (واتساب)' " +
    "WHERE NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.clinic_id='" + c.clinic_id + "'::uuid AND a.doctor_id='" + DOCTOR_ID + "'::uuid AND a.deleted_at IS NULL AND a.status NOT IN ('cancelled','no_show') AND a.slot_time='" + slot_time + "'::timestamptz) " +
    "RETURNING id), " +
    "wl AS (UPDATE public.appointment_waitlist SET status='booked' WHERE patient_id='" + c.patient_id + "'::uuid AND clinic_id='" + c.clinic_id + "'::uuid AND status='offered' AND EXISTS(SELECT 1 FROM ins) RETURNING id), " +
    "rec AS (INSERT INTO public.automation_recovery_ledger (clinic_id,event_type,appt_id,patient_id,service_id,amount,source) SELECT '" + c.clinic_id + "'::uuid,'waitlist_fill',(SELECT id FROM ins),'" + c.patient_id + "'::uuid,'" + svc.id + "'::uuid," + (Number(svc.price)||0) + ",'sura' WHERE EXISTS(SELECT 1 FROM wl) AND EXISTS(SELECT 1 FROM ins) RETURNING id) " +
    "SELECT id::text AS appointment_id, 'confirmed' AS booking_status FROM ins " +
    "UNION ALL SELECT NULL, 'conflict' FROM (SELECT 1) x WHERE NOT EXISTS (SELECT 1 FROM ins);";
} else {
  sql = "SELECT NULL::text AS appointment_id, 'error' AS booking_status;";
}
return [{ json: {
  sql,
  service_id: svc ? svc.id : null, service_name_ar: svc ? svc.name_ar : (c.b_service_ar||''),
  price: svc ? svc.price : '', slot_time, patient_name: c.b_patient_name || '',
  clinic_id: c.clinic_id, patient_id: c.patient_id, doctor_id: DOCTOR_ID, _parent_ctx: c
}}];`;

const FORMAT = String.raw`const r = $json;
const prep = $('Prep Booking Params').first().json;
const ctx = prep._parent_ctx || {};
let msg;
if (r.booking_status === 'confirmed') {
  const cur = ctx.currency === 'OMR' ? 'ر.ع' : (ctx.currency || '');
  const d = new Date(prep.slot_time);
  const dateAr = new Intl.DateTimeFormat('ar', { timeZone:'Asia/Muscat', weekday:'long', day:'numeric', month:'long' }).format(d);
  const timeAr = new Intl.DateTimeFormat('ar', { timeZone:'Asia/Muscat', hour:'numeric', minute:'2-digit', hour12:true }).format(d);
  const price = Number(prep.price); const priceStr = isNaN(price) ? prep.price : price.toFixed(3);
  msg = 'تم تأكيد موعدك بنجاح ✅🌿\n\n' +
        '• الخدمة: ' + prep.service_name_ar + '\n' +
        '• اليوم: ' + dateAr + '\n' +
        '• الوقت: ' + timeAr + '\n' +
        '• الطبيب: د. محمد البادي\n' +
        '• الرسوم: ' + priceStr + ' ' + cur + '\n' +
        '• الدفع: عند الحضور في العيادة\n\n' +
        'نشوفك على خير! 🦷';
} else if (r.booking_status === 'conflict') {
  msg = 'موعدك محجوز ومثبّت بالفعل 🌿\nلو تبي تعدّله أو تحجز وقتاً ثانياً، خبّرني.';
} else {
  msg = 'تمام 🌿 ممكن تعطيني اليوم والوقت اللي يناسبك عشان أثبّت لك الموعد؟';
}
return [{ json: {
  ...ctx, sender: 'sura', message_text: msg,
  booking_status: r.booking_status, appointment_id: r.appointment_id || null
}}];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const g = n => wf.nodes.find(x => x.name === n);
  g("Prep Booking Params").parameters.jsCode = PREP;
  g("Format Booking Reply").parameters.jsCode = FORMAT;
  const wait = g("Debounce 4s");
  if (wait) { wait.parameters.amount = 3; }   // 4s -> 3s
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Dynamic service resolution + friendly conflict + 3s debounce");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
