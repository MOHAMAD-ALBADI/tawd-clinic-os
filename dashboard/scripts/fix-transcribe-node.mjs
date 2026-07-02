// Harden the Transcribe Voice node: robust binary handling, Gemini call mirrored to the
// working manual request (stringified body), try/catch that captures the real error + graceful fallback.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const TRANSCRIBE = String.raw`const c = $('Resolve Clinic ID').first().json;
const wa = $('Get WA Token').first().json;
const token = wa.access_token; const GKEY = wa.gemini_key;
try {
  const meta = await this.helpers.httpRequest({ method:'GET', url:'https://graph.facebook.com/v21.0/' + c.audio_id, headers:{ Authorization:'Bearer ' + token }, json:true });
  const bin = await this.helpers.httpRequest({ method:'GET', url: meta.url, headers:{ Authorization:'Bearer ' + token }, encoding:'arraybuffer' });
  const buf = Buffer.isBuffer(bin) ? bin : Buffer.from(bin);
  const b64 = buf.toString('base64');
  const mime = String(meta.mime_type || 'audio/ogg').split(';')[0];
  const payload = JSON.stringify({ contents:[{ parts:[ { text:'فرّغ هذه الرسالة الصوتية إلى نص عربي فقط، بدون أي تعليق أو مقدمة.' }, { inline_data:{ mime_type: mime, data: b64 } } ] }] });
  const raw = await this.helpers.httpRequest({ method:'POST', url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GKEY, headers:{ 'Content-Type':'application/json' }, body: payload });
  const resp = (typeof raw === 'string') ? JSON.parse(raw) : raw;
  const text = (((((resp.candidates||[])[0]||{}).content||{}).parts||[])[0] || {}).text || '';
  return [{ json: { ...c, message_text: (text.trim() || 'ما قدرت أفهم الرسالة الصوتية، ممكن تكتبها؟'), transcribed:true } }];
} catch (e) {
  const msg = String((e && (e.message || e.description)) || e);
  let body = '';
  try { body = e && e.response && e.response.body ? (typeof e.response.body==='string'? e.response.body : JSON.stringify(e.response.body)) : ''; } catch(_){}
  return [{ json: { ...c, message_text:'ما قدرت أفهم الرسالة الصوتية، ممكن تكتبها لو سمحت؟ 🌷', transcribed:false, voice_error: (msg + ' || ' + body).slice(0,500) } }];
}`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const node = wf.nodes.find(n => n.name === "Transcribe Voice");
  if (!node) { console.log("Transcribe Voice not found"); process.exit(1); }
  node.parameters.jsCode = TRANSCRIBE;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status);
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Transcribe Voice hardened (mirrors working request + error capture)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
