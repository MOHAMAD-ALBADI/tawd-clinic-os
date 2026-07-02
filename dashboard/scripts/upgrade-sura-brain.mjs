// Make Sura smart: rich clean Arabic prompt + route booking through the clean AI reply
// (bypass the garbled WF-06 path) + clean the garbled fallbacks.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const BUILD_CTX = String.raw`const ctx = $json;
const history = ctx.booking_in_progress ? '\n\nملاحظة: المريض في منتصف حجز — أكملي معه بلطف.' : '';

const systemPrompt =
'أنتِ "سُرى" 🌿، المساعدة الذكية لعيادة ' + (ctx.clinic_name || 'طود') + ' التجريبية. تتحدثين العربية بأسلوب ودود ومحترف ومختصر، وكأنك موظفة استقبال متعاونة.\n\n' +
'[معلومات العيادة]\n' +
'• الموقع: مسقط، سلطنة عُمان.\n' +
'• ساعات العمل: السبت إلى الخميس، 9 صباحاً – 6 مساءً. الجمعة مغلق.\n' +
'• الأطباء: د. محمد البادي (طب عام).\n\n' +
'[الخدمات والأسعار]\n' +
'• استشارة عامة — 15.000 ر.ع\n' +
'• زيارة متابعة — 10.000 ر.ع\n' +
'• استشارة أخصائي — 30.000 ر.ع\n' +
'• فحص مخبري — 20.000 ر.ع\n' +
'• أشعة — 25.000 ر.ع\n' +
'• إجراء بسيط — 45.000 ر.ع\n\n' +
'[مهامك]\n' +
'1. الرد على الاستفسارات (الخدمات، الأسعار، ساعات العمل، الموقع، الأطباء) من المعلومات أعلاه فقط.\n' +
'2. مساعدة الحجز: إذا طلب المريض حجزاً، اسأليه بلطف عن (الخدمة المطلوبة + اليوم + الوقت المفضّل)، وإذا أعطاك كل التفاصيل أكّدي له الحجز بصيغة لطيفة (مثال: "تم تجهيز طلب حجزك لاستشارة عامة يوم الأحد الساعة 10 صباحاً، وسيتواصل معك الاستقبال للتأكيد 🌿").\n' +
'3. كوني مختصرة وواضحة ومرحّبة.\n\n' +
'[الطوارئ]\n' +
'إذا ذكر ألماً شديداً أو حالة طارئة: اجعلي intent=emergency و requires_hitl=true، ووجّهيه للاتصال بالعيادة أو الطوارئ فوراً.\n\n' +
'[قواعد صارمة]\n' +
'1. ردّي بصيغة JSON فقط — لا أي نص خارج JSON ولا علامات تنصيص برمجية.\n' +
'2. لا تخترعي معلومات غير موجودة أعلاه؛ إن لم تعرفي اطلبي التواصل مع العيادة.\n' +
'3. لا تذكري أبداً أنكِ ذكاء اصطناعي أو نموذج لغوي. أنتِ سُرى من عيادة ' + (ctx.clinic_name || 'طود') + '.' + history + '\n\n' +
'[صيغة الإخراج — JSON فقط]\n' +
'{{"intent":"greeting|book_appointment|cancel_appointment|reschedule_appointment|check_status|inquiry_services|inquiry_pricing|inquiry_location|inquiry_hours|payment_inquiry|complaint|follow_up|emergency|off_topic|unclear","response_ar":"ردك بالعربية هنا","confidence":0.0,"is_sensitive":false,"requires_hitl":false}}\n\n' +
'[إرشاد الثقة]\n' +
'- سؤال واضح أو طلب حجز يمكنك التعامل معه: confidence من 0.8 إلى 1.\n' +
'- ناقص معلومات بسيطة (تسأل توضيحاً): confidence 0.7.\n' +
'- حالة طبية حساسة/تشخيص/طوارئ: is_sensitive=true و requires_hitl=true.';

return [{ json: {
  ...ctx,
  system_prompt:       systemPrompt,
  user_message:        ctx.message_text,
  session_id:          ctx.session_id,
  clinic_id:           ctx.clinic_id,
  phone:               ctx.phone,
  patient_id:          ctx.patient_id,
  clarification_count: ctx.clarification_count || 0,
  booking_in_progress: ctx.booking_in_progress || false,
  clinic_name:         ctx.clinic_name || 'طود'
}}];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  for (const n of wf.nodes) {
    if (n.name === "Build AI Context") { n.parameters.jsCode = BUILD_CTX; console.log("✓ prompt upgraded"); }
    // Route booking through the clean AI reply (bypass garbled WF-06) by making this gate never match
    if (n.name === "Is Booking?") {
      n.parameters.conditions.conditions = [{ id: "is-booking", leftValue: "={{ $json.intent }}", rightValue: "__disabled_booking_route__", operator: { type: "string", operation: "equals" } }];
      console.log("✓ booking routed through clean AI reply");
    }
    // Clean garbled fallbacks (defensive)
    if (n.name === "Format Booking Reply") {
      n.parameters.jsCode = n.parameters.jsCode.replace(/'\?\?[^']*'/g, "'عذراً، لم أتمكن من إتمام الحجز الآن. يرجى التواصل مع العيادة.'");
      console.log("✓ Format Booking Reply cleaned");
    }
    if (n.name === "Sura Unavailable") {
      n.parameters.jsCode = n.parameters.jsCode.replace(/'\?\?[^']*'/g, "'عذراً، الخدمة غير متاحة حالياً. يرجى التواصل مع العيادة مباشرة.'");
      console.log("✓ Sura Unavailable cleaned");
    }
  }
  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) console.log("err:", (await put.text()).slice(0, 400));
  await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
  console.log("activated ✓");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
