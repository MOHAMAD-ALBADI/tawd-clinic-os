"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";
import { MANUAL_STATUSES, type InvoiceStatus } from "@/lib/invoice-meta";
import { logClaimForInvoice } from "@/app/actions/insurance";
import { clawBackLoyaltyOnRefund } from "@/lib/loyalty-ledger";
import { METHODS, type PaymentMethod } from "@/lib/payment-methods";

export type InvoiceLineInput = {
  description: string;
  service_id?: string | null;
  quantity?: number;
  unit_price: number;
  vat_rate?: number; // fraction, e.g. 0.05 for Oman's standard 5%
};

const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

function revalidateInvoices() {
  revalidatePath("/clinic-admin/finance/invoices");
  revalidatePath("/clinic-admin/finance");
  revalidatePath("/clinic-admin/finance/online");
  revalidatePath("/clinic-admin");
  revalidatePath("/accountant");
  revalidatePath("/accountant/invoices");
}

async function requireFinance() {
  const claims = await getUserClaims();
  if (!claims || !(claims.role === "clinic_admin" || hasRole(claims, "accountant"))) {
    throw new Error("غير مصرح");
  }
  return claims;
}

export async function createInvoice(data: {
  patient_id: string;
  appt_id?: string | null;
  items: InvoiceLineInput[];
  status?: InvoiceStatus;
  due_date?: string | null;
  discount_amount?: number;
  notes?: string;
}) {
  const claims = await requireFinance();
  if (!data.patient_id) throw new Error("اختر المريض");
  if (!data.items?.length) throw new Error("أضف بنداً واحداً على الأقل");

  const supabase = await createServerSupabaseClient();

  const lines = data.items.map((it, i) => {
    const qty = Math.max(1, Number(it.quantity ?? 1) || 1);
    const unit = round3(it.unit_price);
    const line = round3(qty * unit);
    const vatRate = Number(it.vat_rate ?? 0) || 0;
    const vat = round3(line * vatRate);
    return {
      description: it.description?.trim() || "بند",
      description_ar: it.description?.trim() || null,
      service_id: it.service_id || null,
      quantity: qty,
      unit_price_snapshot: unit,
      vat_rate_snapshot: vatRate,
      vat_amount: vat,
      total: round3(line + vat),
      sort_order: i,
    };
  });

  const subtotal = round3(lines.reduce((s, l) => s + l.quantity * l.unit_price_snapshot, 0));
  const vatTotal = round3(lines.reduce((s, l) => s + l.vat_amount, 0));
  const discount = Math.min(round3(data.discount_amount ?? 0), subtotal);
  if (discount < 0) throw new Error("الخصم لا يكون سالباً");
  const total = round3(subtotal + vatTotal - discount);

  /* Allocated by the database so two invoices raised in the same second cannot
     collide on the (clinic_id, invoice_number) unique index. */
  const { data: numData, error: numErr } = await supabase.rpc("next_invoice_number", {
    p_clinic: claims.clinic_id,
  });
  if (numErr || !numData) throw new Error("تعذّر توليد رقم الفاتورة");
  const invoice_number = numData as string;

  const requested = data.status ?? "sent";
  const status: InvoiceStatus = MANUAL_STATUSES.includes(requested) ? requested : "sent";

  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      clinic_id:       claims.clinic_id,
      patient_id:      data.patient_id,
      appt_id:         data.appt_id || null,
      invoice_number,
      subtotal,
      discount_amount: discount,
      vat_amount:      vatTotal,
      total,
      status,
      due_date:        data.due_date || null,
      notes:           data.notes?.trim() || null,
    })
    .select("id, invoice_number, total")
    .single();
  if (error) throw new Error(error.message);

  const { error: itemsError } = await supabase
    .from("invoice_items")
    .insert(lines.map((l) => ({ ...l, invoice_id: inv.id, clinic_id: claims.clinic_id })));
  if (itemsError) {
    // Roll back the header so we never leave an orphan invoice.
    await supabase.from("invoices").delete().eq("id", inv.id).eq("clinic_id", claims.clinic_id);
    throw new Error(itemsError.message);
  }

  /* Only the cashier's appointment-billing path used to open claims, so an
     insured patient billed from here was simply never claimed for. Best-effort:
     the insurance side must not be able to fail a bill. */
  await logClaimForInvoice({
    clinicId: claims.clinic_id,
    patientId: data.patient_id,
    apptId: data.appt_id || null,
    invoiceId: inv.id,
    invoiceTotal: total,
  });

  revalidateInvoices();
  return { success: true, invoice: inv };
}

/** Record money actually received against an invoice.

    This is the only way an invoice becomes paid. It writes the payments row the
    finance overview, the day-close and the VAT return all read, then derives the
    invoice status from the sum of payments rather than trusting the caller. */
export async function recordInvoicePayment(
  invoiceId: string,
  amount: number,
  /* The shared type, so this path cannot fall behind the cashier's. It listed
     the four methods that existed before the clinic's own card terminal became
     one, which meant a manager taking a card payment had to mislabel it as a
     bank transfer — and the day-close then looked for it on the wrong report. */
  gateway: PaymentMethod,
  reference?: string,
) {
  const claims = await requireFinance();
  const amt = round3(amount);
  if (!(amt > 0)) return { ok: false as const, reason: "المبلغ يجب أن يكون أكبر من صفر" };

  const sb = await createServerSupabaseClient();
  const { data: inv } = await sb.from("invoices")
    .select("id, total, net_total, status").eq("id", invoiceId).eq("clinic_id", claims.clinic_id)
    .is("deleted_at", null).maybeSingle();
  if (!inv) return { ok: false as const, reason: "الفاتورة غير موجودة" };
  if (inv.status === "written_off") {
    return { ok: false as const, reason: "الفاتورة مشطوبة — أصدر فاتورة جديدة إن عاد المريض ليسدّد" };
  }
  if (["paid", "cancelled", "refunded"].includes(inv.status as string)) {
    return { ok: false as const, reason: "الفاتورة غير قابلة للتحصيل" };
  }

  const { data: prior } = await sb.from("payments").select("amount")
    .eq("invoice_id", invoiceId).eq("status", "completed");
  const already = round3((prior ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0));
  /* net_total, not total: a credit note reduced what is collectable, and taking
     the original amount would leave the invoice overpaid and owing a refund. */
  const collectable = round3(Number(inv.net_total ?? inv.total ?? 0));
  const due = round3(collectable - already);
  if (amt - due > 0.0005) {
    return { ok: false as const, reason: `المتبقّي على الفاتورة ${due.toFixed(3)} ر.ع فقط` };
  }

  /* Same accountability the cashier's path records: who took it and what the
     slip said. A payment entered from the manager's screen was landing with
     neither, so it appeared in the register as "غير مسجّل". */
  const meta = METHODS[gateway];
  const ref = reference?.trim() || null;
  if (meta?.refRequired && !ref) {
    return { ok: false as const, reason: `${meta.refLabel} مطلوب — بدونه لا يمكن مطابقة الدفعة` };
  }

  const { error: perr } = await sb.from("payments").insert({
    invoice_id: invoiceId,
    clinic_id: claims.clinic_id,
    gateway,
    currency: "OMR",
    amount: amt,
    status: "completed",
    paid_at: new Date().toISOString(),
    transaction_id: ref,
    received_by: claims.sub,
  });
  if (perr) return { ok: false as const, reason: "تعذّر تسجيل الدفعة" };

  const paidSum = round3(already + amt);
  const newStatus = paidSum >= collectable - 0.0005 ? "paid" : "partially_paid";
  const { error: uerr } = await sb.from("invoices")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", invoiceId).eq("clinic_id", claims.clinic_id);
  if (uerr) return { ok: false as const, reason: "سُجّلت الدفعة لكن تعذّر تحديث حالة الفاتورة" };

  revalidateInvoices();
  return { ok: true as const, status: newStatus, remaining: round3(collectable - paidSum) };
}

/** Refund, credit note or write-off against an invoice.

    The arithmetic is not done here. Reading the totals, deciding, then writing
    would be three round trips with no lock: two accountants refunding the same
    invoice at the same moment would both read the same "already refunded"
    figure, both pass the cap, and the clinic would hand back twice what it took.
    So the database does it in one locked transaction — cap, adjustment row, the
    write-off's expense, the new status and the collectable total together — and
    this function's job is the session, the role, and the things that happen
    around the money. */
export async function adjustInvoice(input: {
  invoiceId: string;
  kind: "refund" | "credit_note" | "write_off";
  amount: number;
  reason: string;
  method?: "cash" | "bank_transfer" | "thawani" | null;
}) {
  const claims = await requireFinance();
  const amount = round3(input.amount);
  if (!(amount > 0)) return { ok: false as const, reason: "المبلغ يجب أن يكون أكبر من صفر" };
  if (input.reason.trim().length < 3) return { ok: false as const, reason: "اكتب سبب التسوية" };

  const sb = await createServerSupabaseClient();
  const { data, error } = await sb.rpc("adjust_invoice", {
    p_invoice: input.invoiceId,
    p_kind:    input.kind,
    p_amount:  amount,
    p_reason:  input.reason.trim(),
    p_method:  input.kind === "refund" ? (input.method ?? null) : null,
  });
  /* The RPC raises readable Arabic — the cap, the missing reason, the wrong role
     — so it is shown rather than replaced with a generic failure. */
  if (error) return { ok: false as const, reason: error.message || "تعذّر تسجيل التسوية" };

  const r = (data ?? {}) as {
    status?: string; outstanding?: number; amount?: number; vat_amount?: number;
  };

  /* Points earned on money that has just gone back out. */
  let pointsTaken = 0;
  if (input.kind === "refund") {
    const { data: inv } = await sb.from("invoices")
      .select("patient_id").eq("id", input.invoiceId).eq("clinic_id", claims.clinic_id).maybeSingle();
    if (inv?.patient_id) {
      pointsTaken = await clawBackLoyaltyOnRefund(
        sb, claims.clinic_id, inv.patient_id as string, claims.sub, amount);
    }
  }

  revalidateInvoices();
  revalidatePath("/accountant/day-close");
  revalidatePath("/accountant/vat");
  if (input.kind === "write_off") revalidatePath("/clinic-admin/finance/expenses");

  return {
    ok: true as const,
    status: (r.status ?? "") as string,
    outstanding: Number(r.outstanding ?? 0),
    vatShare: Number(r.vat_amount ?? 0),
    pointsTaken,
  };
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const claims = await requireFinance();
  if (!MANUAL_STATUSES.includes(status)) {
    return { ok: false as const, reason: "حالة الدفع تُشتق من الدفعات المسجّلة — سجّل دفعة بدلاً من ذلك" };
  }
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("invoices")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر تحديث الحالة" };
  revalidateInvoices();
  return { ok: true as const };
}

/* Soft delete — financial records are never hard-deleted. */
export async function deleteInvoice(id: string) {
  const claims = await requireFinance();
  const supabase = await createServerSupabaseClient();

  /* Cancelling an invoice that has taken money would strand those payments
     against a void document; refund it instead. */
  const { data: paid } = await supabase.from("payments").select("id")
    .eq("invoice_id", id).eq("clinic_id", claims.clinic_id).eq("status", "completed").limit(1);
  if (paid?.length) {
    return { ok: false as const, reason: "الفاتورة عليها دفعات محصّلة — استخدم الاسترداد بدل الإلغاء" };
  }

  const { error } = await supabase
    .from("invoices")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر إلغاء الفاتورة" };
  revalidateInvoices();
  return { ok: true as const };
}
