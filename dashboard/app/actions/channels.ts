"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { hasRole } from "@/lib/auth/role-redirect";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { platformSecrets } from "@/lib/platform-secrets";
import { revalidatePath } from "next/cache";

/* Connecting a clinic's WhatsApp.

   createClinic seeds settings, loyalty, the subscription, entitlements, the
   service template and every login — and no channel row at all. So every clinic
   after the first was born without Sura, and the only way to give it one was to
   write JSON into the database by hand.

   A clinic's WhatsApp row needs two different kinds of key. The clinic's own
   Meta assets (token, phone number id, WABA id) are what this screen collects.
   The platform's keys — Gemini, Google TTS, Resend, the alert address — are the
   same for every clinic and are COPIED IN from platform_secrets, because six
   live n8n workflows read them out of the clinic's row, WF-05 included, and
   WF-05 is not to be edited. */

async function requirePlatform() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) throw new Error("غير مصرح");
  return claims;
}

export type WhatsAppInput = {
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  apiVersion?: string;
};

export type WhatsAppCheck = {
  ok: boolean;
  displayNumber?: string;
  verifiedName?: string;
  reason?: string;
};

/** Ask Meta whether this token really controls this number.

    Saving unverified credentials produces a clinic that reads as "connected"
    everywhere in the dashboard and answers nobody — and the first person to
    find out is a patient whose message went nowhere. */
async function verifyWithMeta(input: WhatsAppInput): Promise<WhatsAppCheck> {
  const v = (input.apiVersion || "v20.0").replace(/^v?/, "v");
  try {
    const res = await fetch(
      `https://graph.facebook.com/${v}/${encodeURIComponent(input.phoneNumberId)}?fields=display_phone_number,verified_name`,
      { headers: { Authorization: `Bearer ${input.accessToken}` }, signal: AbortSignal.timeout(12_000) }
    );
    const body = (await res.json().catch(() => null)) as
      | { display_phone_number?: string; verified_name?: string; error?: { message?: string; code?: number } }
      | null;

    if (!res.ok || !body || body.error) {
      const code = body?.error?.code;
      const reason =
        code === 190 ? "الرمز منتهي أو غير صالح"
        : code === 100 ? "معرّف الرقم غير صحيح — تأكد أنه Phone number ID وليس رقم الهاتف"
        : body?.error?.message ?? `تعذّر التحقق من ميتا (${res.status})`;
      return { ok: false, reason };
    }
    return {
      ok: true,
      displayNumber: body.display_phone_number,
      verifiedName: body.verified_name,
    };
  } catch {
    return { ok: false, reason: "تعذّر الاتصال بميتا — حاول مجدداً" };
  }
}

/** Check the credentials without saving anything. */
export async function testWhatsApp(input: WhatsAppInput): Promise<WhatsAppCheck> {
  await requirePlatform();
  if (!input.phoneNumberId?.trim() || !input.accessToken?.trim()) {
    return { ok: false, reason: "معرّف الرقم والرمز مطلوبان" };
  }
  return verifyWithMeta({
    phoneNumberId: input.phoneNumberId.trim(),
    wabaId: input.wabaId?.trim() ?? "",
    accessToken: input.accessToken.trim(),
    apiVersion: input.apiVersion,
  });
}

export async function connectWhatsApp(clinicId: string, input: WhatsAppInput) {
  await requirePlatform();

  const phoneNumberId = input.phoneNumberId?.trim() ?? "";
  const accessToken = input.accessToken?.trim() ?? "";
  const wabaId = input.wabaId?.trim() ?? "";
  const apiVersion = (input.apiVersion?.trim() || "v20.0").replace(/^v?/, "v");

  if (!phoneNumberId) return { ok: false as const, reason: "معرّف الرقم (Phone number ID) مطلوب" };
  if (!accessToken) return { ok: false as const, reason: "رمز الوصول مطلوب" };
  if (!/^\d+$/.test(phoneNumberId)) {
    return { ok: false as const, reason: "معرّف الرقم أرقام فقط — انسخه من لوحة ميتا" };
  }

  const sb = await createServiceRoleClient();

  /* WF-05 finds the clinic by phone_number_id. Two clinics on one number means
     one clinic's patients get answered with the other clinic's schedule. */
  const { data: taken } = await sb
    .from("channel_configs")
    .select("clinic_id, tawd_clinics!clinic_id(name_ar, name)")
    .eq("channel", "whatsapp")
    .eq("config->>phone_number_id", phoneNumberId)
    .neq("clinic_id", clinicId)
    .maybeSingle();
  if (taken) {
    const other = taken.tawd_clinics as unknown as { name_ar?: string; name?: string } | null;
    return {
      ok: false as const,
      reason: `هذا الرقم مربوط بعيادة أخرى (${other?.name_ar ?? other?.name ?? "غير معروفة"}) — لكل عيادة رقمها`,
    };
  }

  /* Verified before saved, so "مربوط" in the dashboard means Meta agreed. */
  const check = await verifyWithMeta({ phoneNumberId, wabaId, accessToken, apiVersion });
  if (!check.ok) return { ok: false as const, reason: check.reason ?? "فشل التحقق" };

  const secrets = await platformSecrets();
  const missing = [
    !secrets.geminiKey && "مفتاح Gemini",
    !secrets.gcpTtsKey && "مفتاح الصوت",
  ].filter(Boolean) as string[];

  const { error } = await sb.from("channel_configs").upsert(
    {
      clinic_id: clinicId,
      channel: "whatsapp",
      credentials_ref: `WhatsApp — ${check.displayNumber ?? phoneNumberId}`,
      is_active: true,
      config: {
        access_token: accessToken,
        phone_number_id: phoneNumberId,
        waba_id: wabaId || null,
        api_version: apiVersion,
        wa_cred_id: null,
        /* Copied, not referenced — see the note at the top of this file. */
        gemini_key: secrets.geminiKey,
        gcp_tts_key: secrets.gcpTtsKey,
        resend_key: secrets.resendKey,
        alert_email: secrets.alertEmail,
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "clinic_id,channel" }
  );
  if (error) return { ok: false as const, reason: `تعذّر الحفظ: ${error.message}` };

  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  return {
    ok: true as const,
    displayNumber: check.displayNumber ?? null,
    verifiedName: check.verifiedName ?? null,
    /* Sura will answer, but without these she cannot think or speak — said out
       loud rather than discovered when the first patient writes. */
    warnings: missing.length ? [`سُرى ستستقبل لكن لن ترد: ${missing.join("، ")} غير مضبوط في أسرار المنصة`] : [],
  };
}

/** Stop Sura answering on this clinic's number without losing the credentials. */
export async function setWhatsAppActive(clinicId: string, active: boolean) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const { error } = await sb.from("channel_configs")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("clinic_id", clinicId).eq("channel", "whatsapp");
  if (error) return { ok: false as const, reason: "تعذّر التحديث" };
  revalidatePath(`/platform-admin/clinics/${clinicId}`);
  return { ok: true as const };
}

/** Push the platform's current keys into every connected clinic.

    Rotating the Gemini key used to mean editing each clinic's JSON by hand, and
    a clinic that was missed simply stopped answering with no error anywhere. */
export async function syncPlatformKeysToClinics() {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const secrets = await platformSecrets();

  const { data: rows } = await sb.from("channel_configs")
    .select("clinic_id, config").eq("channel", "whatsapp");

  let updated = 0;
  for (const r of rows ?? []) {
    const config = (r.config ?? {}) as Record<string, unknown>;
    const { error } = await sb.from("channel_configs").update({
      config: {
        ...config,
        gemini_key: secrets.geminiKey,
        gcp_tts_key: secrets.gcpTtsKey,
        resend_key: secrets.resendKey,
        alert_email: secrets.alertEmail,
      },
      updated_at: new Date().toISOString(),
    }).eq("clinic_id", r.clinic_id as string).eq("channel", "whatsapp");
    if (!error) updated += 1;
  }

  revalidatePath("/platform-admin/settings");
  return { ok: true as const, updated };
}
