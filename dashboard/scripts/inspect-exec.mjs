const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const headers = { "X-N8N-API-KEY": KEY };

(async () => {
  const list = await fetch(`${B}/executions?workflowId=${ID}&limit=1`, { headers }).then(r => r.json());
  const ex = list.data?.[0];
  if (!ex) { console.log("no executions"); return; }
  console.log("execution id:", ex.id, "| status:", ex.status, "| startedAt:", ex.startedAt);

  const full = await fetch(`${B}/executions/${ex.id}?includeData=true`, { headers }).then(r => r.json());
  const rd = full.data?.resultData;
  console.log("lastNodeExecuted:", rd?.lastNodeExecuted);
  if (rd?.error) {
    console.log("ERROR node:", rd.error.node?.name);
    console.log("ERROR message:", rd.error.message);
    console.log("ERROR description:", (rd.error.description || "").slice(0, 300));
  }
  // Per-node statuses
  const runData = rd?.runData || {};
  for (const [name, runs] of Object.entries(runData)) {
    const r = runs[runs.length - 1];
    if (r?.error) console.log(`  ✗ ${name}: ${r.error.message}`);
  }
})();
