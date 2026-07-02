// WF-07 Reminder Engine: (1) remind BOTH 'scheduled' and 'confirmed' upcoming appts (Sura books
// as 'scheduled', so they were never reminded) — convert the Supabase getAll to a Postgres query;
// (2) rewrite the reminder message with correct Arabic + a confirm/cancel call-to-action.
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "S237WFJ4ZB3sh2q2";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const SQL = "SELECT id, clinic_id, patient_id, slot_time::text AS slot_time, status FROM public.appointments " +
  "WHERE status IN ('scheduled','confirmed') AND deleted_at IS NULL AND slot_time > now() AND slot_time < now() + interval '26 hours' ORDER BY slot_time;";

const MSG_CODE = String.raw`const appt = $('Filter Due Reminders').item.json;
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
return [{ json: {
  appointment_id: appt.id, clinic_id: appt.clinic_id, patient_id: appt.patient_id,
  phone: patient.phone, reminder_type: appt.reminder_type, message_text: msg
} }];`;

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const gca = wf.nodes.find(n => n.name === "Get Confirmed Appointments");
  gca.type = "n8n-nodes-base.postgres"; gca.typeVersion = 2;
  gca.credentials = { postgres: { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" } };
  gca.parameters = { operation: "executeQuery", query: SQL, options: {} };

  wf.nodes.find(n => n.name === "Build Reminder Message").parameters.jsCode = MSG_CODE;

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,500)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ WF-07: reminds scheduled+confirmed (Postgres) + confirm/cancel CTA in message");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
