"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

/* PDPL (Oman Royal Decree 6/2022) requires a record of the patient's consent to
   process their health data. Reception/doctor/admin can all record one. */
async function requireStaff() {
  const claims = await getUserClaims();
  if (!claims || !(claims.role === "clinic_admin" || hasRole(claims, "doctor") || hasRole(claims, "receptionist"))) {
    throw new Error("غير مصرح");
  }
  return claims;
}

export type ConsentType = "general_treatment" | "data_processing" | "marketing" | "specific_procedure";

/** Record a signed consent for a patient (in-clinic signature). */
export async function recordConsent(input: {
  patient_id: string; consent_type: ConsentType; expires_at?: string | null;
}) {
  const claims = await requireStaff();
  if (!input.patient_id) return { ok: false as const, reason: "اختر المريض" };
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("digital_consents").insert({
    clinic_id: claims.clinic_id,
    patient_id: input.patient_id,
    consent_type: input.consent_type,
    signed_at: new Date().toISOString(),
    channel: "reception",
    is_active: true,
    expires_at: input.expires_at || null,
  });
  if (error) return { ok: false as const, reason: "تعذّر تسجيل الموافقة" };
  revalidatePath(`/clinic-admin/patients/${input.patient_id}`);
  return { ok: true as const };
}

/** Withdraw a consent (PDPL right to withdraw — keeps the record, flags inactive). */
export async function withdrawConsent(id: string, patientId: string) {
  const claims = await requireStaff();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("digital_consents")
    .update({ is_active: false })
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر سحب الموافقة" };
  revalidatePath(`/clinic-admin/patients/${patientId}`);
  return { ok: true as const };
}
