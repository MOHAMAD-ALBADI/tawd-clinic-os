// n8n's this.helpers.httpRequest mangles the Meta /media multipart upload (400). Switch the node
// to the global fetch + FormData + Blob approach that worked standalone. Female voice kept.
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
if (typeof fetch !== 'function' || typeof FormData !== 'function' || typeof Blob !== 'function') return [{ json: { voice_reply: false, reason: 'no fetch/FormData/Blob in runtime' } }];

const speak = String(text)
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
  .replace(/[•*_#>]/g, ' ').replace(/[ \t]{2,}/g, ' ').trim().slice(0, 900);
if (!speak) return [{ json: { voice_reply: false, reason: 'empty after clean' } }];

let step = 'tts';
try {
  const ttsR = await fetch('https://texttospeech.googleapis.com/v1/text:synthesize?key=' + ttsKey, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: { text: speak }, voice: { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-D' }, audioConfig: { audioEncoding: 'OGG_OPUS' } }) });
  const tj = await ttsR.json();
  if (!tj.audioContent) return [{ json: { voice_reply: false, failed_step: 'tts', detail: JSON.stringify(tj).slice(0,250) } }];
  const buf = Buffer.from(tj.audioContent, 'base64');

  step = 'upload';
  const fd = new FormData();
  fd.append('messaging_product', 'whatsapp');
  fd.append('type', 'audio/ogg');
  fd.append('file', new Blob([buf], { type: 'audio/ogg' }), 'reply.ogg');
  const upR = await fetch('https://graph.facebook.com/v21.0/' + pnid + '/media', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: fd });
  const uj = await upR.json();
  if (!uj.id) return [{ json: { voice_reply: false, failed_step: 'upload', status: upR.status, detail: JSON.stringify(uj).slice(0,250) } }];

  step = 'send';
  const sR = await fetch('https://graph.facebook.com/v21.0/' + pnid + '/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: to, type: 'audio', audio: { id: uj.id } }) });
  const sj = await sR.json();
  return [{ json: { voice_reply: !!(sj.messages && sj.messages[0]), media_id: uj.id, detail: JSON.stringify(sj).slice(0,200) } }];
} catch (e) {
  return [{ json: { voice_reply: false, failed_step: step, error: String((e && e.message) || e).slice(0, 250) } }];
}`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  wf.nodes.find(x => x.name === "Voice Reply (TTS)").parameters.jsCode = CODE;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Voice reply now uses global fetch+FormData (matches working standalone)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
