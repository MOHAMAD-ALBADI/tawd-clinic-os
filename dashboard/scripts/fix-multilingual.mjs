// The model kept replying Arabic to English messages. (1) Add a PROMINENT top-level language
// directive to Build AI Context's system prompt. (2) Make lang detection OR-based (English if the
// user's message OR the reply is predominantly Latin).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const BC_ANCHOR = "والبنية الكاملة موضّحة في نهاية التعليمات.\\n\\n' +";
const BC_ADD = "والبنية الكاملة موضّحة في نهاية التعليمات.\\n\\n' +\n'🌐 [اللغة — إلزامي وأولوية عليا]: اكتشف لغة رسالة المستخدم الحالية. إذا كتب المستخدم بالإنجليزية فيجب أن تكتب محتوى حقل response_ar بالإنجليزية بالكامل؛ وإذا كتب بالعربية فبالعربية. طابق لغة المستخدم في كل رد ولا تخلط اللغتين في رسالة واحدة.\\n\\n' +";

const P_ANCHOR = "const lang = _sl(parsed.response_ar || ctx.message_text);";
const P_REPL = "const lang = (_sl(ctx.message_text)==='en' || _sl(parsed.response_ar)==='en') ? 'en' : 'ar';";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const bc = wf.nodes.find(n => n.name === "Build AI Context");
  if (!bc.parameters.jsCode.includes("اللغة — إلزامي وأولوية عليا")) {
    if (!bc.parameters.jsCode.includes(BC_ANCHOR)) throw new Error("BC anchor missing");
    bc.parameters.jsCode = bc.parameters.jsCode.replace(BC_ANCHOR, BC_ADD);
    try { new Function(bc.parameters.jsCode); } catch(e){ throw new Error("BC invalid: "+e.message); }
    console.log("• Build AI Context: prominent language directive added");
  } else console.log("• BC already has directive");

  const parse = wf.nodes.find(n => n.name === "Parse AI Output");
  if (parse.parameters.jsCode.includes(P_ANCHOR)) {
    parse.parameters.jsCode = parse.parameters.jsCode.replace(P_ANCHOR, P_REPL);
    console.log("• Parse: OR-based lang detection");
  } else console.log("• Parse: lang anchor not found (already updated?)");

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Language directive strengthened");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
