// MULTI-DOCTOR: remove hardcoded DOCTOR_ID. Sura now assigns a doctor per booking:
//  - honour an explicitly requested doctor (booking.doctor -> b_doctor, matched by name ILIKE)
//  - else auto-assign the first FREE doctor (by name) who offers the service (via doctor_services)
// Availability is per-doctor. Reschedule keeps the SAME doctor as the existing appointment.
// Cancel is doctor-agnostic. Waitlist becomes doctor-agnostic (any doctor for the service).
// Build AI Context gets a doctor roster (names + services) + a booking.doctor field.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

// ── Parse AI Output: + b_doctor ──
const PARSE = String.raw`const out = $json.output;
const ctx = $('Build AI Context').first().json;
function escInStr(s){ let o='',q=false,e=false; for(let i=0;i<s.length;i++){const ch=s[i]; if(e){o+=ch;e=false;continue;} if(ch==='\\'){o+=ch;e=true;continue;} if(ch==='"'){q=!q;o+=ch;continue;} if(q&&ch==='\n'){o+='\\n';continue;} if(q&&ch==='\r'){o+='\\r';continue;} if(q&&ch==='\t'){o+='\\t';continue;} o+=ch; } return o; }
function toObj(x){ if(x&&typeof x==='object')return x; let s=String(x==null?'':x).trim(); const a=s.indexOf('{'),b=s.lastIndexOf('}'); if(a>=0&&b>a)s=s.slice(a,b+1); try{return JSON.parse(s);}catch(e){} try{return JSON.parse(escInStr(s));}catch(e){} const m=s.match(/"response_ar"\s*:\s*"([\s\S]*?)"\s*[,}]/); return {intent:'inquiry',response_ar:m?m[1].replace(/\\n/g,'\n'):s,confidence:0.7,booking:{}}; }
const parsed = toObj(out) || {};
const bk = (parsed.booking && typeof parsed.booking==='object') ? parsed.booking : {};
const it = String(parsed.intent||'').toLowerCase();
let act = String(bk.action||'').toLowerCase();
if (!['book','cancel','reschedule','waitlist'].includes(act)) act = '';
if (!act) act = it.includes('reschedul') ? 'reschedule' : (it.includes('cancel') ? 'cancel' : ((it.includes('wait')) ? 'waitlist' : 'book'));
if (act === 'book' && it.includes('reschedul')) act = 'reschedule';
if (act === 'book' && it.includes('cancel')) act = 'cancel';
if (act === 'book' && it.includes('wait')) act = 'waitlist';
const is_emergency = (parsed.is_emergency===true) || it.includes('emerg') || it.includes('urgent');
return [{ json: { ...ctx,
  intent: parsed.intent||'unclear', response_ar: parsed.response_ar||'', confidence: parsed.confidence??0.0,
  is_sensitive: parsed.is_sensitive??false, requires_hitl: parsed.requires_hitl??false, is_emergency,
  booking_confirmed: bk.confirmed===true, b_action: act,
  b_service_ar: bk.service_ar||'', b_date: bk.date||'', b_time: bk.time||'', b_patient_name: bk.patient_name||'', b_doctor: bk.doctor||'',
  raw_ai_output: (typeof out==='string'?out:JSON.stringify(out)) } }];`;

// ── Prep Booking Params: multi-doctor ──
const PREP = String.raw`const c = $json;
const action = c.b_action || 'book';
const esc = s => String(s||'').replace(/'/g, "''");
const CID = c.clinic_id, PID = c.patient_id;
const reqDoctor = esc(String(c.b_doctor||'').trim());
const services = Array.isArray(c.services)?c.services:[];
const want = String(c.b_service_ar||'').trim();
let svc = services.find(s=>s.name_ar===want) || services.find(s=>want&&s.name_ar&&(want.includes(s.name_ar)||s.name_ar.includes(want))) || null;
let t = String(c.b_time||'').trim(); let m = t.match(/^(\d{1,2})(?::(\d{2}))?$/);
let hh = m?String(m[1]).padStart(2,'0'):''; let mm=(m&&m[2])?m[2]:'00';
const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(String(c.b_date||''));
const slot_time = (dateOk&&hh)?(c.b_date+'T'+hh+':'+mm+':00+04:00'):'';
const future = slot_time?(new Date(slot_time).getTime()>Date.now()-3600000):false;
const name = esc(c.b_patient_name);
const dur = svc?parseInt(svc.dur||30,10):30;
const wh = c.working_hours||{};
const openH = parseInt(String(wh.open||'09:00').split(':')[0],10)||9;
const closeH = parseInt(String(wh.close||'18:00').split(':')[0],10)||18;
const pad = x=>String(x).padStart(2,'0');
const openTs=dateOk?(c.b_date+'T'+pad(openH)+':00:00+04:00'):''; const closeTs=dateOk?(c.b_date+'T'+pad(closeH)+':00:00+04:00'):'';
const dayStart=dateOk?(c.b_date+'T00:00:00+04:00'):''; const dayEnd=dateOk?(c.b_date+'T23:59:59+04:00'):'';
const IV = dur + " || ' minutes'";
const NIL='00000000-0000-0000-0000-000000000000';
let sql;
if (action==='cancel' && CID && PID) {
  sql = "WITH tgt AS (SELECT id, slot_time FROM public.appointments WHERE clinic_id='"+CID+"'::uuid AND patient_id='"+PID+"'::uuid AND deleted_at IS NULL AND status IN ('scheduled','confirmed','checked_in') AND slot_time > now() ORDER BY slot_time LIMIT 1), " +
        "upd AS (UPDATE public.appointments SET status='cancelled', cancelled_at=now(), cancellation_reason='إلغاء عبر سُرى (واتساب)' WHERE id=(SELECT id FROM tgt) RETURNING id, slot_time) " +
        "SELECT CASE WHEN EXISTS(SELECT 1 FROM upd) THEN 'cancelled' ELSE 'nothing_to_cancel' END AS booking_status, (SELECT id::text FROM upd) AS appointment_id, (SELECT slot_time::text FROM upd) AS slot_time_out, NULL::text AS alternatives, NULL::text AS doctor_name;";
} else if (action==='waitlist' && svc && svc.id && CID && PID) {
  const df = dateOk ? ("'"+c.b_date+"'::date") : "NULL::date";
  const pw = hh ? ("'[\""+hh+":"+mm+"\"]'::jsonb") : "'[]'::jsonb";
  const stout = dateOk ? ("'"+c.b_date+"T00:00:00+04:00'") : "NULL::text";
  sql = "WITH dup AS (SELECT id FROM public.appointment_waitlist WHERE clinic_id='"+CID+"'::uuid AND patient_id='"+PID+"'::uuid AND service_id='"+svc.id+"'::uuid AND status IN ('waiting','offered') LIMIT 1), " +
        "ins AS (INSERT INTO public.appointment_waitlist (clinic_id,patient_id,service_id,doctor_id,desired_from,desired_to,pref_windows,status) SELECT '"+CID+"'::uuid,'"+PID+"'::uuid,'"+svc.id+"'::uuid,NULL,"+df+","+df+","+pw+",'waiting' WHERE NOT EXISTS(SELECT 1 FROM dup) RETURNING id) " +
        "SELECT CASE WHEN EXISTS(SELECT 1 FROM ins) THEN 'waitlisted' WHEN EXISTS(SELECT 1 FROM dup) THEN 'already_waitlisted' ELSE 'error' END AS booking_status, (SELECT id::text FROM ins) AS appointment_id, "+stout+" AS slot_time_out, NULL::text AS alternatives, NULL::text AS doctor_name;";
} else if (action==='reschedule' && slot_time && future && dateOk && CID && PID) {
  const rSvcId = (svc && svc.id) ? svc.id : '';
  const rDur = svc ? dur : 0;
  const IVr = "((SELECT dur FROM newsvc)||' minutes')::interval";
  sql = "WITH tgt AS (SELECT id, slot_time, service_id, duration_minutes, doctor_id FROM public.appointments WHERE clinic_id='"+CID+"'::uuid AND patient_id='"+PID+"'::uuid AND deleted_at IS NULL AND status IN ('scheduled','confirmed','checked_in') AND slot_time > now() ORDER BY slot_time LIMIT 1), " +
        "newsvc AS (SELECT COALESCE(NULLIF('"+rSvcId+"','')::uuid,(SELECT service_id FROM tgt)) AS sid, COALESCE(NULLIF("+rDur+",0),(SELECT duration_minutes FROM tgt),30) AS dur), " +
        "ex AS (SELECT slot_time, duration_minutes FROM public.appointments WHERE doctor_id=(SELECT doctor_id FROM tgt) AND clinic_id='"+CID+"'::uuid AND deleted_at IS NULL AND status NOT IN ('cancelled','no_show') AND slot_time >= '"+dayStart+"'::timestamptz AND slot_time < '"+dayEnd+"'::timestamptz AND id <> COALESCE((SELECT id FROM tgt),'"+NIL+"'::uuid)), " +
        "reqchk AS (SELECT (EXISTS(SELECT 1 FROM tgt)) AND (NOT EXISTS (SELECT 1 FROM ex WHERE ex.slot_time < '"+slot_time+"'::timestamptz + "+IVr+" AND ex.slot_time + (ex.duration_minutes||' minutes')::interval > '"+slot_time+"'::timestamptz)) AS ok), " +
        "canc AS (UPDATE public.appointments SET status='cancelled', cancelled_at=now(), cancellation_reason='إعادة جدولة عبر سُرى (واتساب)' WHERE id=(SELECT id FROM tgt) AND (SELECT ok FROM reqchk) RETURNING id), " +
        "ins AS (INSERT INTO public.appointments (clinic_id,patient_id,doctor_id,service_id,slot_time,duration_minutes,status,type,notes) SELECT '"+CID+"'::uuid,'"+PID+"'::uuid,(SELECT doctor_id FROM tgt),(SELECT sid FROM newsvc),'"+slot_time+"'::timestamptz,(SELECT dur FROM newsvc),'scheduled','consultation','إعادة جدولة عبر سُرى (واتساب)' WHERE (SELECT ok FROM reqchk) AND EXISTS(SELECT 1 FROM canc) RETURNING id), " +
        "cand AS (SELECT gs FROM generate_series('"+openTs+"'::timestamptz, '"+closeTs+"'::timestamptz - "+IVr+", "+IVr+") gs WHERE gs > now() AND NOT EXISTS (SELECT 1 FROM ex WHERE ex.slot_time < gs + "+IVr+" AND ex.slot_time + (ex.duration_minutes||' minutes')::interval > gs) ORDER BY gs LIMIT 4) " +
        "SELECT CASE WHEN EXISTS(SELECT 1 FROM ins) THEN 'rescheduled' WHEN NOT EXISTS(SELECT 1 FROM tgt) THEN 'nothing_to_reschedule' ELSE 'unavailable' END AS booking_status, (SELECT id::text FROM ins) AS appointment_id, '"+slot_time+"' AS slot_time_out, (SELECT string_agg(to_char(gs AT TIME ZONE 'Asia/Muscat','HH24:MI'), ', ' ORDER BY gs) FROM cand) AS alternatives, (SELECT COALESCE(u.name_ar,u.name) FROM public.tawd_staff_users u WHERE u.id=(SELECT doctor_id FROM tgt)) AS doctor_name;";
} else if (svc && svc.id && slot_time && future && CID && PID && dateOk) {
  const drFilter = reqDoctor ? (" AND COALESCE(u.name_ar,u.name) ILIKE '%"+reqDoctor+"%'") : "";
  sql = "WITH mine AS (SELECT 1 FROM public.appointments WHERE patient_id='"+PID+"'::uuid AND clinic_id='"+CID+"'::uuid AND deleted_at IS NULL AND status NOT IN ('cancelled','no_show') AND slot_time='"+slot_time+"'::timestamptz LIMIT 1), " +
        "cand AS (SELECT u.id AS doctor_id, COALESCE(u.name_ar,u.name) AS dname FROM public.tawd_staff_users u JOIN public.doctor_services ds ON ds.doctor_id=u.id AND ds.service_id='"+svc.id+"'::uuid AND ds.is_active WHERE u.clinic_id='"+CID+"'::uuid AND u.role='doctor' AND u.is_active AND u.deleted_at IS NULL"+drFilter+"), " +
        "free AS (SELECT c2.doctor_id, c2.dname FROM cand c2 WHERE NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.doctor_id=c2.doctor_id AND a.clinic_id='"+CID+"'::uuid AND a.deleted_at IS NULL AND a.status NOT IN ('cancelled','no_show') AND a.slot_time < '"+slot_time+"'::timestamptz + ("+IV+")::interval AND a.slot_time + (a.duration_minutes||' minutes')::interval > '"+slot_time+"'::timestamptz) ORDER BY c2.dname LIMIT 1), " +
        "upd AS (UPDATE public.patients SET name='"+name+"', updated_at=now() WHERE id='"+PID+"'::uuid AND '"+name+"'<>'' AND (name IS NULL OR btrim(name)='' OR name ILIKE '%واتساب%' OR name ILIKE '%whatsapp%' OR name ILIKE '%مريض%') AND EXISTS(SELECT 1 FROM free) RETURNING 1), " +
        "ins AS (INSERT INTO public.appointments (clinic_id,patient_id,doctor_id,service_id,slot_time,duration_minutes,status,type,notes) SELECT '"+CID+"'::uuid,'"+PID+"'::uuid,(SELECT doctor_id FROM free),'"+svc.id+"'::uuid,'"+slot_time+"'::timestamptz,"+dur+",'scheduled','consultation','حجز عبر سُرى (واتساب)' WHERE EXISTS(SELECT 1 FROM free) AND NOT EXISTS(SELECT 1 FROM mine) RETURNING id), " +
        "wl AS (UPDATE public.appointment_waitlist SET status='booked' WHERE patient_id='"+PID+"'::uuid AND clinic_id='"+CID+"'::uuid AND status='offered' AND EXISTS(SELECT 1 FROM ins) RETURNING id), " +
        "rec AS (INSERT INTO public.automation_recovery_ledger (clinic_id,event_type,appt_id,patient_id,service_id,amount,source) SELECT '"+CID+"'::uuid,'waitlist_fill',(SELECT id FROM ins),'"+PID+"'::uuid,'"+svc.id+"'::uuid,"+(Number(svc.price)||0)+",'sura' WHERE EXISTS(SELECT 1 FROM wl) AND EXISTS(SELECT 1 FROM ins) RETURNING id), " +
        "altc AS (SELECT gs FROM generate_series('"+openTs+"'::timestamptz, '"+closeTs+"'::timestamptz - ("+IV+")::interval, ("+IV+")::interval) gs WHERE gs > now() AND EXISTS (SELECT 1 FROM cand c3 WHERE NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.doctor_id=c3.doctor_id AND a.clinic_id='"+CID+"'::uuid AND a.deleted_at IS NULL AND a.status NOT IN ('cancelled','no_show') AND a.slot_time < gs + ("+IV+")::interval AND a.slot_time + (a.duration_minutes||' minutes')::interval > gs)) ORDER BY gs LIMIT 4) " +
        "SELECT CASE WHEN EXISTS(SELECT 1 FROM mine) THEN 'already_booked' WHEN EXISTS(SELECT 1 FROM ins) THEN 'confirmed' WHEN NOT EXISTS(SELECT 1 FROM cand) THEN 'no_doctor' ELSE 'unavailable' END AS booking_status, (SELECT id::text FROM ins) AS appointment_id, '"+slot_time+"' AS slot_time_out, (SELECT string_agg(to_char(gs AT TIME ZONE 'Asia/Muscat','HH24:MI'), ', ' ORDER BY gs) FROM altc) AS alternatives, COALESCE((SELECT dname FROM free),(SELECT COALESCE(u.name_ar,u.name) FROM public.appointments a JOIN public.tawd_staff_users u ON u.id=a.doctor_id WHERE a.patient_id='"+PID+"'::uuid AND a.clinic_id='"+CID+"'::uuid AND a.deleted_at IS NULL AND a.status NOT IN ('cancelled','no_show') AND a.slot_time='"+slot_time+"'::timestamptz LIMIT 1)) AS doctor_name;";
} else {
  sql = "SELECT 'error' AS booking_status, NULL::text AS appointment_id, NULL::text AS slot_time_out, NULL::text AS alternatives, NULL::text AS doctor_name;";
}
return [{ json: { sql, action, service_name_ar: svc?svc.name_ar:(c.b_service_ar||''), price: svc?svc.price:'', slot_time, patient_name: c.b_patient_name||'', clinic_id: CID, patient_id: PID, _parent_ctx: c } }];`;

// ── Format Booking Reply: dynamic doctor name + no_doctor ──
const FORMAT = String.raw`const r = $json;
const prep = $('Prep Booking Params').first().json;
const ctx = prep._parent_ctx || {};
const cur = ctx.currency === 'OMR' ? 'ر.ع' : (ctx.currency || '');
const iso = r.slot_time_out || prep.slot_time;
const d = iso ? new Date(iso) : null;
const timeAr = d ? new Intl.DateTimeFormat('ar',{ timeZone:'Asia/Muscat', hour:'numeric', minute:'2-digit', hour12:true }).format(d) : '';
const dateAr = d ? new Intl.DateTimeFormat('ar',{ timeZone:'Asia/Muscat', weekday:'long', day:'numeric', month:'long' }).format(d) : '';
const dr = r.doctor_name || 'طبيب العيادة';
let msg;
if (r.booking_status === 'confirmed') {
  const price = Number(prep.price); const priceStr = isNaN(price) ? prep.price : price.toFixed(3);
  msg = 'تم تأكيد موعدك بنجاح ✅🌿\n\n• الخدمة: ' + prep.service_name_ar + '\n• اليوم: ' + dateAr + '\n• الوقت: ' + timeAr + '\n• الطبيب: ' + dr + '\n• الرسوم: ' + priceStr + ' ' + cur + '\n• الدفع: عند الحضور في العيادة\n\nنشوفك على خير! 🦷';
} else if (r.booking_status === 'rescheduled') {
  msg = 'تم تعديل موعدك بنجاح ✅🌿\n\n• الموعد الجديد: ' + dateAr + ' الساعة ' + timeAr + (prep.service_name_ar ? '\n• الخدمة: ' + prep.service_name_ar : '') + '\n• الطبيب: ' + dr + '\n• الدفع: عند الحضور في العيادة\n\nنشوفك على خير! 🦷';
} else if (r.booking_status === 'already_booked') {
  msg = 'أنت محجوز بالفعل في هذا الوقت ✅🌿' + (r.doctor_name ? (' مع ' + r.doctor_name) : '') + '. نشوفك على خير! 🦷';
} else if (r.booking_status === 'cancelled') {
  msg = 'تم إلغاء موعدك بنجاح ✅🌿\n(' + dateAr + ' الساعة ' + timeAr + ')\n\nتحب أحجز لك موعداً آخر؟';
} else if (r.booking_status === 'waitlisted') {
  msg = 'تمام ✅🌿 سجّلتك في قائمة الانتظار لخدمة ' + prep.service_name_ar + (dateAr ? (' (' + dateAr + ')') : '') + '.\nأول ما يتوفّر موعد بأرسل لك رسالة فوراً — ويكون لك الأولوية. 🌿';
} else if (r.booking_status === 'already_waitlisted') {
  msg = 'أنت مسجّل بالفعل في قائمة الانتظار 🌿 بنعلمك فوراً أول ما يفضى موعد مناسب.';
} else if (r.booking_status === 'nothing_to_cancel') {
  msg = 'ما لقيت لك موعد قادم لإلغائه 🌿. تحب أحجز لك موعداً جديداً؟';
} else if (r.booking_status === 'nothing_to_reschedule') {
  msg = 'ما لقيت لك موعد قادم لتعديله 🌿. تحب أحجز لك موعداً جديداً؟';
} else if (r.booking_status === 'no_doctor') {
  msg = ctx.b_doctor ? ('للأسف الطبيب المطلوب غير متاح لهذي الخدمة 🌿 تحب أرشّح لك طبيباً آخر متاحاً؟') : ('للأسف ما فيه طبيب يقدّم هذي الخدمة حالياً 🌿 تحب تختار خدمة ثانية؟');
} else if (r.booking_status === 'unavailable') {
  msg = 'للأسف ' + timeAr + ' محجوز ذاك اليوم 🌿' + (r.alternatives ? ('\nأقرب الأوقات المتاحة: ' + r.alternatives + '\nأي وقت يناسبك؟ أو أسجّلك في قائمة الانتظار وأعلمك أول ما يفضى موعد؟') : '\nتحب أسجّلك في قائمة الانتظار وأعلمك أول ما يفضى موعد؟');
} else {
  msg = 'تمام 🌿 ممكن تعطيني التفاصيل المطلوبة عشان أكمّل؟';
}
return [{ json: { ...ctx, sender:'sura', message_text: msg, booking_status: r.booking_status, appointment_id: r.appointment_id || null } }];`;

// ── Load Patient History: append doctors_json roster column ──
const LPH_FIND = " FROM public.appointments a WHERE a.patient_id=";
const LPH_ADD = ", (SELECT json_agg(json_build_object('name_ar', COALESCE(u.name_ar,u.name), 'services', (SELECT json_agg(sv.name_ar) FROM public.doctor_services ds JOIN public.services sv ON sv.id=ds.service_id WHERE ds.doctor_id=u.id AND ds.is_active AND sv.deleted_at IS NULL))) FROM public.tawd_staff_users u WHERE u.clinic_id='{{ $json.clinic_id }}'::uuid AND u.role='doctor' AND u.is_active AND u.deleted_at IS NULL) AS doctors_json FROM public.appointments a WHERE a.patient_id=";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const g = n => wf.nodes.find(x => x.name === n);
  g("Parse AI Output").parameters.jsCode = PARSE;
  g("Prep Booking Params").parameters.jsCode = PREP;
  g("Format Booking Reply").parameters.jsCode = FORMAT;

  // Load Patient History: add doctors_json
  const lph = g("Load Patient History");
  if (lph.parameters.query.includes("doctors_json")) console.log("• LPH already has doctors_json");
  else { if (!lph.parameters.query.includes(LPH_FIND)) throw new Error("LPH anchor missing"); lph.parameters.query = lph.parameters.query.replace(LPH_FIND, LPH_ADD); }

  // Build AI Context: roster section + booking.doctor in schema + [حقل booking] mention
  const bc = g("Build AI Context");
  let code = bc.parameters.jsCode;
  if (!code.includes("doctorsSection")) {
    // (1) build roster after the histSection next-appointment line
    const anchor1 = "if (_next) histSection += '\\n لديه موعد قادم مؤكد: ' + _next + '. إن سأل «متى موعدي» أخبريه به، ولا تحجزي موعداً جديداً إلا إن طلب صراحةً.';";
    if (!code.includes(anchor1)) throw new Error("BC anchor1 missing");
    const rosterBuild = anchor1 + "\n" + String.raw`
let doctorsSection = '';
try {
  let docs = _hist.doctors_json;
  if (typeof docs === 'string') docs = JSON.parse(docs);
  if (Array.isArray(docs) && docs.length) {
    doctorsSection = '[أطباء العيادة والخدمات التي يقدّمها كل طبيب]\n' + docs.map(dd => '• ' + esc(dd.name_ar) + ': ' + (((dd.services)||[]).filter(Boolean).map(x=>esc(x)).join('، ') || 'خدمات عامة')).join('\n') +
      '\nإذا طلب المريض طبيباً بعينه اضبطي booking.doctor باسمه؛ وإلا اتركيه فارغاً وسيُسنَد تلقائياً أنسب طبيب متاح. لا تعِدي المريض بطبيب لا يقدّم الخدمة المطلوبة.';
  }
} catch(e) {}`;
    code = code.replace(anchor1, rosterBuild);

    // (2) inject roster into the prompt right after histSection
    const anchor2 = "'[الوقت — تلقائي، ممنوع الحجز في الماضي]\\n' + status + '\\n\\n' + histSection + '\\n\\n' +";
    if (!code.includes(anchor2)) throw new Error("BC anchor2 missing");
    code = code.replace(anchor2, anchor2 + "\n(doctorsSection ? doctorsSection + '\\n\\n' : '') +");

    // (3) add doctor to the booking schema example
    const anchor3 = '"patient_name":""}}}}';
    if (!code.includes(anchor3)) throw new Error("BC anchor3 missing");
    code = code.replace(anchor3, '"patient_name":"","doctor":""}}}}');

    // (4) mention doctor field in the booking instruction
    const anchor4 = "patient_name، و action بإحدى القيم فقط:";
    if (!code.includes(anchor4)) throw new Error("BC anchor4 missing");
    code = code.replace(anchor4, "patient_name، و doctor (اسم الطبيب فقط إن طلبه المريض صراحةً وإلا فارغ)، و action بإحدى القيم فقط:");

    try { new Function(code); } catch(e){ throw new Error("BC invalid JS: " + e.message); }
    bc.parameters.jsCode = code;
    console.log("• Build AI Context patched (roster + doctor field)");
  } else console.log("• Build AI Context already has doctorsSection");

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,600)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Multi-doctor wired (auto-assign first free; honour requested doctor; per-doctor availability)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
