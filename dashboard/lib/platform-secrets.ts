import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

/* The platform's own keys, read from the platform's own table.

   Three places used to find them with "the first active whatsapp channel row" —
   which meant they were physically stored inside a CLINIC's configuration, and
   which row answered depended on nothing more than insert order.

   With one clinic that is correct by accident. With two:
     a broadcast from TAWD leaves from whichever clinic's WhatsApp number sorts
     first, so a clinic receives a message from a competitor's number;
     one clinic burns another's Gemini quota, and deactivating the first kills
     the second's assistant;
     error alerts go out on a random clinic's Resend key.

   platform_secrets has RLS on and no policies at all, so nothing holding a
   browser session can read it — only the service role, which lives on the
   server. That is a stronger boundary than the old row ever had: a clinic
   manager could read their own channel config, and the platform's keys were
   sitting in it.

   Note for anyone changing this: the keys ALSO still live in the clinic's
   channel row, and must. Six live n8n workflows read them from there, WF-05
   included, and that one is not to be edited. It locates a clinic by
   phone_number_id and expects the keys inside that clinic's row — so connecting
   a new clinic copies them across rather than moving them. */

export type PlatformSecrets = {
  geminiKey: string | null;
  gcpTtsKey: string | null;
  resendKey: string | null;
  alertEmail: string | null;
  waAccessToken: string | null;
  waPhoneNumberId: string | null;
};

export async function platformSecrets(): Promise<PlatformSecrets> {
  const sb = await createServiceRoleClient();
  const { data } = await sb.from("platform_secrets")
    .select("gemini_key, gcp_tts_key, resend_key, alert_email, wa_access_token, wa_phone_number_id")
    .limit(1).maybeSingle();

  return {
    geminiKey: (data?.gemini_key as string | null) ?? null,
    gcpTtsKey: (data?.gcp_tts_key as string | null) ?? null,
    resendKey: (data?.resend_key as string | null) ?? null,
    alertEmail: (data?.alert_email as string | null) ?? null,
    waAccessToken: (data?.wa_access_token as string | null) ?? null,
    waPhoneNumberId: (data?.wa_phone_number_id as string | null) ?? null,
  };
}
