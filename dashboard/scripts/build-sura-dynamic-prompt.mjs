// Multi-tenant: each clinic has ONE editable field `sura_system_message` (the full System Message).
// S4 loads it (+ services + working hours from tables); Build AI Context = that message
// + auto-appended live services/prices + current time + protected booking/output rules.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const MAIN = "arZRfHPPTytcMSR5";
const S4 = "MSsHC3t4qbzqWzlk";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];
const PG = { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" };

// ── (1) S4 loader: clinic + settings + services + the system message ────────────
const S4_SQL =
"SELECT c.name AS clinic_name, c.name_ar AS clinic_name_ar, c.phone AS clinic_phone, " +
"c.address AS clinic_address, c.timezone AS clinic_timezone, c.currency::text AS currency, " +
"COALESCE(s.is_in_maintenance,false) AS is_in_maintenance, s.maintenance_msg_ar, s.maintenance_msg_en, " +
"COALESCE(s.appointment_lock_minutes,15) AS appointment_lock_minutes, s.working_hours, " +
"s.sura_system_message, s.sura_personality_override AS sura_config, " +
"COALESCE((SELECT json_agg(json_build_object('id',sv.id::text,'name_ar',sv.name_ar,'price',sv.price,'dur',sv.duration_minutes) ORDER BY sv.price) " +
"FROM public.services sv WHERE sv.clinic_id=c.id AND sv.deleted_at IS NULL), '[]'::json) AS services " +
"FROM public.tawd_clinics c LEFT JOIN public.tawd_clinic_settings s ON s.clinic_id=c.id " +
"WHERE c.id='{{ $json.clinic_id }}'::uuid LIMIT 1;";

const S4_MERGE =
"const t = $('Trigger').first().json; const r = $json;\n" +
"return [{ json: { ...t,\n" +
"  clinic_name: r.clinic_name ?? null,\n" +
"  clinic_name_ar: r.clinic_name_ar ?? r.clinic_name ?? null,\n" +
"  clinic_phone: r.clinic_phone ?? null,\n" +
"  clinic_address: r.clinic_address ?? null,\n" +
"  clinic_timezone: r.clinic_timezone ?? 'Asia/Muscat',\n" +
"  currency: r.currency ?? 'OMR', language: 'ar',\n" +
"  is_in_maintenance: r.is_in_maintenance ?? false,\n" +
"  maintenance_msg_ar: r.maintenance_msg_ar ?? null, maintenance_msg_en: r.maintenance_msg_en ?? null,\n" +
"  appointment_lock_minutes: r.appointment_lock_minutes ?? 15,\n" +
"  working_hours: r.working_hours ?? null,\n" +
"  sura_system_message: r.sura_system_message ?? null,\n" +
"  sura_config: r.sura_config ?? {}, services: r.services ?? []\n" +
"} }];";

async function rebuildS4() {
  const wf = await fetch(`${B}/workflows/${S4}`, { headers: H }).then(r => r.json());
  const trigger = wf.nodes.find(n => n.type.includes("executeWorkflowTrigger"));
  const tx = trigger.position?.[0] ?? 0, ty = trigger.position?.[1] ?? 0;
  const load = { id:"pg-load-ctx", name:"Load Context", type:"n8n-nodes-base.postgres", typeVersion:2,
    position:[tx+260,ty], parameters:{ operation:"executeQuery", query:"="+S4_SQL, options:{} }, credentials:{ postgres:PG } };
  const merge = { id:"merge-ctx", name:"Merge Context", type:"n8n-nodes-base.code", typeVersion:2,
    position:[tx+520,ty], parameters:{ jsCode:S4_MERGE } };
  const nodes = [trigger, load, merge];
  const connections = { [trigger.name]:{ main:[[{node:"Load Context",type:"main",index:0}]] },
                        "Load Context":{ main:[[{node:"Merge Context",type:"main",index:0}]] } };
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k]!==undefined) settings[k]=wf.settings[k];
  const body = JSON.stringify({ name:wf.name, nodes, connections, settings });
  const wasActive = wf.active;
  if (wasActive) await fetch(`${B}/workflows/${S4}/deactivate`,{method:"POST",headers:H,body:"{}"});
  const put = await fetch(`${B}/workflows/${S4}`,{method:"PUT",headers:H,body});
  console.log("S4 PUT:", put.status); if (put.status>=300) console.log("  err:",(await put.text()).slice(0,400));
  if (wasActive) await fetch(`${B}/workflows/${S4}/activate`,{method:"POST",headers:H,body:"{}"});
}

// ── (2) Build AI Context = clinic System Message + auto live data + protected rules ──
const BUILD_CTX = String.raw`const ctx = $json;
const esc = s => String(s == null ? '' : s).replace(/{/g, '{{').replace(/}/g, '}}'); // protect LangChain templating from clinic free-text
const wh = ctx.working_hours || {};
const open = String(wh.open || '09:00'), close = String(wh.close || '18:00');
const closedWd = Array.isArray(wh.closed_weekdays) ? wh.closed_weekdays : [];
const tz = ctx.clinic_timezone || 'Asia/Muscat';

const now = new Date();
const nice = new Intl.DateTimeFormat('ar', { timeZone:tz, weekday:'long', day:'numeric', month:'long', hour:'numeric', minute:'2-digit', hour12:true }).format(now);
const todayISO = new Intl.DateTimeFormat('en-CA', { timeZone:tz, year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
const pp = new Intl.DateTimeFormat('en-US', { timeZone:tz, weekday:'short', hour:'2-digit', hour12:false }).formatToParts(now);
const dayShort = (pp.find(x=>x.type==='weekday')||{}).value;
const hour24 = parseInt((pp.find(x=>x.type==='hour')||{}).value || '0', 10);
const openH = parseInt(open.split(':')[0] || '9', 10), closeH = parseInt(close.split(':')[0] || '18', 10);
const isOpen = !closedWd.includes(dayShort) && hour24 >= openH && hour24 < closeH;
const status = 'الوقت الآن بالضبط: ' + nice + ' (توقيت ' + tz + '). تاريخ اليوم ISO: ' + todayISO + '. حالة العيادة الآن: ' + (isOpen ? 'مفتوحة' : 'مغلقة');

const cur = ctx.currency === 'OMR' ? 'ر.ع' : (ctx.currency || '');
const fmtPrice = v => { const n = Number(v); return (ctx.currency === 'OMR' && !isNaN(n)) ? n.toFixed(3) : esc(v); };
const svcLines = (ctx.services||[]).map(s => '• ' + esc(s.name_ar) + ' — ' + fmtPrice(s.price) + ' ' + cur).join('\n') || '(لا توجد خدمات مسجّلة)';

// ── THE single editable place: each clinic's full System Message ──
let body = esc((ctx.sura_system_message || '').trim());
if (!body) {
  const CLINIC = esc(ctx.clinic_name_ar || ctx.clinic_name || 'العيادة');
  body = 'أنتِ «سُرى»، موظفة الاستقبال الذكية في ' + CLINIC + ' عبر واتساب. كوني دافئة، مهذبة، مقتضبة، واحترافية، وساعدي المريض في الاستفسارات وحجز المواعيد. لا تكشفي أنكِ ذكاء اصطناعي.';
}

const sp =
'أنتِ محرّك يولّد ردود «سُرى». مخرجك دائماً كائن JSON واحد فقط بلا أي نص خارجه إطلاقاً — حتى عند الترحيب أو تأكيد الحجز. كلام سُرى للمريض يوضع داخل الحقل response_ar فقط، والبنية الكاملة موضّحة في نهاية التعليمات.\n\n' +
'===== شخصية سُرى وتعليماتها وبياناتها (مرجع لصياغة response_ar) =====\n' +
body + '\n\n' +
'[الخدمات والأسعار — تُحدّث تلقائياً من النظام]\n' + svcLines + '\n\n' +
'[الوقت — تلقائي، ممنوع الحجز في الماضي]\n' + status + '\n\n' +
'[حقل booking — إلزامي في كل رد]\nاملئي حقل booking دائماً بما جمعتِه: service_ar (اسم الخدمة بالعربي كما في قائمة الأسعار أعلاه)، date بصيغة YYYY-MM-DD، time بصيغة HH:MM (٢٤ ساعة)، patient_name. اتركي ما لم يُذكر بعد فارغاً "". احسبي التاريخ من تاريخ اليوم ISO أعلاه («بكرة»=+١، واسم اليوم=أقرب تاريخ قادم يحمله). اضبطي confirmed=true فقط في الرد الذي يوافق فيه المريض نهائياً وتكون الحقول الأربعة مكتملة والوقت ليس ماضياً؛ غير ذلك confirmed=false.\nمهم جداً: إذا سبق أن تأكّد حجز في هذه المحادثة، اتركي confirmed=false في كل الرسائل التالية (شكر، تحية، يعطيك العافية، استفسار) — لا تعيدي الحجز إطلاقاً ما لم يطلب المريض موعداً جديداً مختلفاً صراحةً.\n' +
'[⚠️ تنسيق الإخراج — إلزامي بلا أي استثناء]\n' +
'أخرجي كائن JSON واحد صالحاً فقط لا غير. ممنوع منعاً باتاً أي نص أو شرح أو إيموجي خارج الـ JSON، حتى عند الترحيب أو تأكيد الحجز. ضعي كلامك للمريض داخل الحقل response_ar فقط. أي رد ليس JSON يُعدّ خطأ.\n' +
'البنية المطلوبة بالضبط:\n' +
'{{"intent":"greeting|book_appointment|cancel_appointment|reschedule_appointment|check_status|inquiry_services|inquiry_pricing|inquiry_location|inquiry_hours|payment_inquiry|complaint|follow_up|emergency|off_topic|unclear","response_ar":"ردّك المقتضب بالعربية","confidence":0.0,"is_sensitive":false,"requires_hitl":false,"booking":{{"confirmed":false,"service_ar":"","date":"","time":"","patient_name":""}}}}';

return [{ json: {
  ...ctx, system_prompt: sp, user_message: ctx.message_text, session_id: ctx.session_id,
  clinic_id: ctx.clinic_id, phone: ctx.phone, patient_id: ctx.patient_id,
  clarification_count: ctx.clarification_count || 0, booking_in_progress: ctx.booking_in_progress || false,
  clinic_name: ctx.clinic_name_ar || ctx.clinic_name
}}];`;

async function rewriteBuildCtx() {
  const wf = await fetch(`${B}/workflows/${MAIN}`, { headers: H }).then(r => r.json());
  wf.nodes.find(n => n.name === "Build AI Context").parameters.jsCode = BUILD_CTX;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k]!==undefined) settings[k]=wf.settings[k];
  const body = JSON.stringify({ name:wf.name, nodes:wf.nodes, connections:wf.connections, settings });
  await fetch(`${B}/workflows/${MAIN}/deactivate`,{method:"POST",headers:H,body:"{}"});
  const put = await fetch(`${B}/workflows/${MAIN}`,{method:"PUT",headers:H,body});
  console.log("MAIN PUT:", put.status); if (put.status>=300) { console.log("  err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${MAIN}/activate`,{method:"POST",headers:H,body:"{}"});
}

(async () => {
  await rebuildS4();
  await rewriteBuildCtx();
  console.log("✓ Sura now reads ONE field per clinic: sura_system_message (+ auto services/time/booking)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
