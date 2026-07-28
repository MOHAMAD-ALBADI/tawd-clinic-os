"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

/* A PATIENT paying a clinic invoice by card.

   This is the optional half of Thawani, sold as the `online_payments` module,
   because most clinics here take money at the desk and will never want it. The
   other half — a clinic paying TAWD for its subscription — is core and lives in
   app/actions/subscription.ts.

   The loop already existed in n8n: WF-17 opens a checkout session, WF-16's
   webhook marks the link paid and books the payment, WF-24 expires stale links.
   This module is the clinic-facing half of it, writing the same `payment_links`
   row shape WF-17 writes so a link created here is settled by the same webhook.
   `thawani_session_id` is how WF-16 finds the link, so it must keep that name. */

import { appOrigin, createSession, thawaniConfig } from "@/lib/thawani";

async function requireFinance() {
  const claims = await getUserClaims();
  if (!claims || !(claims.role === "clinic_admin" || hasRole(claims, "accountant"))) {
    throw new Error("غير مصرح");
  }
  return claims;
}
const rev = () => {
  revalidatePath("/clinic-admin/finance/online");
  revalidatePath("/clinic-admin/finance/invoices");
};

/** Live-or-test tells the manager which Thawani environment their money is in. */
export async function thawaniStatus() {
  await requireFinance();
  return thawaniConfig();
}

/** Open a Thawani checkout session for an unpaid invoice and store the link. */
export async function createInvoicePaymentLink(invoiceId: string) {
  const claims = await requireFinance();

  const sb = await createServerSupabaseClient();
  const { data: inv } = await sb.from("invoices")
    .select("id, invoice_number, total, net_total, status, patients(name, phone)")
    .eq("id", invoiceId).eq("clinic_id", claims.clinic_id).is("deleted_at", null).maybeSingle();

  if (!inv) return { ok: false as const, reason: "الفاتورة غير موجودة" };
  if (inv.status === "paid") return { ok: false as const, reason: "الفاتورة مدفوعة بالفعل" };
  if (["cancelled", "refunded", "written_off"].includes(inv.status as string)) {
    return { ok: false as const, reason: "الفاتورة غير قابلة للتحصيل" };
  }

  /* What is left to collect, not the face value: a credit note reduced it, and
     payments may already have been taken at the desk. Asking a patient for the
     original amount after either is how a refund gets created. */
  const { data: paid } = await sb.from("payments").select("amount")
    .eq("invoice_id", invoiceId).eq("status", "completed");
  const already = (paid ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0);
  const amount = Math.round((Number(inv.net_total ?? inv.total ?? 0) - already) * 1000) / 1000;
  if (!(amount > 0)) return { ok: false as const, reason: "لا يوجد مبلغ مستحق على الفاتورة" };

  /* Don't stack links: an unexpired pending link for the same invoice is the
     answer to "send the patient a link", not a reason to open a second session. */
  const nowIso = new Date().toISOString();
  const { data: existing } = await sb.from("payment_links")
    .select("id, link_url, expires_at").eq("clinic_id", claims.clinic_id)
    .eq("invoice_id", invoiceId).eq("status", "pending")
    .gt("expires_at", nowIso).limit(1).maybeSingle();
  if (existing) return { ok: true as const, url: existing.link_url as string, reused: true };

  /* The return URLs are ours, not Thawani's. They used to point back at the
     gateway's own domain, so a patient who paid landed on a Thawani page with no
     idea whether their clinic had been told. */
  const origin = appOrigin();
  const session = await createSession({
    reference: invoiceId,
    productName: `فاتورة ${inv.invoice_number}`,
    amountOmr: amount,
    successUrl: `${origin}/pay/done?ref=${invoiceId}`,
    cancelUrl: `${origin}/pay/cancelled?ref=${invoiceId}`,
  });
  if (!session.ok) return { ok: false as const, reason: session.reason };

  const { error } = await sb.from("payment_links").insert({
    clinic_id: claims.clinic_id,
    invoice_id: invoiceId,
    link_url: session.url,
    thawani_session_id: session.sessionId,
    purpose: "invoice",
    amount,
    currency: "OMR",
    status: "pending",
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  });
  if (error) return { ok: false as const, reason: "أُنشئ الرابط لكن تعذّر حفظه" };

  rev();
  return { ok: true as const, url: session.url, reused: false };
}

/** Send an existing link to the patient over the clinic's WhatsApp number. */
export async function sendPaymentLink(linkId: string) {
  const claims = await requireFinance();
  const sb = await createServerSupabaseClient();
  const { data: link } = await sb.from("payment_links")
    .select("id, link_url, amount, status, invoices(invoice_number, patients(name, phone))")
    .eq("id", linkId).eq("clinic_id", claims.clinic_id).maybeSingle();

  if (!link) return { ok: false as const, reason: "الرابط غير موجود" };
  if (link.status !== "pending") return { ok: false as const, reason: "الرابط لم يعد صالحاً" };

  const inv = link.invoices as unknown as { invoice_number?: string; patients?: { name?: string; phone?: string } } | null;
  const phone = (inv?.patients?.phone ?? "").replace(/\D/g, "");
  if (!phone) return { ok: false as const, reason: "لا يوجد رقم جوال للمريض" };

  const svc = await createServiceRoleClient();
  const [{ data: cfg }, { data: clinic }] = await Promise.all([
    svc.from("channel_configs").select("config")
      .eq("clinic_id", claims.clinic_id).eq("channel", "whatsapp").eq("is_active", true).limit(1).maybeSingle(),
    svc.from("tawd_clinics").select("name_ar, name").eq("id", claims.clinic_id).single(),
  ]);
  const conf = cfg?.config as Record<string, string> | null;
  if (!conf?.access_token || !conf?.phone_number_id) {
    return { ok: false as const, reason: "واتساب العيادة غير مربوط" };
  }

  const amount = Number(link.amount ?? 0).toFixed(3);
  const body =
    `${inv?.patients?.name ? inv.patients.name + "، " : ""}فاتورتك ${inv?.invoice_number ?? ""} بمبلغ ${amount} ر.ع.\n` +
    `للدفع الإلكتروني:\n${link.link_url}\n\n${clinic?.name_ar ?? clinic?.name ?? ""}`;

  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${conf.phone_number_id}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${conf.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: phone, type: "text", text: { body } }),
    });
    if (!res.ok) return { ok: false as const, reason: "رفض واتساب الإرسال" };
  } catch {
    return { ok: false as const, reason: "تعذّر الإرسال عبر واتساب" };
  }
  return { ok: true as const };
}

/** Withdraw a link the clinic no longer wants honoured. */
export async function cancelPaymentLink(linkId: string) {
  const claims = await requireFinance();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("payment_links")
    .update({ status: "cancelled" })
    .eq("id", linkId).eq("clinic_id", claims.clinic_id).eq("status", "pending");
  if (error) return { ok: false as const, reason: "تعذّر إلغاء الرابط" };
  rev();
  return { ok: true as const };
}
