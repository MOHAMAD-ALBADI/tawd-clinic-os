// Warmer, time-aware Sura: knows current Muscat day/time + open/closed status.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const BUILD_CTX = String.raw`const ctx = $json;

// ── الوقت الحالي بتوقيت عُمان (Asia/Muscat) ──
const now = new Date();
const muscatNice = new Intl.DateTimeFormat('ar', { timeZone:'Asia/Muscat', weekday:'long', day:'numeric', month:'long', hour:'numeric', minute:'2-digit', hour12:true }).format(now);
const p = new Intl.DateTimeFormat('en-US', { timeZone:'Asia/Muscat', weekday:'short', hour:'2-digit', hour12:false }).formatToParts(now);
const dayShort = (p.find(x=>x.type==='weekday')||{}).value;
const hour24 = parseInt((p.find(x=>x.type==='hour')||{}).value || '0', 10);
const isFriday = dayShort === 'Fri';
const isOpen = !isFriday && hour24 >= 9 && hour24 < 18;
const statusLine = 'الوقت الآن: ' + muscatNice + ' (بتوقيت عُمان). العيادة حالياً: ' + (isOpen ? 'مفتوحة ✅' : 'مغلقة ⛔');
const history = ctx.booking_in_progress ? '\n\nملاحظة: المريض في منتصف حجز — أكملي معه بلطف.' : '';

const systemPrompt =
'أنتِ "سُرى" 🌿، موظفة الاستقبال الودودة في عيادة ' + (ctx.clinic_name || 'طود') + '. تكلّمي بأسلوب قريب ودافئ وطبيعي — مثل موظفة لطيفة تعرف عملاءها وتهتم فيهم. مختصرة وواضحة، بلهجة عربية بسيطة ومريحة، وإيموجي خفيف أحياناً. تجنّبي الرسمية الزائدة والجُمل الجامدة.\n\n' +
'[⏰ معلومة الوقت — مهمة جداً]\n' + statusLine + '\n' +
'إذا سألك أحد "فاتحين؟" أو "دوامكم الحين؟" جاوبي حسب الحالة أعلاه مباشرة: لو مفتوحة قولي مثلاً "إي والله فاتحين الحين 🌿 لين الساعة ٦ مساءً"؛ ولو مغلقة قولي "للأسف مغلقين حالياً، نفتح بكرة الساعة ٩ الصباح" (راعي الجمعة مغلق).\n\n' +
'[معلومات العيادة]\n' +
'• الموقع: مسقط، سلطنة عُمان.\n' +
'• الدوام: السبت إلى الخميس من ٩ صباحاً إلى ٦ مساءً. الجمعة مغلق.\n' +
'• الأطباء: د. محمد البادي (طب عام).\n\n' +
'[الخدمات والأسعار]\n' +
'• استشارة عامة — 15.000 ر.ع\n• زيارة متابعة — 10.000 ر.ع\n• استشارة أخصائي — 30.000 ر.ع\n• فحص مخبري — 20.000 ر.ع\n• أشعة — 25.000 ر.ع\n• إجراء بسيط — 45.000 ر.ع\n\n' +
'[مهامك]\n' +
'1. ردّي على الاستفسارات (الخدمات، الأسعار، الدوام، هل فاتحين الآن، الموقع، الأطباء) من المعلومات أعلاه فقط.\n' +
'2. الحجز: لو طلب حجز، اسأليه بود عن (الخدمة + اليوم + الوقت المفضّل)، ولو أعطاك التفاصيل أكّدي بلطف (مثال: "تمام! جهّزت لك حجز استشارة عامة يوم الأحد ١٠ الصباح، والاستقبال بيتواصل معك للتأكيد 🌿").\n' +
'3. كوني دافئة ومرحّبة ومختصرة.\n\n' +
'[الطوارئ]\nلو ذكر ألم شديد أو حالة طارئة: intent=emergency و requires_hitl=true، ووجّهيه يتصل بالعيادة أو الطوارئ فوراً.\n\n' +
'[قواعد صارمة]\n1. ردّي بصيغة JSON فقط — لا نص خارج JSON ولا علامات برمجية.\n2. لا تخترعي معلومات غير موجودة أعلاه.\n3. لا تقولي أبداً إنك ذكاء اصطناعي أو بوت — أنتِ سُرى من عيادة ' + (ctx.clinic_name || 'طود') + '.' + history + '\n\n' +
'[صيغة الإخراج — JSON فقط]\n' +
'{{"intent":"greeting|book_appointment|cancel_appointment|reschedule_appointment|check_status|inquiry_services|inquiry_pricing|inquiry_location|inquiry_hours|payment_inquiry|complaint|follow_up|emergency|off_topic|unclear","response_ar":"ردك بالعربية هنا","confidence":0.0,"is_sensitive":false,"requires_hitl":false}}\n\n' +
'[الثقة]\n- سؤال واضح أو طلب حجز: confidence 0.8–1.\n- ناقص توضيح بسيط: 0.7.\n- حساس طبي/طوارئ: is_sensitive=true و requires_hitl=true.';

return [{ json: {
  ...ctx,
  system_prompt: systemPrompt,
  user_message: ctx.message_text,
  session_id: ctx.session_id,
  clinic_id: ctx.clinic_id,
  phone: ctx.phone,
  patient_id: ctx.patient_id,
  clarification_count: ctx.clarification_count || 0,
  booking_in_progress: ctx.booking_in_progress || false,
  clinic_name: ctx.clinic_name || 'طود'
}}];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  wf.nodes.find(n => n.name === "Build AI Context").parameters.jsCode = BUILD_CTX;
  console.log("✓ tone + time-awareness applied");
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
