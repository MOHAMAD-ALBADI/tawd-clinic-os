// Voice gender detection: the Transcribe Voice node now asks Gemini for {gender,text} on audio,
// and appends an INTERNAL note ([ملاحظة نظام ...]) telling Sura to address the patient in the
// correct gender. Image handling unchanged. Sura's prompt already treats [ملاحظة نظام] as internal.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

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
    : 'أنت تحلّل رسالة صوتية من مريض لعيادة أسنان. أعد فقط كائن JSON صالحاً بهذا الشكل بالضبط: {"gender":"male|female|unknown","text":"..."} حيث text هو التفريغ العربي الحرفي للكلام، و gender تخمين جنس المتحدث من نبرة صوته (male للرجل، female للمرأة، unknown إذا لم يتّضح). لا تكتب أي شيء خارج JSON.';
  const payload = JSON.stringify({ contents:[{ parts:[ { text: prompt }, { inline_data:{ mime_type: (mime || (isImg ? 'image/jpeg' : 'audio/ogg')), data: b64 } } ] }] });
  const rawResp = await this.helpers.httpRequest({ method:'POST', url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GKEY, headers:{ 'Content-Type':'application/json' }, body: payload });
  const resp = (typeof rawResp === 'string') ? JSON.parse(rawResp) : rawResp;
  const out = (((((resp.candidates||[])[0]||{}).content||{}).parts||[])[0] || {}).text || '';
  if (isImg) {
    const msg = '(أرسل المريض صورة) ' + (c.message_text ? c.message_text + ' — ' : '') + 'وصف الصورة: ' + (out.trim() || 'صورة غير واضحة');
    return [{ json: { ...c, message_text: msg, media_processed: true } }];
  }
  // audio -> parse {gender, text}
  let g = 'unknown', text = '';
  try { let s = out.trim(); const a = s.indexOf('{'), b = s.lastIndexOf('}'); if (a>=0 && b>a) s = s.slice(a, b+1); const j = JSON.parse(s); g = String(j.gender||'unknown').toLowerCase(); text = String(j.text||'').trim(); }
  catch(e) { text = out.trim(); }
  if (!text) return [{ json: { ...c, message_text: 'ما وصلتني الرسالة الصوتية بوضوح 🌿 ممكن ترسلها مرة ثانية؟', media_processed: false } }];
  let hint = '';
  if (g === 'male') hint = '\n\n[ملاحظة نظام داخلية — لا تُذكر للمريض: صوت المريض يوحي بأنه رجل، خاطبيه بصيغة المذكّر]';
  else if (g === 'female') hint = '\n\n[ملاحظة نظام داخلية — لا تُذكر للمريض: صوت المريضة يوحي بأنها امرأة، خاطبيها بصيغة المؤنث]';
  return [{ json: { ...c, message_text: text + hint, voice_gender: g, media_processed: true } }];
} catch (e) {
  const isImg = c.media_kind === 'image';
  return [{ json: { ...c, message_text: isImg ? '(أرسل المريض صورة) — تعذّر تحليلها، اشكري المريض واعرضي عرضها على الطبيب أو حجز موعد.' : 'واجهتني مشكلة تقنية بسيطة في تشغيل الرسالة الصوتية 🌿 ممكن ترسلها مرة ثانية؟', media_processed: false, media_error: String((e && e.message) || e).slice(0,300) } }];
}`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  wf.nodes.find(n => n.name === "Transcribe Voice").parameters.jsCode = PROCESS;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Voice gender detection wired (audio -> {gender,text} -> internal address hint)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
