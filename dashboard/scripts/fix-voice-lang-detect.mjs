// The appended Arabic gender hint "[ملاحظة نظام …]" pollutes language detection on short English
// voice notes (Arabic hint chars outnumber the English transcript). Strip the hint before counting,
// in BOTH Build AI Context (userLang directive) and Parse AI Output (lang field).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const BC_FIND = "const _uL = (String(ctx.message_text||'').match(/[A-Za-z]/g)||[]).length; const _uA = (String(ctx.message_text||'').match(/[\\u0600-\\u06FF]/g)||[]).length; const userLang = _uL > _uA ? 'الإنجليزية' : 'العربية';";
const BC_REPL = String.raw`const _lc = String(ctx.message_text||'').replace(/\[ملاحظة نظام[\s\S]*?\]/g,''); const _uL = (_lc.match(/[A-Za-z]/g)||[]).length; const _uA = (_lc.match(/[؀-ۿ]/g)||[]).length; const userLang = _uL > _uA ? 'الإنجليزية' : 'العربية';`;

const P_FIND = "const lang = (_sl(ctx.message_text)==='en' || _sl(parsed.response_ar)==='en') ? 'en' : 'ar';";
const P_REPL = String.raw`const lang = (_sl(String(ctx.message_text||'').replace(/\[ملاحظة نظام[\s\S]*?\]/g,''))==='en' || _sl(parsed.response_ar)==='en') ? 'en' : 'ar';`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const bc = wf.nodes.find(n => n.name === "Build AI Context");
  const parse = wf.nodes.find(n => n.name === "Parse AI Output");

  if (bc.parameters.jsCode.includes("const _lc =")) { console.log("BC already patched"); }
  else { if (!bc.parameters.jsCode.includes(BC_FIND)) throw new Error("BC anchor missing"); bc.parameters.jsCode = bc.parameters.jsCode.replace(BC_FIND, BC_REPL); }

  if (parse.parameters.jsCode.includes("ملاحظة نظام")) { console.log("Parse already patched"); }
  else { if (!parse.parameters.jsCode.includes(P_FIND)) throw new Error("Parse anchor missing"); parse.parameters.jsCode = parse.parameters.jsCode.replace(P_FIND, P_REPL); }

  try { new Function(bc.parameters.jsCode); new Function(parse.parameters.jsCode); } catch(e){ throw new Error("invalid JS: "+e.message); }

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,400)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Language detection now ignores the [ملاحظة نظام] gender hint");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
