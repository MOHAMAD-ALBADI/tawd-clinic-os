// Add WhatsApp voice-note support to WF-05: audio -> fetch media from Meta -> Gemini transcribe -> continue.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];
const PG = { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" };

// Parse Request: accept audio (voice) as a valid message with is_voice + audio_id
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
if (msg.type === 'text') return [{ json: { ...common, message_text: msg.text.body, is_voice: false } }];
if (msg.type === 'audio') return [{ json: { ...common, message_text: '', is_voice: true, audio_id: (msg.audio||{}).id, audio_mime: (msg.audio||{}).mime_type || 'audio/ogg' } }];
return [{ json: { type: 'unsupported_media', from: '+' + msg.from, media_type: msg.type } }];`;

// Transcribe Voice: download media from Meta, send to Gemini for Arabic transcription
const TRANSCRIBE =
"const c = $json;\n" +
"const token = $('Get WA Token').first().json.access_token;\n" +
"const GKEY = $('Get WA Token').first().json.gemini_key;\n" +
"const meta = await this.helpers.httpRequest({ method:'GET', url:'https://graph.facebook.com/v21.0/' + c.audio_id, headers:{ Authorization:'Bearer ' + token }, json:true });\n" +
"const bin = await this.helpers.httpRequest({ method:'GET', url: meta.url, headers:{ Authorization:'Bearer ' + token }, encoding:'arraybuffer' });\n" +
"const b64 = Buffer.from(bin).toString('base64');\n" +
"const mime = String(meta.mime_type || c.audio_mime || 'audio/ogg').split(';')[0];\n" +
"const resp = await this.helpers.httpRequest({ method:'POST', url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GKEY, body:{ contents:[{ parts:[ { text:'فرّغ هذه الرسالة الصوتية إلى نص عربي فقط، بدون أي تعليق أو مقدمة أو علامات.' }, { inline_data:{ mime_type: mime, data: b64 } } ] }] }, json:true });\n" +
"const text = ((((resp.candidates||[])[0]||{}).content||{}).parts||[])[0] && resp.candidates[0].content.parts[0].text || '';\n" +
"return [{ json: { ...c, message_text: (text.trim() || 'رسالة صوتية غير واضحة، ممكن تكتبها؟'), transcribed:true } }];";

const TOKEN_SQL = "=SELECT config->>'access_token' AS access_token, config->>'gemini_key' AS gemini_key FROM public.channel_configs WHERE channel='whatsapp' AND config->>'phone_number_id' = '{{ $json.phone_number_id }}' LIMIT 1;";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  if (wf.nodes.some(n => n.name === "Transcribe Voice")) { console.log("voice branch already exists"); return; }
  const g = n => wf.nodes.find(x => x.name === n);
  g("Parse Request").parameters.jsCode = PARSE;

  const rc = g("Resolve Clinic ID"); const rx = rc.position?.[0] ?? 1392, ry = rc.position?.[1] ?? 304;
  wf.nodes.push(
    { id:"is-voice", name:"Is Voice?", type:"n8n-nodes-base.if", typeVersion:2, position:[rx+130, ry],
      parameters:{ conditions:{ options:{caseSensitive:true,typeValidation:"loose",version:1}, conditions:[{id:"v",leftValue:"={{ $json.is_voice }}",rightValue:"",operator:{type:"boolean",operation:"true",singleValue:true}}], combinator:"and" }, options:{} } },
    { id:"get-wa-token", name:"Get WA Token", type:"n8n-nodes-base.postgres", typeVersion:2, position:[rx+300, ry-140],
      parameters:{ operation:"executeQuery", query: TOKEN_SQL, options:{} }, credentials:{ postgres: PG } },
    { id:"transcribe-voice", name:"Transcribe Voice", type:"n8n-nodes-base.code", typeVersion:2, position:[rx+470, ry-140],
      parameters:{ jsCode: TRANSCRIBE } }
  );

  // rewire: Resolve Clinic ID -> Is Voice? ; true -> Get WA Token -> Transcribe -> Prep Buffer SQL ; false -> Prep Buffer SQL
  wf.connections["Resolve Clinic ID"] = { main: [[{ node:"Is Voice?", type:"main", index:0 }]] };
  wf.connections["Is Voice?"] = { main: [
    [{ node:"Get WA Token", type:"main", index:0 }],
    [{ node:"Prep Buffer SQL", type:"main", index:0 }]
  ] };
  wf.connections["Get WA Token"] = { main: [[{ node:"Transcribe Voice", type:"main", index:0 }]] };
  wf.connections["Transcribe Voice"] = { main: [[{ node:"Prep Buffer SQL", type:"main", index:0 }]] };

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ voice-note branch installed (audio -> Meta media -> Gemini transcription -> pipeline)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
