// Add CANCEL action to Sura: booking.action='cancel' -> cancel the patient's next upcoming
// appointment (frees the slot -> WF-27 auto-offers it). Keeps availability-aware booking.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];
const DOCTOR_ID = "e3e7fd39-158f-48a3-8ae4-ba56fa3a27f1";

// Parse AI Output — bulletproof + extract booking.action
const PARSE = String.raw`const out = $json.output;
const ctx = $('Build AI Context').first().json;
function escInStr(s){ let o='',q=false,e=false; for(let i=0;i<s.length;i++){const ch=s[i]; if(e){o+=ch;e=false;continue;} if(ch==='\\'){o+=ch;e=true;continue;} if(ch==='"'){q=!q;o+=ch;continue;} if(q&&ch==='\n'){o+='\\n';continue;} if(q&&ch==='\r'){o+='\\r';continue;} if(q&&ch==='\t'){o+='\\t';continue;} o+=ch; } return o; }
function toObj(x){ if(x&&typeof x==='object')return x; let s=String(x==null?'':x).trim(); const a=s.indexOf('{'),b=s.lastIndexOf('}'); if(a>=0&&b>a)s=s.slice(a,b+1); try{return JSON.parse(s);}catch(e){} try{return JSON.parse(escInStr(s));}catch(e){} const m=s.match(/"response_ar"\s*:\s*"([\s\S]*?)"\s*[,}]/); return {intent:'inquiry',response_ar:m?m[1].replace(/\\n/g,'\n'):s,confidence:0.7,booking:{}}; }
const parsed = toObj(out) || {};
const bk = (parsed.booking && typeof parsed.booking==='object') ? parsed.booking : {};
return [{ json: { ...ctx,
  intent: parsed.intent||'unclear', response_ar: parsed.response_ar||'', confidence: parsed.confidence??0.0,
  is_sensitive: parsed.is_sensitive??false, requires_hitl: parsed.requires_hitl??false,
  booking_confirmed: bk.confirmed===true, b_action: bk.action || 'book',
  b_service_ar: bk.service_ar||'', b_date: bk.date||'', b_time: bk.time||'', b_patient_name: bk.patient_name||'',
  raw_ai_output: (typeof out==='string'?out:JSON.stringify(out)) } }];`;

// Prep Booking Params — branch on action (cancel | book)
const PREP = "const DOCTOR_ID='" + DOCTOR_ID + "';\n" + String.raw`const c = $json;
const action = c.b_action || 'book';
const esc = s => String(s||'').replace(/'/g, "''");
const CID = c.clinic_id, PID = c.patient_id;
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
let sql;
if (action==='cancel' && CID && PID) {
  sql = "WITH tgt AS (SELECT id, slot_time FROM public.appointments WHERE clinic_id='"+CID+"'::uuid AND patient_id='"+PID+"'::uuid AND deleted_at IS NULL AND status IN ('scheduled','confirmed','checked_in') AND slot_time > now() ORDER BY slot_time LIMIT 1), " +
        "upd AS (UPDATE public.appointments SET status='cancelled', cancelled_at=now(), cancellation_reason='إلغاء عبر سُرى (واتساب)' WHERE id=(SELECT id FROM tgt) RETURNING id, slot_time) " +
        "SELECT CASE WHEN EXISTS(SELECT 1 FROM upd) THEN 'cancelled' ELSE 'nothing_to_cancel' END AS booking_status, (SELECT id::text FROM upd) AS appointment_id, (SELECT slot_time::text FROM upd) AS slot_time_out, NULL::text AS alternatives;";
} else if (svc && svc.id && slot_time && future && CID && PID && dateOk) {
  sql = "WITH ex AS (SELECT slot_time, duration_minutes FROM public.appointments WHERE doctor_id='"+DOCTOR_ID+"'::uuid AND clinic_id='"+CID+"'::uuid AND deleted_at IS NULL AND status NOT IN ('cancelled','no_show') AND slot_time >= '"+dayStart+"'::timestamptz AND slot_time < '"+dayEnd+"'::timestamptz), " +
        "reqchk AS (SELECT NOT EXISTS (SELECT 1 FROM ex WHERE ex.slot_time < '"+slot_time+"'::timestamptz + ("+IV+")::interval AND ex.slot_time + (ex.duration_minutes||' minutes')::interval > '"+slot_time+"'::timestamptz) AS ok), " +
        "upd AS (UPDATE public.patients SET name='"+name+"', updated_at=now() WHERE id='"+PID+"'::uuid AND '"+name+"'<>'' AND (name IS NULL OR btrim(name)='' OR name ILIKE '%واتساب%' OR name ILIKE '%whatsapp%' OR name ILIKE '%مريض%') AND (SELECT ok FROM reqchk) RETURNING 1), " +
        "ins AS (INSERT INTO public.appointments (clinic_id,patient_id,doctor_id,service_id,slot_time,duration_minutes,status,type,notes) SELECT '"+CID+"'::uuid,'"+PID+"'::uuid,'"+DOCTOR_ID+"'::uuid,'"+svc.id+"'::uuid,'"+slot_time+"'::timestamptz,"+dur+",'scheduled','consultation','حجز عبر سُرى (واتساب)' WHERE (SELECT ok FROM reqchk) RETURNING id), " +
        "wl AS (UPDATE public.appointment_waitlist SET status='booked' WHERE patient_id='"+PID+"'::uuid AND clinic_id='"+CID+"'::uuid AND status='offered' AND EXISTS(SELECT 1 FROM ins) RETURNING id), " +
        "rec AS (INSERT INTO public.automation_recovery_ledger (clinic_id,event_type,appt_id,patient_id,service_id,amount,source) SELECT '"+CID+"'::uuid,'waitlist_fill',(SELECT id FROM ins),'"+PID+"'::uuid,'"+svc.id+"'::uuid,"+(Number(svc.price)||0)+",'sura' WHERE EXISTS(SELECT 1 FROM wl) AND EXISTS(SELECT 1 FROM ins) RETURNING id), " +
        "cand AS (SELECT gs FROM generate_series('"+openTs+"'::timestamptz, '"+closeTs+"'::timestamptz - ("+IV+")::interval, ("+IV+")::interval) gs WHERE gs > now() AND NOT EXISTS (SELECT 1 FROM ex WHERE ex.slot_time < gs + ("+IV+")::interval AND ex.slot_time + (ex.duration_minutes||' minutes')::interval > gs) ORDER BY gs LIMIT 4) " +
        "SELECT CASE WHEN EXISTS(SELECT 1 FROM ins) THEN 'confirmed' WHEN (SELECT ok FROM reqchk)=false THEN 'unavailable' ELSE 'error' END AS booking_status, (SELECT id::text FROM ins) AS appointment_id, '"+slot_time+"' AS slot_time_out, (SELECT string_agg(to_char(gs AT TIME ZONE 'Asia/Muscat','HH24:MI'), ', ' ORDER BY gs) FROM cand) AS alternatives;";
} else {
  sql = "SELECT 'error' AS booking_status, NULL::text AS appointment_id, NULL::text AS slot_time_out, NULL::text AS alternatives;";
}
return [{ json: { sql, action, service_name_ar: svc?svc.name_ar:(c.b_service_ar||''), price: svc?svc.price:'', slot_time, patient_name: c.b_patient_name||'', clinic_id: CID, patient_id: PID, doctor_id: DOCTOR_ID, _parent_ctx: c } }];`;

// Format Booking Reply — all statuses
const FORMAT = String.raw`const r = $json;
const prep = $('Prep Booking Params').first().json;
const ctx = prep._parent_ctx || {};
const cur = ctx.currency === 'OMR' ? 'ر.ع' : (ctx.currency || '');
const iso = r.slot_time_out || prep.slot_time;
const d = iso ? new Date(iso) : null;
const timeAr = d ? new Intl.DateTimeFormat('ar',{ timeZone:'Asia/Muscat', hour:'numeric', minute:'2-digit', hour12:true }).format(d) : '';
const dateAr = d ? new Intl.DateTimeFormat('ar',{ timeZone:'Asia/Muscat', weekday:'long', day:'numeric', month:'long' }).format(d) : '';
let msg;
if (r.booking_status === 'confirmed') {
  const price = Number(prep.price); const priceStr = isNaN(price) ? prep.price : price.toFixed(3);
  msg = 'تم تأكيد موعدك بنجاح ✅🌿\n\n• الخدمة: ' + prep.service_name_ar + '\n• اليوم: ' + dateAr + '\n• الوقت: ' + timeAr + '\n• الطبيب: د. محمد البادي\n• الرسوم: ' + priceStr + ' ' + cur + '\n• الدفع: عند الحضور في العيادة\n\nنشوفك على خير! 🦷';
} else if (r.booking_status === 'cancelled') {
  msg = 'تم إلغاء موعدك بنجاح ✅🌿\n(' + dateAr + ' الساعة ' + timeAr + ')\n\nتحب أحجز لك موعداً آخر؟';
} else if (r.booking_status === 'nothing_to_cancel') {
  msg = 'ما لقيت لك موعد قادم لإلغائه 🌿. تحب أحجز لك موعداً جديداً؟';
} else if (r.booking_status === 'unavailable') {
  msg = 'للأسف ' + timeAr + ' محجوز ذاك اليوم 🌿' + (r.alternatives ? ('\nأقرب الأوقات المتاحة: ' + r.alternatives + '\nأي وقت يناسبك؟') : '\nتحب أقترح لك وقتاً ثانياً؟');
} else {
  msg = 'تمام 🌿 ممكن تعطيني التفاصيل المطلوبة عشان أكمّل؟';
}
return [{ json: { ...ctx, sender:'sura', message_text: msg, booking_status: r.booking_status, appointment_id: r.appointment_id || null } }];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const g = n => wf.nodes.find(x => x.name === n);
  g("Parse AI Output").parameters.jsCode = PARSE;
  g("Prep Booking Params").parameters.jsCode = PREP;
  g("Format Booking Reply").parameters.jsCode = FORMAT;
  // add "action" to the structured output parser example so the model emits it
  const so = g("Structured Output");
  if (so && so.parameters.jsonSchemaExample) {
    try { const ex = JSON.parse(so.parameters.jsonSchemaExample); if (ex.booking) { ex.booking.action = "book"; so.parameters.jsonSchemaExample = JSON.stringify(ex, null, 2); } } catch(e){}
  }
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Cancel action wired (frees slot -> feeds waitlist)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
