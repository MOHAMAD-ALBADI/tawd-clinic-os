import type { SupabaseClient } from "@supabase/supabase-js";
import type { Role } from "@/types/tawd";

/* The rest of the clinic.
 *
 * Sura could book, cancel, waitlist, draft a plan, message and issue one
 * report. Eight things, against a system with fifty tables — so she was
 * hitting a real wall constantly and I kept rewriting her instructions
 * as if the problem were her wording. It was not. The surface was small.
 *
 * These are the operations a clinic actually performs in a day: taking a
 * new patient, billing a visit, receiving money, writing a prescription,
 * recording what happened, closing a plan item, blocking a doctor's day.
 * Each one is scoped to the caller's clinic and re-checked against their
 * role here, not in the prompt.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OMANI_PHONE = /^\+?968\d{8}$|^\d{8}$/;

export type OpsAction =
  | { type: "create_patient"; name: string; phone: string; gender?: string; email?: string }
  | { type: "invoice_appointment"; appointment_id: string; discount?: number }
  | { type: "record_payment"; invoice_id: string; amount: number; method: string; reference?: string }
  | { type: "write_prescription"; patient_id: string; diagnosis?: string; items: { drug: string; dosage?: string; frequency?: string; duration?: string; instructions?: string }[] }
  | { type: "add_clinical_note"; patient_id: string; note: string; private?: boolean }
  | { type: "complete_plan_item"; item_id: string }
  | { type: "block_doctor_day"; doctor_id: string; date: string; reason?: string }
  | { type: "add_service"; name: string; price: number; duration_minutes?: number; category?: string }
  | { type: "submit_insurance_claim"; invoice_id: string; provider_id: string; amount?: number }
  | { type: "queue_recovery"; patient_ids: string[]; note?: string };

export type OpsResult = { action: string; done: boolean; reason?: string; [k: string]: unknown };

type SB = SupabaseClient;

/* Money is the accountant's and the manager's. A receptionist takes
   payments at the desk but does not write off or claim; a doctor writes
   clinical records but does not touch the ledger. */
const CLINICAL: Role[] = ["clinic_admin", "doctor"];
const MONEY: Role[] = ["clinic_admin", "accountant", "receptionist"];
const ADMIN: Role[] = ["clinic_admin"];

export function opsHandles(t: string): boolean {
  return [
    "create_patient", "invoice_appointment", "record_payment", "write_prescription",
    "add_clinical_note", "complete_plan_item", "block_doctor_day", "add_service",
    "submit_insurance_claim", "queue_recovery",
  ].includes(t);
}

export async function runOps(
  sb: SB, a: OpsAction, cid: string, role: Role, actor: string,
): Promise<OpsResult> {
  const need = (allowed: Role[]) => {
    if (!allowed.includes(role)) throw new Error("هذا الإجراء خارج صلاحيات دورك");
  };

  switch (a.type) {
    case "create_patient":         need([...MONEY, "doctor"]); return createPatient(sb, a, cid);
    case "invoice_appointment":    need(MONEY);                return invoiceAppt(sb, a, cid);
    case "record_payment":         need(MONEY);                return recordPayment(sb, a, cid, actor);
    case "write_prescription":     need(CLINICAL);             return prescribe(sb, a, cid, actor);
    case "add_clinical_note":      need(CLINICAL);             return note(sb, a, cid, actor);
    case "complete_plan_item":     need(CLINICAL);             return completeItem(sb, a, cid);
    case "block_doctor_day":       need([...ADMIN, "doctor"]); return blockDay(sb, a, cid, role, actor);
    case "add_service":            need(ADMIN);                return addService(sb, a, cid);
    case "submit_insurance_claim": need(MONEY);                return claim(sb, a, cid);
    case "queue_recovery":         need([...MONEY, "doctor"]); return queueRecovery(sb, a, cid);
  }
}

/* The link between the two halves of the agent.
 *
 * Sura analyses in conversation and the loop acts on its own, and until
 * now nothing joined them: she would find twenty lapsed patients, write
 * a recommendation about them, and that was the end of it. The finding
 * evaporated the moment the answer was read.
 *
 * She can hand them over now. Each patient becomes a goal the tick loop
 * picks up within ten minutes, ranks against everything else open, and
 * works under the same guardrails as any other — quiet hours, one
 * message a day, two attempts, a logged reason. She is not sending
 * anything here; she is putting it in the queue that does.
 */
async function queueRecovery(
  sb: SB, a: Extract<OpsAction, { type: "queue_recovery" }>, cid: string,
): Promise<OpsResult> {
  const ids = [...new Set((a.patient_ids ?? []).filter((x) => UUID.test(x)))].slice(0, 40);
  if (ids.length === 0) return fail(a, "لا يوجد مريض صالح — مرّري معرّفات من نتيجة استعلام");

  const { data: people } = await sb.from("patients")
    .select("id, name, name_ar, phone").eq("clinic_id", cid).in("id", ids)
    .is("deleted_at", null).eq("is_archived", false);

  const reachable = (people ?? []).filter((p) => p.phone);
  if (reachable.length === 0) return fail(a, "لا يوجد لدى أيٍّ منهم رقم تواصل");

  /* Worth what the clinic would earn if they came back. Their unfinished
     treatment when there is one, and otherwise nothing claimed — a goal
     that overstates its value distorts the queue it competes in. */
  const { data: plans } = await sb.from("treatment_plan_items")
    .select("line_total, status, treatment_plans!plan_id(patient_id, status)")
    .eq("clinic_id", cid).eq("status", "pending");

  const owed = new Map<string, number>();
  for (const row of (plans ?? []) as unknown as { line_total: number; treatment_plans: { patient_id: string; status: string } | null }[]) {
    const p = row.treatment_plans;
    if (!p || !["accepted", "in_progress"].includes(p.status)) continue;
    owed.set(p.patient_id, (owed.get(p.patient_id) ?? 0) + Number(row.line_total || 0));
  }

  const rows = reachable.map((p) => ({
    clinic_id: cid,
    kind: "plan_recovery" as const,
    subject_id: p.id,          // the patient is the subject for a hand-queued goal
    patient_id: p.id,
    value_omr: owed.get(p.id) ?? 0,
    context: {
      plan_title: a.note?.slice(0, 160) ?? "استدعاء مريض منقطع",
      queued_by: "sura_conversation",
      items_left: 0, items_done: 0,
      next_item: a.note?.slice(0, 160) ?? "متابعة",
      next_price: owed.get(p.id) ?? 0,
      days_stalled: 0,
    },
  }));

  /* The partial unique index makes this idempotent: a patient already in
     the queue is skipped rather than duplicated, which is what keeps a
     re-run of the same analysis from messaging anyone twice. */
  const { data: made, error } = await sb.from("sura_goals")
    .insert(rows).select("id");

  if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);

  const queued = made?.length ?? 0;
  return {
    action: a.type, done: queued > 0,
    queued,
    skipped: reachable.length - queued,
    value_omr: rows.reduce((s, r) => s + r.value_omr, 0),
    reason: queued === 0 ? "جميعهم مُدرجون في قائمة المتابعة بالفعل" : undefined,
    note: "سُرى ستتواصل معهم تلقائياً خلال عشر دقائق، بحدّ رسالة واحدة لكل مريض يومياً وخارج ساعات الهدوء.",
  };
}

/* ── patients ─────────────────────────────────────────────────────── */

async function createPatient(sb: SB, a: Extract<OpsAction, { type: "create_patient" }>, cid: string) {
  const name = a.name?.trim();
  if (!name || name.length < 3) return fail(a, "الاسم قصير أو ناقص");

  const digits = a.phone.replace(/[^\d+]/g, "");
  if (!OMANI_PHONE.test(digits)) return fail(a, "رقم الهاتف غير صالح — ثمانية أرقام أو بصيغة +968");
  const phone = digits.startsWith("+") ? digits : `+968${digits.slice(-8)}`;

  /* A clinic has the same patient twice under two spellings often
     enough that creating blind is the wrong default. */
  const { data: existing } = await sb.from("patients")
    .select("id, name").eq("clinic_id", cid).eq("phone", phone).is("deleted_at", null).maybeSingle();
  if (existing) {
    return { action: a.type, done: false, reason: `هذا الرقم مسجّل باسم «${existing.name}»`, patient_id: existing.id };
  }

  const { data, error } = await sb.from("patients").insert({
    clinic_id: cid, name, phone,
    gender: a.gender === "male" || a.gender === "female" ? a.gender : null,
    email: a.email?.trim() || null,
    source_channel: "web_chat",
  }).select("id, name, phone").single();
  if (error) throw new Error(error.message);
  return { action: a.type, done: true, patient: data };
}

/* ── money ────────────────────────────────────────────────────────── */

async function invoiceAppt(sb: SB, a: Extract<OpsAction, { type: "invoice_appointment" }>, cid: string) {
  id(a.appointment_id, "appointment_id");

  const { data: appt } = await sb.from("appointments")
    .select("id, patient_id, service_id, status, services!service_id(name, name_ar, price, vat_applicable)")
    .eq("id", a.appointment_id).eq("clinic_id", cid).is("deleted_at", null).maybeSingle();
  if (!appt) return fail(a, "الموعد غير موجود");
  if (!appt.service_id) return fail(a, "الموعد بلا خدمة محدّدة — لا يمكن تسعيره");

  const { data: already } = await sb.from("invoices")
    .select("id, invoice_number").eq("appt_id", a.appointment_id).is("deleted_at", null).maybeSingle();
  if (already) {
    return { action: a.type, done: false, reason: `للموعد فاتورة بالفعل رقم ${already.invoice_number}`, invoice_id: already.id };
  }

  const svc = appt.services as unknown as { name: string; name_ar: string | null; price: number; vat_applicable: boolean } | null;
  if (!svc) return fail(a, "الخدمة غير موجودة");

  const discount = Math.max(0, Math.min(Number(a.discount ?? 0), Number(svc.price)));
  const subtotal = Number(svc.price) - discount;
  /* 5% Omani VAT, and only where the service carries it. Rounded to
     three places because the riyal has three. */
  const vat = svc.vat_applicable ? Math.round(subtotal * 0.05 * 1000) / 1000 : 0;
  const total = Math.round((subtotal + vat) * 1000) / 1000;

  const { data: numRes } = await sb.rpc("next_invoice_number", { p_clinic: cid });
  const invoiceNumber = (numRes as string) ?? `INV-${Date.now()}`;

  /* net_total is generated (total - adjusted_amount) — inserting into it
     errors, which is a trap this codebase has already fallen into once. */
  const { data: inv, error } = await sb.from("invoices").insert({
    clinic_id: cid, appt_id: appt.id, patient_id: appt.patient_id,
    invoice_number: invoiceNumber,
    subtotal, discount_amount: discount, vat_amount: vat, total,
    currency: "OMR", status: "sent",
  }).select("id, invoice_number, total").single();
  if (error) throw new Error(error.message);

  await sb.from("invoice_items").insert({
    invoice_id: inv.id, clinic_id: cid, service_id: appt.service_id,
    description: svc.name, description_ar: svc.name_ar ?? svc.name,
    quantity: 1, unit_price_snapshot: svc.price,
    vat_rate_snapshot: svc.vat_applicable ? 5 : 0, vat_amount: vat, total,
    sort_order: 1,
  });

  return { action: a.type, done: true, invoice: inv, vat_omr: vat };
}

async function recordPayment(sb: SB, a: Extract<OpsAction, { type: "record_payment" }>, cid: string, actor: string) {
  id(a.invoice_id, "invoice_id");
  const amount = Number(a.amount);
  if (!Number.isFinite(amount) || amount <= 0) return fail(a, "المبلغ غير صالح");

  const methods = ["cash", "card", "bank_transfer", "thawani", "insurance"];
  const method = methods.includes(a.method) ? a.method : "cash";

  const { data: inv } = await sb.from("invoices")
    .select("id, total, adjusted_amount, status").eq("id", a.invoice_id).eq("clinic_id", cid)
    .is("deleted_at", null).maybeSingle();
  if (!inv) return fail(a, "الفاتورة غير موجودة");

  const { data: paid } = await sb.from("payments")
    .select("amount").eq("invoice_id", inv.id).eq("status", "completed").is("voided_at", null);
  const already = (paid ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const owed = Number(inv.total) - Number(inv.adjusted_amount ?? 0) - already;

  if (owed <= 0) return fail(a, "الفاتورة مسدّدة بالكامل");
  if (amount > owed + 0.001) {
    return fail(a, `المبلغ أكبر من المتبقّي (${owed.toFixed(3)} ر.ع)`);
  }

  const { error } = await sb.from("payments").insert({
    invoice_id: inv.id, clinic_id: cid, gateway: method,
    currency: "OMR", amount, status: "completed",
    paid_at: new Date().toISOString(), received_by: actor,
    gateway_ref: a.reference?.slice(0, 120) || null,
  });
  if (error) throw new Error(error.message);

  const remaining = Math.round((owed - amount) * 1000) / 1000;
  await sb.from("invoices")
    .update({ status: remaining <= 0.001 ? "paid" : "partially_paid" })
    .eq("id", inv.id);

  return { action: a.type, done: true, paid_omr: amount, remaining_omr: Math.max(0, remaining) };
}

async function claim(sb: SB, a: Extract<OpsAction, { type: "submit_insurance_claim" }>, cid: string) {
  id(a.invoice_id, "invoice_id");
  id(a.provider_id, "provider_id");

  const { data: inv } = await sb.from("invoices")
    .select("id, patient_id, appt_id, total").eq("id", a.invoice_id).eq("clinic_id", cid)
    .is("deleted_at", null).maybeSingle();
  if (!inv) return fail(a, "الفاتورة غير موجودة");

  const { data: cover } = await sb.from("patient_insurance")
    .select("coverage_percent, valid_until, is_active")
    .eq("patient_id", inv.patient_id).eq("provider_id", a.provider_id)
    .eq("is_active", true).maybeSingle();
  if (!cover) return fail(a, "لا توجد تغطية فعّالة لهذا المريض عند هذا المزوّد");
  if (cover.valid_until && new Date(cover.valid_until as string) < new Date()) {
    return fail(a, "تغطية المريض منتهية");
  }

  const amount = Number(a.amount ?? (Number(inv.total) * Number(cover.coverage_percent)) / 100);
  const { data, error } = await sb.from("insurance_claims").insert({
    clinic_id: cid, patient_id: inv.patient_id, invoice_id: inv.id, appt_id: inv.appt_id,
    provider_id: a.provider_id, status: "submitted",
    submitted_amount: Math.round(amount * 1000) / 1000,
    currency: "OMR", submitted_at: new Date().toISOString(),
  }).select("id, submitted_amount").single();
  if (error) throw new Error(error.message);
  return { action: a.type, done: true, claim: data, coverage_percent: cover.coverage_percent };
}

/* ── clinical ─────────────────────────────────────────────────────── */

async function prescribe(sb: SB, a: Extract<OpsAction, { type: "write_prescription" }>, cid: string, actor: string) {
  id(a.patient_id, "patient_id");
  if (!a.items?.length) return fail(a, "الوصفة بلا أدوية");
  if (a.items.length > 12) return fail(a, "عدد الأدوية كبير");

  const { data: rx, error } = await sb.from("prescriptions").insert({
    clinic_id: cid, patient_id: a.patient_id, doctor_id: actor,
    /* draft, never signed. A prescription is a doctor's signature and
       an assistant does not hold the pen. */
    status: "draft",
    diagnosis: a.diagnosis?.slice(0, 300) || null,
  }).select("id").single();
  if (error) throw new Error(error.message);

  const { error: itemErr } = await sb.from("prescription_items").insert(
    a.items.map((it, i) => ({
      prescription_id: rx.id, clinic_id: cid,
      drug_name: it.drug.slice(0, 160),
      dosage: it.dosage?.slice(0, 80) || null,
      frequency: it.frequency?.slice(0, 80) || null,
      duration: it.duration?.slice(0, 80) || null,
      instructions_ar: it.instructions?.slice(0, 300) || null,
      sort_order: i + 1,
    })),
  );
  if (itemErr) throw new Error(itemErr.message);

  return {
    action: a.type, done: true, prescription_id: rx.id, drugs: a.items.length,
    note: "أُنشئت كمسوّدة — تحتاج توقيع الطبيب قبل صرفها",
  };
}

async function note(sb: SB, a: Extract<OpsAction, { type: "add_clinical_note" }>, cid: string, actor: string) {
  id(a.patient_id, "patient_id");
  const text = a.note?.trim();
  if (!text) return fail(a, "الملاحظة فارغة");

  const { data, error } = await sb.from("patient_notes").insert({
    clinic_id: cid, patient_id: a.patient_id, doctor_id: actor,
    note_text: text.slice(0, 4000), is_private: Boolean(a.private),
  }).select("id, created_at").single();
  if (error) throw new Error(error.message);
  return { action: a.type, done: true, note: data };
}

async function completeItem(sb: SB, a: Extract<OpsAction, { type: "complete_plan_item" }>, cid: string) {
  id(a.item_id, "item_id");
  const { data, error } = await sb.from("treatment_plan_items")
    .update({ status: "done", done_at: new Date().toISOString() })
    .eq("id", a.item_id).eq("clinic_id", cid).eq("status", "pending")
    .select("id, description, plan_id").maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return fail(a, "البند غير موجود أو منجز بالفعل");

  const { data: left } = await sb.from("treatment_plan_items")
    .select("id").eq("plan_id", data.plan_id).eq("status", "pending");
  const remaining = left?.length ?? 0;

  /* Closing the last item closes the plan. Leaving a plan "in progress"
     with nothing left in it is how a clinic's reporting drifts. */
  if (remaining === 0) {
    await sb.from("treatment_plans").update({ status: "completed" }).eq("id", data.plan_id);
  }
  return { action: a.type, done: true, item: data.description, items_left: remaining };
}

/* ── the diary ────────────────────────────────────────────────────── */

async function blockDay(sb: SB, a: Extract<OpsAction, { type: "block_doctor_day" }>, cid: string, role: Role, actor: string) {
  const doctorId = role === "doctor" ? actor : a.doctor_id;
  id(doctorId, "doctor_id");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date)) return fail(a, "التاريخ بصيغة YYYY-MM-DD");

  /* Blocking a day that already has patients in it silently strands
     them. Say so and let a person decide. */
  const { data: booked } = await sb.from("appointments")
    .select("id").eq("clinic_id", cid).eq("doctor_id", doctorId)
    .gte("slot_time", `${a.date}T00:00:00+04:00`)
    .lt("slot_time", `${a.date}T23:59:59+04:00`)
    .not("status", "in", "(cancelled,no_show)").is("deleted_at", null);

  if ((booked?.length ?? 0) > 0) {
    return fail(a, `في هذا اليوم ${booked!.length} موعداً محجوزاً — أعيدي جدولتها أو ألغيها أولاً`);
  }

  const { data, error } = await sb.from("clinic_holidays").insert({
    clinic_id: cid, holiday_date: a.date,
    name: a.reason?.slice(0, 120) || "إجازة", name_ar: a.reason?.slice(0, 120) || "إجازة",
    applies_to_all_doctors: false, doctor_id: doctorId,
  }).select("id, holiday_date").single();
  if (error) throw new Error(error.message);
  return { action: a.type, done: true, blocked: data };
}

async function addService(sb: SB, a: Extract<OpsAction, { type: "add_service" }>, cid: string) {
  const name = a.name?.trim();
  const price = Number(a.price);
  if (!name) return fail(a, "اسم الخدمة ناقص");
  if (!Number.isFinite(price) || price < 0) return fail(a, "السعر غير صالح");

  const { data: dupe } = await sb.from("services")
    .select("id").eq("clinic_id", cid).ilike("name", name).is("deleted_at", null).maybeSingle();
  if (dupe) return fail(a, "توجد خدمة بنفس الاسم");

  const { data, error } = await sb.from("services").insert({
    clinic_id: cid, name, name_ar: name, price,
    duration_minutes: Math.min(480, Math.max(5, Number(a.duration_minutes ?? 30))),
    currency: "OMR", vat_applicable: true, is_active: true,
    category: a.category?.slice(0, 80) || null,
  }).select("id, name, price").single();
  if (error) throw new Error(error.message);
  return { action: a.type, done: true, service: data };
}

/* ── shared ───────────────────────────────────────────────────────── */

function id(v: string | undefined, field: string) {
  if (!v || !UUID.test(v)) {
    throw new Error(`${field} يجب أن يكون UUID حقيقياً من نتيجة استعلام في هذه المحادثة`);
  }
}

function fail(a: { type: string }, reason: string): OpsResult {
  return { action: a.type, done: false, reason };
}
