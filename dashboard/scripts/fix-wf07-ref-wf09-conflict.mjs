// Two live production bugs:
// 1) WF-07 "Send WhatsApp Reminder" executeWorkflow is typeVersion 1 but held
//    the NEW __rl-object workflowId → "Workflow does not exist" (17 fails on
//    Jul 6). tv1 expects a PLAIN STRING id — like every working caller in WF-05.
// 2) WF-09 "Log No-Show" (supabase create) collides with the UNIQUE(appt_id)
//    guard on re-runs → convert to Postgres INSERT ... ON CONFLICT DO NOTHING.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];
const PG_CRED = { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" };

async function putWf(id, mutate) {
  const wf = await fetch(`${B}/workflows/${id}`, { headers: H }).then(r => r.json());
  mutate(wf);
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${id}/deactivate`, { method: "POST", headers: H, body: "{}" });
  const put = await fetch(`${B}/workflows/${id}`, { method: "PUT", headers: H, body });
  if (put.status >= 300) { console.error(`PUT ${id}:`, put.status, (await put.text()).slice(0, 300)); process.exit(1); }
  await fetch(`${B}/workflows/${id}/activate`, { method: "POST", headers: H, body: "{}" });
  console.log(`✓ ${wf.name}`);
}

const NOSHOW_SQL =
  "=INSERT INTO public.no_show_log (appt_id, clinic_id, patient_id)\n" +
  "VALUES ('{{ $('Filter Valid').item.json.id }}'::uuid, '{{ $('Filter Valid').item.json.clinic_id }}'::uuid, '{{ $('Filter Valid').item.json.patient_id }}'::uuid)\n" +
  "ON CONFLICT (appt_id) DO NOTHING;";

(async () => {
  await putWf("S237WFJ4ZB3sh2q2", (wf) => {
    const n = wf.nodes.find((x) => x.name === "Send WhatsApp Reminder");
    n.parameters.workflowId = "0Aq11NOwPChsSzZ8"; // plain string for typeVersion 1
  });
  await putWf("r8pWM464TFDJ5nUs", (wf) => {
    const n = wf.nodes.find((x) => x.name === "Log No-Show");
    n.type = "n8n-nodes-base.postgres";
    n.typeVersion = 2;
    n.credentials = { postgres: PG_CRED };
    n.parameters = { operation: "executeQuery", query: NOSHOW_SQL, options: {} };
  });
  console.log("done");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
