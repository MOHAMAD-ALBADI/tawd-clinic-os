// WF-Followup: post-visit thank-you + review request. Every 3h, find COMPLETED appointments from
// 3-48h ago not yet followed up, send an AI-personalized warm thank-you with the clinic's Google
// review link appended, and mark appointments.followup_sent_at. Patient replies -> Sura handles.
import { randomUUID } from "crypto";
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };

const SQL =
"WITH due AS (" +
"  SELECT a.id AS appt_id, a.clinic_id, a.patient_id, p.phone, p.name, " +
"    (SELECT COALESCE(s.name, s.name_ar) FROM public.services s WHERE s.id=a.service_id) AS service " +
"  FROM public.appointments a JOIN public.patients p ON p.id=a.patient_id " +
"  WHERE a.status='completed' AND a.deleted_at IS NULL AND a.followup_sent_at IS NULL " +
"    AND a.slot_time < now() - interval '3 hours' AND a.slot_time > now() - interval '48 hours' " +
"    AND p.phone IS NOT NULL AND btrim(p.phone) <> ''" +
"), " +
"mark AS (UPDATE public.appointments SET followup_sent_at=now() WHERE id IN (SELECT appt_id FROM due) RETURNING id) " +
"SELECT d.appt_id::text AS appt_id, d.clinic_id::text AS clinic_id, d.phone, d.name, d.service, " +
"  cs.google_review_url AS review_url, " +
"  cc.config->>'access_token' AS wa_token, cc.config->>'phone_number_id' AS phone_number_id, cc.config->>'gemini_key' AS gemini_key " +
"FROM due d JOIN public.channel_configs cc ON cc.clinic_id=d.clinic_id AND cc.channel='whatsapp' AND cc.is_active=true " +
"LEFT JOIN public.tawd_clinic_settings cs ON cs.clinic_id=d.clinic_id LIMIT 50;";

const SEND = String.raw`const rows = $input.all();
const out = [];
for (const it of rows) {
  const r = it.json || {};
  if (!r.phone || !r.wa_token || !r.phone_number_id) { out.push({ json:{ appt_id:r.appt_id, skipped:true } }); continue; }
  const name = (r.name && !/واتساب|whatsapp|مريض/i.test(r.name)) ? r.name : '';
  let body = '';
  if (r.gemini_key) {
    try {
      const prompt = 'أنت موظف استقبال لطيف في «عيادة طود للأسنان» بسلطنة عُمان. اكتب رسالة واتساب قصيرة جداً (سطران كحد أقصى) دافئة وراقية تشكر المريض على زيارته اليوم' + (r.service ? (' لخدمة ' + r.service) : '') + '، تطمئن على راحته، وتلمّح بلطف أنك تسعد برأيه في التجربة. ممنوع وضع أي رابط أو أرقام أو أسعار. استخدم اسم المريض إن توفّر. إيموجي واحد كحد أقصى. أخرج نص الرسالة فقط.\n\nاسم المريض: ' + (name || 'غير معروف');
      const resp = await this.helpers.httpRequest({ method:'POST', url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + r.gemini_key, headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ contents:[{ parts:[{ text: prompt }] }], generationConfig:{ temperature:0.8, maxOutputTokens:400, thinkingConfig:{ thinkingBudget:0 } } }) });
      const j = (typeof resp === 'string') ? JSON.parse(resp) : resp;
      body = String(j.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    } catch(e) {}
  }
  if (!body) body = 'مرحباً ' + (name ? name + ' ' : '') + '🌿 شكراً لزيارتك اليوم عيادة طود للأسنان، نتمنى أنك بأتم الراحة. رأيك يهمّنا كثيراً!';
  const msg = body + (r.review_url ? ('\n\nيسعدنا تقييمك لتجربتك ⭐:\n' + r.review_url) : '');
  try {
    await this.helpers.httpRequest({ method:'POST', url:'https://graph.facebook.com/v21.0/' + r.phone_number_id + '/messages', headers:{ Authorization:'Bearer ' + r.wa_token, 'Content-Type':'application/json' }, body: JSON.stringify({ messaging_product:'whatsapp', to:String(r.phone).replace('+',''), type:'text', text:{ body: msg } }) });
    out.push({ json:{ appt_id:r.appt_id, sent:true } });
  } catch(e){ out.push({ json:{ appt_id:r.appt_id, sent:false, err:String((e&&e.message)||e).slice(0,150) } }); }
}
return out.length ? out : [{ json:{ note:'no followups this run' } }];`;

const nSched = randomUUID(), nQuery = randomUUID(), nSend = randomUUID();
const nodes = [
  { id: nSched, name: "Every 3h", type: "n8n-nodes-base.scheduleTrigger", typeVersion: 1.2, position: [260, 300], parameters: { rule: { interval: [{ field: "hours", hoursInterval: 3 }] } } },
  { id: nQuery, name: "Find Followup Candidates", type: "n8n-nodes-base.postgres", typeVersion: 2, position: [480, 300], credentials: { postgres: { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" } }, parameters: { operation: "executeQuery", query: SQL, options: {} } },
  { id: nSend, name: "Send Followup", type: "n8n-nodes-base.code", typeVersion: 2, position: [700, 300], parameters: { jsCode: SEND } },
];
const connections = {
  "Every 3h": { main: [[{ node: "Find Followup Candidates", type: "main", index: 0 }]] },
  "Find Followup Candidates": { main: [[{ node: "Send Followup", type: "main", index: 0 }]] },
};

(async () => {
  const body = JSON.stringify({ name: "TAWD - WF-Followup Post-Visit Review", nodes, connections, settings: { executionOrder: "v1" } });
  const res = await fetch(`${B}/workflows`, { method: "POST", headers: H, body });
  const j = await res.json();
  if (!j.id) { console.error("create failed:", JSON.stringify(j).slice(0,400)); process.exit(1); }
  console.log("created WF-Followup id:", j.id);
  const act = await fetch(`${B}/workflows/${j.id}/activate`, { method: "POST", headers: H, body: "{}" });
  console.log("activate:", act.status);
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
