// WF-Winback: recover patients who no-showed or cancelled a recent appointment and never rebooked.
// Daily: find a no_show/cancelled appt in the last 45 days, with NO upcoming appt and NO completed
// visit since the miss, not win-backed in 45 days -> send a warm re-engagement -> patient replies ->
// Sura books. Excludes test-cleanup cancellations. Marks patients.last_winback_at (new column).
import { randomUUID } from "crypto";
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };

const SQL =
"WITH miss AS (" +
"  SELECT a.patient_id, a.clinic_id, max(a.slot_time) AS missed_at " +
"  FROM public.appointments a " +
"  WHERE a.deleted_at IS NULL AND a.status IN ('no_show','cancelled') " +
"    AND a.slot_time > now() - interval '45 days' AND a.slot_time < now() " +
"    AND COALESCE(a.cancellation_reason,'') NOT ILIKE '%اختبار%' " +
"  GROUP BY a.patient_id, a.clinic_id" +
"), " +
"cand AS (" +
"  SELECT m.patient_id, m.clinic_id, p.phone, p.name, m.missed_at " +
"  FROM miss m JOIN public.patients p ON p.id=m.patient_id " +
"  WHERE p.deleted_at IS NULL AND p.phone IS NOT NULL AND btrim(p.phone) <> '' " +
"    AND (p.last_winback_at IS NULL OR p.last_winback_at < now() - interval '45 days') " +
"    AND NOT EXISTS (SELECT 1 FROM public.appointments up WHERE up.patient_id=m.patient_id AND up.deleted_at IS NULL AND up.status IN ('scheduled','confirmed') AND up.slot_time > now()) " +
"    AND NOT EXISTS (SELECT 1 FROM public.appointments c WHERE c.patient_id=m.patient_id AND c.status='completed' AND c.slot_time > m.missed_at)" +
"), " +
"mark AS (UPDATE public.patients SET last_winback_at=now() WHERE id IN (SELECT patient_id FROM cand) RETURNING id) " +
"SELECT c.patient_id::text AS patient_id, c.clinic_id::text AS clinic_id, c.phone, c.name, " +
"  cc.config->>'access_token' AS wa_token, cc.config->>'phone_number_id' AS phone_number_id " +
"FROM cand c JOIN public.channel_configs cc ON cc.clinic_id=c.clinic_id AND cc.channel='whatsapp' AND cc.is_active=true LIMIT 50;";

const SEND = String.raw`const rows = $input.all();
const out = [];
for (const it of rows) {
  const r = it.json || {};
  if (!r.phone || !r.wa_token || !r.phone_number_id) { out.push({ json:{ patient_id:r.patient_id, skipped:true } }); continue; }
  const name = (r.name && !/واتساب|whatsapp|مريض/i.test(r.name)) ? r.name : '';
  const msg = 'مرحباً ' + (name ? name + ' ' : '') + '🌿\n\nلاحظنا إنك ما قدرت تكمّل موعدك السابق في عيادة طود للأسنان، ونتمنى إنك بخير. صحّة أسنانك تهمّنا، ويسعدنا نرتّب لك موعداً جديداً يناسبك.\n\nتحب نحجز لك؟ ردّ علينا وأنا سُرى بخدمتك 🦷';
  try {
    await this.helpers.httpRequest({ method:'POST', url:'https://graph.facebook.com/v21.0/' + r.phone_number_id + '/messages', headers:{ Authorization:'Bearer ' + r.wa_token, 'Content-Type':'application/json' }, body: JSON.stringify({ messaging_product:'whatsapp', to:String(r.phone).replace('+',''), type:'text', text:{ body: msg } }) });
    out.push({ json:{ patient_id:r.patient_id, sent:true } });
  } catch(e){ out.push({ json:{ patient_id:r.patient_id, sent:false, err:String((e&&e.message)||e).slice(0,150) } }); }
}
return out.length ? out : [{ json:{ note:'no winbacks this run' } }];`;

const nSched = randomUUID(), nQuery = randomUUID(), nSend = randomUUID();
const nodes = [
  { id: nSched, name: "Daily", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [260, 300], parameters: { rule: { interval: [{ field: "hours", hoursInterval: 24 }] } } },
  { id: nQuery, name: "Find Winback Candidates", type: "n8n-nodes-base.postgres", typeVersion: 2, position: [480, 300], credentials: { postgres: { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" } }, parameters: { operation: "executeQuery", query: SQL, options: {} } },
  { id: nSend, name: "Send Winback", type: "n8n-nodes-base.code", typeVersion: 2, position: [700, 300], parameters: { jsCode: SEND } },
];
const connections = {
  "Daily": { main: [[{ node: "Find Winback Candidates", type: "main", index: 0 }]] },
  "Find Winback Candidates": { main: [[{ node: "Send Winback", type: "main", index: 0 }]] },
};

(async () => {
  const body = JSON.stringify({ name: "TAWD - WF-Winback No-Show Recovery", nodes, connections, settings: { executionOrder: "v1" } });
  const res = await fetch(`${B}/workflows`, { method: "POST", headers: H, body });
  const j = await res.json();
  if (!j.id) { console.error("create failed:", JSON.stringify(j).slice(0,400)); process.exit(1); }
  console.log("created WF-Winback id:", j.id);
  const act = await fetch(`${B}/workflows/${j.id}/activate`, { method: "POST", headers: H, body: "{}" });
  console.log("activate:", act.status);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
