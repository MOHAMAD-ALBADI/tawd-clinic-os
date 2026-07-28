"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { clinicIdentity, sendClinicEmail, looksLikeEmail } from "@/lib/email";
import { invoiceEmail, receiptEmail, statementEmail } from "@/lib/email-templates";
import { buildStatement } from "@/lib/patient-statement";
import { METHOD_AR } from "@/lib/payment-methods";

/* Sending a patient their own paperwork.

   Everything the product produced could be printed and delivered by no other
   means, so "email me my invoice" was answered with a photograph of a screen.

   Each of these rebuilds the document from the database at send time rather than
   taking figures from the caller — a client that passes its own totals is a
   client that can email a patient the wrong balance. */

async function requireFinance() {
  const claims = await getUserClaims();
  if (!claims || !(claims.role === "clinic_admin" || hasRole(claims, "accountant"))) {
    throw new Error("غير مصرح");
  }
  return claims;
}

const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;
const dateOnly = (iso: string) => iso.slice(0, 10);

/** Email a patient their invoice. */
export async function emailInvoice(invoiceId: string, override?: string) {
  const claims = await requireFinance();
  const sb = await createServerSupabaseClient();

  const [{ data: inv }, { data: items }] = await Promise.all([
    sb.from("invoices")
      .select("id, invoice_number, total, net_total, vat_amount, created_at, patient_id, patients!patient_id(name, email)")
      .eq("id", invoiceId).eq("clinic_id", claims.clinic_id).is("deleted_at", null).maybeSingle(),
    sb.from("invoice_items")
      .select("description, description_ar, quantity, total")
      .eq("invoice_id", invoiceId).eq("clinic_id", claims.clinic_id).order("sort_order"),
  ]);
  if (!inv) return { ok: false as const, reason: "الفاتورة غير موجودة" };

  const patient = inv.patients as unknown as { name?: string; email?: string | null } | null;
  const to = override?.trim() || patient?.email || "";
  if (!looksLikeEmail(to)) {
    return { ok: false as const, reason: "لا يوجد بريد إلكتروني لهذا المريض" };
  }

  const { data: pays } = await sb.from("payments").select("amount")
    .eq("invoice_id", invoiceId).eq("status", "completed");
  const paid = round3((pays ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0));
  const collectable = round3(Number(inv.net_total ?? inv.total ?? 0));

  const identity = await clinicIdentity(claims.clinic_id);
  const { subject, html } = invoiceEmail(identity, {
    number: inv.invoice_number as string,
    patientName: patient?.name ?? "عميلنا",
    date: dateOnly(inv.created_at as string),
    total: Number(inv.total ?? 0),
    vat: Number(inv.vat_amount ?? 0),
    paid,
    outstanding: round3(collectable - paid),
    items: (items ?? []).map((i) => ({
      description: (i.description_ar as string) || (i.description as string) || "بند",
      quantity: Number(i.quantity ?? 1),
      total: Number(i.total ?? 0),
    })),
  });

  const r = await sendClinicEmail({
    clinicId: claims.clinic_id, to, subject, html, kind: "invoice",
    patientId: (inv.patient_id as string) ?? null,
    refType: "invoice", refId: invoiceId, sentBy: claims.sub,
  });
  if (!r.ok) return { ok: false as const, reason: r.reason };

  revalidatePath("/accountant/invoices");
  revalidatePath(`/accountant/invoices/${invoiceId}`);
  return { ok: true as const, to };
}

/** Email a patient the receipt for one payment. */
export async function emailReceipt(paymentId: string, override?: string) {
  const claims = await requireFinance();
  const sb = await createServerSupabaseClient();

  const { data: pay } = await sb.from("payments")
    .select("id, amount, gateway, paid_at, status, invoice_id, invoices!invoice_id(invoice_number, patient_id, patients!patient_id(name, email))")
    .eq("id", paymentId).eq("clinic_id", claims.clinic_id).maybeSingle();
  if (!pay) return { ok: false as const, reason: "الدفعة غير موجودة" };
  /* A voided payment is not a receipt. Emailing one would hand the patient proof
     of something the clinic has already decided did not happen. */
  if (pay.status !== "completed") {
    return { ok: false as const, reason: "الدفعة ملغاة — لا يُرسل سند لها" };
  }

  const inv = pay.invoices as unknown as
    { invoice_number?: string; patient_id?: string; patients?: { name?: string; email?: string | null } | null } | null;
  const to = override?.trim() || inv?.patients?.email || "";
  if (!looksLikeEmail(to)) {
    return { ok: false as const, reason: "لا يوجد بريد إلكتروني لهذا المريض" };
  }

  const identity = await clinicIdentity(claims.clinic_id);
  const { subject, html } = receiptEmail(identity, {
    receiptNo: String(pay.id).slice(0, 8).toUpperCase(),
    patientName: inv?.patients?.name ?? "عميلنا",
    amount: Number(pay.amount ?? 0),
    method: METHOD_AR(pay.gateway as string),
    paidAt: dateOnly(pay.paid_at as string),
    invoiceNumber: inv?.invoice_number ?? null,
  });

  const r = await sendClinicEmail({
    clinicId: claims.clinic_id, to, subject, html, kind: "receipt",
    patientId: inv?.patient_id ?? null,
    refType: "payment", refId: paymentId, sentBy: claims.sub,
  });
  if (!r.ok) return { ok: false as const, reason: r.reason };

  revalidatePath("/accountant/payments");
  return { ok: true as const, to };
}

/** Email a patient their statement of account. */
export async function emailStatement(patientId: string, override?: string) {
  const claims = await requireFinance();
  const sb = await createServerSupabaseClient();

  const { data: patient } = await sb.from("patients")
    .select("id, name, email").eq("id", patientId).eq("clinic_id", claims.clinic_id)
    .is("deleted_at", null).maybeSingle();
  if (!patient) return { ok: false as const, reason: "المريض غير موجود" };

  const to = override?.trim() || (patient.email as string | null) || "";
  if (!looksLikeEmail(to)) {
    return { ok: false as const, reason: "لا يوجد بريد إلكتروني لهذا المريض" };
  }

  const st = await buildStatement(sb, claims.clinic_id, patientId);
  if (!st.lines.length) {
    return { ok: false as const, reason: "لا حركات مالية لهذا المريض" };
  }

  const identity = await clinicIdentity(claims.clinic_id);
  const { subject, html } = statementEmail(identity, {
    patientName: (patient.name as string) ?? "عميلنا",
    billed: st.billed,
    collected: st.collected,
    balance: st.balance,
    lines: st.lines.map((l) => ({
      at: dateOnly(l.at), label: l.label, delta: l.delta, balance: l.balance,
    })),
  });

  const r = await sendClinicEmail({
    clinicId: claims.clinic_id, to, subject, html, kind: "statement",
    patientId, refType: "patient", refId: patientId, sentBy: claims.sub,
  });
  if (!r.ok) return { ok: false as const, reason: r.reason };

  revalidatePath(`/accountant/patients/${patientId}`);
  return { ok: true as const, to };
}
