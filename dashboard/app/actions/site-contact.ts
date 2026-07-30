"use server";

import { createServiceRoleClient } from "@/lib/supabase/server";
import { platformSecrets } from "@/lib/platform-secrets";

/* A contact form that actually delivers.

   The failure mode to avoid is the one the campaign launcher had: a form that
   says "sent" while the message goes nowhere. So the enquiry is WRITTEN FIRST
   to a table we control, and the email is attempted after. If Resend is down or
   unconfigured, the lead is still on record — the visitor is told the truth
   either way. */

export type ContactInput = {
  name: string;
  clinic?: string;
  phone: string;
  email?: string;
  message: string;
};

export async function sendEnquiry(input: ContactInput) {
  const name = (input.name ?? "").trim();
  const phone = (input.phone ?? "").trim();
  const message = (input.message ?? "").trim();

  /* Validated on the server too — a client-only check is a suggestion. */
  if (name.length < 2 || phone.length < 6 || message.length < 5) {
    return { ok: false as const, reason: "invalid" as const };
  }

  const clinic = (input.clinic ?? "").trim() || null;
  const email = (input.email ?? "").trim() || null;

  const sb = await createServiceRoleClient();
  const { error } = await sb.from("site_enquiries").insert({
    name: name.slice(0, 120),
    clinic_name: clinic?.slice(0, 160) ?? null,
    phone: phone.slice(0, 40),
    email: email?.slice(0, 160) ?? null,
    message: message.slice(0, 4000),
  });
  if (error) return { ok: false as const, reason: "store" as const };

  /* Best effort. The enquiry is already safe; a mail failure must not tell the
     visitor their message was lost when it was not. */
  try {
    const s = await platformSecrets();
    if (s.resendKey && s.alertEmail) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${s.resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "TAWD <onboarding@resend.dev>",
          to: [s.alertEmail],
          subject: `طلب جديد من الموقع — ${name}${clinic ? ` (${clinic})` : ""}`,
          text: [
            `الاسم: ${name}`,
            clinic ? `العيادة: ${clinic}` : null,
            `الهاتف: ${phone}`,
            email ? `البريد: ${email}` : null,
            "",
            message,
          ].filter(Boolean).join("\n"),
        }),
        signal: AbortSignal.timeout(10_000),
      });
    }
  } catch { /* the row is written; that is what matters */ }

  return { ok: true as const };
}
