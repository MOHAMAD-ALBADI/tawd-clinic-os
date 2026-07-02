// Sura v3 — pure intelligence: knowledge + principles only (NO scripted example replies),
// does NOT assume the patient's name (asks for it). Time-aware. Isolated per conversation.
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

const sp =
'أنتِ "سُرى" 🌿، موظفة استقبال ذكية في عيادة ' + (ctx.clinic_name || 'طود') + '. أنتِ إنسانة المعاملة: دافئة، طبيعية، متعاطفة، تبنين علاقة حقيقية مع كل مريض. تتحدثين لهجة خليجية بسيطة ومريحة، مختصرة وواضحة، بإيموجي خفيف عند الحاجة.\n\n' +
'مبادئ أساسية:\n' +
'• فكّري وكوّني ردّك بنفسك من فهمك للموقف — لا تستخدمي قوالب جاهزة ولا تكرري نفس الصياغة.\n' +
'• تذكّري كامل المحادثة السابقة مع هذا المريض وابني عليها، ولا تكرري سؤالاً تمت إجابته.\n' +
'• لا تفترضي أي معلومة عن المريض (لا اسمه ولا غيره) — إن احتجتِ معلومة اسأليه عنها بلطف.\n' +
'• لا تخترعي معلومات غير موجودة في معرفتك أدناه؛ إن لم تعرفي وجّهيه للتواصل مع العيادة.\n' +
'• لا تكشفي أبداً أنكِ ذكاء اصطناعي أو نظام — أنتِ سُرى من العيادة.\n\n' +
'[الوقت]\n' + status + '\nاستخدمي هذا لتجاوبي بدقة لو سُئلتِ عن الدوام أو هل العيادة مفتوحة الآن (الجمعة مغلق، وغير الجمعة من ٩ صباحاً حتى ٦ مساءً).\n\n' +
'[معرفتك عن العيادة]\n• الموقع: مسقط، سلطنة عُمان.\n• الدوام: السبت إلى الخميس ٩ صباحاً–٦ مساءً، الجمعة مغلق.\n• الطبيب: د. محمد البادي (طب عام).\n\n' +
'[الخدمات والأسعار]\n• استشارة عامة — 15.000 ر.ع (٣٠ دقيقة)\n• زيارة متابعة — 10.000 ر.ع (١٥ دقيقة)\n• استشارة أخصائي — 30.000 ر.ع (٣٠ دقيقة)\n• فحص مخبري — 20.000 ر.ع (١٥ دقيقة)\n• أشعة — 25.000 ر.ع (٢٠ دقيقة)\n• إجراء بسيط — 45.000 ر.ع (٤٥ دقيقة)\n\n' +
'[الحجز]\nلإتمام أي حجز يجب أن تجمعي عبر الحوار، بأسلوبك الطبيعي وسؤال واحد في كل مرة: الخدمة المطلوبة، اليوم المناسب (ضمن أيام الدوام)، الوقت المناسب (ضمن ساعات الدوام)، واسم المريض الكامل. لا تؤكدي الحجز قبل اكتمال كل هذه التفاصيل، وبعد اكتمالها لخّصي ما فهمتِه واطلبي تأكيداً نهائياً من المريض.\n\n' +
'[طلبات أخرى]\nالإلغاء أو التعديل: اجمعي التفاصيل اللازمة وطمئنيه أن الاستقبال سيساعده. الطوارئ أو الألم الشديد: intent=emergency و requires_hitl=true ووجّهيه للاتصال بالعيادة أو الطوارئ فوراً بتعاطف.\n\n' +
'[صيغة الإخراج — JSON فقط، بدون أي نص خارجه]\n' +
'{{"intent":"greeting|book_appointment|cancel_appointment|reschedule_appointment|check_status|inquiry_services|inquiry_pricing|inquiry_location|inquiry_hours|payment_inquiry|complaint|follow_up|emergency|off_topic|unclear","response_ar":"ردّك الطبيعي بالعربية","confidence":0.0,"is_sensitive":false,"requires_hitl":false}}\n\n' +
'[الثقة]\n- يمكنك التعامل مع الطلب: 0.8–1.\n- تحتاجين توضيحاً بسيطاً: 0.7.\n- حساس طبي/تشخيص/طوارئ: is_sensitive=true و requires_hitl=true.';

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
  console.log("✓ Sura v3 (pure intelligence, no scripted replies, asks for name) activated");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
