// Switch WF-ErrorHandler from WhatsApp to EMAIL (Resend). On any Sura error: log to sura_errors +
// email the founder (from onboarding@resend.dev to config.alert_email). Key/email read from
// channel_configs.config (resend_key, alert_email) — not hardcoded.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "W8N7vDeYzuZLnlWW";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const PREP = String.raw`const j = $json;
const esc = s => String(s==null?'':s).replace(/'/g, "''");
const wfn = (j.workflow && j.workflow.name) || 'unknown';
const node = (j.execution && j.execution.lastNodeExecuted) || (j.execution && j.execution.error && j.execution.error.node && j.execution.error.node.name) || 'unknown';
const emsg = (((j.execution && j.execution.error && j.execution.error.message) || 'unknown') + '').slice(0,500);
const exid = String((j.execution && j.execution.id) || '');
const exurl = (j.execution && j.execution.url) || '';
const sql = "WITH ins AS (INSERT INTO public.sura_errors (workflow_name,node_name,error_message,execution_id,execution_url) VALUES ('"+esc(wfn)+"','"+esc(node)+"','"+esc(emsg)+"','"+esc(exid)+"','"+esc(exurl)+"') RETURNING id) SELECT (SELECT id::text FROM ins) AS err_id, cc.config->>'resend_key' AS resend_key, cc.config->>'alert_email' AS alert_email FROM public.channel_configs cc WHERE cc.channel='whatsapp' AND cc.is_active=true LIMIT 1;";
const alert = '• الأتمتة: ' + wfn + '\n• العقدة: ' + node + '\n• الخطأ: ' + emsg.slice(0,400) + (exurl ? ('\n• التنفيذ: ' + exurl) : '');
return [{ json: { sql, alert } }];`;

const SEND = String.raw`const cfg = $json;
let alert = ''; try { alert = $('Prep Error').first().json.alert; } catch(e){}
const key = cfg.resend_key, to = cfg.alert_email;
if (!key || !to) return [{ json: { alerted:false, reason:'no email config', err_id: cfg.err_id } }];
const safe = String(alert).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const html = '<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;line-height:1.7;color:#111"><h2 style="color:#dc2626;margin:0 0 10px">🚨 خطأ في سُرى</h2><pre style="white-space:pre-wrap;background:#f6f6f6;border-radius:8px;padding:14px;font-family:inherit;font-size:14px;margin:0">' + safe + '</pre><p style="color:#999;font-size:12px;margin-top:14px">رسالة نظام تلقائية من منصة طود — TAWD</p></div>';
try {
  await this.helpers.httpRequest({ method:'POST', url:'https://api.resend.com/emails', headers:{ Authorization:'Bearer ' + key, 'Content-Type':'application/json' }, body: JSON.stringify({ from:'TAWD Alerts <onboarding@resend.dev>', to:[to], subject:'🚨 خطأ في سُرى — تنبيه فوري', html }) });
  return [{ json: { alerted:true, via:'email', err_id: cfg.err_id } }];
} catch(e){ return [{ json:{ alerted:false, err:String((e&&e.message)||e).slice(0,200) } }]; }`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  wf.nodes.find(n => n.name === "Prep Error").parameters.jsCode = PREP;
  wf.nodes.find(n => n.name === "Send Alert").parameters.jsCode = SEND;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,400)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Error alerts now go by EMAIL (Resend) instead of WhatsApp");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
