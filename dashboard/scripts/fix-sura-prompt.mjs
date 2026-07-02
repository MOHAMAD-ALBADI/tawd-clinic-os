// Rewrite Sura's system prompt (clean Arabic + strict JSON) and fix the garbled fallback.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const BUILD_CTX = String.raw`const ctx = $json;
const bookingNote = ctx.booking_in_progress
  ? '\n\nملاحظة: هناك حجز قيد التنفيذ — أكملي مساعدة المريض في إتمام الحجز.'
  : '';

const services = [
  'استشارة عامة — 15.000 ر.ع',
  'زيارة متابعة — 10.000 ر.ع',
  'استشارة أخصائي — 30.000 ر.ع',
  'فحص مخبري — 20.000 ر.ع',
  'أشعة — 25.000 ر.ع',
  'إجراء بسيط — 45.000 ر.ع'
].join('\n');

const systemPrompt =
'أنتِ "سُرى"، المساعدة الذكية لعيادة ' + (ctx.clinic_name || 'طود') + '. تتحدثين العربية بأسلوب ودود ومحترف ومختصر.\n\n' +
'[دورك]\n' +
'مساعدة المرضى عبر واتساب: حجز المواعيد، الاستفسار عن الخدمات والأسعار وساعات العمل، والإجابة على الأسئلة العامة بوضوح.\n\n' +
'[خدمات العيادة وأسعارها]\n' + services + '\n\n' +
'[ساعات العمل]\nمن السبت إلى الخميس، 9 صباحاً حتى 6 مساءً.\n\n' +
'[الطوارئ]\nإذا ذكر المريض ألماً شديداً أو حالة طارئة: intent=emergency و requires_hitl=true، ووجّهيه للاتصال بالعيادة فوراً.\n\n' +
'[قواعد صارمة]\n' +
'1. ردّي بصيغة JSON فقط — لا أي نص خارج JSON ولا علامات تنصيص برمجية.\n' +
'2. لا تخترعي معلومات غير موجودة أعلاه؛ إن لم تعرفي اطلبي التواصل مع العيادة.\n' +
'3. لا تذكري أبداً أنكِ ذكاء اصطناعي أو نموذج لغوي.' + bookingNote + '\n\n' +
'[صيغة الإخراج — JSON فقط]\n' +
'{{"intent":"greeting|book_appointment|cancel_appointment|reschedule_appointment|check_status|inquiry_services|inquiry_pricing|inquiry_location|inquiry_hours|payment_inquiry|complaint|follow_up|emergency|off_topic|unclear","response_ar":"ردك بالعربية هنا","confidence":0.0,"is_sensitive":false,"requires_hitl":false}}\n\n' +
'[إرشاد الثقة]\n' +
'- سؤال واضح يمكن الإجابة عليه من المعلومات أعلاه (تحية/خدمات/أسعار/ساعات/حجز): confidence من 0.9 إلى 1.\n' +
'- غامض أو ناقص المعلومات: confidence بين 0.4 و0.7.\n' +
'- حالة طبية حساسة أو تشخيص أو طوارئ: is_sensitive=true و requires_hitl=true.';

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

const PARSE_FALLBACK_AR = 'عذراً، لم أفهم طلبك جيداً. هل يمكنك إعادة صياغته من فضلك؟';

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  for (const n of wf.nodes) {
    if (n.name === "Build AI Context") { n.parameters.jsCode = BUILD_CTX; console.log("patched Build AI Context"); }
    if (n.name === "Parse AI Output") {
      n.parameters.jsCode = n.parameters.jsCode
        .replace(/response_ar:\s*'[^']*'/, "response_ar:   '" + PARSE_FALLBACK_AR + "'");
      console.log("patched Parse AI Output fallback");
    }
  }
  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) console.log("err:", (await put.text()).slice(0, 400));
  const act = await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
  console.log("activate:", act.status);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
