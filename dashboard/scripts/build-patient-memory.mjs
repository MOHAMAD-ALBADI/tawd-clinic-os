// Long-term patient memory: inject a factual [سجل المريض] section (past visits, last visit,
// services used, no-show count, next upcoming appointment) into the prompt so Sura recognises
// returning patients instead of treating every chat as a cold start. Adds a "Load Patient History"
// Postgres node between "S6 Save User Msg" and "Build AI Context", and rewires Build AI Context to
// read ctx from S6 and history from the new node.
import { randomUUID } from "crypto";
const KEY = process.env.N8N_API_KEY;
const B = "https://n8n.srv1239666.hstgr.cloud/api/v1";
const ID = "arZRfHPPTytcMSR5";
const H = { "X-N8N-API-KEY": KEY, "Content-Type": "application/json" };
const ALLOWED = ["saveExecutionProgress","saveManualExecutions","saveDataErrorExecution","saveDataSuccessExecution","executionTimeout","errorWorkflow","timezone","executionOrder"];

const HISTORY_SQL =
"SELECT " +
"count(*) FILTER (WHERE a.status='completed') AS visits, " +
"count(*) FILTER (WHERE a.status='no_show') AS no_shows, " +
"max(a.slot_time) FILTER (WHERE a.status='completed')::text AS last_visit, " +
"(SELECT string_agg(DISTINCT s.name_ar, ', ') FROM public.appointments a2 JOIN public.services s ON s.id=a2.service_id WHERE a2.patient_id='{{ $json.patient_id }}'::uuid AND a2.clinic_id='{{ $json.clinic_id }}'::uuid AND a2.status='completed') AS services, " +
"(SELECT min(a3.slot_time) FROM public.appointments a3 WHERE a3.patient_id='{{ $json.patient_id }}'::uuid AND a3.clinic_id='{{ $json.clinic_id }}'::uuid AND a3.status IN ('scheduled','confirmed') AND a3.slot_time > now())::text AS next_upcoming " +
"FROM public.appointments a " +
"WHERE a.patient_id='{{ $json.patient_id }}'::uuid AND a.clinic_id='{{ $json.clinic_id }}'::uuid AND a.deleted_at IS NULL;";

// Build AI Context edits
const CTX_FIND = "const ctx = $json;";
const CTX_REPL = "const ctx = $('S6 Save User Msg').first().json;\nlet _hist = {}; try { _hist = $('Load Patient History').first().json || {}; } catch(e) {}";

const HIST_BUILD = String.raw`
const _v = Number(_hist.visits||0), _ns = Number(_hist.no_shows||0);
let histSection = '';
if (_v > 0) {
  const lv = _hist.last_visit ? new Intl.DateTimeFormat('ar',{timeZone:tz,day:'numeric',month:'long',year:'numeric'}).format(new Date(_hist.last_visit)) : '';
  histSection = '[سجل المريض — استعمليه بذكاء للترحيب والتخصيص، ولا تُفصحي عن الأرقام إلا إن سأل]\n' +
    'مريض حالي معروف: ' + _v + ' زيارة سابقة' + (lv ? ('، آخر زيارة ' + lv) : '') + '.' +
    (_hist.services ? (' خدماته السابقة: ' + esc(_hist.services) + '.') : '') +
    (_ns > 0 ? (' سجّل ' + _ns + ' غياباً سابقاً — ذكّريه بلطف بأهمية تأكيد الموعد والحضور.') : '');
} else {
  histSection = '[سجل المريض]\nمريض جديد (لا زيارات سابقة) — رحّبي به ترحيباً خاصاً بأول زيارة.';
}
const _next = _hist.next_upcoming ? new Intl.DateTimeFormat('ar',{timeZone:tz,weekday:'long',day:'numeric',month:'long',hour:'numeric',minute:'2-digit',hour12:true}).format(new Date(_hist.next_upcoming)) : '';
if (_next) histSection += '\n لديه موعد قادم مؤكد: ' + _next + '. إن سأل «متى موعدي» أخبريه به، ولا تحجزي موعداً جديداً إلا إن طلب صراحةً.';
`;
const ANCHOR = "'[الوقت — تلقائي، ممنوع الحجز في الماضي]\\n' + status + '\\n\\n' +";
const ANCHOR_REPL = "'[الوقت — تلقائي، ممنوع الحجز في الماضي]\\n' + status + '\\n\\n' + histSection + '\\n\\n' +";

(async () => {
  const wf = await fetch(`${B}/workflows/${ID}`, { headers: H }).then(r => r.json());
  const g = n => wf.nodes.find(x => x.name === n);

  if (g("Load Patient History")) { console.error("Load Patient History already exists — aborting"); process.exit(1); }

  const s6 = g("S6 Save User Msg");
  const bc = g("Build AI Context");
  const [bx, by] = bc.position || [3728, 480];

  // new Postgres node
  const histNode = {
    id: randomUUID(), name: "Load Patient History", type: "n8n-nodes-base.postgres", typeVersion: 2,
    position: [bx - 200, by + 40],
    credentials: { postgres: { id: "NDrVeK2iQy3c33J3", name: "TAWD Supabase Postgres" } },
    parameters: { operation: "executeQuery", query: "=" + HISTORY_SQL, options: {} }
  };
  wf.nodes.push(histNode);

  // rewire: S6 Save User Msg -> Load Patient History -> Build AI Context
  wf.connections["S6 Save User Msg"].main[0] = [{ node: "Load Patient History", type: "main", index: 0 }];
  wf.connections["Load Patient History"] = { main: [[{ node: "Build AI Context", type: "main", index: 0 }]] };

  // edit Build AI Context code
  let code = bc.parameters.jsCode;
  if (!code.includes(CTX_FIND)) { console.error("CTX_FIND missing — aborting"); process.exit(1); }
  if (code.includes("Load Patient History")) { console.error("Build AI Context already patched — aborting"); process.exit(1); }
  code = code.replace(CTX_FIND, CTX_REPL);
  // insert histSection builder right after the `status` line is defined (before `const cur =`)
  code = code.replace("\nconst cur = ctx.currency", HIST_BUILD + "\nconst cur = ctx.currency");
  if (!code.includes(ANCHOR)) { console.error("prompt ANCHOR missing — aborting"); process.exit(1); }
  code = code.replace(ANCHOR, ANCHOR_REPL);
  try { new Function(code); } catch(e){ console.error("Build AI Context invalid JS:", e.message); process.exit(1); }
  bc.parameters.jsCode = code;

  const settings = {}; for (const k of ALLOWED) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];
  const body = JSON.stringify({ name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  await fetch(`${B}/workflows/${ID}/deactivate`, { method:"POST", headers:H, body:"{}" });
  const put = await fetch(`${B}/workflows/${ID}`, { method:"PUT", headers:H, body });
  console.log("PUT:", put.status); if (put.status>=300) { console.log("err:",(await put.text()).slice(0,600)); process.exit(1); }
  await fetch(`${B}/workflows/${ID}/activate`, { method:"POST", headers:H, body:"{}" });
  console.log("✓ Long-term patient memory wired (Load Patient History -> [سجل المريض] in prompt)");
})().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
