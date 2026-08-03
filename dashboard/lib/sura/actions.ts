import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/types/tawd";
import { loadAvailability, freeAt, pickDoctor } from "@/lib/availability";

/* What Sura can actually DO when asked.
 *
 * Before this she could cancel and confirm an appointment. Everything
 * else — book, waitlist, draft a plan, send a message — she could only
 * describe, which makes her a search box with opinions.
 *
 * Three rules hold across every action here, and they are what make it
 * safe to hand a language model write access to a clinic:
 *
 *   1. Ids come from a query in the same conversation. The model is never
 *      trusted to invent a uuid; a malformed one is refused before any
 *      table is touched.
 *   2. Every write is scoped to the caller's clinic and re-checked against
 *      their role at execution time, not merely omitted from the prompt.
 *      A prompt is a suggestion; this is the enforcement.
 *   3. Booking goes through lib/availability, the same code the booking
 *      page and the WhatsApp agent use. A second implementation of "is
 *      this doctor free" is how two patients end up in one chair.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Action =
  | { type: "cancel_appointment"; appointment_id: string; reason?: string }
  | { type: "confirm_appointment"; appointment_id: string }
  | { type: "book_appointment"; patient_id: string; service_id: string; doctor_id?: string; date: string; time: string }
  | { type: "reschedule_appointment"; appointment_id: string; date: string; time: string }
  | { type: "add_to_waitlist"; patient_id: string; service_id: string; from_date: string; to_date: string }
  | { type: "draft_treatment_plan"; patient_id: string; title: string; items: { service_id: string; description?: string; tooth?: string; qty?: number }[] }
  | { type: "message_patient"; patient_id: string; text: string }
  | { type: "open_document"; kind: "monthly_report"; month?: string };

export type ActionResult = {
  action: string;
  done: boolean;
  reason?: string;
  [k: string]: unknown;
};

type SB = SupabaseClient;

/** Roles that may change a clinic's state at all. */
const WRITERS: Role[] = ["clinic_admin", "doctor", "receptionist"];

/* Actions a doctor may not take. A doctor books and reschedules their own
   day; drafting a plan is theirs by right, but messaging patients and
   managing the waitlist belong to the desk. */
const DESK_ONLY = new Set(["add_to_waitlist", "message_patient"]);

export async function runAction(
  sb: SB,
  action: Action,
  clinicId: string,
  role: Role,
  actorId: string,
): Promise<ActionResult> {
  if (role === "platform_admin") {
    throw new Error("تعديل بيانات عيادة لا يتم من لوحة المنصة — استخدم إذن الدخول من ملف العيادة");
  }
  if (!WRITERS.includes(role)) {
    throw new Error("هذا الدور لا يملك صلاحية تنفيذ إجراءات");
  }
  if (role === "doctor" && DESK_ONLY.has(action.type)) {
    throw new Error("هذا الإجراء من صلاحيات الاستقبال أو الإدارة");
  }
  if (!clinicId) throw new Error("لا توجد عيادة محدّدة");

  switch (action.type) {
    case "cancel_appointment":   return cancelAppt(sb, action, clinicId, role, actorId);
    case "confirm_appointment":  return confirmAppt(sb, action, clinicId, role);
    case "book_appointment":     return book(sb, action, clinicId, role, actorId);
    case "reschedule_appointment": return reschedule(sb, action, clinicId, role);
    case "add_to_waitlist":      return waitlist(sb, action, clinicId);
    case "draft_treatment_plan": return draftPlan(sb, action, clinicId, actorId);
    case "message_patient":      return message(sb, action, clinicId);
    case "open_document":        return openDocument(action);
    default:
      throw new Error(`إجراء غير مدعوم: ${(action as { type: string }).type}`);
  }
}

/* ── appointments ─────────────────────────────────────────────────── */

async function cancelAppt(sb: SB, a: Extract<Action, { type: "cancel_appointment" }>, cid: string, role: Role, actor: string) {
  requireId(a.appointment_id, "appointment_id");
  let q = sb.from("appointments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_by: actor,
      cancellation_reason: (a.reason ?? "").trim() || "إلغاء عبر سُرى",
    })
    .eq("id", a.appointment_id).eq("clinic_id", cid).is("deleted_at", null)
    .in("status", ["scheduled", "confirmed", "checked_in"]);
  if (role === "doctor") q = q.eq("doctor_id", actor);

  const { data, error } = await q.select("id, slot_time").maybeSingle();
  if (error) throw new Error(error.message);
  return data
    ? { action: a.type, done: true, appointment: data }
    : { action: a.type, done: false, reason: "لا يوجد موعد بهذا المعرف قابل للإلغاء" };
}

async function confirmAppt(sb: SB, a: Extract<Action, { type: "confirm_appointment" }>, cid: string, role: Role) {
  requireId(a.appointment_id, "appointment_id");
  const { data, error } = await sb.from("appointments")
    .update({ status: "confirmed" })
    .eq("id", a.appointment_id).eq("clinic_id", cid).is("deleted_at", null)
    .eq("status", "scheduled")
    .select("id, slot_time").maybeSingle();
  if (error) throw new Error(error.message);
  void role;
  return data
    ? { action: a.type, done: true, appointment: data }
    : { action: a.type, done: false, reason: "الموعد غير موجود أو ليس في حالة «مجدول»" };
}

async function book(sb: SB, a: Extract<Action, { type: "book_appointment" }>, cid: string, role: Role, actor: string) {
  requireId(a.patient_id, "patient_id");
  requireId(a.service_id, "service_id");
  const when = parseWhen(a.date, a.time);

  const doctorId = role === "doctor" ? actor : (a.doctor_id ?? "any");

  /* The one source of truth for "is this doctor free" — split shifts,
     leave, holidays and clashes all answered by the same code the booking
     page uses. */
  const av = await loadAvailability(sb, cid, a.service_id, doctorId, a.date);
  if (!av.ok) return { action: a.type, done: false, reason: av.reason };

  const minuteOfDay = when.hh * 60 + when.mm;
  const chosen =
    doctorId !== "any"
      ? (freeAt(av.ctx, doctorId, minuteOfDay, when.ms)
          ? av.ctx.candidates.find((c) => c.id === doctorId) ?? null
          : null)
      : pickDoctor(av.ctx, minuteOfDay, when.ms);

  if (!chosen) {
    return { action: a.type, done: false, reason: "لا يوجد طبيب متاح في هذا الوقت — اقترحي وقتاً آخر" };
  }

  const { data, error } = await sb.from("appointments").insert({
    clinic_id: cid,
    patient_id: a.patient_id,
    doctor_id: chosen.id,
    service_id: a.service_id,
    slot_time: new Date(when.ms).toISOString(),
    duration_minutes: av.ctx.durationMinutes,
    status: "scheduled",
    type: "consultation",
    source_channel: "web_chat",
  }).select("id, slot_time, duration_minutes").single();

  /* The exclusion constraint on (doctor, time span) is the real guarantee.
     Availability can go stale between the check and the insert; the
     database cannot. */
  if (error) {
    const clash = /exclu|overlap|conflict/i.test(error.message);
    return {
      action: a.type, done: false,
      reason: clash ? "الوقت حُجز للتوّ من مكان آخر — اقترحي وقتاً بديلاً" : error.message,
    };
  }
  return { action: a.type, done: true, appointment: data, doctor: chosen.label };
}

async function reschedule(sb: SB, a: Extract<Action, { type: "reschedule_appointment" }>, cid: string, role: Role) {
  requireId(a.appointment_id, "appointment_id");
  const when = parseWhen(a.date, a.time);

  const { data: appt } = await sb.from("appointments")
    .select("id, doctor_id, service_id, duration_minutes, status")
    .eq("id", a.appointment_id).eq("clinic_id", cid).is("deleted_at", null).maybeSingle();
  if (!appt) return { action: a.type, done: false, reason: "الموعد غير موجود" };
  if (["completed", "cancelled", "no_show"].includes(String(appt.status))) {
    return { action: a.type, done: false, reason: `لا يمكن تغيير موعد حالته «${appt.status}»` };
  }

  const av = await loadAvailability(sb, cid, String(appt.service_id ?? ""), String(appt.doctor_id), a.date);
  if (!av.ok) return { action: a.type, done: false, reason: av.reason };
  if (!freeAt(av.ctx, String(appt.doctor_id), when.hh * 60 + when.mm, when.ms)) {
    return { action: a.type, done: false, reason: "الطبيب غير متاح في الوقت الجديد" };
  }

  const { data, error } = await sb.from("appointments")
    .update({ slot_time: new Date(when.ms).toISOString(), status: "scheduled" })
    .eq("id", a.appointment_id).eq("clinic_id", cid)
    .select("id, slot_time").maybeSingle();
  if (error) throw new Error(error.message);
  void role;
  return { action: a.type, done: true, appointment: data };
}

/* ── the desk ─────────────────────────────────────────────────────── */

async function waitlist(sb: SB, a: Extract<Action, { type: "add_to_waitlist" }>, cid: string) {
  requireId(a.patient_id, "patient_id");
  requireId(a.service_id, "service_id");

  const { data, error } = await sb.from("appointment_waitlist").insert({
    clinic_id: cid,
    patient_id: a.patient_id,
    service_id: a.service_id,
    desired_from: a.from_date,
    desired_to: a.to_date,
    status: "pending",
  }).select("id, desired_from, desired_to").single();
  if (error) throw new Error(error.message);

  /* Worth saying out loud in the reply: joining the waitlist is not a
     passive act here. The agent's gap-fill loop reads this table, so the
     patient has just become a candidate the next time an hour frees up. */
  return { action: a.type, done: true, waitlist: data, note: "سيُعرض عليه أي موعد يُلغى ضمن هذه الفترة تلقائياً" };
}

async function draftPlan(sb: SB, a: Extract<Action, { type: "draft_treatment_plan" }>, cid: string, actor: string) {
  requireId(a.patient_id, "patient_id");
  if (!a.items?.length) return { action: a.type, done: false, reason: "الخطة بلا بنود" };
  if (a.items.length > 20) return { action: a.type, done: false, reason: "عدد البنود كبير — قسّمي الخطة" };

  const ids = a.items.map((i) => i.service_id);
  ids.forEach((id) => requireId(id, "service_id"));

  /* Prices come from the clinic's own service list, never from the model.
     A plan quoting a number Sura invented is a number the clinic then has
     to honour. */
  const { data: services } = await sb.from("services")
    .select("id, name, name_ar, price").eq("clinic_id", cid).in("id", ids);
  const priceOf = new Map((services ?? []).map((s) => [s.id as string, s]));
  if (priceOf.size !== new Set(ids).size) {
    return { action: a.type, done: false, reason: "بعض الخدمات غير موجودة في قائمة خدمات العيادة" };
  }

  const { data: plan, error } = await sb.from("treatment_plans").insert({
    clinic_id: cid,
    patient_id: a.patient_id,
    doctor_id: actor,
    title: a.title.slice(0, 160),
    /* draft, not accepted: a plan is a clinical and commercial commitment
       and a person signs off on it, not an assistant. */
    status: "draft",
    total_estimate: 0,
    created_by: actor,
  }).select("id, title").single();
  if (error) throw new Error(error.message);

  const rows = a.items.map((it, i) => {
    const s = priceOf.get(it.service_id)!;
    const qty = Math.min(20, Math.max(1, Number(it.qty ?? 1)));
    return {
      clinic_id: cid,
      plan_id: plan.id,
      service_id: it.service_id,
      description: (it.description ?? s.name_ar ?? s.name ?? "بند").slice(0, 200),
      tooth_number: it.tooth ?? null,
      quantity: qty,
      unit_price: Number(s.price),
      status: "pending",
      sort_order: i + 1,
    };
  });
  const { error: itemErr } = await sb.from("treatment_plan_items").insert(rows);
  if (itemErr) throw new Error(itemErr.message);

  const total = rows.reduce((t, r) => t + r.unit_price * r.quantity, 0);
  return {
    action: a.type, done: true, plan_id: plan.id, title: plan.title,
    items: rows.length, total_omr: total,
    note: "أُنشئت كمسوّدة — تحتاج اعتماد الطبيب قبل عرضها على المريض",
  };
}

async function message(sb: SB, a: Extract<Action, { type: "message_patient" }>, cid: string) {
  requireId(a.patient_id, "patient_id");
  const text = a.text.trim();
  if (!text) return { action: a.type, done: false, reason: "الرسالة فارغة" };
  if (text.length > 900) return { action: a.type, done: false, reason: "الرسالة طويلة جداً" };

  const [{ data: patient }, { data: cfg }] = await Promise.all([
    sb.from("patients").select("name, name_ar, phone").eq("id", a.patient_id).eq("clinic_id", cid).maybeSingle(),
    sb.from("channel_configs").select("config").eq("clinic_id", cid)
      .eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle(),
  ]);
  if (!patient?.phone) return { action: a.type, done: false, reason: "لا يوجد رقم تواصل لهذا المريض" };

  const conf = cfg?.config as Record<string, string> | null;
  if (!conf?.access_token || !conf?.phone_number_id) {
    return { action: a.type, done: false, reason: "واتساب غير مربوط لهذه العيادة" };
  }

  const res = await fetch(`https://graph.facebook.com/v20.0/${conf.phone_number_id}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${conf.access_token}`, "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: patient.phone.replace(/\D/g, ""),
      type: "text",
      text: { body: text },
    }),
  });
  if (!res.ok) {
    return { action: a.type, done: false, reason: waError(await res.text()) };
  }
  return { action: a.type, done: true, to: patient.name_ar ?? patient.name };
}

/* Produce the document, rather than explain where it lives.
 *
 * Asked "can you make me a PDF?" she used to recite navigation — open
 * this page, press that button — which is a help article, not an agent.
 * She now returns the finished document and the interface renders it as
 * something to click.
 *
 * The url is a page styled for paper, not a generated file, because the
 * common PDF libraries do no Arabic shaping and produce disconnected
 * letters in reverse. The browser already renders it correctly, and its
 * print dialog writes the PDF. */
function openDocument(a: Extract<Action, { type: "open_document" }>): ActionResult {
  if (a.kind !== "monthly_report") {
    return { action: a.type, done: false, reason: `مستند غير معروف: ${a.kind}` };
  }

  const month = /^\d{4}-\d{2}-\d{2}$/.test(a.month ?? "") ? a.month! : undefined;
  const label = month
    ? `تقرير ${new Date(`${month}T00:00:00+04:00`).toLocaleDateString("ar-OM", { month: "long", year: "numeric", timeZone: "Asia/Muscat" })}`
    : "تقرير الشهر";

  return {
    action: a.type,
    done: true,
    document: {
      url: `/clinic-admin/sura-agent/report${month ? `?month=${month}` : ""}`,
      label,
    },
    /* Said plainly so she confirms it exists rather than describing how
       to reach it. The interface shows the button; she should not
       repeat its contents as prose. */
    note: "المستند جاهز ومعروض للمستخدم كزرّ. أخبريه أنه جاهز وما الذي يحتويه، بجملة أو جملتين. لا تشرحي خطوات فتحه.",
  };
}

/* ── shared ───────────────────────────────────────────────────────── */

function requireId(v: string | undefined, field: string) {
  if (!v || !UUID.test(v)) {
    throw new Error(`${field} يجب أن يكون UUID حقيقياً من نتيجة استعلام في هذه المحادثة`);
  }
}

/** Clinic-local wall time → an absolute instant. */
function parseWhen(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("التاريخ بصيغة YYYY-MM-DD");
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error("الوقت بصيغة HH:MM");
  const [hh, mm] = time.split(":").map(Number);
  /* Oman is UTC+4 year-round with no daylight saving, so a fixed offset is
     exact rather than an approximation. */
  const ms = Date.parse(`${date}T${time}:00+04:00`);
  if (Number.isNaN(ms)) throw new Error("تاريخ أو وقت غير صالح");
  if (ms < Date.now() - 60_000) throw new Error("لا يمكن الحجز في الماضي");
  return { hh, mm, ms };
}

/** Meta's numeric codes mean nothing to a clinic manager. */
function waError(body: string): string {
  if (body.includes("131030")) return "رقم المريض غير مضاف لقائمة الأرقام المسموحة في حساب واتساب التجريبي";
  if (body.includes("131047")) return "خارج نافذة الـ٢٤ ساعة — واتساب يمنع الرسائل الحرة لمن لم يراسل العيادة مؤخراً";
  if (body.includes("131026")) return "الرقم غير مسجّل في واتساب";
  if (body.includes("190")) return "انتهت صلاحية رمز واتساب — جدّده من الإعدادات";
  return "تعذّر الإرسال عبر واتساب";
}
