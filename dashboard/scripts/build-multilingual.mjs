// Multilingual (English): (1) Parse detects reply language (lang='en'|'ar') from response script;
// (2) Format Booking Reply is bilingual (booking confirmations etc. in the patient's language);
// (3) Voice Reply uses an English voice (en-US-Chirp3-HD-Aoede) when the reply is English.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const FORMAT = String.raw`const r = $json;
const prep = $('Prep Booking Params').first().json;
const ctx = prep._parent_ctx || {};
const lang = ctx.lang === 'en' ? 'en' : 'ar';
const L = (a,e) => lang === 'en' ? e : a;
const cur = ctx.currency === 'OMR' ? L('ر.ع','OMR') : (ctx.currency || '');
const loc = lang === 'en' ? 'en-GB' : 'ar';
const iso = r.slot_time_out || prep.slot_time;
const d = iso ? new Date(iso) : null;
const timeS = d ? new Intl.DateTimeFormat(loc,{ timeZone:'Asia/Muscat', hour:'numeric', minute:'2-digit', hour12:true }).format(d) : '';
const dateS = d ? new Intl.DateTimeFormat(loc,{ timeZone:'Asia/Muscat', weekday:'long', day:'numeric', month:'long' }).format(d) : '';
const dr = r.doctor_name || L('طبيب العيادة','our doctor');
const svc = prep.service_name_ar || '';
const st = r.booking_status;
let msg;
if (st === 'confirmed') { const price = Number(prep.price); const ps = isNaN(price) ? prep.price : price.toFixed(3);
  msg = L('تم تأكيد موعدك بنجاح ✅🌿\n\n• الخدمة: '+svc+'\n• اليوم: '+dateS+'\n• الوقت: '+timeS+'\n• الطبيب: '+dr+'\n• الرسوم: '+ps+' '+cur+'\n• الدفع: عند الحضور في العيادة\n\nنشوفك على خير! 🦷',
          'Your appointment is confirmed ✅🌿\n\n• Service: '+svc+'\n• Day: '+dateS+'\n• Time: '+timeS+'\n• Doctor: '+dr+'\n• Fee: '+ps+' '+cur+'\n• Payment: at the clinic\n\nSee you soon! 🦷');
} else if (st === 'rescheduled') {
  msg = L('تم تعديل موعدك بنجاح ✅🌿\n\n• الموعد الجديد: '+dateS+' الساعة '+timeS+(svc?'\n• الخدمة: '+svc:'')+'\n• الطبيب: '+dr+'\n• الدفع: عند الحضور\n\nنشوفك على خير! 🦷',
          'Your appointment has been rescheduled ✅🌿\n\n• New time: '+dateS+' at '+timeS+(svc?'\n• Service: '+svc:'')+'\n• Doctor: '+dr+'\n• Payment: at the clinic\n\nSee you soon! 🦷');
} else if (st === 'cancelled') {
  msg = L('تم إلغاء موعدك بنجاح ✅🌿\n('+dateS+' الساعة '+timeS+')\n\nتحب أحجز لك موعداً آخر؟',
          'Your appointment has been cancelled ✅🌿\n('+dateS+' at '+timeS+')\n\nWould you like to book another one?');
} else if (st === 'already_booked') {
  msg = L('أنت محجوز بالفعل في هذا الوقت ✅🌿'+(r.doctor_name?(' مع '+r.doctor_name):'')+'. نشوفك على خير! 🦷',
          'You already have an appointment at this time ✅🌿'+(r.doctor_name?(' with '+r.doctor_name):'')+'. See you soon! 🦷');
} else if (st === 'attendance_confirmed') {
  msg = L('تمام، سجّلنا تأكيد حضورك ✅🌿'+(dateS?('\nموعدك: '+dateS+' الساعة '+timeS):'')+(r.doctor_name?('\nمع '+r.doctor_name):'')+'\nنشوفك على خير! 🦷',
          'Great — your attendance is confirmed ✅🌿'+(dateS?('\nYour appointment: '+dateS+' at '+timeS):'')+(r.doctor_name?('\nwith '+r.doctor_name):'')+'\nSee you soon! 🦷');
} else if (st === 'nothing_to_confirm') {
  msg = L('ما لقيت لك موعد قادم لتأكيده 🌿. تحب أحجز لك موعداً جديداً؟','I couldn’t find an upcoming appointment to confirm 🌿. Would you like to book one?');
} else if (st === 'waitlisted') {
  msg = L('تمام ✅🌿 سجّلتك في قائمة الانتظار لخدمة '+svc+(dateS?(' ('+dateS+')'):'')+'.\nأول ما يتوفّر موعد بأرسل لك فوراً — ولك الأولوية. 🌿',
          'Done ✅🌿 I’ve added you to the waitlist for '+svc+(dateS?(' ('+dateS+')'):'')+'.\nI’ll message you the moment a slot opens — you’ll have priority. 🌿');
} else if (st === 'already_waitlisted') {
  msg = L('أنت مسجّل بالفعل في قائمة الانتظار 🌿 بنعلمك فوراً أول ما يفضى موعد.','You’re already on the waitlist 🌿 We’ll notify you as soon as a slot opens.');
} else if (st === 'nothing_to_cancel') {
  msg = L('ما لقيت لك موعد قادم لإلغائه 🌿. تحب أحجز لك موعداً جديداً؟','I couldn’t find an upcoming appointment to cancel 🌿. Would you like to book one?');
} else if (st === 'nothing_to_reschedule') {
  msg = L('ما لقيت لك موعد قادم لتعديله 🌿. تحب أحجز لك موعداً جديداً؟','I couldn’t find an upcoming appointment to reschedule 🌿. Would you like to book one?');
} else if (st === 'no_doctor') {
  msg = ctx.b_doctor ? L('للأسف الطبيب المطلوب غير متاح لهذي الخدمة 🌿 تحب أرشّح لك طبيباً آخر؟','Unfortunately the requested doctor isn’t available for this service 🌿 May I suggest another doctor?')
                     : L('للأسف ما فيه طبيب يقدّم هذي الخدمة حالياً 🌿 تحب تختار خدمة ثانية؟','Unfortunately no doctor currently offers this service 🌿 Would you like to choose another service?');
} else if (st === 'unavailable') {
  msg = L('للأسف '+timeS+' محجوز ذاك اليوم 🌿'+(r.alternatives?('\nأقرب الأوقات المتاحة: '+r.alternatives+'\nأي وقت يناسبك؟ أو أسجّلك في قائمة الانتظار؟'):'\nتحب أسجّلك في قائمة الانتظار وأعلمك أول ما يفضى موعد؟'),
          'Unfortunately '+timeS+' is taken that day 🌿'+(r.alternatives?('\nNearest available times: '+r.alternatives+'\nWhich works for you? Or shall I add you to the waitlist?'):'\nShall I add you to the waitlist and notify you when a slot opens?'));
} else {
  msg = L('تمام 🌿 ممكن تعطيني التفاصيل المطلوبة عشان أكمّل؟','Sure 🌿 could you share the details so I can proceed?');
}
return [{ json: { ...ctx, sender:'sura', message_text: msg, booking_status: r.booking_status, appointment_id: r.appointment_id || null } }];`;

const PARSE_FIND = "return [{ json: { ...ctx,";
const PARSE_ADD = "function _sl(s){ s=String(s||''); const ar=(s.match(/[\\u0600-\\u06FF]/g)||[]).length, la=(s.match(/[A-Za-z]/g)||[]).length; return la>ar?'en':'ar'; }\nconst lang = _sl(parsed.response_ar || ctx.message_text);\nreturn [{ json: { ...ctx, lang,";

const V_FIND = "voice: { languageCode: 'ar-XA', name: 'ar-XA-Chirp3-HD-Aoede' }";
const V_REPL = "voice: { languageCode: (( (speak.match(/[A-Za-z]/g)||[]).length ) > ( (speak.match(/[\\u0600-\\u06FF]/g)||[]).length )) ? 'en-US' : 'ar-XA', name: (( (speak.match(/[A-Za-z]/g)||[]).length ) > ( (speak.match(/[\\u0600-\\u06FF]/g)||[]).length )) ? 'en-US-Chirp3-HD-Aoede' : 'ar-XA-Chirp3-HD-Aoede' }";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const g = n => wf.nodes.find(x => x.name === n);

  // Parse: add lang
  const parse = g("Parse AI Output");
  if (!parse.parameters.jsCode.includes("_sl(")) {
    if (!parse.parameters.jsCode.includes(PARSE_FIND)) throw new Error("Parse anchor missing");
    parse.parameters.jsCode = parse.parameters.jsCode.replace(PARSE_FIND, PARSE_ADD);
    try { new Function(parse.parameters.jsCode); } catch(e){ throw new Error("Parse invalid: "+e.message); }
    console.log("• Parse: lang detection added");
  } else console.log("• Parse: already has lang");

  // Format: bilingual rewrite
  g("Format Booking Reply").parameters.jsCode = FORMAT;
  try { new Function(FORMAT); } catch(e){ throw new Error("Format invalid: "+e.message); }
  console.log("• Format: bilingual");

  // Voice: language-aware voice
  const v = g("Voice Reply (TTS)");
  if (v.parameters.jsCode.includes(V_FIND)) {
    v.parameters.jsCode = v.parameters.jsCode.replace(V_FIND, V_REPL);
    try { new Function("return async function(){\n" + v.parameters.jsCode + "\n}"); } catch(e){ throw new Error("Voice invalid: "+e.message); }
    console.log("• Voice: en/ar voice switch");
  } else console.log("• Voice: anchor not found (already patched?)");

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,600)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Multilingual wired (Arabic + English: replies, booking messages, voice)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
