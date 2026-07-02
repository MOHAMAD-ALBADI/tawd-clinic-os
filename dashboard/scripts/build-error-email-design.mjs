// Professional branded HTML email for Sura error alerts (light, table-based, email-client safe).
// Prep Error now passes structured fields; Send Alert renders the TAWD-branded template + a plain
// text part (both parts improves deliverability).
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
const at = new Date().toLocaleString('ar', { timeZone:'Asia/Muscat', dateStyle:'medium', timeStyle:'short' });
const sql = "WITH ins AS (INSERT INTO public.sura_errors (workflow_name,node_name,error_message,execution_id,execution_url) VALUES ('"+esc(wfn)+"','"+esc(node)+"','"+esc(emsg)+"','"+esc(exid)+"','"+esc(exurl)+"') RETURNING id) SELECT (SELECT id::text FROM ins) AS err_id, cc.config->>'resend_key' AS resend_key, cc.config->>'alert_email' AS alert_email FROM public.channel_configs cc WHERE cc.channel='whatsapp' AND cc.is_active=true LIMIT 1;";
const text = 'خطأ في سُرى\n\nالأتمتة: ' + wfn + '\nالعقدة: ' + node + '\nالوقت: ' + at + '\nالخطأ: ' + emsg + (exurl ? ('\nالتنفيذ: ' + exurl) : '');
return [{ json: { sql, wfn, node, emsg, exurl, at, text } }];`;

const SEND = String.raw`const cfg = $json;
let p = {}; try { p = $('Prep Error').first().json; } catch(e){}
const key = cfg.resend_key, to = cfg.alert_email;
if (!key || !to) return [{ json: { alerted:false, reason:'no email config', err_id: cfg.err_id } }];
const h = s => String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const row = (l,v) => '<tr><td style="padding:11px 16px;font-size:12px;color:#64748b;background:#fafbfc;width:78px;border-bottom:1px solid #eef0f2">' + l + '</td><td style="padding:11px 16px;font-size:13px;color:#0f172a;font-weight:600;border-bottom:1px solid #eef0f2">' + h(v) + '</td></tr>';
const btn = p.exurl ? '<div style="margin-top:22px"><a href="' + h(p.exurl) + '" style="display:inline-block;background:#0d9488;color:#ffffff;font-weight:700;font-size:14px;text-decoration:none;padding:11px 24px;border-radius:10px">فتح التنفيذ في n8n &larr;</a></div>' : '';
const html =
'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" dir="rtl" style="background:#f4f6f8;padding:32px 12px;font-family:Segoe UI,Tahoma,Arial,sans-serif"><tr><td align="center">' +
'<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.08)">' +
'<tr><td style="background:#0d9488;padding:20px 28px"><table width="100%"><tr>' +
'<td style="color:#ffffff;font-size:20px;font-weight:800">طود <span style="opacity:.7;font-size:13px;font-weight:600">· TAWD</span></td>' +
'<td align="left"><span style="background:rgba(255,255,255,0.2);color:#ffffff;font-size:12px;font-weight:700;padding:5px 12px;border-radius:20px">تنبيه نظام</span></td>' +
'</tr></table></td></tr>' +
'<tr><td style="padding:28px">' +
'<div style="font-size:18px;font-weight:800;color:#dc2626;margin-bottom:6px">🚨 حدث خطأ في سُرى</div>' +
'<div style="font-size:13px;color:#64748b;margin-bottom:22px;line-height:1.6">اكتشفنا خللاً في إحدى أتمتة سُرى وسجّلناه تلقائياً. التفاصيل أدناه لتتصرّف بسرعة.</div>' +
'<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef0f2;border-radius:12px;overflow:hidden">' + row('الأتمتة', p.wfn) + row('العقدة', p.node) + row('الوقت', p.at) + '</table>' +
'<div style="margin-top:16px;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px">' +
'<div style="font-size:11px;color:#991b1b;font-weight:700;margin-bottom:6px">رسالة الخطأ</div>' +
'<div style="font-size:13px;color:#b91c1c;line-height:1.6;word-break:break-word">' + h(p.emsg) + '</div></div>' + btn +
'</td></tr>' +
'<tr><td style="padding:16px 28px;border-top:1px solid #eef0f2;color:#94a3b8;font-size:11px;line-height:1.6">رسالة تلقائية من منصة طود لإدارة العيادات — تصلك عند أي خلل في سُرى لتتصرّف بسرعة.</td></tr>' +
'</table></td></tr></table>';
try {
  await this.helpers.httpRequest({ method:'POST', url:'https://api.resend.com/emails', headers:{ Authorization:'Bearer ' + key, 'Content-Type':'application/json' }, body: JSON.stringify({ from:'TAWD · طود <onboarding@resend.dev>', to:[to], subject:'تنبيه سُرى: خطأ في ' + (p.wfn||'أتمتة'), html, text: p.text || 'خطأ في سُرى' }) });
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
  console.log("✓ Professional branded error email deployed");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
