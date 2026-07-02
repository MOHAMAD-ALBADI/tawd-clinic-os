// Replace the flaky Supabase-v1 getAll search in S3/S5 with deterministic Postgres get-or-create.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];
const PG = { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" };

const PATIENT_SQL =
"WITH found AS (SELECT id FROM public.patients WHERE clinic_id='{{ $json.clinic_id }}'::uuid AND phone='{{ $json.phone }}' AND deleted_at IS NULL LIMIT 1), " +
"created AS (INSERT INTO public.patients (clinic_id, phone, name) SELECT '{{ $json.clinic_id }}'::uuid, '{{ $json.phone }}', 'مريض واتساب' WHERE NOT EXISTS (SELECT 1 FROM found) RETURNING id) " +
"SELECT id::text AS patient_id, false AS is_new FROM found UNION ALL SELECT id::text AS patient_id, true AS is_new FROM created;";

const PATIENT_OUT =
"const t = $('Trigger').first().json; const r = $json;\n" +
"return [{ json: { ...t, patient_id: r.patient_id, is_new_patient: r.is_new } }];";

const SESSION_SQL =
"WITH found AS (SELECT id, booking_in_progress, booking_locked_until, booking_slot_id, clarification_count, language FROM public.chat_sessions WHERE clinic_id='{{ $json.clinic_id }}'::uuid AND external_user_id='{{ $json.phone }}' AND channel='{{ $json.channel }}' AND status='active' ORDER BY last_active_at DESC LIMIT 1), " +
"created AS (INSERT INTO public.chat_sessions (clinic_id, patient_id, channel, external_user_id, status, language) SELECT '{{ $json.clinic_id }}'::uuid, NULLIF('{{ $json.patient_id }}','')::uuid, '{{ $json.channel }}', '{{ $json.phone }}', 'active', 'ar' WHERE NOT EXISTS (SELECT 1 FROM found) RETURNING id, booking_in_progress, booking_locked_until, booking_slot_id, clarification_count, language) " +
"SELECT id::text AS id, booking_in_progress, booking_locked_until, booking_slot_id, clarification_count, language FROM found UNION ALL SELECT id::text AS id, booking_in_progress, booking_locked_until, booking_slot_id, clarification_count, language FROM created;";

const SESSION_OUT =
"const t = $('Trigger').first().json; const s = $json;\n" +
"return [{ json: { ...t, session_id: s.id, is_new_session: false, booking_in_progress: s.booking_in_progress ?? false, booking_locked_until: s.booking_locked_until ?? null, booking_slot_id: s.booking_slot_id ?? null, clarification_count: s.clarification_count ?? 0, session_language: s.language ?? t.language ?? 'ar' } }];";

async function rebuild(id, { upsertName, sql, outCode }) {
  const wf = await fetch(`${B}/workflows/${id}`, { headers: H }).then(r => r.json());
  const trigger = wf.nodes.find(n => n.type.includes("executeWorkflowTrigger"));
  const tx = trigger.position?.[0] ?? 0, ty = trigger.position?.[1] ?? 0;
  const upsert = {
    id: "pg-" + upsertName, name: upsertName, type: "n8n-nodes-base.postgres", typeVersion: 2,
    position: [tx + 260, ty], parameters: { operation: "executeQuery", query: "=" + sql, options: {} },
    credentials: { postgres: PG },
  };
  const out = {
    id: "out-" + upsertName, name: "Output", type: "n8n-nodes-base.code", typeVersion: 2,
    position: [tx + 520, ty], parameters: { jsCode: outCode },
  };
  const nodes = [trigger, upsert, out];
  const connections = {
    [trigger.name]: { main: [[{ node: upsertName, type: "main", index: 0 }]] },
    [upsertName]: { main: [[{ node: "Output", type: "main", index: 0 }]] },
  };
  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes, connections, settings });
  const wasActive = wf.active;
  if (wasActive) await fetch(`${B}/workflows/${id}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${id}`, { method:"PUT", headers:H, body });
  console.log(id, "PUT ->", put.status);
  if (put.status >= 300) { console.log("  err:", (await put.text()).slice(0,500)); return; }
  if (wasActive) await fetch(`${B}/workflows/${id}/activate`, { method:"POST", headers:H, body:"{}" });
}

(async () => {
  await rebuild("44lmYECx1xkG0Cir", { upsertName: "Upsert Patient", sql: PATIENT_SQL, outCode: PATIENT_OUT });
  await rebuild("LhLhOblkCwLWWQlt", { upsertName: "Upsert Session", sql: SESSION_SQL, outCode: SESSION_OUT });
  console.log("✓ S3/S5 rebuilt with Postgres get-or-create");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
