"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

/* Sura, per clinic, from the operator's side.

   Every clinic's receptionist is configured by rows in tawd_clinic_settings —
   its system message, personality, languages, which channels are live, and a
   maintenance switch that makes Sura say "we are briefly unavailable" instead
   of going silent. All of it existed and none of it was reachable from the
   platform dashboard: supporting a clinic whose Sura was misbehaving meant
   opening Supabase and editing a row by hand.

   These writes are the operator's, not the clinic's. The clinic edits its own
   personality from its settings page; this is for the person who has to fix it
   when a customer calls. */

async function requirePlatform() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) throw new Error("غير مصرح");
  return claims;
}

const rev = (clinicId: string) => {
  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  revalidatePath("/platform-admin/automation");
  revalidatePath("/platform-admin");
};

export type SuraConfigInput = {
  clinicId: string;
  systemMessage: string;
  languages: string[];
  /** whatsapp / instagram / web_chat → live or not */
  channels: Record<string, boolean>;
};

export async function saveClinicSura(input: SuraConfigInput) {
  await requirePlatform();
  const sb = await createServiceRoleClient();

  /* Only the languages Sura is actually built to answer in. A code that slips
     in here would make the prompt ask for a language nobody wrote replies for. */
  const langs = input.languages.filter((l) => l === "ar" || l === "en");

  const { error } = await sb.from("tawd_clinic_settings").update({
    sura_system_message: input.systemMessage.trim() || null,
    languages: langs.length ? langs : ["ar"],
    channel_toggles: input.channels,
    updated_at: new Date().toISOString(),
  }).eq("clinic_id", input.clinicId);

  if (error) return { ok: false as const, reason: "تعذّر حفظ إعدادات سُرى" };
  rev(input.clinicId);
  return { ok: true as const };
}

/** Put one clinic's Sura into maintenance.

    Not the same as switching the workflow off. Off means an inbound WhatsApp
    message gets no reply at all and the patient assumes the clinic ignored
    them; maintenance means Sura answers with the clinic's own wording. When
    something is broken for one customer, the second is almost always what you
    want. */
export async function setClinicSuraMaintenance(
  clinicId: string,
  on: boolean,
  messageAr?: string,
) {
  await requirePlatform();
  const sb = await createServiceRoleClient();

  const patch: Record<string, unknown> = {
    is_in_maintenance: on,
    updated_at: new Date().toISOString(),
  };
  if (on && messageAr?.trim()) patch.maintenance_msg_ar = messageAr.trim();

  const { error } = await sb.from("tawd_clinic_settings").update(patch).eq("clinic_id", clinicId);
  if (error) return { ok: false as const, reason: "تعذّر تغيير وضع الصيانة" };
  rev(clinicId);
  return { ok: true as const };
}
