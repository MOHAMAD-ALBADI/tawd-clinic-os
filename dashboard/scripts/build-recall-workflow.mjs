// WF-Recall: proactive dental recall. Daily, find patients whose last COMPLETED visit was 150-400
// days ago, who have NO upcoming appointment and weren't recalled in the last 90 days, and send a
// WhatsApp "time for your checkup" message. Patient replies -> Sura books normally. Marks
// patients.last_recalled_at in the same SQL (data-modifying CTE) to avoid re-sending.
import { randomUUID } from "crypto";
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const SQL =
"WITH cand AS (" +
"  SELECT p.id AS patient_id, p.clinic_id, p.phone, p.name, " +
"    (SELECT max(a.slot_time) FROM public.appointments a WHERE a.patient_id=p.id AND a.status='completed') AS last_visit " +
"  FROM public.patients p " +
"  WHERE p.deleted_at IS NULL AND p.phone IS NOT NULL AND btrim(p.phone) <> '' " +
"    AND (p.last_recalled_at IS NULL OR p.last_recalled_at < now() - interval '90 days') " +
"    AND NOT EXISTS (SELECT 1 FROM public.appointments up WHERE up.patient_id=p.id AND up.deleted_at IS NULL AND up.status IN ('scheduled','confirmed') AND up.slot_time > now())" +
"), " +
"due AS (SELECT * FROM cand WHERE last_visit IS NOT NULL AND last_visit < now() - interval '150 days' AND last_visit > now() - interval '400 days'), " +
"mark AS (UPDATE public.patients SET last_recalled_at=now() WHERE id IN (SELECT patient_id FROM due) RETURNING id) " +
"SELECT d.patient_id::text AS patient_id, d.clinic_id::text AS clinic_id, d.phone, d.name, " +
"  cc.config->>'access_token' AS wa_token, cc.config->>'phone_number_id' AS phone_number_id " +
"FROM due d JOIN public.channel_configs cc ON cc.clinic_id=d.clinic_id AND cc.channel='whatsapp' AND cc.is_active=true LIMIT 50;";

const SEND = String.raw`const rows = $input.all();
const out = [];
for (const it of rows) {
  const r = it.json || {};
  if (!r.phone || !r.wa_token || !r.phone_number_id) { out.push({ json:{ patient_id:r.patient_id, skipped:true } }); continue; }
  const name = (r.name && !/واتساب|whatsapp|مريض/i.test(r.name)) ? r.name : '';
  const msg = 'مرحباً ' + (name ? name + ' ' : '') + '🌿\n\nمضى وقت على آخر زيارة لك لعيادة طود للأسنان. للحفاظ على صحة أسنانك وابتسامتك، ننصح بفحص وتنظيف دوري كل ٦ أشهر.\n\nتحب نحجز لك موعد؟ ردّ علينا وأنا سُرى بخدمتك 🦷';
  try {
    await this.helpers.httpRequest({ method:'POST', url:'https://graph.facebook.com/v21.0/' + r.phone_number_id + '/messages', headers:{ Authorization:'Bearer ' + r.wa_token, 'Content-Type':'application/json' }, body: JSON.stringify({ messaging_product:'whatsapp', to:String(r.phone).replace('+',''), type:'text', text:{ body: msg } }) });
    out.push({ json:{ patient_id:r.patient_id, sent:true } });
  } catch(e){ out.push({ json:{ patient_id:r.patient_id, sent:false, err:String((e&&e.message)||e).slice(0,150) } }); }
}
return out.length ? out : [{ json:{ note:'no recalls this run' } }];`;

const nSched = randomUUID(), nQuery = randomUUID(), nSend = randomUUID();
const nodes = [
  { id: nSched, name: "Daily", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [260, 300], parameters: { rule: { interval: [{ field: "hours", hoursInterval: 24 }] } } },
  { id: nQuery, name: "Find Recall Candidates", type: "n8n-nodes-base.postgres", typeVersion: 2, position: [480, 300], credentials: { postgres: { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" } }, parameters: { operation: "executeQuery", query: SQL, options: {} } },
  { id: nSend, name: "Send Recall", type: "n8n-nodes-base.code", typeVersion: 2, position: [700, 300], parameters: { jsCode: SEND } },
];
const connections = {
  "Daily": { main: [[{ node: "Find Recall Candidates", type: "main", index: 0 }]] },
  "Find Recall Candidates": { main: [[{ node: "Send Recall", type: "main", index: 0 }]] },
};

(async () => {
  const body = JSON.stringify({ name: "TAWD - WF-Recall Proactive Checkup", nodes, connections, settings: { executionOrder: "v1" } });
  const res = await fetch(`${B}/workflows`, { method: "POST", headers: H, body });
  const j = await res.json();
  if (!j.id) { console.error("create failed:", JSON.stringify(j).slice(0,400)); process.exit(1); }
  console.log("created WF-Recall id:", j.id);
  const act = await fetch(`${B}/workflows/${j.id}/activate`, { method: "POST", headers: H, body: "{}" });
  console.log("activate:", act.status);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
