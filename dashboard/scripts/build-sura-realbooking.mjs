// Real DB booking for Sura: structured booking output -> resolve service + slot_time ->
// conflict-aware INSERT into appointments (prevents double-book) -> real confirmation.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];
const DOCTOR_ID = "e63290e7-36a4-4fdc-be06-a4ebe8de3ada"; // demo doctor (د. محمد البادي)
const PG_CRED = { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" };

// ── 1) Build AI Context (v5 + booking schema + ISO date) ───────────────────────
const BUILD_CTX = String.raw`const ctx = $json;
const CLINIC = 'عيادة طود';
const now = new Date();
const nice = new Intl.DateTimeFormat('ar', { timeZone:'Asia/Muscat', weekday:'long', day:'numeric', month:'long', hour:'numeric', minute:'2-digit', hour12:true }).format(now);
const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Muscat', year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
const p = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Muscat', weekday:'short', hour:'2-digit', hour12:false }).formatToParts(now);
const dayShort = (p.find(x=>x.type==='weekday')||{}).value;
const hour24 = parseInt((p.find(x=>x.type==='hour')||{}).value || '0', 10);
const isOpen = dayShort !== 'Fri' && hour24 >= 9 && hour24 < 18;
const status = 'الوقت الآن: ' + nice + ' (بتوقيت عُمان). تاريخ اليوم (ISO): ' + todayISO + '. حالة العيادة الآن: ' + (isOpen ? 'مفتوحة' : 'مغلقة');

const sp =
'أنتِ "سُرى" 🌿، موظفة استقبال ذكية في ' + CLINIC + '. شخصيتك دافئة وطبيعية وفطنة، تبنين علاقة حقيقية مع المريض، لهجتك خليجية بسيطة ومريحة، مختصرة وواضحة، بإيموجي خفيف عند الحاجة. اسم عيادتك بالعربي دائماً: ' + CLINIC + ' (لا تستخدمي الاسم الإنجليزي أبداً).\n\n' +
'[قواعد المحادثة — مهمة]\n' +
'• رحّبي مرة واحدة فقط في أول رسالة من المحادثة. إذا سبق وتحدثتِ مع المريض في هذه المحادثة (يوجد سياق سابق)، لا تعيدي الترحيب إطلاقاً — أجيبي مباشرة وبنّي على ما قيل.\n' +
'• لا تكرري نفس الجُمل (مثل "كيف أقدر أساعدك") في كل رد — كل رد جديد ومناسب للسياق.\n' +
'• فكّري وكوّني ردّك بنفسك من فهمك — لا قوالب جاهزة.\n' +
'• افهمي القصد حتى لو الرسالة ناقصة أو فيها أخطاء، وكوني استباقية.\n' +
'• تذكّري كامل المحادثة وابني عليها، ولا تكرري سؤالاً تمت إجابته.\n' +
'• إذا غيّر المريض معلومة أثناء المحادثة (اسم أو خدمة أو يوم أو وقت)، اعتمدي دائماً آخر قيمة أعطاكِ إياها وتجاهلي القديمة.\n' +
'• لا تفترضي اسم المريض؛ اسأليه عنه عند الحجز فقط.\n' +
'• لا تخترعي معلومات غير الموجودة أدناه؛ إن لم تعرفي وجّهيه للعيادة. ولا تكشفي أنكِ ذكاء اصطناعي.\n\n' +
'[الوقت]\n' + status + '\nاستخدميه لتجاوبي بدقة عن الدوام أو هل العيادة مفتوحة الآن (الجمعة مغلق، وبقية الأيام ٩ص–٦م).\n\n' +
'[معرفتك عن ' + CLINIC + ']\n• الموقع: مسقط، سلطنة عُمان.\n• الدوام: السبت–الخميس ٩ص–٦م، الجمعة مغلق.\n• الطبيب: د. محمد البادي (طب عام).\n\n' +
'[الخدمات والأسعار]\n• استشارة عامة — 15.000 ر.ع (٣٠ د)\n• زيارة متابعة — 10.000 ر.ع (١٥ د)\n• استشارة أخصائي — 30.000 ر.ع (٣٠ د)\n• فحص مخبري — 20.000 ر.ع (١٥ د)\n• أشعة — 25.000 ر.ع (٢٠ د)\n• إجراء بسيط — 45.000 ر.ع (٤٥ د)\n\n' +
'[الحجز]\nاجمعي عبر الحوار (سؤال واحد كل مرة): الخدمة، اليوم (ضمن الدوام)، الوقت (ضمن الساعات)، واسم المريض. لا تؤكدي قبل اكتمال كل التفاصيل؛ بعدها لخّصي واطلبي تأكيداً نهائياً.\nمهم: إذا سبق وأكّدتِ للمريض حجزاً في هذه المحادثة بنفس الخدمة والوقت، لا تنشئي حجزاً جديداً مكرراً — ذكّريه بلطف أنه محجوز بالفعل، واعرضي تعديله أو اقتراح وقت بديل.\n\n' +
'[تأكيد الحجز — مهم جداً]\nفي حقل booking: اتركي confirmed=false في كل الرسائل، ولا تجعليه true إلا في اللحظة التي يؤكّد فيها المريض الحجز نهائياً بعد اكتمال (الخدمة + اليوم + الوقت + الاسم). عند التأكيد النهائي فقط: confirmed=true، و service_ar باسم الخدمة بالعربي تماماً كما في القائمة أعلاه، و date بصيغة YYYY-MM-DD، و time بصيغة HH:MM (٢٤ ساعة)، و patient_name باسم المريض. احسبي التاريخ اعتماداً على تاريخ اليوم ISO أعلاه: «اليوم»=نفس التاريخ، «بكرة»=اليوم+١، واسم اليوم (مثل الأحد) = أقرب تاريخ قادم يحمل ذلك الاسم. لا تختاري الجمعة (مغلق) ولا وقتاً خارج ٩ص–٦م.\n\n' +
'[طلبات أخرى]\nإلغاء/تعديل: اجمعي التفاصيل وطمئنيه أن الاستقبال سيساعده. الطوارئ/الألم الشديد: intent=emergency و requires_hitl=true ووجّهيه يتصل بالعيادة أو الطوارئ فوراً.\n\n' +
'[صيغة الإخراج — JSON فقط بدون أي نص خارجه]\n' +
'{{"intent":"greeting|book_appointment|cancel_appointment|reschedule_appointment|check_status|inquiry_services|inquiry_pricing|inquiry_location|inquiry_hours|payment_inquiry|complaint|follow_up|emergency|off_topic|unclear","response_ar":"ردّك الطبيعي بالعربية","confidence":0.0,"is_sensitive":false,"requires_hitl":false,"booking":{{"confirmed":false,"service_ar":"","date":"","time":"","patient_name":""}}}}\n\n' +
'[الثقة]\n- تقدرين تتعاملين مع الطلب: 0.8–1.\n- تحتاجين توضيحاً بسيطاً: 0.7.\n- حساس طبي/طوارئ: is_sensitive=true و requires_hitl=true.';

return [{ json: {
  ...ctx, system_prompt: sp, user_message: ctx.message_text, session_id: ctx.session_id,
  clinic_id: ctx.clinic_id, phone: ctx.phone, patient_id: ctx.patient_id,
  clarification_count: ctx.clarification_count || 0, booking_in_progress: ctx.booking_in_progress || false,
  clinic_name: CLINIC
}}];`;

// ── 2) Parse AI Output (+ booking extraction) ──────────────────────────────────
const PARSE = String.raw`const rawOutput = $json.output || $json.text || '';
const ctx = $('Build AI Context').first().json;
let parsed;
try {
  const cleaned = String(rawOutput).replace(/` + "```json" + String.raw`\n?/gi, '').replace(/` + "```" + String.raw`\n?/g, '').trim();
  parsed = JSON.parse(cleaned);
  if (!parsed || typeof parsed !== 'object' || !parsed.response_ar) throw new Error('no response_ar');
} catch (e) {
  const txt = String(rawOutput).trim();
  parsed = { intent:'inquiry', response_ar: txt || 'كيف أقدر أساعدك؟', confidence: txt.length>0?0.8:0.0, is_sensitive:false, requires_hitl:false };
}
const bk = (parsed.booking && typeof parsed.booking === 'object') ? parsed.booking : {};
return [{ json: {
  ...ctx,
  intent: parsed.intent || 'unclear',
  response_ar: parsed.response_ar || '',
  confidence: parsed.confidence ?? 0.0,
  is_sensitive: parsed.is_sensitive ?? false,
  requires_hitl: parsed.requires_hitl ?? false,
  booking_confirmed: bk.confirmed === true,
  b_service_ar: bk.service_ar || '',
  b_date: bk.date || '',
  b_time: bk.time || '',
  b_patient_name: bk.patient_name || '',
  raw_ai_output: rawOutput,
}}];`;

// ── 4) Prep Booking Params: resolve service + slot_time + build conflict-aware SQL ─
const PREP = "const DOCTOR_ID = '" + DOCTOR_ID + "';\n" + String.raw`const c = $json;
const SERVICES = [
  { kw:['متابعة'],            id:'a1000000-0000-0000-0000-000000000002', ar:'زيارة متابعة',     price:'10.000', dur:15 },
  { kw:['أخصائي','اخصائي'],   id:'a1000000-0000-0000-0000-000000000003', ar:'استشارة أخصائي',   price:'30.000', dur:30 },
  { kw:['مخبري','فحص','تحليل'],id:'a1000000-0000-0000-0000-000000000004', ar:'فحص مخبري',        price:'20.000', dur:15 },
  { kw:['أشعة','اشعة'],       id:'a1000000-0000-0000-0000-000000000005', ar:'أشعة',             price:'25.000', dur:20 },
  { kw:['إجراء','اجراء'],     id:'a1000000-0000-0000-0000-000000000006', ar:'إجراء بسيط',       price:'45.000', dur:45 },
  { kw:['عام','استشارة','عادي'],id:'a1000000-0000-0000-0000-000000000001', ar:'استشارة عامة',    price:'15.000', dur:30 },
];
const sv = String(c.b_service_ar || '');
let svc = SERVICES.find(s => s.kw.some(k => sv.includes(k))) || SERVICES[SERVICES.length-1];

// normalize time
let t = String(c.b_time || '').trim();
let m = t.match(/^(\d{1,2})(?::(\d{2}))?$/);
let hh = m ? String(m[1]).padStart(2,'0') : '';
let mm = (m && m[2]) ? m[2] : '00';
const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(String(c.b_date||''));
const slot_time = (dateOk && hh) ? (c.b_date + 'T' + hh + ':' + mm + ':00+04:00') : '';
const future = slot_time ? (new Date(slot_time).getTime() > Date.now() - 3600000) : false;

const esc = s => String(s||'').replace(/'/g, "''");
const name = esc(c.b_patient_name);

let sql, valid = !!(slot_time && future && c.clinic_id && c.patient_id);
if (valid) {
  sql =
    "WITH upd AS (UPDATE public.patients SET name='" + name + "', updated_at=now() " +
    "WHERE id='" + c.patient_id + "'::uuid AND '" + name + "'<>'' AND (name IS NULL OR btrim(name)='' OR name ILIKE '%واتساب%' OR name ILIKE '%whatsapp%' OR name ILIKE '%مريض%') RETURNING 1), " +
    "ins AS (INSERT INTO public.appointments (clinic_id,patient_id,doctor_id,service_id,slot_time,duration_minutes,status,type,notes) " +
    "SELECT '" + c.clinic_id + "'::uuid,'" + c.patient_id + "'::uuid,'" + DOCTOR_ID + "'::uuid,'" + svc.id + "'::uuid,'" + slot_time + "'::timestamptz," + svc.dur + ",'scheduled','consultation','حجز عبر سُرى (واتساب)' " +
    "WHERE NOT EXISTS (SELECT 1 FROM public.appointments a WHERE a.clinic_id='" + c.clinic_id + "'::uuid AND a.doctor_id='" + DOCTOR_ID + "'::uuid AND a.deleted_at IS NULL AND a.status NOT IN ('cancelled','no_show') AND a.slot_time='" + slot_time + "'::timestamptz) " +
    "RETURNING id, slot_time) " +
    "SELECT id::text AS appointment_id, slot_time::text AS slot_time_out, 'confirmed' AS booking_status FROM ins " +
    "UNION ALL SELECT NULL, '" + slot_time + "', 'conflict' FROM (SELECT 1) x WHERE NOT EXISTS (SELECT 1 FROM ins);";
} else {
  sql = "SELECT NULL::text AS appointment_id, NULL::text AS slot_time_out, 'error' AS booking_status;";
}
return [{ json: {
  sql,
  service_id: svc.id, service_name_ar: svc.ar, price: svc.price, duration_minutes: svc.dur,
  slot_time, patient_name: c.b_patient_name || '',
  clinic_id: c.clinic_id, patient_id: c.patient_id, doctor_id: DOCTOR_ID,
  _parent_ctx: c
}}];`;

// ── 6) Format Booking Reply (real confirmation / conflict / error) ─────────────
const FORMAT = String.raw`const r = $json;
const prep = $('Prep Booking Params').first().json;
const ctx = prep._parent_ctx || {};
let msg;
if (r.booking_status === 'confirmed') {
  const d = new Date(r.slot_time_out || prep.slot_time);
  const dateAr = new Intl.DateTimeFormat('ar', { timeZone:'Asia/Muscat', weekday:'long', day:'numeric', month:'long' }).format(d);
  const timeAr = new Intl.DateTimeFormat('ar', { timeZone:'Asia/Muscat', hour:'numeric', minute:'2-digit', hour12:true }).format(d);
  msg = 'تم تأكيد موعدك بنجاح في عيادة طود ✅🌿\n\n' +
        '• الخدمة: ' + prep.service_name_ar + '\n' +
        '• اليوم: ' + dateAr + '\n' +
        '• الوقت: ' + timeAr + '\n' +
        '• الطبيب: د. محمد البادي\n' +
        '• الرسوم: ' + prep.price + ' ر.ع\n\n' +
        'نشوفك على خير! لو حبيت تعدّل أو تلغي خبريني 🌿';
} else if (r.booking_status === 'conflict') {
  msg = 'يا هلا 🌿 هذا الوقت محجوز بالفعل عندنا. تحب أقترح لك وقتاً ثانياً قريباً منه؟';
} else {
  msg = 'عذراً، ما قدرت أكمّل الحجز الآن. ممكن تعطيني اليوم والوقت من جديد؟ 🌿';
}
return [{ json: {
  ...ctx, sender: 'sura', message_text: msg,
  booking_status: r.booking_status, appointment_id: r.appointment_id || null
}}];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const g = n => wf.nodes.find(x => x.name === n);

  g("Build AI Context").parameters.jsCode = BUILD_CTX;
  g("Parse AI Output").parameters.jsCode = PARSE;
  g("Prep Booking Params").parameters.jsCode = PREP;
  g("Format Booking Reply").parameters.jsCode = FORMAT;

  // Is Booking? -> boolean gate on booking_confirmed
  g("Is Booking?").parameters = {
    conditions: { options:{ caseSensitive:true, typeValidation:"loose", version:1 },
      conditions:[{ id:"is-booking", leftValue:"={{ $json.booking_confirmed }}", rightValue:"",
        operator:{ type:"boolean", operation:"true", singleValue:true } }], combinator:"and" },
    options:{}
  };

  // Replace "Call WF-06 Booking" (executeWorkflow) with a Postgres direct insert (keep name+wiring)
  const wf06 = g("Call WF-06 Booking");
  wf06.type = "n8n-nodes-base.postgres";
  wf06.typeVersion = 2;
  wf06.parameters = { operation: "executeQuery", query: "={{ $json.sql }}", options: {} };
  wf06.credentials = { postgres: PG_CRED };

  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) { console.log("err:", (await put.text()).slice(0,600)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Real booking wired (structured output -> conflict-checked insert -> confirmation)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
