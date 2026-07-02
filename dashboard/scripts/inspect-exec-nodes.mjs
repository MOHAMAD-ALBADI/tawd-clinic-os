const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const headers = { "X-N8N-API-KEY": KEY };
(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  for (const n of wf.nodes) {
    if ((n.type || "").includes("executeWorkflow")) {
      const wid = n.parameters?.workflowId;
      console.log(`"${n.name}" -> workflowId =`, typeof wid === "object" ? JSON.stringify(wid) : wid);
    }
  }
})();
