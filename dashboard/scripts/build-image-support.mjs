// Extend Sura's media branch to also understand IMAGES (X-rays, reports, tooth photos).
// Generalizes the existing voice branch: Parse audio+image -> Get WA Token -> Process Media (Gemini vision/audio).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const PARSE = String.raw`const raw  = $input.first().json;
const body = raw.body || raw;
const entry  = (body.entry || [])[0];
const change = (entry && entry.changes || [])[0];
const value  = change && change.value;
const msgs   = (value && value.messages) || [];
if (!msgs.length) return [{ json: { type: 'status_update' } }];
const msg = msgs[0];
const common = {
  type: 'message', phone: '+' + msg.from, raw_from: msg.from, message_id: msg.id,
  sender_name: ((value && value.contacts) || [])[0] && ((value.contacts)[0].profile||{}).name || '',
  timestamp: msg.timestamp, phone_number_id: (value && value.metadata && value.metadata.phone_number_id) || '',
  channel: 'whatsapp', waba_id: (entry && entry.id) || ''
};
if (msg.type === 'text')  return [{ json: { ...common, message_text: msg.text.body, needs_media: false } }];
if (msg.type === 'audio') return [{ json: { ...common, message_text: '', needs_media: true, media_kind: 'audio', media_id: (msg.audio||{}).id, media_mime: (msg.audio||{}).mime_type || 'audio/ogg' } }];
if (msg.type === 'image') return [{ json: { ...common, message_text: (msg.image||{}).caption || '', needs_media: true, media_kind: 'image', media_id: (msg.image||{}).id, media_mime: (msg.image||{}).mime_type || 'image/jpeg' } }];
return [{ json: { type: 'unsupported_media', from: '+' + msg.from, media_type: msg.type } }];`;

const PROCESS = String.raw`const c = $('Resolve Clinic ID').first().json;
const wa = $('Get WA Token').first().json;
const token = wa.access_token; const GKEY = wa.gemini_key;
try {
  const meta = await this.helpers.httpRequest({ method:'GET', url:'https://graph.facebook.com/v21.0/' + c.media_id, headers:{ Authorization:'Bearer ' + token }, json:true });
  const bin = await this.helpers.httpRequest({ method:'GET', url: meta.url, headers:{ Authorization:'Bearer ' + token }, encoding:'arraybuffer' });
  const buf = Buffer.isBuffer(bin) ? bin : Buffer.from(bin);
  const b64 = buf.toString('base64');
  const mime = String(meta.mime_type || c.media_mime || '').split(';')[0];
  const isImg = (c.media_kind === 'image') || mime.indexOf('image') === 0;
  const prompt = isImg
    ? 'المريض أرسل صورة إلى عيادة أسنان. صِف بإيجاز ووضوح بالعربية ما يظهر فيها فقط (إن كانت أشعة/سنّاً/تقريراً فاذكر نوعها وأي ملاحظة ظاهرة بشكل موضوعي). ممنوع التشخيص أو اقتراح علاج — وصف موضوعي قصير فقط.'
    : 'فرّغ هذه الرسالة الصوتية إلى نص عربي فقط، بدون أي تعليق أو مقدمة.';
  const payload = JSON.stringify({ contents:[{ parts:[ { text: prompt }, { inline_data:{ mime_type: (mime || (isImg ? 'image/jpeg' : 'audio/ogg')), data: b64 } } ] }] });
  const rawResp = await this.helpers.httpRequest({ method:'POST', url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GKEY, headers:{ 'Content-Type':'application/json' }, body: payload });
  const resp = (typeof rawResp === 'string') ? JSON.parse(rawResp) : rawResp;
  const out = (((((resp.candidates||[])[0]||{}).content||{}).parts||[])[0] || {}).text || '';
  const msg = isImg
    ? ('(أرسل المريض صورة) ' + (c.message_text ? c.message_text + ' — ' : '') + 'وصف الصورة: ' + (out.trim() || 'صورة غير واضحة'))
    : (out.trim() || 'رسالة صوتية غير واضحة، ممكن تكتبها؟');
  return [{ json: { ...c, message_text: msg, media_processed: true } }];
} catch (e) {
  const isImg = c.media_kind === 'image';
  return [{ json: { ...c, message_text: isImg ? '(أرسل المريض صورة) — تعذّر تحليلها، اشكري المريض واعرضي عرضها على الطبيب أو حجز موعد.' : 'ما قدرت أفهم الرسالة الصوتية، ممكن تكتبها لو سمحت؟', media_processed:false, media_error: String((e && e.message) || e).slice(0,300) } }];
}`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const g = n => wf.nodes.find(x => x.name === n);
  g("Parse Request").parameters.jsCode = PARSE;
  g("Transcribe Voice").parameters.jsCode = PROCESS;              // node kept its name; now handles audio+image
  const iff = g("Is Voice?");
  iff.parameters.conditions.conditions[0].leftValue = "={{ $json.needs_media }}";

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,400)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Sura now understands images too (audio + image media branch)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
