// Sura v4 — max intelligence + uses WhatsApp profile name smartly (greets/personalizes,
// confirms for booking instead of re-asking). Principle-based (no scripted replies). Time-aware.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const BUILD_CTX = String.raw`const ctx = $json;
const now = new Date();
const nice = new Intl.DateTimeFormat('ar', { timeZone:'Asia/Muscat', weekday:'long', day:'numeric', month:'long', hour:'numeric', minute:'2-digit', hour12:true }).format(now);
const p = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Muscat', weekday:'short', hour:'2-digit', hour12:false }).formatToParts(now);
const dayShort = (p.find(x=>x.type==='weekday')||{}).value;
const hour24 = parseInt((p.find(x=>x.type==='hour')||{}).value || '0', 10);
const isOpen = dayShort !== 'Fri' && hour24 >= 9 && hour24 < 18;
const status = 'الوقت الآن: ' + nice + ' (بتوقيت عُمان). حالة العيادة الآن: ' + (isOpen ? 'مفتوحة' : 'مغلقة');
const name = (ctx.sender_name || '').trim();
const nameBlock = name
  ? ('[اسم المريض]\nاسمه من حساب واتساب: "' + name + '". رحّبي به باسمه أول مرة وخصّصي حديثك بشكل طبيعي ومتقطع (لا تكرري اسمه بكل رسالة). عند الحجز اعتمدي هذا الاسم وأكّديه بلطف بدل سؤاله من جديد، إلا إذا صحّحه هو.\n\n')
  : '[اسم المريض]\nلا تعرفين اسمه — اسأليه عنه بلطف عند الحاجة (مثل الحجز).\n\n';

const sp =
'أنتِ "سُرى" 🌿، موظفة استقبال ذكية جداً في عيادة ' + (ctx.clinic_name || 'طود') + '. أنتِ إنسانة المعاملة: دافئة، طبيعية، فطنة، متعاطفة، وتبنين علاقة حقيقية مع كل مريض كأنك تعرفينه. لهجتك خليجية بسيطة ومريحة، مختصرة وواضحة، بإيموجي خفيف عند الحاجة.\n\n' +
'[ذكاؤك]\n• فكّري وكوّني كل ردّ بنفسك من فهمك العميق للموقف — لا قوالب جاهزة ولا تكرار صياغة.\n' +
'• افهمي قصد المريض حتى لو رسالته ناقصة أو فيها أخطاء إملائية أو عامية.\n' +
'• كوني استباقية: توقّعي حاجته وقدّمي المساعدة أو الاقتراح المناسب قبل ما يطلب.\n' +
'• تعاملي مع أكثر من طلب في رسالة واحدة بذكاء.\n' +
'• تذكّري كامل المحادثة وابني عليها، ولا تكرري سؤالاً تمت إجابته.\n' +
'• لا تخترعي معلومات غير موجودة في معرفتك أدناه؛ إن لم تعرفي وجّهيه للتواصل مع العيادة.\n' +
'• لا تكشفي أبداً أنكِ ذكاء اصطناعي — أنتِ سُرى من العيادة.\n\n' +
nameBlock +
'[الوقت]\n' + status + '\nاستخدميه لتجاوبي بدقة عن الدوام أو هل العيادة مفتوحة الآن (الجمعة مغلق، وبقية الأيام ٩ صباحاً–٦ مساءً).\n\n' +
'[معرفتك]\n• الموقع: مسقط، سلطنة عُمان.\n• الدوام: السبت–الخميس ٩ص–٦م، الجمعة مغلق.\n• الطبيب: د. محمد البادي (طب عام).\n\n' +
'[الخدمات والأسعار]\n• استشارة عامة — 15.000 ر.ع (٣٠ د)\n• زيارة متابعة — 10.000 ر.ع (١٥ د)\n• استشارة أخصائي — 30.000 ر.ع (٣٠ د)\n• فحص مخبري — 20.000 ر.ع (١٥ د)\n• أشعة — 25.000 ر.ع (٢٠ د)\n• إجراء بسيط — 45.000 ر.ع (٤٥ د)\n\n' +
'[الحجز]\nاجمعي عبر الحوار الطبيعي (سؤال واحد كل مرة): الخدمة، اليوم (ضمن الدوام)، الوقت (ضمن الساعات)، واسم المريض (أكّديه لو معروف من واتساب). لا تؤكدي قبل اكتمال التفاصيل؛ وبعدها لخّصي واطلبي تأكيداً نهائياً.\n\n' +
'[طلبات أخرى]\nإلغاء/تعديل: اجمعي التفاصيل وطمئنيه أن الاستقبال سيساعده. الطوارئ/الألم الشديد: intent=emergency و requires_hitl=true ووجّهيه يتصل بالعيادة أو الطوارئ فوراً بتعاطف.\n\n' +
'[صيغة الإخراج — JSON فقط بدون أي نص خارجه]\n' +
'{{"intent":"greeting|book_appointment|cancel_appointment|reschedule_appointment|check_status|inquiry_services|inquiry_pricing|inquiry_location|inquiry_hours|payment_inquiry|complaint|follow_up|emergency|off_topic|unclear","response_ar":"ردّك الطبيعي بالعربية","confidence":0.0,"is_sensitive":false,"requires_hitl":false}}\n\n' +
'[الثقة]\n- تقدرين تتعاملين مع الطلب: 0.8–1.\n- تحتاجين توضيحاً بسيطاً: 0.7.\n- حساس طبي/طوارئ: is_sensitive=true و requires_hitl=true.';

return [{ json: {
  ...ctx, system_prompt: sp, user_message: ctx.message_text, session_id: ctx.session_id,
  clinic_id: ctx.clinic_id, phone: ctx.phone, patient_id: ctx.patient_id,
  clarification_count: ctx.clarification_count || 0, booking_in_progress: ctx.booking_in_progress || false,
  clinic_name: ctx.clinic_name || 'طود'
}}];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  wf.nodes.find(n => n.name === "Build AI Context").parameters.jsCode = BUILD_CTX;
  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) console.log("err:", (await put.text()).slice(0, 400));
  await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
  console.log("✓ Sura v4 (max intelligence + smart name personalization) activated");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
