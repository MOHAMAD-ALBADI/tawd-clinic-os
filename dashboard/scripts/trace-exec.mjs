const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const headers = { "X-N8N-API-KEY": KEY };
(async () => {
  const list = await fetch(`${B}/executions?workflowId=${ID}&limit=1`, { headers }).then(r => r.json());
  const ex = list.data?.[0];
  console.log("execution", ex.id, "| status:", ex.status, "|", ex.startedAt);
  const full = await fetch(`${B}/executions/${ex.id}?includeData=true`, { headers }).then(r => r.json());
  const rd = full.data?.resultData?.runData || {};
  console.log("lastNodeExecuted:", full.data?.resultData?.lastNodeExecuted);
  console.log("--- executed nodes (in order) ---");
  // runData keys aren't strictly ordered; print with any send/reply nodes flagged
  for (const name of Object.keys(rd)) {
    const flag = /S1|Send|Respond|HITL|Valid|Agent|Maintenance/i.test(name) ? "  <<<" : "";
    console.log(" -", name, flag);
  }
})();
