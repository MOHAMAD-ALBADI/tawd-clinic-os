// Fix S1 "WhatsApp API" node: send token dynamically from channel_configs (multi-tenant),
// drop the broken httpHeaderAuth credential, and fix the recipient field.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "0Aq11NOwPChsSzZ8";
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  for (const n of wf.nodes) {
    if (n.name === "WhatsApp API") {
      n.parameters = {
        method: "POST",
        url: "=https://graph.facebook.com/v20.0/{{ $json.config.phone_number_id }}/messages",
        authentication: "none",
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: "Authorization", value: "=Bearer {{ $json.config.access_token }}" },
          { name: "Content-Type", value: "application/json" },
        ]},
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify({ messaging_product: 'whatsapp', to: ($('Trigger').item.json.to || $('Trigger').item.json.raw_from || ($('Trigger').item.json.phone || '').replace(/\\D/g,'')), type: 'text', text: { body: ($('Trigger').item.json.body || $('Trigger').item.json.message_text || '') } }) }}",
        options: {},
      };
      delete n.credentials;
      console.log("patched WhatsApp API node (dynamic token, fixed recipient)");
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
