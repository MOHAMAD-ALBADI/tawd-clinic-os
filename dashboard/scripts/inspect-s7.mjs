const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "dK1T85wRcr8XPZSO"; // S7 Push to HITL
const headers = { "X-N8N-API-KEY": KEY };

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers }).then(r => r.json());
  for (const n of wf.nodes) {
    if (n.type?.includes("supabase") || /HITL|Queue|Insert/i.test(n.name)) {
      console.log("=== NODE:", n.name, "| type:", n.type, "===");
      console.log(JSON.stringify(n.parameters, null, 1).slice(0, 1500));
    }
  }
})();
