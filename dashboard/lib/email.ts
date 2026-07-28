import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/* Email is TAWD writing to its clinics. Not the clinic writing to its patients.

   It was built the other way round first, and the direction matters more than it
   sounds: a clinic emailing patients needs the clinic's own identity, its own
   domain and its own consent posture. TAWD emailing the clinics it bills needs
   none of that — it is one sender, one domain, and the recipient is a business
   we have a contract with.

   So there is one identity here and it is ours, and the addresses are the
   clinic's own managers. What it carries is the commercial relationship: the
   subscription invoice, the reminder when it goes unpaid, and the welcome that
   gets a new clinic into the product. */

const API = "https://api.resend.com/emails";

export type EmailKind = "subscription_invoice" | "dunning" | "welcome" | "notice";

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: string };

/** Escape anything interpolated into a body.

    Clinic names and manager names are data somebody else typed, and building
    markup out of them unescaped is how a stray angle bracket turns an invoice
    into broken markup. */
export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const looksLikeEmail = (s: string | null | undefined) =>
  !!s && EMAIL_RE.test(s.trim());

/** Can the platform send at all? */
export function emailStatus() {
  const from = process.env.RESEND_FROM || "";
  return {
    configured: !!process.env.RESEND_API_KEY,
    from: from || "onboarding@resend.dev",
    /* Resend's shared sandbox address delivers only to the account owner, so a
       clinic would never receive anything. Worth saying out loud rather than
       letting the operator believe mail is going out. */
    sandbox: !from || from.includes("resend.dev"),
  };
}

/** Everyone at a clinic who should receive account mail.

    The managers, because this is billing and account business — not the
    receptionist, and never the patients. */
export async function clinicRecipients(clinicId: string): Promise<string[]> {
  const sb = await createServiceRoleClient();
  const { data } = await sb.from("tawd_staff_users")
    .select("email")
    .eq("clinic_id", clinicId).eq("role", "admin")
    .eq("is_active", true).is("deleted_at", null);
  return [...new Set((data ?? []).map((s) => String(s.email ?? "").trim()))]
    .filter(looksLikeEmail);
}

/** Send, and write down that we did — including when it fails.

    A refused send that nobody recorded is indistinguishable from one that
    arrived, and "did the clinic ever get its invoice?" has to have an answer
    before anyone suspends them over it. */
export async function sendPlatformEmail(input: {
  clinicId: string;
  to: string[];
  subject: string;
  html: string;
  kind: EmailKind;
  refType?: string | null;
  refId?: string | null;
  sentBy?: string | null;
}): Promise<SendResult> {
  const sb = await createServiceRoleClient();

  const log = async (status: "sent" | "failed", providerId: string | null, error: string | null) => {
    await sb.from("email_log").insert({
      clinic_id: input.clinicId,
      to_email: input.to.join(", "),
      subject: input.subject,
      kind: input.kind,
      ref_type: input.refType ?? null,
      ref_id: input.refId ?? null,
      status,
      provider_id: providerId,
      error,
      sent_by: input.sentBy ?? null,
    });
  };

  const to = input.to.filter(looksLikeEmail);
  if (!to.length) {
    await log("failed", null, "لا يوجد بريد صالح لمديري العيادة");
    return { ok: false, reason: "لا يوجد بريد مسجّل لمدير هذه العيادة" };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    /* Not logged as a failed send: nothing was attempted, and a log full of
       "no key" rows would bury the real bounces. */
    return { ok: false, reason: "الإرسال غير مفعّل — أضف RESEND_API_KEY" };
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "TAWD <onboarding@resend.dev>",
        to,
        subject: input.subject,
        html: input.html,
      }),
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      await log("failed", null, body.message ?? `HTTP ${res.status}`);
      return { ok: false, reason: body.message ?? "رفض مزوّد البريد الإرسال" };
    }
    await log("sent", body.id ?? null, null);
    return { ok: true, id: body.id ?? null };
  } catch {
    await log("failed", null, "تعذّر الوصول إلى مزوّد البريد");
    return { ok: false, reason: "تعذّر الوصول إلى مزوّد البريد" };
  }
}
