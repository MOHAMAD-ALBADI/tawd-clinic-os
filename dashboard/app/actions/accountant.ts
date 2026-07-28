"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { consumeServiceMaterials } from "@/app/actions/inventory";
import { logClaimForInvoice } from "@/app/actions/insurance";
import { logCommissionForInvoice } from "@/app/actions/commissions";
import { clinicToday, clinicDayRange } from "@/lib/clinic-time";
import { METHODS, bucketOf, type PaymentMethod } from "@/lib/payment-methods";
import { revalidatePath } from "next/cache";

async function requireAccountant() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) {
    throw new Error("غير مصرح");
  }
  return claims;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

type LoyaltyCfg = {
  is_active: boolean;
  points_per_omr: number;
  redemption_rate: number;
  min_redeem_points: number;
  max_redeem_pct: number;
  expiry_months: number;
};

async function getLoyaltyCfg(
  sb: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clinicId: string
): Promise<LoyaltyCfg | null> {
  const { data } = await sb
    .from("loyalty_settings")
    .select("is_active, points_per_omr, redemption_rate, min_redeem_points, max_redeem_pct, expiry_months")
    .eq("clinic_id", clinicId)
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return {
    is_active: true,
    points_per_omr: Number(data.points_per_omr ?? 1),
    redemption_rate: Number(data.redemption_rate ?? 0.03),
    min_redeem_points: Number(data.min_redeem_points ?? 100),
    max_redeem_pct: Number(data.max_redeem_pct ?? 30),
    expiry_months: Number(data.expiry_months ?? 6),
  };
}

/** Lazy expiry: no loyalty activity for expiry_months → balance zeroed (logged). Returns current balance. */
async function expireIfStale(
  sb: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  clinicId: string,
  patientId: string,
  expiryMonths: number
): Promise<number> {
  const { data: p } = await sb
    .from("patients").select("loyalty_points").eq("id", patientId).single();
  const balance = Number(p?.loyalty_points ?? 0);
  if (balance <= 0) return 0;

  const { data: lastTx } = await sb
    .from("loyalty_transactions")
    .select("created_at")
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1);
  const lastActivity = lastTx?.[0]?.created_at ? new Date(lastTx[0].created_at) : null;
  if (!lastActivity) return balance; // balance with no ledger history — leave as-is

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - expiryMonths);
  if (lastActivity > cutoff) return balance;

  await sb.from("patients").update({ loyalty_points: 0 }).eq("id", patientId);
  await sb.from("loyalty_transactions").insert({
    clinic_id: clinicId,
    patient_id: patientId,
    type: "expire",
    points: -balance,
    balance_after: 0,
    note: `انتهاء صلاحية النقاط (عدم نشاط ${expiryMonths} أشهر)`,
  });
  return 0;
}

/** Earn on paid amount (best-effort — never fails the payment). Returns earned points. */
async function earnOnPayment(
  sb: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  claims: { clinic_id: string; sub: string },
  patientId: string,
  appointmentId: string | null,
  amountPaid: number
): Promise<number> {
  try {
    const cfg = await getLoyaltyCfg(sb, claims.clinic_id);
    if (!cfg) return 0;
    const balance = await expireIfStale(sb, claims.clinic_id, patientId, cfg.expiry_months);
    const points = Math.floor(amountPaid * cfg.points_per_omr);
    if (points <= 0) return 0;
    const newBalance = balance + points;
    await sb.from("patients").update({ loyalty_points: newBalance }).eq("id", patientId);
    await sb.from("loyalty_transactions").insert({
      clinic_id: claims.clinic_id,
      patient_id: patientId,
      appointment_id: appointmentId,
      type: "earn_visit",
      points,
      balance_after: newBalance,
      note: `كسب تلقائي — دفعة ${round3(amountPaid)} ر.ع`,
      created_by: claims.sub,
    });
    return points;
  } catch {
    return 0;
  }
}

/** Invoice a completed appointment (idempotent — returns the existing one if present).
    VAT: service-specific vat_rules row → clinic default rule → Oman standard 5%. */
export async function createInvoiceForAppointment(appointmentId: string) {
  const claims = await requireAccountant();
  const sb = await createServerSupabaseClient();

  const { data: appt, error: aerr } = await sb
    .from("appointments")
    .select("id, patient_id, service_id, doctor_id, status, services(name_ar, name, price)")
    .eq("id", appointmentId)
    .eq("clinic_id", claims.clinic_id)
    .is("deleted_at", null)
    .single();
  if (aerr || !appt) return { ok: false as const, reason: "الموعد غير موجود" };
  if (appt.status !== "completed") return { ok: false as const, reason: "الفوترة متاحة للمواعيد المكتملة فقط" };

  const { data: existing } = await sb
    .from("invoices").select("id, total, invoice_number")
    .eq("appt_id", appointmentId).is("deleted_at", null).limit(1);
  if (existing?.length) {
    return {
      ok: true as const,
      invoiceId: existing[0].id,
      total: Number(existing[0].total),
      invoiceNumber: existing[0].invoice_number as string,
      existed: true,
    };
  }

  const svc = appt.services as unknown as { name_ar: string | null; name: string | null; price: number } | null;
  const price = Number(svc?.price ?? 0);

  /* VAT rate: service rule → clinic-wide rule → 5% (Oman standard) */
  const { data: rules } = await sb
    .from("vat_rules").select("service_id, vat_applicable, rate")
    .eq("clinic_id", claims.clinic_id);
  const rule =
    (rules ?? []).find((r) => r.service_id === appt.service_id) ??
    (rules ?? []).find((r) => r.service_id === null);
  const rate = rule ? (rule.vat_applicable ? Number(rule.rate) : 0) : 5;

  const subtotal = round3(price);
  const vatAmount = round3((subtotal * rate) / 100);
  const total = round3(subtotal + vatAmount);

  /* Same allocator the manager's invoice form uses. Two count-based schemes ran
     here before — one counting the month's invoices, one counting all of them —
     so the cashier and the manager could compute the same number and one of them
     would hit the (clinic_id, invoice_number) unique index. */
  const { data: numData, error: numErr } = await sb.rpc("next_invoice_number", {
    p_clinic: claims.clinic_id,
  });
  if (numErr || !numData) return { ok: false as const, reason: "تعذّر توليد رقم الفاتورة" };
  const invoiceNumber = numData as string;

  const { data: inv, error: ierr } = await sb
    .from("invoices")
    .insert({
      clinic_id: claims.clinic_id,
      appt_id: appointmentId,
      patient_id: appt.patient_id,
      invoice_number: invoiceNumber,
      subtotal,
      discount_amount: 0,
      vat_amount: vatAmount,
      total,
      currency: "OMR",
      status: "sent",
      due_date: clinicToday(),
    })
    .select("id")
    .single();
  if (ierr || !inv) return { ok: false as const, reason: "تعذّر إنشاء الفاتورة" };

  const { error: iterr } = await sb.from("invoice_items").insert({
    invoice_id: inv.id,
    clinic_id: claims.clinic_id,
    service_id: appt.service_id,
    description: svc?.name ?? svc?.name_ar ?? "خدمة",
    description_ar: svc?.name_ar ?? svc?.name ?? "خدمة",
    quantity: 1,
    unit_price_snapshot: subtotal,
    vat_rate_snapshot: rate,
    vat_amount: vatAmount,
    total,
    sort_order: 1,
  });
  if (iterr) return { ok: false as const, reason: "أُنشئت الفاتورة لكن تعذّر تسجيل بنودها" };

  // Auto-deduct this service's materials from stock (single point per invoice;
  // best-effort — a stock hiccup must never block billing a delivered service).
  if (appt.service_id) {
    await consumeServiceMaterials(appt.service_id, "invoice", inv.id);
  }
  // Auto-open an insurance claim if this patient has active coverage (best-effort).
  await logClaimForInvoice({
    clinicId: claims.clinic_id, patientId: appt.patient_id,
    apptId: appointmentId, invoiceId: inv.id, invoiceTotal: total,
  });
  // Accrue the treating doctor's commission if their HR profile sets a rate (best-effort).
  await logCommissionForInvoice({ clinicId: claims.clinic_id, doctorId: appt.doctor_id ?? null, invoiceId: inv.id, invoiceTotal: total });

  revalidatePath("/accountant");
  return { ok: true as const, invoiceId: inv.id, total, invoiceNumber, existed: false };
}

/** Record a payment against an invoice and roll the invoice status forward.

    The method is the real one — the clinic's card machine is not a bank transfer
    — and it carries the reference off the slip, because a payment nobody can
    match to a terminal report or a bank statement is a number the clinic has to
    take on trust. `received_by` is who was standing at the desk: without it a
    short till has no owner. */
export async function recordPayment(
  invoiceId: string,
  gateway: PaymentMethod,
  amount: number,
  reference?: string,
) {
  const claims = await requireAccountant();
  const sb = await createServerSupabaseClient();
  if (!(amount > 0)) return { ok: false as const, reason: "المبلغ غير صالح" };

  const meta = METHODS[gateway];
  if (!meta) return { ok: false as const, reason: "طريقة دفع غير معروفة" };
  const ref = reference?.trim() || null;
  if (meta.refRequired && !ref) {
    return { ok: false as const, reason: `${meta.refLabel} مطلوب — بدونه لا يمكن مطابقة الدفعة` };
  }

  const { data: inv, error: ierr } = await sb
    .from("invoices").select("id, total, net_total, status, patient_id, appt_id")
    .eq("id", invoiceId).eq("clinic_id", claims.clinic_id).is("deleted_at", null).single();
  if (ierr || !inv) return { ok: false as const, reason: "الفاتورة غير موجودة" };
  if (inv.status === "written_off") {
    return { ok: false as const, reason: "الفاتورة مشطوبة — أصدر فاتورة جديدة إن عاد المريض ليسدّد" };
  }
  if (["paid", "cancelled", "refunded"].includes(inv.status)) {
    return { ok: false as const, reason: "الفاتورة غير قابلة للتحصيل" };
  }

  /* What is collectable, after any credit note — not what was invoiced. */
  const collectable = round3(Number(inv.net_total ?? inv.total ?? 0));

  const { error: perr } = await sb.from("payments").insert({
    invoice_id: invoiceId,
    clinic_id: claims.clinic_id,
    gateway,
    currency: "OMR",
    amount: round3(amount),
    status: "completed",
    paid_at: new Date().toISOString(),
    transaction_id: ref,
    received_by: claims.sub,
  });
  if (perr) return { ok: false as const, reason: "تعذّر تسجيل الدفعة" };

  const { data: pays } = await sb
    .from("payments").select("amount")
    .eq("invoice_id", invoiceId).eq("status", "completed");
  const paidSum = round3((pays ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0));
  const newStatus = paidSum >= collectable - 0.0005 ? "paid" : "partially_paid";

  const { error: uerr } = await sb
    .from("invoices")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (uerr) return { ok: false as const, reason: "سُجّلت الدفعة لكن تعذّر تحديث حالة الفاتورة" };

  /* loyalty: earn on what was actually paid (never blocks the payment) */
  const earnedPoints = await earnOnPayment(sb, claims, inv.patient_id, inv.appt_id, amount);

  revalidatePath("/accountant");
  return { ok: true as const, status: newStatus, paidSum, earnedPoints };
}

/** Redeem points as a discount on an open invoice (capped, thresholded, audited). */
export async function redeemPoints(invoiceId: string, points: number) {
  const claims = await requireAccountant();
  const sb = await createServerSupabaseClient();

  const cfg = await getLoyaltyCfg(sb, claims.clinic_id);
  if (!cfg) return { ok: false as const, reason: "نظام الولاء غير مفعّل" };

  const { data: inv } = await sb
    .from("invoices")
    .select("id, subtotal, discount_amount, vat_amount, total, status, patient_id")
    .eq("id", invoiceId).eq("clinic_id", claims.clinic_id).is("deleted_at", null).single();
  if (!inv) return { ok: false as const, reason: "الفاتورة غير موجودة" };
  if (!["sent", "partially_paid", "overdue", "draft"].includes(inv.status)) {
    return { ok: false as const, reason: "الفاتورة غير قابلة للخصم" };
  }

  const balance = await expireIfStale(sb, claims.clinic_id, inv.patient_id, cfg.expiry_months);
  if (balance < cfg.min_redeem_points) {
    return { ok: false as const, reason: `الاستبدال يبدأ من ${cfg.min_redeem_points} نقطة — رصيده ${balance}` };
  }

  const maxValue = round3((Number(inv.total) * cfg.max_redeem_pct) / 100);
  const maxPoints = Math.floor(maxValue / cfg.redemption_rate);
  const usePoints = Math.min(Math.max(1, Math.floor(points)), balance, maxPoints);
  if (usePoints <= 0) return { ok: false as const, reason: "لا يمكن الاستبدال على هذه الفاتورة" };
  const value = round3(usePoints * cfg.redemption_rate);

  const newDiscount = round3(Number(inv.discount_amount ?? 0) + value);
  const newTotal = round3(Number(inv.total) - value);

  const { error: uerr } = await sb
    .from("invoices")
    .update({ discount_amount: newDiscount, total: newTotal, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (uerr) return { ok: false as const, reason: "تعذّر تطبيق الخصم" };

  const newBalance = balance - usePoints;
  await sb.from("patients").update({ loyalty_points: newBalance }).eq("id", inv.patient_id);
  await sb.from("loyalty_transactions").insert({
    clinic_id: claims.clinic_id,
    patient_id: inv.patient_id,
    type: "redeem",
    points: -usePoints,
    balance_after: newBalance,
    note: `استبدال نقاط — خصم ${value} ر.ع على الفاتورة`,
    created_by: claims.sub,
  });

  revalidatePath("/accountant");
  return { ok: true as const, usedPoints: usePoints, value, newTotal, balanceAfter: newBalance };
}

export type DayCloseInput = {
  openingFloat: number;
  countedCash: number;
  notes?: string;
};

/** End-of-day reconciliation: system totals by method vs counted cash → variance. */
export async function closeDay(input: DayCloseInput) {
  const claims = await requireAccountant();
  const sb = await createServerSupabaseClient();

  /* The day being closed is the CLINIC's day, not UTC's. Oman is +4, so a
     UTC-dated window starts at 04:00 Muscat and ends at 03:59 the next morning:
     money taken between midnight and 4am fell outside the close for its own day
     and outside the next one too — it simply never got reconciled, and the
     drawer came up short with no explanation. */
  const today = clinicToday();
  const { startUtc, endUtc } = clinicDayRange(today);

  const [{ data: pays }, { data: refunds }] = await Promise.all([
    sb.from("payments")
      .select("gateway, amount")
      .eq("clinic_id", claims.clinic_id)
      .eq("status", "completed")
      .gte("paid_at", startUtc)
      .lt("paid_at", endUtc),
    /* Cash handed back left the drawer. Counting only what came in meant the
       till was short by exactly the refund and the variance read as missing
       money — the close accused the cashier of the thing it had failed to
       record. Card reversals are the bank's problem, not the drawer's. */
    sb.from("invoice_adjustments")
      .select("amount")
      .eq("clinic_id", claims.clinic_id)
      .eq("kind", "refund")
      .eq("method", "cash")
      .gte("created_at", startUtc)
      .lt("created_at", endUtc),
  ]);

  /* One figure per document the clinic can actually check against: the drawer it
     counts, the card machine's own settlement report, and the bank statement.
     These three used to be two, with the terminal and the bank folded together
     into "card" — a number that matches neither report. */
  let cash = 0, card = 0, transfer = 0, other = 0;
  for (const p of pays ?? []) {
    const amt = Number(p.amount ?? 0);
    switch (bucketOf(p.gateway as string)) {
      case "drawer":   cash += amt; break;
      case "terminal": card += amt; break;
      case "bank":     transfer += amt; break;
      default:         other += amt;
    }
  }
  cash = round3(cash); card = round3(card); transfer = round3(transfer); other = round3(other);
  const cashRefunds = round3((refunds ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0));

  const expectedCash = round3(Number(input.openingFloat) + cash - cashRefunds);
  const variance = round3(Number(input.countedCash) - expectedCash);

  const { error } = await sb.from("cashier_day_closes").upsert(
    {
      clinic_id: claims.clinic_id,
      close_date: today,
      opening_float: round3(Number(input.openingFloat)),
      counted_cash: round3(Number(input.countedCash)),
      system_cash: cash,
      system_card: card,
      system_transfer: transfer,
      system_other: other,
      system_refunds: cashRefunds,
      variance,
      notes: input.notes?.trim() || null,
      closed_by: claims.sub,
    },
    { onConflict: "clinic_id,close_date" }
  );
  if (error) return { ok: false as const, reason: "تعذّر حفظ الإغلاق" };

  revalidatePath("/accountant/day-close");
  return {
    ok: true as const, systemCash: cash, systemCard: card,
    systemTransfer: transfer, systemOther: other,
    cashRefunds, expectedCash, variance,
  };
}

/** Undo a payment that was recorded by mistake.

    A typo is not a refund. A refund says money left the drawer; a mis-keyed
    payment means money never arrived, and recording it as a refund would make
    the till wrong a second time in the other direction. So the row stays, marked
    void with a reason and a name, and every sum of money received ignores it.

    Refused once the day is closed: those totals have been counted against a
    drawer, a terminal report and a bank statement, and silently changing them
    afterwards makes a signed-off reconciliation untrue. A closed day is corrected
    on the invoice instead — a refund if the money really did go back, a credit
    note if the invoice was wrong. */
export async function voidPayment(paymentId: string, reason: string) {
  const claims = await requireAccountant();
  const sb = await createServerSupabaseClient();

  const why = reason.trim();
  if (why.length < 3) return { ok: false as const, reason: "اكتب سبب الإلغاء — يبقى في السجل" };

  const { data: pay } = await sb.from("payments")
    .select("id, amount, paid_at, voided_at, invoice_id, gateway")
    .eq("id", paymentId).eq("clinic_id", claims.clinic_id).maybeSingle();
  if (!pay) return { ok: false as const, reason: "الدفعة غير موجودة" };
  if (pay.voided_at) return { ok: false as const, reason: "الدفعة ملغاة أصلاً" };

  /* The clinic's own day, not UTC's — Oman is +4, so anything taken before 4am
     would otherwise be tested against the wrong date. */
  const day = clinicToday(new Date(pay.paid_at as string));
  const { data: closed } = await sb.from("cashier_day_closes")
    .select("close_date").eq("clinic_id", claims.clinic_id).eq("close_date", day).limit(1);
  if (closed?.length) {
    return {
      ok: false as const,
      reason: `يوم ${day} مُغلق ومطابَق — صحّح على الفاتورة باسترداد أو إشعار دائن بدل إلغاء الدفعة`,
    };
  }

  /* status leaves 'completed', which is what actually removes it from the money.
     Fifteen screens sum payments and every one filters on completed, so the void
     is invisible to none of them — a flag only some of them checked is how the
     cashier's screen and the manager's revenue end up disagreeing. */
  const { error } = await sb.from("payments").update({
    status: "voided",
    voided_at: new Date().toISOString(),
    voided_by: claims.sub,
    void_reason: why,
    updated_at: new Date().toISOString(),
  }).eq("id", paymentId).eq("clinic_id", claims.clinic_id).is("voided_at", null);
  if (error) return { ok: false as const, reason: "تعذّر إلغاء الدفعة" };

  /* The invoice's status is derived from live payments, so it has to be
     recomputed — leaving it "paid" after removing the payment that paid it is
     exactly the bug class this product keeps tripping over. */
  const { data: inv } = await sb.from("invoices")
    .select("id, total, net_total, status").eq("id", pay.invoice_id).maybeSingle();
  if (inv) {
    const { data: live } = await sb.from("payments").select("amount")
      .eq("invoice_id", pay.invoice_id).eq("status", "completed");
    const paidSum = round3((live ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0));
    const collectable = round3(Number(inv.net_total ?? inv.total ?? 0));
    /* Only the payment-derived statuses are ours to set. A cancelled, refunded or
       written-off invoice was put there by a decision, not by arithmetic. */
    if (["paid", "partially_paid", "sent", "overdue"].includes(inv.status as string)) {
      const next = paidSum >= collectable - 0.0005 ? "paid"
        : paidSum > 0.0005 ? "partially_paid"
        : inv.status === "overdue" ? "overdue" : "sent";
      await sb.from("invoices")
        .update({ status: next, updated_at: new Date().toISOString() })
        .eq("id", pay.invoice_id);
    }
  }

  revalidatePath("/accountant");
  revalidatePath("/accountant/payments");
  revalidatePath("/accountant/invoices");
  revalidatePath("/accountant/day-close");
  return { ok: true as const };
}

/** Save the clinic VAT registration number (shown on printed tax invoices). */
export async function updateVatNumber(vatNumber: string) {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) {
    throw new Error("غير مصرح");
  }
  const sb = await createServerSupabaseClient();
  const { error } = await sb
    .from("tawd_clinics")
    .update({ vat_number: vatNumber.trim() || null })
    .eq("id", claims.clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/settings");
  revalidatePath("/accountant");
}
