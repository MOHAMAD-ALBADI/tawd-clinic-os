// WF-07 Reminder Engine failed on every run that HAD due reminders:
// "Build Reminder Message" + "Bulk Send Delay" are runOnceForEachItem Code nodes
// but returned an ARRAY [{json:...}] — in each-item mode the return must be a
// plain {json:...} object → "A 'json' property isn't an object [item 0]".
// Fix: return the object directly (keep per-item mode so $('Get Patient').item pairing works).
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "S237WFJ4ZB3sh2q2";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const BUILD = String.raw`const appt = $('Filter Due Reminders').item.json;
const patient = $('Get Patient').item.json;
const slotDate = new Date(appt.slot_time);
const dateStr = slotDate.toLocaleDateString('ar', { timeZone:'Asia/Muscat', weekday:'long', day:'numeric', month:'long' });
const timeStr = slotDate.toLocaleTimeString('ar', { timeZone:'Asia/Muscat', hour:'numeric', minute:'2-digit', hour12:true });
const name = patient.name || '';
const greet = name ? ('مرحباً ' + name + ' 🌿') : 'مرحباً 🌿';
let msg;
if (appt.reminder_type === '24h') {
  msg = greet + '\n\nنذكّرك بموعدك في عيادة طود للأسنان يوم ' + dateStr + ' الساعة ' + timeStr + '.\n\n• للتأكيد ردّ: نعم ✅\n• للتعديل ردّ: تعديل\n• للإلغاء ردّ: إلغاء';
} else {
  msg = greet + '\n\nتذكير: موعدك اليوم الساعة ' + timeStr + ' في عيادة طود للأسنان. نشوفك على خير! 🦷\n\n• للتأكيد ردّ: نعم ✅\n• إن تعذّر الحضور ردّ: إلغاء';
}
return { json: {
  appointment_id: appt.id, clinic_id: appt.clinic_id, patient_id: appt.patient_id,
  phone: patient.phone, reminder_type: appt.reminder_type, message_text: msg
} };`;

const DELAY = String.raw`const min = 4000, max = 9000;
const delay = Math.floor(Math.random() * (max - min)) + min;
await new Promise(resolve => setTimeout(resolve, delay));
return { json: { ...$json, _bulk_delay_ms: delay } };`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  wf.nodes.find(n => n.name === "Build Reminder Message").parameters.jsCode = BUILD;
  wf.nodes.find(n => n.name === "Bulk Send Delay").parameters.jsCode = DELAY;
  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,400)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ WF-07 per-item Code nodes now return objects; reminders can send again");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
