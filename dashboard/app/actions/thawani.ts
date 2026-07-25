"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

/* Thawani (ثواني) is Oman's card gateway. The whole loop already existed in n8n —
   WF-17 opens a checkout session, WF-16's webhook marks the link paid and books
   the payment, WF-24 expires stale links — but the clinic had no way to start one
   or to see any of it. This module is the missing half.

   It writes the same `payment_links` row shape WF-17 writes, so a link created
   here is settled by the same webhook. The two paths must stay in agreement:
   the checkout URL format and `thawani_session_id` are how WF-16 finds the link. */

const THAWANI_BASE = process.env.THAWANI_BASE_URL || "https://uatcheckout.thawani.om";

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
  return {
    configured: !!process.env.THAWANI_SECRET_KEY && !!process.env.THAWANI_PUBLIC_KEY,
    live: !THAWANI_BASE.includes("uat"),
    baseUrl: THAWANI_BASE,
  };
}

/** Open a Thawani checkout session for an unpaid invoice and store the link. */
export async function createInvoicePaymentLink(invoiceId: string) {
  const claims = await requireFinance();
  const secret = process.env.THAWANI_SECRET_KEY;
  const publicKey = process.env.THAWANI_PUBLIC_KEY;
  if (!secret || !publicKey) {
    return { ok: false as const, reason: "مفاتيح ثواني غير مضبوطة — أضفها في إعدادات النشر" };
  }

  const sb = await createServerSupabaseClient();
  const { data: inv } = await sb.from("invoices")
    .select("id, invoice_number, total, status, patients(name, phone)")
    .eq("id", invoiceId).eq("clinic_id", claims.clinic_id).is("deleted_at", null).maybeSingle();

  if (!inv) return { ok: false as const, reason: "الفاتورة غير موجودة" };
  if (inv.status === "paid") return { ok: false as const, reason: "الفاتورة مدفوعة بالفعل" };

  const amount = Number(inv.total ?? 0);
  if (!(amount > 0)) return { ok: false as const, reason: "قيمة الفاتورة صفر" };

  /* Don't stack links: an unexpired pending link for the same invoice is the
     answer to "send the patient a link", not a reason to open a second session. */
  const nowIso = new Date().toISOString();
  const { data: existing } = await sb.from("payment_links")
    .select("id, link_url, expires_at").eq("clinic_id", claims.clinic_id)
    .eq("invoice_id", invoiceId).eq("status", "pending")
    .gt("expires_at", nowIso).limit(1).maybeSingle();
  if (existing) return { ok: true as const, url: existing.link_url as string, reused: true };

  // Thawani prices in baisa (1 OMR = 1000 baisa)
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  let sessionId: string | null = null;
  try {
    const res = await fetch(`${THAWANI_BASE}/api/v1/checkout/session`, {
      method: "POST",
      headers: { "thawani-api-key": secret, "Content-Type": "application/json" },
      body: JSON.stringify({
        client_reference_code: invoiceId,
        mode: "payment",
        products: [{ name: `فاتورة ${inv.invoice_number}`, unit_amount: Math.round(amount * 1000), quantity: 1 }],
        success_url: `${THAWANI_BASE}/success?ref=${invoiceId}`,
        cancel_url: `${THAWANI_BASE}/cancel?ref=${invoiceId}`,
      }),
    });
    const body = (await res.json()) as { data?: { session_id?: string }; session_id?: string };
    sessionId = body.data?.session_id ?? body.session_id ?? null;
    if (!res.ok || !sessionId) return { ok: false as const, reason: "رفضت ثواني إنشاء الجلسة — تحقّق من المفاتيح" };
  } catch {
    return { ok: false as const, reason: "تعذّر الوصول إلى ثواني" };
  }

  const url = `${THAWANI_BASE}/pay/${sessionId}?key=${publicKey}`;
  const { error } = await sb.from("payment_links").insert({
    clinic_id: claims.clinic_id,
    invoice_id: invoiceId,
    link_url: url,
    thawani_session_id: sessionId,
    purpose: "invoice",
    amount,
    currency: "OMR",
    status: "pending",
    expires_at: expiresAt,
  });
  if (error) return { ok: false as const, reason: "أُنشئ الرابط لكن تعذّر حفظه" };

  rev();
  return { ok: true as const, url, reused: false };
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
