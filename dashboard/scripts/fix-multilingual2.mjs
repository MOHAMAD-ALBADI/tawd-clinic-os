// The model still replied Arabic to a bare "Hi". Stop relying on the model to detect language:
// compute the user's message language DETERMINISTICALLY in Build AI Context and inject an explicit
// per-turn directive ("this message is in <lang> — write response_ar in <lang>").
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const CALC_ANCHOR = "const tz = ctx.clinic_timezone || 'Asia/Muscat';";
const CALC_ADD = CALC_ANCHOR + "\nconst _uL = (String(ctx.message_text||'').match(/[A-Za-z]/g)||[]).length; const _uA = (String(ctx.message_text||'').match(/[\\u0600-\\u06FF]/g)||[]).length; const userLang = _uL > _uA ? 'الإنجليزية' : 'العربية';";

const DIR_FIND = "[اللغة — إلزامي وأولوية عليا]: اكتشف لغة رسالة المستخدم الحالية. إذا كتب المستخدم بالإنجليزية فيجب أن تكتب محتوى حقل response_ar بالإنجليزية بالكامل؛ وإذا كتب بالعربية فبالعربية. طابق لغة المستخدم في كل رد ولا تخلط اللغتين في رسالة واحدة.";
const DIR_REPL = "[اللغة — إلزامي وأولوية عليا]: لغة رسالة المريض الحالية هي ' + userLang + '. اكتب محتوى حقل response_ar بهذه اللغة حصراً — حتى لو كانت الرسالة تحية قصيرة مثل «hi» أو «hello» أو «نعم». لا تخلط اللغتين في رسالة واحدة.";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const bc = wf.nodes.find(n => n.name === "Build AI Context");
  let code = bc.parameters.jsCode;
  if (code.includes("const userLang")) { console.log("already patched"); process.exit(0); }
  if (!code.includes(CALC_ANCHOR)) throw new Error("calc anchor missing");
  if (!code.includes(DIR_FIND)) throw new Error("directive anchor missing");
  code = code.replace(CALC_ANCHOR, CALC_ADD).replace(DIR_FIND, DIR_REPL);
  try { new Function(code); } catch(e){ throw new Error("BC invalid: " + e.message); }
  bc.parameters.jsCode = code;

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Deterministic per-turn language directive injected");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
