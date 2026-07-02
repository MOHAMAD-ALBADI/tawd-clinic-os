// WF-09 No-Show Handler marked FUTURE appointments as no_show because "Get Overdue Appointments"
// is a Supabase-v1 getAll whose slot_time filters are silently ignored (same class as the S3/S5
// bug). Replace it with a Postgres query that correctly selects only TODAY'S past-time, still-open
// appointments. "Mark No-Show" (update by id) is fine and stays.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "r8pWM464TFDJ5nUs";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const SQL = "=SELECT id, clinic_id, patient_id, slot_time::text AS slot_time " +
  "FROM public.appointments " +
  "WHERE status IN ('scheduled','confirmed') AND deleted_at IS NULL " +
  "AND slot_time <= '{{ $json.cutoff }}'::timestamptz " +
  "AND slot_time >= '{{ $json.today_start }}'::timestamptz;";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const n = wf.nodes.find(x => x.name === "Get Overdue Appointments");
  if (!n) { console.error("node not found"); process.exit(1); }
  n.type = "n8n-nodes-base.postgres";
  n.typeVersion = 2;
  n.credentials = { postgres: { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" } };
  n.parameters = { operation: "executeQuery", query: SQL, options: {} };

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ WF-09 Get Overdue Appointments -> Postgres (time-bounded); future appts no longer touched");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
