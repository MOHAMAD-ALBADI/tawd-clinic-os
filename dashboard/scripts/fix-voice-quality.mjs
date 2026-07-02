// Set Sura's voice to the chosen Chirp3-HD-Aoede (natural female) and normalize the reply text for
// natural speech: Arabic-Indic->Western digits, times (11:00 -> "الساعة 11", 11:30 -> "11 و 30 دقيقة"),
// whole prices (20.000 -> 20), currency (ر.ع -> ريال), ص/م -> صباحاً/مساءً, lists -> flowing sentences.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const TTS_CODE = String.raw`let mk = '';
try { const tv = $('Transcribe Voice').first(); mk = (tv && tv.json && tv.json.media_kind) || ''; } catch(e) {}
if (mk !== 'audio') return [];

let text = '';
try { const fb = $('Format Booking Reply').first(); if (fb && fb.json && fb.json.message_text) text = fb.json.message_text; } catch(e) {}
if (!text) { try { const ss = $('Set Sender Sura').first(); if (ss && ss.json && ss.json.message_text) text = ss.json.message_text; } catch(e) {} }
if (!text) return [];

const rc = $('Resolve Clinic ID').first().json;
const wa = $('Get WA Token').first().json;
const token = wa.access_token, ttsKey = wa.gcp_tts_key;
const pnid = rc.phone_number_id;
const to = String(rc.phone || '').replace('+','') || rc.raw_from;
if (!ttsKey || !token || !pnid || !to) return [];

const west = String(text).replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)]);
const speak = west
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
  .replace(/[•*_#>]/g, ' ')
  .replace(/\r?\n+/g, '. ')
  .replace(/(\d+)\.000\b/g, '$1')
  .replace(/:00\b/g, '')
  .replace(/:(\d{2})\b/g, ' و $1 دقيقة')
  .replace(/(\d)\s*ص(?![؀-ۿ])/g, '$1 صباحاً')
  .replace(/(\d)\s*م(?![؀-ۿ])/g, '$1 مساءً')
  .replace(/ر\.?\s*ع(?![؀-ۿ])/g, ' ريال')
  .replace(/[ \t]{2,}/g, ' ')
  .replace(/\s*\.\s*\.+/g, '. ')
  .trim().slice(0, 900);
if (!speak || speak.length < 12) return []; // skip TTS for trivial one-liners (save tokens)

try {
  const ttsResp = await this.helpers.httpRequest({ method: 'POST', url: 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + ttsKey, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: { text: speak }, voice: { languageCode: 'ar-XA', name: 'ar-XA-Chirp3-HD-Aoede' }, audioConfig: { audioEncoding: 'OGG_OPUS' } }) });
  const tj = (typeof ttsResp === 'string') ? JSON.parse(ttsResp) : ttsResp;
  if (!tj.audioContent) return [];
  const buf = Buffer.from(tj.audioContent, 'base64');
  const binary = await this.helpers.prepareBinaryData(buf, 'reply.ogg', 'audio/ogg');
  return [{ json: { pnid, token, to }, binary: { data: binary } }];
} catch (e) {
  return [];
}`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  wf.nodes.find(x => x.name === "Voice Reply (TTS)").parameters.jsCode = TTS_CODE;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Voice = Chirp3-HD-Aoede + speech normalization");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
