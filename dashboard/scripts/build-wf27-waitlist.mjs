// WF-27 Waitlist Auto-Fill: scheduled — find freed (cancelled) future slots, match a waiting
// patient, atomically mark 'offered', and send a Sura WhatsApp offer. Self-contained (no WF-05 touch).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const PG = { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" };

const CLAIM_SQL = "=" + [
"WITH freed AS (",
"  SELECT a.id AS appt_id, a.clinic_id, a.doctor_id, a.service_id, a.slot_time",
"  FROM public.appointments a",
"  WHERE a.status IN ('cancelled','no_show') AND a.deleted_at IS NULL",
"    AND a.slot_time > now() AND a.cancelled_at > now() - interval '3 hours'",
"    AND NOT EXISTS (SELECT 1 FROM public.appointment_waitlist w WHERE w.offered_appt_id = a.id)",
"    AND NOT EXISTS (SELECT 1 FROM public.appointments b WHERE b.clinic_id=a.clinic_id AND b.doctor_id=a.doctor_id AND b.slot_time=a.slot_time AND b.deleted_at IS NULL AND b.status NOT IN ('cancelled','no_show'))",
"),",
"pick AS (",
"  SELECT DISTINCT ON (w.id) f.appt_id, f.clinic_id, f.slot_time, f.service_id AS freed_service, w.id AS waitlist_id, w.patient_id, w.service_id AS want_service",
"  FROM freed f JOIN public.appointment_waitlist w ON w.clinic_id=f.clinic_id AND w.status='waiting' AND (w.service_id=f.service_id OR w.service_id IS NULL OR f.service_id IS NULL)",
"  ORDER BY w.id, w.priority DESC, w.created_at ASC",
"),",
"claim AS (",
"  UPDATE public.appointment_waitlist w SET status='offered', offered_slot_time=p.slot_time, offered_appt_id=p.appt_id, offer_expires_at=now()+interval '30 minutes'",
"  FROM pick p WHERE w.id=p.waitlist_id",
"  RETURNING w.id AS waitlist_id, w.clinic_id, w.patient_id, w.offered_slot_time AS slot_time, COALESCE(w.service_id,p.freed_service) AS service_id",
")",
"SELECT c.waitlist_id, c.clinic_id::text, c.patient_id::text, c.slot_time::text, pt.phone, pt.name AS patient_name, s.name_ar AS service_ar,",
"       cc.config->>'access_token' AS wa_token, cc.config->>'phone_number_id' AS phone_number_id",
"FROM claim c JOIN public.patients pt ON pt.id=c.patient_id LEFT JOIN public.services s ON s.id=c.service_id",
"JOIN public.channel_configs cc ON cc.clinic_id=c.clinic_id AND cc.channel='whatsapp' AND cc.is_active=true;"
].join("\n");

const SEND = String.raw`const rows = $input.all();
const out = [];
for (const it of rows) {
  const r = it.json || {};
  if (!r.phone || !r.wa_token || !r.phone_number_id) { out.push({ json:{ waitlist_id:r.waitlist_id, skipped:true } }); continue; }
  const d = new Date(r.slot_time);
  const dateAr = new Intl.DateTimeFormat('ar',{timeZone:'Asia/Muscat',weekday:'long',day:'numeric',month:'long'}).format(d);
  const timeAr = new Intl.DateTimeFormat('ar',{timeZone:'Asia/Muscat',hour:'numeric',minute:'2-digit',hour12:true}).format(d);
  const msg = 'يا هلا ' + (r.patient_name||'') + ' 🌿\n\nصار عندنا موعد متاح لـ' + (r.service_ar||'موعدك') + ':\n• ' + dateAr + '\n• الساعة ' + timeAr + '\n\nيناسبك؟ ردّ بـ«نعم» خلال ٣٠ دقيقة ونثبّته لك مباشرة 🌷';
  try {
    await this.helpers.httpRequest({ method:'POST', url:'https://graph.facebook.com/v21.0/' + r.phone_number_id + '/messages', headers:{ Authorization:'Bearer ' + r.wa_token, 'Content-Type':'application/json' }, body: JSON.stringify({ messaging_product:'whatsapp', to:String(r.phone).replace('+',''), type:'text', text:{ body: msg } }) });
    out.push({ json:{ waitlist_id:r.waitlist_id, sent:true } });
  } catch(e){ out.push({ json:{ waitlist_id:r.waitlist_id, sent:false, err:String((e&&e.message)||e).slice(0,150) } }); }
}
return out.length ? out : [{ json:{ note:'no offers this run' } }];`;

const nodes = [
  { id:"wf27-trigger", name:"Every 5 min", type:"n8n-nodes-base.scheduleTrigger", typeVersion:1.2, position:[260,300],
    parameters:{ rule:{ interval:[{ field:"minutes", minutesInterval:5 }] } } },
  { id:"wf27-claim", name:"Claim Offers", type:"n8n-nodes-base.postgres", typeVersion:2, position:[520,300],
    parameters:{ operation:"executeQuery", query: CLAIM_SQL, options:{} }, credentials:{ postgres: PG } },
  { id:"wf27-send", name:"Send Offers", type:"n8n-nodes-base.code", typeVersion:2, position:[780,300],
    parameters:{ jsCode: SEND } },
];
const connections = {
  "Every 5 min": { main:[[{ node:"Claim Offers", type:"main", index:0 }]] },
  "Claim Offers": { main:[[{ node:"Send Offers", type:"main", index:0 }]] },
};

(async () => {
  const create = await fetch(`${B}/workflows`, { method:"POST", headers:H,
    body: JSON.stringify({ name:"TAWD - WF-27 Waitlist Auto-Fill", nodes, connections, settings:{ executionOrder:"v1" } }) });
  const cj = await create.json();
  if (create.status >= 300) { console.log("create FAILED:", create.status, JSON.stringify(cj).slice(0,400)); process.exit(1); }
  console.log("created WF-27 id:", cj.id);
  const act = await fetch(`${B}/workflows/${cj.id}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("activate:", act.status, act.status<300 ? "✓ active (runs every 5 min)" : (await act.text()).slice(0,200));
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
