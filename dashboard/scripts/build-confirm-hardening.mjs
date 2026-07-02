// Reliability: tighten the confirmation criteria in Build AI Context's system prompt so Sura only
// sets confirmed=true on a CLEAR affirmative to a confirm-question she asked — never assumes "yes"
// from ambiguous/garbled/single-char input, and is extra strict for destructive cancel/reschedule.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const OLD = "اضبطي confirmed=true فقط في الرد الذي يوافق فيه المريض نهائياً وتكون الحقول الأربعة مكتملة والوقت ليس ماضياً؛ غير ذلك confirmed=false.";
const NEW = "اضبطي confirmed=true فقط عند تحقّق كل الشروط معاً: (أ) أن تكوني في ردّكِ السابق قد عرضتِ ملخصاً واضحاً وطلبتِ تأكيداً صريحاً؛ (ب) أن يكون ردّ المريض تأكيداً واضحاً لا لبس فيه (نعم، أكيد، اكد، تمام، موافق، ماشي، أيوه)؛ (ج) اكتمال المعلومات المطلوبة والوقت ليس ماضياً. وإلا فاضبطي confirmed=false وأعيدي طلب التأكيد بلطف — لا تفترضي الموافقة إطلاقاً من رسالة غامضة أو حرف أو رمز غير واضح. وفي الإلغاء والتعديل (إجراءات حسّاسة يصعب التراجع عنها) كوني أشد صرامة: لا تؤكّدي إلا برد صريح لا لبس فيه على سؤال تأكيد طرحتِه أنتِ.";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const bc = wf.nodes.find(n => n.name === "Build AI Context");
  let code = bc.parameters.jsCode;
  if (!code.includes(OLD)) { console.error("OLD confirmation sentence not found — aborting"); process.exit(1); }
  if (code.includes("لا تفترضي الموافقة إطلاقاً")) { console.error("Already hardened — aborting"); process.exit(1); }
  code = code.replace(OLD, NEW);
  try { new Function(code); } catch(e){ console.error("Build AI Context invalid JS:", e.message); process.exit(1); }
  bc.parameters.jsCode = code;

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Confirmation criteria hardened (no assumed-yes; strict for cancel/reschedule)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
