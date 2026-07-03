// n8n workflow cleanup (audit 2026-07-03):
// 1. Deactivate [STUB] WF-14 + WF-22 — executeWorkflowTrigger placeholders; sub-workflows
//    don't need to be active to be callable, and nothing calls them yet.
// 2. WF-24 payment-link cleanup: every 5 min -> hourly (payment_links table is empty,
//    Thawani deferred; 288 no-op runs/day were flooding the execution log).
// 3. Set errorWorkflow = WF-ErrorHandler on every ACTIVE workflow missing it
//    (except the ErrorHandler itself) so ALL failures email the founder.
// 4. Rename superseded inactive WIPs to [ARCHIVED]: WF-19 (superseded by WF-Recall +
//    WF-Winback + smart outreach) and WF-23 (superseded by WF-ErrorHandler).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];
const ERR_ID = "W8N7vDeYzuZLnlWW";

async function putWf(wf, { rename, settingsPatch, schedulePatch } = {}) {
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  Object.assign(settings, settingsPatch || {});
  if (schedulePatch) schedulePatch(wf.nodes);
  const body = JSON.stringify({ name: rename || wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  const wasActive = wf.active;
  if (wasActive) await fetch(`${B}/workflows/${wf.id}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${wf.id}`, { method:"PUT", headers:H, body });
  if (put.status >= 300) { console.log(`  PUT ${wf.name}: ${put.status} — ${(await put.text()).slice(0,200)}`); return false; }
  if (wasActive) await fetch(`${B}/workflows/${wf.id}/activate`, { method:"POST", headers:H, body:"{}" });
  return true;
}

(async () => {
  const list = (await fetch(`${B}/workflows?limit=100`, { headers: H }).then(r => r.json())).data;

  // 1. deactivate stubs
  for (const id of ["LVizXPb2HP2o1eVW","d3a7Esig0glU7A9B"]) {
    const r = await fetch(`${B}/workflows/${id}/deactivate`, { method:"POST", headers:H, body:"{}" });
    console.log(`stub ${id} deactivated: ${r.status}`);
  }

  // 2. WF-24 -> hourly
  const wf24 = await fetch(`${B}/workflows/ijOOJ75qBU4kUyJ8`, { headers: H }).then(r => r.json());
  const ok24 = await putWf(wf24, {
    rename: "TAWD - WF-24 Expired Payment Link Cleanup (hourly)",
    settingsPatch: { errorWorkflow: ERR_ID },
    schedulePatch: (nodes) => {
      const t = nodes.find(n => n.type === "n8n-nodes-base.scheduleTrigger");
      t.parameters.rule = { interval: [{ field: "hours", hoursInterval: 1 }] };
    },
  });
  console.log(`WF-24 hourly: ${ok24}`);

  // 3. errorWorkflow on all active workflows missing it (skip ErrorHandler + the stubs just deactivated)
  const skip = new Set([ERR_ID, "LVizXPb2HP2o1eVW", "d3a7Esig0glU7A9B", "ijOOJ75qBU4kUyJ8"]);
  for (const w of list.filter(x => x.active && !skip.has(x.id) && x.settings?.errorWorkflow !== ERR_ID)) {
    const full = await fetch(`${B}/workflows/${w.id}`, { headers: H }).then(r => r.json());
    const ok = await putWf(full, { settingsPatch: { errorWorkflow: ERR_ID } });
    console.log(`errorWorkflow -> ${w.name}: ${ok}`);
  }

  // 4. archive superseded WIPs (inactive, rename only)
  const renames = {
    yuvFcZgDnBXZMwxB: "TAWD - [ARCHIVED] WF-19 Re-engagement Campaign Engine (superseded by WF-Recall + WF-Winback)",
    BCL1vP4d3khMinjJ: "TAWD - [ARCHIVED] WF-23 Workflow Health Monitor (superseded by WF-ErrorHandler)",
  };
  for (const [id, name] of Object.entries(renames)) {
    const full = await fetch(`${B}/workflows/${id}`, { headers: H }).then(r => r.json());
    const ok = await putWf(full, { rename: name });
    console.log(`archived ${name.slice(0,60)}: ${ok}`);
  }

  console.log("✓ cleanup complete");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
