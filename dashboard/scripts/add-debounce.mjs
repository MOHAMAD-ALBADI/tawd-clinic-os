// Insert message-grouping (debounce) chain between "Resolve Clinic ID" and "S4 Clinic Context".
// Each message: buffer -> wait 4s -> only the LATEST claims+merges all pending -> continues.
// Superseded executions return [] and die silently. Response to Meta already fired at Respond Challenge.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];
const PG = { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" };

const PREP = `const c = $json;
const esc = s => String(s ?? '').replace(/'/g, "''");
const sql = "INSERT INTO public.sura_inbound_buffer (clinic_id, phone, channel, message_text, wamid) VALUES ('" +
  c.clinic_id + "'::uuid, '" + esc(c.phone) + "', '" + esc(c.channel || 'whatsapp') + "', '" + esc(c.message_text) + "', '" + esc(c.message_id) + "') " +
  "ON CONFLICT (wamid) DO NOTHING RETURNING id::text AS buffer_id;";
return [{ json: { ...c, sql } }];`;

const CLAIM =
"=WITH latest AS (SELECT id FROM public.sura_inbound_buffer WHERE clinic_id = '{{ $('Prep Buffer SQL').first().json.clinic_id }}'::uuid AND phone = '{{ $('Prep Buffer SQL').first().json.phone }}' AND processed = false ORDER BY created_at DESC LIMIT 1) " +
"UPDATE public.sura_inbound_buffer b SET processed = true WHERE b.clinic_id = '{{ $('Prep Buffer SQL').first().json.clinic_id }}'::uuid AND b.phone = '{{ $('Prep Buffer SQL').first().json.phone }}' AND b.processed = false AND (SELECT id FROM latest) = '{{ $('Buffer Insert').first().json.buffer_id }}'::uuid " +
"RETURNING b.message_text, b.created_at;";

const MERGE = `const rows = $input.all();
if (rows.length === 0) return [];                         // not the latest message -> stop silently
const ctx = $('Prep Buffer SQL').first().json;
const merged = rows.map(r => r.json)
  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  .map(r => r.message_text).join('\\n');
const { sql, ...clean } = ctx;
return [{ json: { ...clean, message_text: merged, original_message_text: ctx.message_text } }];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const names = new Set(wf.nodes.map(n => n.name));
  if (names.has("Debounce 4s")) { console.log("Debounce already installed — aborting to avoid duplicates."); return; }

  const nodes = [
    { id: "deb-prep",  name: "Prep Buffer SQL", type: "n8n-nodes-base.code",     typeVersion: 2,   position: [1430, 470], parameters: { jsCode: PREP } },
    { id: "deb-ins",   name: "Buffer Insert",   type: "n8n-nodes-base.postgres", typeVersion: 2,   position: [1590, 470], parameters: { operation: "executeQuery", query: "={{ $json.sql }}", options: {} }, credentials: { postgres: PG } },
    { id: "deb-wait",  name: "Debounce 4s",     type: "n8n-nodes-base.wait",     typeVersion: 1.1, position: [1750, 470], parameters: { resume: "timeInterval", amount: 4, unit: "seconds" }, webhookId: "sura-debounce-resume" },
    { id: "deb-claim", name: "Claim Or Abort",  type: "n8n-nodes-base.postgres", typeVersion: 2,   position: [1910, 470], parameters: { operation: "executeQuery", query: CLAIM, options: {} }, credentials: { postgres: PG } },
    { id: "deb-merge", name: "Merge & Continue", type: "n8n-nodes-base.code",    typeVersion: 2,   position: [2070, 470], parameters: { jsCode: MERGE } },
  ];
  wf.nodes.push(...nodes);

  // Rewire: Resolve Clinic ID -> debounce chain -> S4 Clinic Context
  wf.connections["Resolve Clinic ID"] = { main: [[{ node: "Prep Buffer SQL", type: "main", index: 0 }]] };
  wf.connections["Prep Buffer SQL"]   = { main: [[{ node: "Buffer Insert",   type: "main", index: 0 }]] };
  wf.connections["Buffer Insert"]     = { main: [[{ node: "Debounce 4s",     type: "main", index: 0 }]] };
  wf.connections["Debounce 4s"]       = { main: [[{ node: "Claim Or Abort",  type: "main", index: 0 }]] };
  wf.connections["Claim Or Abort"]    = { main: [[{ node: "Merge & Continue", type: "main", index: 0 }]] };
  wf.connections["Merge & Continue"]  = { main: [[{ node: "S4 Clinic Context", type: "main", index: 0 }]] };

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers: H, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers: H, body });
  console.log("PUT:", put.status); if (put.status >= 300) { console.log("err:", (await put.text()).slice(0, 600)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers: H, body: "{}" });
  console.log("✓ Debounce (message grouping) installed: 4s window, last-message-wins, atomic merge");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
