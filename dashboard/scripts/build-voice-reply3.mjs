// Robust voice reply: n8n Code node has no global fetch/FormData, and httpRequest can't do the
// Meta multipart upload. So: (1) Code "Voice Reply (TTS)" does TTS via httpRequest and emits the
// OGG as n8n BINARY (returns [] to skip when not a voice turn); (2) native HTTP Request node
// "Upload Voice" does the multipart binary upload to Meta (handles it correctly); (3) Code
// "Send Voice" sends the audio message with the returned media id.
import { randomUUID } from "crypto";
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

const speak = String(text)
  .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu, '')
  .replace(/[•*_#>]/g, ' ').replace(/[ \t]{2,}/g, ' ').trim().slice(0, 900);
if (!speak) return [];

try {
  const ttsResp = await this.helpers.httpRequest({ method: 'POST', url: 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + ttsKey, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input: { text: speak }, voice: { languageCode: 'ar-XA', name: 'ar-XA-Wavenet-D' }, audioConfig: { audioEncoding: 'OGG_OPUS' } }) });
  const tj = (typeof ttsResp === 'string') ? JSON.parse(ttsResp) : ttsResp;
  if (!tj.audioContent) return [];
  const buf = Buffer.from(tj.audioContent, 'base64');
  const binary = await this.helpers.prepareBinaryData(buf, 'reply.ogg', 'audio/ogg');
  return [{ json: { pnid, token, to }, binary: { data: binary } }];
} catch (e) {
  return [];
}`;

const SEND_CODE = String.raw`const vr = $('Voice Reply (TTS)').first().json;
const up = $json; // Meta media response { id }
const mediaId = up && up.id;
if (!mediaId) return [{ json: { voice_reply: false, detail: JSON.stringify(up).slice(0,250) } }];
try {
  await this.helpers.httpRequest({ method: 'POST', url: 'https://graph.facebook.com/v21.0/' + vr.pnid + '/messages', headers: { Authorization: 'Bearer ' + vr.token, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to: vr.to, type: 'audio', audio: { id: mediaId } }) });
  return [{ json: { voice_reply: true, media_id: mediaId } }];
} catch (e) {
  return [{ json: { voice_reply: false, error: String((e && e.message) || e).slice(0,250) } }];
}`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const g = n => wf.nodes.find(x => x.name === n);

  // 1) rewrite the TTS/gate node to emit binary
  g("Voice Reply (TTS)").parameters.jsCode = TTS_CODE;

  // 2) add native HTTP Request upload node (multipart binary)
  if (!g("Upload Voice")) {
    wf.nodes.push({
      id: randomUUID(), name: "Upload Voice", type: "n8n-nodes-base.httpRequest", typeVersion: 4.2, position: [6320, 300],
      parameters: {
        method: "POST",
        url: "=https://graph.facebook.com/v21.0/{{ $json.pnid }}/media",
        sendHeaders: true,
        headerParameters: { parameters: [ { name: "Authorization", value: "=Bearer {{ $json.token }}" } ] },
        contentType: "multipart-form-data",
        sendBody: true,
        bodyParameters: { parameters: [
          { name: "messaging_product", value: "whatsapp" },
          { name: "type", value: "audio/ogg" },
          { parameterType: "formBinaryData", name: "file", inputDataFieldName: "data" }
        ] },
        options: {}
      }
    });
  }
  // 3) add Send Voice code node
  if (!g("Send Voice")) {
    wf.nodes.push({ id: randomUUID(), name: "Send Voice", type: "n8n-nodes-base.code", typeVersion: 2, position: [6540, 300], parameters: { jsCode: SEND_CODE } });
  }

  // wire: Voice Reply (TTS) -> Upload Voice -> Send Voice
  wf.connections["Voice Reply (TTS)"] = { main: [[{ node: "Upload Voice", type: "main", index: 0 }]] };
  wf.connections["Upload Voice"] = { main: [[{ node: "Send Voice", type: "main", index: 0 }]] };

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,600)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Voice reply restructured: TTS(binary) -> HTTP Request upload -> Send Voice");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
