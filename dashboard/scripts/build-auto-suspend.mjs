// WF-AutoSuspend: daily 08:00 Muscat — subscriptions past due (3-day grace,
// covers both expired trials and unpaid renewals) → suspend subscription +
// clinic, then WhatsApp the clinic owner a renewal nudge via the platform
// sender (config from DB, nothing hardcoded). Rows only when action happens.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const PG_CRED = { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" };
const ERR_ID = "W8N7vDeYzuZLnlWW";

const SQL = `WITH cfg AS (
  SELECT config->>'access_token' AS token, config->>'phone_number_id' AS pnid
  FROM public.channel_configs WHERE channel='whatsapp' AND is_active LIMIT 1
),
due AS (
  SELECT s.clinic_id FROM public.tawd_subscriptions s
  WHERE (s.status='active' AND s.current_period_end IS NOT NULL AND s.current_period_end < now() - interval '3 days')
     OR (s.status='trial'  AND s.trial_ends_at     IS NOT NULL AND s.trial_ends_at     < now() - interval '3 days')
),
u1 AS (
  UPDATE public.tawd_subscriptions SET status='suspended', updated_at=now()
  WHERE clinic_id IN (SELECT clinic_id FROM due) RETURNING clinic_id
),
u2 AS (
  UPDATE public.tawd_clinics SET status='suspended', updated_at=now()
  WHERE id IN (SELECT clinic_id FROM due) RETURNING id, COALESCE(name_ar,name) AS clinic_name, phone
)
SELECT u2.clinic_name, u2.phone, cfg.token, cfg.pnid FROM u2 CROSS JOIN cfg;`;

const CODE = String.raw`const out = [];
for (const it of $input.all()) {
  const j = it.json;
  const to = String(j.phone || '').replace(/\D/g, '');
  if (!to || !j.token || !j.pnid) continue;
  out.push({ json: {
    token: j.token,
    pnid: j.pnid,
    payload: {
      messaging_product: 'whatsapp', to, type: 'text',
      text: { body: '⚠️ عزيزي شريكنا في ' + j.clinic_name + '،\nانتهى اشتراككم في منصة طود وتم إيقاف الخدمة مؤقتاً (سُرى ولوحة التحكم).\nللتجديد وإعادة التفعيل خلال دقائق، ردّوا على هذه الرسالة وسنخدمكم فوراً 🌿' }
    }
  }});
}
return out;`;

const wf = {
  name: "TAWD - WF-AutoSuspend Expired Subscriptions (daily)",
  settings: { executionOrder: "v1", errorWorkflow: ERR_ID, timezone: "Asia/Muscat" },
  nodes: [
    { id: "t1", name: "Daily 08:00", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [0, 0],
      parameters: { rule: { interval: [{ field: "days", triggerAtHour: 8 }] } } },
    { id: "p1", name: "Suspend Due Clinics", type: "n8n-nodes-base.postgres", typeVersion: 2, position: [220, 0],
      credentials: { postgres: PG_CRED },
      parameters: { operation: "executeQuery", query: SQL, options: {} } },
    { id: "c1", name: "Build WhatsApp Nudges", type: "n8n-nodes-base.code", typeVersion: 2, position: [440, 0],
      parameters: { jsCode: CODE } },
    { id: "h1", name: "Send Renewal WhatsApp", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [660, 0],
      onError: "continueRegularOutput",
      parameters: {
        method: "POST",
        url: "={{ 'https://graph.facebook.com/v20.0/' + $json.pnid + '/messages' }}",
        sendHeaders: true,
        headerParameters: { parameters: [{ name: "Authorization", value: "={{ 'Bearer ' + $json.token }}" }] },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={{ JSON.stringify($json.payload) }}",
        options: {},
      } },
  ],
  connections: {
    "Daily 08:00": { main: [[{ node: "Suspend Due Clinics", type: "main", index: 0 }]] },
    "Suspend Due Clinics": { main: [[{ node: "Build WhatsApp Nudges", type: "main", index: 0 }]] },
    "Build WhatsApp Nudges": { main: [[{ node: "Send Renewal WhatsApp", type: "main", index: 0 }]] },
  },
};

(async () => {
  const existing = await fetch(`${B}/workflows?limit=100`, { headers: H }).then(r => r.json());
  if (existing.data.some(w => w.name === wf.name)) { console.log("already exists — aborting"); process.exit(0); }
  const res = await fetch(`${B}/workflows`, { method: "POST", headers: H, body: JSON.stringify(wf) });
  const j = await res.json();
  if (res.status >= 300) { console.error("CREATE FAILED:", JSON.stringify(j).slice(0, 300)); process.exit(1); }
  await fetch(`${B}/workflows/${j.id}/activate`, { method: "POST", headers: H, body: "{}" });
  console.log("✓ WF-AutoSuspend created + activated:", j.id);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
