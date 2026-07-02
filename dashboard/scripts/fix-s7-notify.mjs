// S7: replace the $vars.S1_WORKFLOW_ID reference with the literal S1 workflow id.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "dK1T85wRcr8XPZSO"; // S7
const S1 = "0Aq11NOwPChsSzZ8";
const headers = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  for (const n of wf.nodes) {
    if ((n.type || "").includes("executeWorkflow")) {
      const wid = n.parameters?.workflowId;
      const str = typeof wid === "object" ? JSON.stringify(wid) : String(wid);
      if (str.includes("$vars") || str.includes("S1_WORKFLOW_ID") || !str || str === "undefined") {
        n.parameters.workflowId = S1;
        n.continueOnFail = true; // staff notify is non-critical
        console.log("fixed executeWorkflow node:", n.name, "-> ", S1, "(continueOnFail)");
      }
    }
  }
  const settings = {};
  for (const k of ALLOWED) if (wf.settings && wf.settings[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method: "POST", headers, body: "{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method: "PUT", headers, body });
  console.log("PUT:", put.status);
  if (put.status >= 300) console.log("err:", (await put.text()).slice(0, 400));
  const act = await fetch(`${B}/workflows/${ID}/activate`, { method: "POST", headers, body: "{}" });
  console.log("activate:", act.status);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
