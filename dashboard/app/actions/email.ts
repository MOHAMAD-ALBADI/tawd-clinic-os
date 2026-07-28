"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { clinicRecipients, sendPlatformEmail, emailStatus } from "@/lib/email";
import { subscriptionInvoiceMail, dunningMail } from "@/lib/email-templates";
import { appOrigin } from "@/lib/thawani";

/* TAWD writing to its clinics about money.

   The subscription invoice existed only inside the platform dashboard, which is
   a screen the clinic never opens — so a clinic learned it owed something when
   somebody rang them, or when the account suspended itself. */

async function requirePlatform() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) throw new Error("غير مصرح");
  return claims;
}

const money = (v: number) => Math.round((Number(v) || 0) * 1000) / 1000;

/** Everything one platform invoice needs to be written about. */
async function invoiceFacts(invoiceId: string) {
  const sb = await createServiceRoleClient();
  const { data: inv } = await sb.from("platform_invoices")
    .select("id, number, clinic_id, period_start, period_end, total_omr, status, due_at, tawd_clinics!clinic_id(name, name_ar)")
    .eq("id", invoiceId).maybeSingle();
  if (!inv) return null;

  const { data: pays } = await sb.from("platform_payments")
    .select("amount_omr").eq("invoice_id", invoiceId);
  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount_omr ?? 0), 0);
  const clinic = inv.tawd_clinics as unknown as { name?: string; name_ar?: string } | null;

  return {
    id: inv.id as string,
    number: inv.number as string,
    clinicId: inv.clinic_id as string,
    clinicName: clinic?.name_ar ?? clinic?.name ?? "العيادة",
    periodStart: inv.period_start as string,
    periodEnd: inv.period_end as string,
    total: Number(inv.total_omr ?? 0),
    outstanding: money(Number(inv.total_omr ?? 0) - paid),
    status: inv.status as string,
    dueAt: (inv.due_at as string | null) ?? null,
  };
}

/* The clinic's own billing screen, which is where the pay-by-card button lives.
   Deep-linking there rather than to a generic login means the manager lands on
   the invoice instead of hunting for it. */
const payUrl = () => `${appOrigin()}/clinic-admin/settings`;

/** Send a clinic its subscription invoice. */
export async function emailSubscriptionInvoice(invoiceId: string) {
  const claims = await requirePlatform();
  const inv = await invoiceFacts(invoiceId);
  if (!inv) return { ok: false as const, reason: "الفاتورة غير موجودة" };
  if (inv.status === "void") return { ok: false as const, reason: "الفاتورة ملغاة" };

  const to = await clinicRecipients(inv.clinicId);
  const { subject, html } = subscriptionInvoiceMail({
    clinicName: inv.clinicName,
    number: inv.number,
    periodStart: inv.periodStart,
    periodEnd: inv.periodEnd,
    total: inv.total,
    outstanding: inv.outstanding,
    dueAt: inv.dueAt,
    payUrl: payUrl(),
  });

  const r = await sendPlatformEmail({
    clinicId: inv.clinicId, to, subject, html, kind: "subscription_invoice",
    refType: "platform_invoice", refId: invoiceId, sentBy: claims.sub,
  });
  if (!r.ok) return { ok: false as const, reason: r.reason };

  revalidatePath("/platform-admin/billing");
  return { ok: true as const, to: to.join(", ") };
}

/** Chase one overdue invoice. */
export async function emailDunning(invoiceId: string) {
  const claims = await requirePlatform();
  const inv = await invoiceFacts(invoiceId);
  if (!inv) return { ok: false as const, reason: "الفاتورة غير موجودة" };
  if (inv.status === "void") return { ok: false as const, reason: "الفاتورة ملغاة" };
  if (inv.outstanding <= 0) return { ok: false as const, reason: "الفاتورة مسدّدة" };

  const daysLate = inv.dueAt
    ? Math.floor((Date.now() - new Date(inv.dueAt).getTime()) / 86_400_000)
    : 0;

  const to = await clinicRecipients(inv.clinicId);
  const { subject, html } = dunningMail({
    clinicName: inv.clinicName,
    number: inv.number,
    outstanding: inv.outstanding,
    dueAt: inv.dueAt,
    daysLate,
    payUrl: payUrl(),
  });

  const r = await sendPlatformEmail({
    clinicId: inv.clinicId, to, subject, html, kind: "dunning",
    refType: "platform_invoice", refId: invoiceId, sentBy: claims.sub,
  });
  if (!r.ok) return { ok: false as const, reason: r.reason };

  revalidatePath("/platform-admin/billing");
  return { ok: true as const, to: to.join(", ") };
}

/** Chase every overdue invoice at once.

    One button rather than a nightly cron, deliberately: the operator sees who is
    about to be chased before anything leaves, and a clinic mid-dispute is not
    emailed a demand by a schedule at 3am. */
export async function emailAllOverdue() {
  const claims = await requirePlatform();
  const status = emailStatus();
  if (!status.configured) {
    return { ok: false as const, reason: "الإرسال غير مفعّل — أضف RESEND_API_KEY" };
  }

  const sb = await createServiceRoleClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: invoices } = await sb.from("platform_invoices")
    .select("id, due_at, status").neq("status", "void").lt("due_at", today).limit(200);

  const sent: string[] = [];
  const skipped: { number: string; why: string }[] = [];

  for (const row of invoices ?? []) {
    const inv = await invoiceFacts(row.id as string);
    if (!inv) continue;
    /* Paid invoices past their due date are not overdue — status alone is not
       enough here, because a part-payment leaves it open. */
    if (inv.outstanding <= 0) continue;
    const r = await emailDunning(inv.id);
    if (r.ok) sent.push(inv.number);
    else skipped.push({ number: inv.number, why: r.reason });
  }

  revalidatePath("/platform-admin/billing");
  return { ok: true as const, sent, skipped };
}
