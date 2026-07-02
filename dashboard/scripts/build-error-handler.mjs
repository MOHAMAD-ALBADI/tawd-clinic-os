// WF-ErrorHandler: fires whenever any Sura workflow ERRORS (n8n error-trigger). Logs the failure to
// public.sura_errors and sends a WhatsApp alert to the founder — so silent breakages (like the
// dexpr booking bug) surface immediately. Then sets this as the errorWorkflow on all Sura workflows.
import { randomUUID } from "crypto";
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];
const ALERT_PHONE = "96876630020"; // founder

const PREP = String.raw`const j = $json;
const esc = s => String(s==null?'':s).replace(/'/g, "''");
const wfn = (j.workflow && j.workflow.name) || 'unknown';
const node = (j.execution && j.execution.lastNodeExecuted) || (j.execution && j.execution.error && j.execution.error.node && j.execution.error.node.name) || 'unknown';
const emsg = (((j.execution && j.execution.error && j.execution.error.message) || 'unknown') + '').slice(0,500);
const exid = String((j.execution && j.execution.id) || '');
const exurl = (j.execution && j.execution.url) || '';
const sql = "WITH ins AS (INSERT INTO public.sura_errors (workflow_name,node_name,error_message,execution_id,execution_url) VALUES ('"+esc(wfn)+"','"+esc(node)+"','"+esc(emsg)+"','"+esc(exid)+"','"+esc(exurl)+"') RETURNING id) SELECT (SELECT id::text FROM ins) AS err_id, cc.config->>'access_token' AS wa_token, cc.config->>'phone_number_id' AS pnid FROM public.channel_configs cc WHERE cc.channel='whatsapp' AND cc.is_active=true LIMIT 1;";
const alert = '🚨 تنبيه: خطأ في سُرى\n\n• الأتمتة: ' + wfn + '\n• العقدة: ' + node + '\n• الخطأ: ' + emsg.slice(0,300) + (exurl ? ('\n• التنفيذ: ' + exurl) : '');
return [{ json: { sql, alert } }];`;

const SEND = String.raw`const cfg = $json;
let alert = ''; try { alert = $('Prep Error').first().json.alert; } catch(e){}
const to = '` + ALERT_PHONE + String.raw`';
if (!cfg.wa_token || !cfg.pnid) return [{ json: { alerted:false, reason:'no wa config', err_id: cfg.err_id } }];
try {
  await this.helpers.httpRequest({ method:'POST', url:'https://graph.facebook.com/v21.0/' + cfg.pnid + '/messages', headers:{ Authorization:'Bearer ' + cfg.wa_token, 'Content-Type':'application/json' }, body: JSON.stringify({ messaging_product:'whatsapp', to, type:'text', text:{ body: alert } }) });
  return [{ json: { alerted:true, err_id: cfg.err_id } }];
} catch(e){ return [{ json:{ alerted:false, err:String((e&&e.message)||e).slice(0,150) } }]; }`;

const TARGETS = ["arZRfHPPTytcMSR5","nxo4Ftrz3aBae8tW","r8pWM464TFDJ5nUs","S237WFJ4ZB3sh2q2","nMzV4wxrURtNOtfZ","1LnkHnZF36GuM0Zz","jBOPF0mgvjyLAXTO","yTs1IgdYh9BYVO51"];

(async () => {
  const nTrig = randomUUID(), nPrep = randomUUID(), nPg = randomUUID(), nSend = randomUUID();
  const nodes = [
    { id: nTrig, name: "Error Trigger", type: "n8n-nodes-base.errorTrigger", typeVersion: 1, position: [260,300], parameters: {} },
    { id: nPrep, name: "Prep Error", type: "n8n-nodes-base.code", typeVersion: 2, position: [480,300], parameters: { jsCode: PREP } },
    { id: nPg, name: "Log & Config", type: "n8n-nodes-base.postgres", typeVersion: 2, position: [700,300], credentials: { postgres: { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" } }, parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} } },
    { id: nSend, name: "Send Alert", type: "n8n-nodes-base.code", typeVersion: 2, position: [920,300], parameters: { jsCode: SEND } },
  ];
  const connections = {
    "Error Trigger": { main: [[{ node: "Prep Error", type: "main", index: 0 }]] },
    "Prep Error": { main: [[{ node: "Log & Config", type: "main", index: 0 }]] },
    "Log & Config": { main: [[{ node: "Send Alert", type: "main", index: 0 }]] },
  };
  const res = await fetch(`${B}/workflows`, { method: "POST", headers: H, body: JSON.stringify({ name: "TAWD - WF-ErrorHandler (Sura alerts)", nodes, connections, settings: { executionOrder: "v1" } }) });
  const j = await res.json();
  if (!j.id) { console.error("create failed:", JSON.stringify(j).slice(0,400)); process.exit(1); }
  const handlerId = j.id;
  await fetch(`${B}/workflows/${handlerId}/activate`, { method: "POST", headers: H, body: "{}" });
  console.log("created + activated WF-ErrorHandler:", handlerId);

  // set errorWorkflow on all Sura workflows
  for (const id of TARGETS) {
    const wf = await fetch(`${B}/workflows/${id}`, { headers: H }).then(r => r.json());
    const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
    settings.errorWorkflow = handlerId;
    const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
    await fetch(`${B}/workflows/${id}/deactivate`, { method:"POST", headers:H, body:"{}" });
    const put = await fetch(`${B}/workflows/${id}`, { method:"PUT", headers:H, body });
    await fetch(`${B}/workflows/${id}/activate`, { method:"POST", headers:H, body:"{}" });
    console.log("  errorWorkflow set on", id, "->", put.status);
  }
  console.log("✓ all Sura workflows now alert on error");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
