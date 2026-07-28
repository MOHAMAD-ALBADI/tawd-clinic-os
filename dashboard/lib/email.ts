import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/* Sending email, in one place.

   The key is the PLATFORM's, not the clinic's. A clinic does not have a Resend
   account and should never be asked to verify a sending domain to email its own
   patient an invoice — so everything leaves from TAWD's verified domain, carrying
   the clinic's name, with the clinic's own address as reply-to. A patient hitting
   reply reaches the clinic, not us, which is the only part of the identity that
   actually matters to them.

   It was already half-here and in the wrong place: the error-alert path read a
   `resend_key` out of the WHATSAPP channel_configs row. Email credentials hiding
   inside another channel's config is the sort of thing that is invisible until
   somebody edits the WhatsApp settings and the alerts stop. */

const API = "https://api.resend.com/emails";

export type EmailKind = "invoice" | "receipt" | "statement" | "appointment" | "other";

export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: string };

/** Escape anything that goes into the HTML body.

    Every one of these messages interpolates a patient's name and a clinic's name.
    A patient called "O'Brien & Sons <clinic>" is unlikely, but a name is data
    someone else typed, and building markup out of it unescaped is how a stray
    angle bracket turns a receipt into broken markup — or worse. */
export function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export type ClinicIdentity = {
  name: string;
  replyTo: string | null;
  phone: string | null;
};

/** Who this clinic appears as. */
export async function clinicIdentity(clinicId: string): Promise<ClinicIdentity> {
  const sb = await createServiceRoleClient();
  const [{ data: clinic }, { data: cfg }] = await Promise.all([
    sb.from("tawd_clinics").select("name, name_ar, phone").eq("id", clinicId).maybeSingle(),
    sb.from("channel_configs").select("config, is_active")
      .eq("clinic_id", clinicId).eq("channel", "email").maybeSingle(),
  ]);
  const conf = (cfg?.config ?? {}) as Record<string, string>;
  return {
    name: conf.from_name?.trim() || (clinic?.name_ar ?? clinic?.name ?? "عيادة") as string,
    replyTo: conf.reply_to?.trim() || null,
    phone: (clinic?.phone as string | null) ?? null,
  };
}

/** Is the email channel switched on for this clinic, and can we actually send? */
export async function emailStatus(clinicId: string) {
  const sb = await createServiceRoleClient();
  const { data } = await sb.from("channel_configs")
    .select("is_active, config").eq("clinic_id", clinicId).eq("channel", "email").maybeSingle();
  const conf = (data?.config ?? {}) as Record<string, string>;
  return {
    /* Two separate things, reported separately, because the fixes are different:
       the operator has not set up sending at all, versus this clinic has not
       switched it on. */
    configured: !!process.env.RESEND_API_KEY,
    enabled: !!data?.is_active,
    fromName: conf.from_name ?? null,
    replyTo: conf.reply_to ?? null,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const looksLikeEmail = (s: string | null | undefined) =>
  !!s && EMAIL_RE.test(s.trim());

/** Send one message and write down that we did.

    Always logs — including the failures, which is the whole point. A send that
    the provider refused and nobody recorded is indistinguishable from one that
    arrived. */
export async function sendClinicEmail(input: {
  clinicId: string;
  to: string;
  subject: string;
  html: string;
  kind: EmailKind;
  patientId?: string | null;
  refType?: string | null;
  refId?: string | null;
  sentBy?: string | null;
}): Promise<SendResult> {
  const sb = await createServiceRoleClient();

  const log = async (status: "sent" | "failed", providerId: string | null, error: string | null) => {
    await sb.from("email_log").insert({
      clinic_id: input.clinicId,
      patient_id: input.patientId ?? null,
      to_email: input.to,
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

  if (!looksLikeEmail(input.to)) {
    await log("failed", null, "عنوان بريد غير صالح");
    return { ok: false, reason: "عنوان البريد غير صالح" };
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    /* Not logged as a failed send: nothing was attempted, and a log full of
       "no key" rows would bury the real bounces. */
    return { ok: false, reason: "البريد غير مفعّل على المنصة بعد" };
  }

  const identity = await clinicIdentity(input.clinicId);
  const from = process.env.RESEND_FROM || "onboarding@resend.dev";

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        /* The clinic's name in front of our verified address — the patient sees
           who it is from without the clinic owning a domain. */
        from: `${identity.name} <${from}>`,
        to: [input.to.trim()],
        ...(identity.replyTo ? { reply_to: identity.replyTo } : {}),
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
