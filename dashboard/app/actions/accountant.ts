"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

async function requireAccountant() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "accountant") || claims.role === "clinic_admin")) {
    throw new Error("غير مصرح");
  }
  return claims;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Invoice a completed appointment (idempotent — returns the existing one if present).
    VAT: service-specific vat_rules row → clinic default rule → Oman standard 5%. */
export async function createInvoiceForAppointment(appointmentId: string) {
  const claims = await requireAccountant();
  const sb = await createServerSupabaseClient();

  const { data: appt, error: aerr } = await sb
    .from("appointments")
    .select("id, patient_id, service_id, status, services(name_ar, name, price)")
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

  /* sequential number: INV-YYYYMM-#### */
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  const { count } = await sb
    .from("invoices").select("id", { count: "exact", head: true })
    .eq("clinic_id", claims.clinic_id)
    .ilike("invoice_number", `INV-${ym}-%`);
  const invoiceNumber = `INV-${ym}-${String((count ?? 0) + 1).padStart(4, "0")}`;

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
      due_date: new Date().toISOString().split("T")[0],
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

  revalidatePath("/accountant");
  return { ok: true as const, invoiceId: inv.id, total, invoiceNumber, existed: false };
}

/** Record a payment against an invoice and roll the invoice status forward. */
export async function recordPayment(
  invoiceId: string,
  gateway: "cash" | "bank_transfer",
  amount: number
) {
  const claims = await requireAccountant();
  const sb = await createServerSupabaseClient();
  if (!(amount > 0)) return { ok: false as const, reason: "المبلغ غير صالح" };

  const { data: inv, error: ierr } = await sb
    .from("invoices").select("id, total, status")
    .eq("id", invoiceId).eq("clinic_id", claims.clinic_id).is("deleted_at", null).single();
  if (ierr || !inv) return { ok: false as const, reason: "الفاتورة غير موجودة" };
  if (["paid", "cancelled", "refunded"].includes(inv.status)) {
    return { ok: false as const, reason: "الفاتورة غير قابلة للتحصيل" };
  }

  const { error: perr } = await sb.from("payments").insert({
    invoice_id: invoiceId,
    clinic_id: claims.clinic_id,
    gateway,
    currency: "OMR",
    amount: round3(amount),
    status: "completed",
    paid_at: new Date().toISOString(),
  });
  if (perr) return { ok: false as const, reason: "تعذّر تسجيل الدفعة" };

  const { data: pays } = await sb
    .from("payments").select("amount")
    .eq("invoice_id", invoiceId).eq("status", "completed");
  const paidSum = round3((pays ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0));
  const newStatus = paidSum >= Number(inv.total) - 0.0005 ? "paid" : "partially_paid";

  const { error: uerr } = await sb
    .from("invoices")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", invoiceId);
  if (uerr) return { ok: false as const, reason: "سُجّلت الدفعة لكن تعذّر تحديث حالة الفاتورة" };

  revalidatePath("/accountant");
  return { ok: true as const, status: newStatus, paidSum };
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

  const today = new Date().toISOString().split("T")[0];
  const { data: pays } = await sb
    .from("payments")
    .select("gateway, amount")
    .eq("clinic_id", claims.clinic_id)
    .eq("status", "completed")
    .gte("paid_at", `${today}T00:00:00`)
    .lte("paid_at", `${today}T23:59:59`);

  let cash = 0, card = 0, other = 0;
  for (const p of pays ?? []) {
    const amt = Number(p.amount ?? 0);
    if (p.gateway === "cash") cash += amt;
    else if (p.gateway === "bank_transfer" || p.gateway === "thawani") card += amt;
    else other += amt;
  }
  cash = round3(cash); card = round3(card); other = round3(other);

  const expectedCash = round3(Number(input.openingFloat) + cash);
  const variance = round3(Number(input.countedCash) - expectedCash);

  const { error } = await sb.from("cashier_day_closes").upsert(
    {
      clinic_id: claims.clinic_id,
      close_date: today,
      opening_float: round3(Number(input.openingFloat)),
      counted_cash: round3(Number(input.countedCash)),
      system_cash: cash,
      system_card: card,
      system_other: other,
      variance,
      notes: input.notes?.trim() || null,
      closed_by: claims.sub,
    },
    { onConflict: "clinic_id,close_date" }
  );
  if (error) return { ok: false as const, reason: "تعذّر حفظ الإغلاق" };

  revalidatePath("/accountant/day-close");
  return { ok: true as const, systemCash: cash, systemCard: card, systemOther: other, expectedCash, variance };
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
