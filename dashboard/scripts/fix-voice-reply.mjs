// Fix Voice Reply: (1) female Arabic voice (ar-XA-Wavenet-D), (2) build the Meta media multipart
// upload MANUALLY as a raw Buffer body (n8n's formData helper produced a 400), (3) capture which
// step fails for diagnostics.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const CODE = String.raw`let mk = '';
try { const tv = $('Transcribe Voice').first(); mk = (tv && tv.json && tv.json.media_kind) || ''; } catch(e) {}
if (mk !== 'audio') return [{ json: { voice_reply: false, reason: 'not a voice turn' } }];

let text = '';
try { const fb = $('Format Booking Reply').first(); if (fb && fb.json && fb.json.message_text) text = fb.json.message_text; } catch(e) {}
if (!text) { try { const ss = $('Set Sender Sura').first(); if (ss && ss.json && ss.json.message_text) text = ss.json.message_text; } catch(e) {} }
if (!text) return [{ json: { voice_reply: false, reason: 'no reply text' } }];

const rc = $('Resolve Clinic ID').first().json;
const wa = $('Get WA Token').first().json;
const token = wa.access_token, ttsKey = wa.gcp_tts_key;
const pnid = rc.phone_number_id;
const to = String(rc.phone || '').replace('+','') || rc.raw_from;
if (!ttsKey || !token || !pnid || !to) return [{ json: { voice_reply: false, reason: 'missing creds' } }];

const speak = String(text)
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
  .replace(/[•*_#>]/g, ' ').replace(/[ \t]{2,}/g, ' ').trim().slice(0, 900);
if (!speak) return [{ json: { voice_reply: false, reason: 'empty after clean' } }];

let step = 'tts';
try {
  // 1) Google Cloud TTS -> OGG_OPUS (FEMALE voice)
  const ttsBody = JSON.stringify({ input: { text: speak }, voice: { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-D' }, audioConfig: { audioEncoding: 'OGG_OPUS' } });
  const ttsResp = await this.helpers.httpRequest({ method: 'POST', url: 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + ttsKey, headers: { 'Content-Type': 'application/json' }, body: ttsBody });
  const tj = (typeof ttsResp === 'string') ? JSON.parse(ttsResp) : ttsResp;
  if (!tj.audioContent) return [{ json: { voice_reply: false, reason: 'tts no audio', detail: JSON.stringify(tj).slice(0,200) } }];
  const buf = Buffer.from(tj.audioContent, 'base64');

  // 2) upload to Meta media — MANUAL multipart as raw Buffer
  step = 'upload';
  const boundary = '----tawd' + Date.now();
  const CRLF = '\r\n';
  const pre = Buffer.from(
    '--' + boundary + CRLF + 'Content-Disposition: form-data; name="messaging_product"' + CRLF + CRLF + 'whatsapp' + CRLF +
    '--' + boundary + CRLF + 'Content-Disposition: form-data; name="type"' + CRLF + CRLF + 'audio/ogg' + CRLF +
    '--' + boundary + CRLF + 'Content-Disposition: form-data; name="file"; filename="reply.ogg"' + CRLF + 'Content-Type: audio/ogg' + CRLF + CRLF, 'utf8');
  const post = Buffer.from(CRLF + '--' + boundary + '--' + CRLF, 'utf8');
  const multipart = Buffer.concat([pre, buf, post]);
  const up = await this.helpers.httpRequest({ method: 'POST', url: 'https://graph.facebook.com/v21.0/' + pnid + '/media', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'multipart/form-data; boundary=' + boundary }, body: multipart });
  const uj = (typeof up === 'string') ? JSON.parse(up) : up;
  if (!uj.id) return [{ json: { voice_reply: false, reason: 'no media id', detail: JSON.stringify(uj).slice(0,200) } }];

  // 3) send audio message
  step = 'send';
  const sendBody = JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to, type: 'audio', audio: { id: uj.id } });
  await this.helpers.httpRequest({ method: 'POST', url: 'https://graph.facebook.com/v21.0/' + pnid + '/messages', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: sendBody });
  return [{ json: { voice_reply: true, media_id: uj.id } }];
} catch (e) {
  const body = (e && e.response && (e.response.body || e.response.data)) || '';
  return [{ json: { voice_reply: false, failed_step: step, error: String((e && e.message) || e).slice(0, 200), detail: (typeof body==='string'?body:JSON.stringify(body)).slice(0,300) } }];
}`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const n = wf.nodes.find(x => x.name === "Voice Reply (TTS)");
  if (!n) { console.error("Voice Reply node missing"); process.exit(1); }
  n.parameters.jsCode = CODE;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Voice reply fixed (female voice + manual multipart upload + step diagnostics)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
