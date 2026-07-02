// Voice replies (TTS): when the patient's turn was a VOICE note, after Sura's text reply is sent,
// synthesize her reply to Arabic OGG/Opus via Google Cloud TTS, upload to Meta, and send as a
// WhatsApp audio message. Terminal branch off S1 Send Response + S1 Send Booking (never breaks the
// text send). Gated on Transcribe Voice having run with media_kind='audio' in THIS execution.
import { randomUUID } from "crypto";
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const CODE = String.raw`// only reply with voice if this turn started as a voice note
let mk = '';
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

// clean text for speech: drop emojis, bullets, markdown
const speak = String(text)
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
  .replace(/[•*_#>]/g, ' ')
  .replace(/[ \t]{2,}/g, ' ')
  .trim()
  .slice(0, 900);
if (!speak) return [{ json: { voice_reply: false, reason: 'empty after clean' } }];

try {
  // 1) Google Cloud TTS -> OGG_OPUS
  const ttsBody = JSON.stringify({ input: { text: speak }, voice: { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-B' }, audioConfig: { audioEncoding: 'OGG_OPUS' } });
  const ttsResp = await this.helpers.httpRequest({ method: 'POST', url: 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + ttsKey, headers: { 'Content-Type': 'application/json' }, body: ttsBody });
  const tj = (typeof ttsResp === 'string') ? JSON.parse(ttsResp) : ttsResp;
  if (!tj.audioContent) return [{ json: { voice_reply: false, reason: 'tts no audio', detail: JSON.stringify(tj).slice(0,200) } }];
  const buf = Buffer.from(tj.audioContent, 'base64');

  // 2) upload to Meta media
  const up = await this.helpers.httpRequest({ method: 'POST', url: 'https://graph.facebook.com/v21.0/' + pnid + '/media', headers: { Authorization: 'Bearer ' + token }, formData: { messaging_product: 'whatsapp', type: 'audio/ogg', file: { value: buf, options: { filename: 'reply.ogg', contentType: 'audio/ogg' } } } });
  const uj = (typeof up === 'string') ? JSON.parse(up) : up;
  if (!uj.id) return [{ json: { voice_reply: false, reason: 'no media id', detail: JSON.stringify(uj).slice(0,200) } }];

  // 3) send audio message
  const sendBody = JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to, type: 'audio', audio: { id: uj.id } });
  await this.helpers.httpRequest({ method: 'POST', url: 'https://graph.facebook.com/v21.0/' + pnid + '/messages', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: sendBody });
  return [{ json: { voice_reply: true, media_id: uj.id } }];
} catch (e) {
  return [{ json: { voice_reply: false, error: String((e && e.message) || e).slice(0, 300) } }];
}`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const g = n => wf.nodes.find(x => x.name === n);

  // 1) Get WA Token: add gcp_tts_key
  const gt = g("Get WA Token");
  if (!gt.parameters.query.includes("gcp_tts_key")) {
    gt.parameters.query = gt.parameters.query.replace("config->>'gemini_key' AS gemini_key", "config->>'gemini_key' AS gemini_key, config->>'gcp_tts_key' AS gcp_tts_key");
    console.log("• Get WA Token: gcp_tts_key added");
  }

  // 2) Voice Reply node
  if (g("Voice Reply (TTS)")) { console.error("Voice Reply node already exists — aborting"); process.exit(1); }
  wf.nodes.push({ id: randomUUID(), name: "Voice Reply (TTS)", type: "n8n-nodes-base.code", typeVersion: 2, position: [6100, 300], parameters: { jsCode: CODE } });

  // 3) wire from both send paths (terminal)
  for (const src of ["S1 Send Response", "S1 Send Booking"]) {
    if (!wf.connections[src]) wf.connections[src] = { main: [[]] };
    if (!wf.connections[src].main[0]) wf.connections[src].main[0] = [];
    if (!wf.connections[src].main[0].some(x => x.node === "Voice Reply (TTS)")) wf.connections[src].main[0].push({ node: "Voice Reply (TTS)", type: "main", index: 0 });
  }

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,600)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Voice replies wired (voice-in -> Sura speaks back in Arabic OGG)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
