"use server";

import { revalidatePath } from "next/cache";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { appOrigin, createSession } from "@/lib/thawani";
import { settleSubscriptionSession } from "@/lib/subscription-settle";

/* The clinic paying TAWD.

   Platform invoices could only be settled by the operator typing in a bank
   transfer after noticing it had landed. Every renewal therefore depended on
   somebody watching a bank account, and a clinic that wanted to pay by card
   simply could not.

   The manager of the clinic owns this, not the accountant: it is the clinic's
   own bill to the platform, not part of the clinic's books. */

async function requireOwner(clinicId: string) {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");
  if (hasRole(claims, "platform_admin")) return claims;
  if (claims.role !== "clinic_admin" || claims.clinic_id !== clinicId) {
    throw new Error("غير مصرح");
  }
  return claims;
}

const money = (v: number) => Math.round((Number(v) || 0) * 1000) / 1000;

/* Whether card payment is available at all is read straight from thawaniConfig()
   by the settings page. It was an action here for a moment, which would have made
   a needless network endpoint out of two booleans a server component can read. */

/** What is still owed on one platform invoice, read with the service client.

    The clinic can read its own platform invoices under RLS, but the amount that
    matters is invoice total less payments, and payments must be summed without
    depending on which policy the caller happens to satisfy. */
async function outstandingOf(
  sb: Awaited<ReturnType<typeof createServiceRoleClient>>,
  invoiceId: string,
) {
  const { data: inv } = await sb.from("platform_invoices")
    .select("id, clinic_id, number, total_omr, status")
    .eq("id", invoiceId).maybeSingle();
  if (!inv) return null;

  const { data: pays } = await sb.from("platform_payments")
    .select("amount_omr").eq("invoice_id", invoiceId);
  const paid = (pays ?? []).reduce((s, p) => s + Number(p.amount_omr ?? 0), 0);
  return {
    invoice: inv,
    outstanding: money(Number(inv.total_omr ?? 0) - paid),
  };
}

/** Open (or reuse) a Thawani checkout for a subscription invoice. */
export async function createSubscriptionPaymentLink(invoiceId: string) {
  const sb = await createServiceRoleClient();
  const found = await outstandingOf(sb, invoiceId);
  if (!found) return { ok: false as const, reason: "الفاتورة غير موجودة" };

  const { invoice, outstanding } = found;
  await requireOwner(invoice.clinic_id as string);

  if (invoice.status === "void") return { ok: false as const, reason: "الفاتورة ملغاة" };
  if (outstanding <= 0) return { ok: false as const, reason: "الفاتورة مسدّدة بالكامل" };

  /* An unexpired link for the same invoice IS the answer to "let me pay" — a
     second session would let the same invoice be paid twice. */
  const { data: existing } = await sb.from("payment_links")
    .select("id, link_url, expires_at").eq("platform_invoice_id", invoiceId)
    .eq("status", "pending").gt("expires_at", new Date().toISOString())
    .limit(1).maybeSingle();
  if (existing) return { ok: true as const, url: existing.link_url as string, reused: true };

  const origin = appOrigin();
  const session = await createSession({
    reference: invoiceId,
    productName: `اشتراك طَود — فاتورة ${invoice.number}`,
    amountOmr: outstanding,
    successUrl: `${origin}/api/thawani/subscription?ref=${invoiceId}`,
    cancelUrl: `${origin}/clinic-admin/settings?pay=cancelled`,
  });
  if (!session.ok) return { ok: false as const, reason: session.reason };

  const { error } = await sb.from("payment_links").insert({
    clinic_id: invoice.clinic_id,
    platform_invoice_id: invoiceId,
    link_url: session.url,
    thawani_session_id: session.sessionId,
    purpose: "subscription_renewal",
    amount: outstanding,
    currency: "OMR",
    status: "pending",
    /* Thirty minutes, same as the patient link: a checkout page left open for a
       day is a price that may no longer be the price. */
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (error) return { ok: false as const, reason: "أُنشئت الجلسة لكن تعذّر حفظ الرابط" };

  revalidatePath("/clinic-admin/settings");
  return { ok: true as const, url: session.url, reused: false };
}

/** Ask Thawani whether a pending link was paid, and book it if so.

    Needed because the redirect can be lost — the payer closes the tab, the
    network drops on the way back — and then the money has moved with nothing on
    our side to show it. This and the callback route both funnel into
    settleSubscriptionSession, so one confirmation cannot become two payments. */
export async function verifySubscriptionPayment(invoiceId: string) {
  const sb = await createServiceRoleClient();
  const found = await outstandingOf(sb, invoiceId);
  if (!found) return { ok: false as const, reason: "الفاتورة غير موجودة" };
  await requireOwner(found.invoice.clinic_id as string);

  const { data: links } = await sb.from("payment_links")
    .select("thawani_session_id")
    .eq("platform_invoice_id", invoiceId).eq("status", "pending")
    .order("created_at", { ascending: false }).limit(3);

  if (!links?.length) return { ok: false as const, reason: "لا يوجد رابط دفع معلّق" };

  for (const l of links) {
    const sid = l.thawani_session_id as string | null;
    if (!sid) continue;
    const r = await settleSubscriptionSession(sid);
    if (r.settled) {
      revalidatePath("/clinic-admin/settings");
      revalidatePath("/platform-admin/billing");
      return { ok: true as const, paid: true, amount: r.amount };
    }
  }
  return { ok: true as const, paid: false, amount: 0 };
}
