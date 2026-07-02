// Replace S1 "WhatsApp API" httpRequest node with a Code node that calls Meta directly.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "0Aq11NOwPChsSzZ8";
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const CODE = `const cfg = $json.config || {};
const t = $('Trigger').first().json;
const to = t.to || t.raw_from || String(t.phone || '').replace(/\\D/g, '');
const text = t.body || t.message_text || '';
let data;
try {
  data = await this.helpers.httpRequest({
    method: 'POST',
    url: 'https://graph.facebook.com/v20.0/' + cfg.phone_number_id + '/messages',
    headers: { Authorization: 'Bearer ' + cfg.access_token, 'Content-Type': 'application/json' },
    body: { messaging_product: 'whatsapp', to: to, type: 'text', text: { body: text } },
    json: true,
  });
} catch (e) {
  data = { error: (e && e.message) || String(e), _failed: true, _to: to };
}
return [{ json: data }];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  for (const n of wf.nodes) {
    if (n.name === "WhatsApp API") {
      n.type = "n8n-nodes-base.code";
      n.typeVersion = 2;
      n.parameters = { mode: "runOnceForAllItems", jsCode: CODE };
      delete n.credentials;
      console.log("replaced WhatsApp API with Code node (direct Meta call)");
    }
  }
  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) console.log("err:", (await put.text()).slice(0, 500));
  const act = await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
  console.log("activate:", act.status);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
