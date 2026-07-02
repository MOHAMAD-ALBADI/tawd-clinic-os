// Make Recall + Winback outreach AI-personalized & persuasive: enrich the candidate queries with
// last_service / months-since / context / gemini_key, and have the Send node generate a tailored,
// professional Arabic marketing message per patient via Gemini (with a strong static fallback).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const RECALL_SQL =
"WITH cand AS (SELECT p.id AS patient_id, p.clinic_id, p.phone, p.name, " +
"  (SELECT max(a.slot_time) FROM public.appointments a WHERE a.patient_id=p.id AND a.status='completed') AS last_visit " +
"  FROM public.patients p WHERE p.deleted_at IS NULL AND p.phone IS NOT NULL AND btrim(p.phone) <> '' " +
"  AND (p.last_recalled_at IS NULL OR p.last_recalled_at < now() - interval '90 days') " +
"  AND NOT EXISTS (SELECT 1 FROM public.appointments up WHERE up.patient_id=p.id AND up.deleted_at IS NULL AND up.status IN ('scheduled','confirmed') AND up.slot_time > now())), " +
"due AS (SELECT * FROM cand WHERE last_visit IS NOT NULL AND last_visit < now() - interval '150 days' AND last_visit > now() - interval '400 days'), " +
"mark AS (UPDATE public.patients SET last_recalled_at=now() WHERE id IN (SELECT patient_id FROM due) RETURNING id) " +
"SELECT d.patient_id::text AS patient_id, d.clinic_id::text AS clinic_id, d.phone, d.name, " +
"  (SELECT s.name_ar FROM public.appointments a2 JOIN public.services s ON s.id=a2.service_id WHERE a2.patient_id=d.patient_id AND a2.status='completed' ORDER BY a2.slot_time DESC LIMIT 1) AS last_service, " +
"  floor(extract(epoch from (now()-d.last_visit))/2592000)::int AS months, 'recall' AS context, " +
"  cc.config->>'access_token' AS wa_token, cc.config->>'phone_number_id' AS phone_number_id, cc.config->>'gemini_key' AS gemini_key " +
"FROM due d JOIN public.channel_configs cc ON cc.clinic_id=d.clinic_id AND cc.channel='whatsapp' AND cc.is_active=true LIMIT 50;";

const WINBACK_SQL =
"WITH miss AS (SELECT a.patient_id, a.clinic_id, max(a.slot_time) AS missed_at FROM public.appointments a " +
"  WHERE a.deleted_at IS NULL AND a.status IN ('no_show','cancelled') AND a.slot_time > now() - interval '45 days' AND a.slot_time < now() " +
"  AND COALESCE(a.cancellation_reason,'') NOT ILIKE '%اختبار%' GROUP BY a.patient_id, a.clinic_id), " +
"cand AS (SELECT m.patient_id, m.clinic_id, p.phone, p.name, m.missed_at FROM miss m JOIN public.patients p ON p.id=m.patient_id " +
"  WHERE p.deleted_at IS NULL AND p.phone IS NOT NULL AND btrim(p.phone) <> '' " +
"  AND (p.last_winback_at IS NULL OR p.last_winback_at < now() - interval '45 days') " +
"  AND NOT EXISTS (SELECT 1 FROM public.appointments up WHERE up.patient_id=m.patient_id AND up.deleted_at IS NULL AND up.status IN ('scheduled','confirmed') AND up.slot_time > now()) " +
"  AND NOT EXISTS (SELECT 1 FROM public.appointments c WHERE c.patient_id=m.patient_id AND c.status='completed' AND c.slot_time > m.missed_at)), " +
"mark AS (UPDATE public.patients SET last_winback_at=now() WHERE id IN (SELECT patient_id FROM cand) RETURNING id) " +
"SELECT c.patient_id::text AS patient_id, c.clinic_id::text AS clinic_id, c.phone, c.name, " +
"  (SELECT s.name_ar FROM public.appointments a2 JOIN public.services s ON s.id=a2.service_id WHERE a2.patient_id=c.patient_id AND a2.slot_time=c.missed_at LIMIT 1) AS last_service, " +
"  floor(extract(epoch from (now()-c.missed_at))/2592000)::int AS months, 'winback' AS context, " +
"  cc.config->>'access_token' AS wa_token, cc.config->>'phone_number_id' AS phone_number_id, cc.config->>'gemini_key' AS gemini_key " +
"FROM cand c JOIN public.channel_configs cc ON cc.clinic_id=c.clinic_id AND cc.channel='whatsapp' AND cc.is_active=true LIMIT 50;";

const SEND_AI = String.raw`const rows = $input.all();
const out = [];
for (const it of rows) {
  const r = it.json || {};
  if (!r.phone || !r.wa_token || !r.phone_number_id) { out.push({ json:{ patient_id:r.patient_id, skipped:true } }); continue; }
  const name = (r.name && !/واتساب|whatsapp|مريض/i.test(r.name)) ? r.name : '';
  const isWin = r.context === 'winback';
  let msg = '';
  if (r.gemini_key) {
    try {
      const goal = isWin ? 'استرجاع مريض لم يُكمل موعده السابق ولم يعُد بعدها' : 'دعوة مريض للفحص والتنظيف الدوري بعد مرور فترة على آخر زيارة';
      const prompt = 'أنت كاتب تسويق طبي محترف لعيادة «طود للأسنان» في سلطنة عُمان. اكتب رسالة واتساب واحدة قصيرة (سطران إلى ثلاثة كحد أقصى) بالعربية الفصحى الراقية المطعّمة بلمسة خليجية دافئة، هدفها: ' + goal + '. اجعلها شخصية باستخدام اسم المريض، وألمِح بلطف للمدة منذ آخر زيارة وآخر خدمة إن توفّرت، وأبرز قيمة العناية الدورية بأسلوب يبني الثقة ولا يكون ملحّاً أو دعائياً مبالغاً، واختم بدعوة واضحة ومهذبة للحجز عبر الرد على الرسالة. ممنوع منعاً باتاً: ذكر الأسعار، أي وعود أو نتائج طبية، المبالغة، أكثر من إيموجي واحد. وقّعي الرسالة باسم «سُرى - عيادة طود للأسنان». أخرج نص الرسالة فقط دون أي مقدمة.\n\nبيانات المريض: الاسم=' + (name || 'غير معروف') + '؛ آخر خدمة=' + (r.last_service || 'غير معروفة') + '؛ المدة منذ آخر زيارة/موعد=حوالي ' + (r.months != null ? r.months : 'عدة') + ' أشهر.';
      const resp = await this.helpers.httpRequest({ method:'POST', url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + r.gemini_key, headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }], generationConfig:{ temperature:0.85, maxOutputTokens:400, thinkingConfig:{ thinkingBudget:0 } } }) });
      const j = (typeof resp === 'string') ? JSON.parse(resp) : resp;
      msg = String((((((j.candidates||[])[0]||{}).content||{}).parts||[])[0]||{}).text || '').trim();
    } catch(e) {}
  }
  if (!msg) {
    const svc = r.last_service ? (' (' + r.last_service + ')') : '';
    msg = 'مرحباً ' + (name ? name + ' ' : '') + '🌿\n\n' + (isWin
      ? 'نتمنّى أنك بخير — يسعدنا أن نرتّب لك موعداً جديداً في عيادة طود للأسنان يناسب وقتك، لنكمل العناية بابتسامتك.'
      : ('مضى وقت على آخر زيارة لك' + svc + '، وننصح بفحص وتنظيف دوري للحفاظ على صحة أسنانك وابتسامتك.')) +
      '\n\nتحب نحجز لك موعداً؟ ردّ علينا وأنا سُرى بخدمتك 🦷';
  }
  try {
    await this.helpers.httpRequest({ method:'POST', url:'https://graph.facebook.com/v21.0/' + r.phone_number_id + '/messages', headers:{ Authorization:'Bearer ' + r.wa_token, 'Content-Type':'application/json' }, body: JSON.stringify({ messaging_product:'whatsapp', to:String(r.phone).replace('+',''), type:'text', text:{ body: msg } }) });
    out.push({ json:{ patient_id:r.patient_id, sent:true, ai: !!r.gemini_key } });
  } catch(e){ out.push({ json:{ patient_id:r.patient_id, sent:false, err:String((e&&e.message)||e).slice(0,150) } }); }
}
return out.length ? out : [{ json:{ note:'none this run' } }];`;

async function patch(id, queryNode, sendNode, sql) {
  const wf = await fetch(`${B}/workflows/${id}`, { headers: H }).then(r => r.json());
  wf.nodes.find(n => n.name === queryNode).parameters.query = sql;
  wf.nodes.find(n => n.name === sendNode).parameters.jsCode = SEND_AI;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${id}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${id}`, { method:"PUT", headers:H, body });
  if (put.status >= 300) { console.log(id, "err:", (await put.text()).slice(0,400)); return; }
  await fetch(`${B}/workflows/${id}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓", id, "-> AI-personalized outreach");
}

(async () => {
  await patch("1LnkHnZF36GuM0Zz", "Find Recall Candidates", "Send Recall", RECALL_SQL);
  await patch("jBOPF0mgvjyLAXTO", "Find Winback Candidates", "Send Winback", WINBACK_SQL);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
