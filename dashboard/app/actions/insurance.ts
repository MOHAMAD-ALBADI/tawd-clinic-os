"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

async function requireStaff() {
  const claims = await getUserClaims();
  if (!claims || !(claims.role === "clinic_admin" || hasRole(claims, "accountant"))) {
    throw new Error("غير مصرح");
  }
  return claims;
}
const rev = () => revalidatePath("/clinic-admin/insurance");

/* ─────────── Providers ─────────── */
export async function saveProvider(input: {
  id?: string; provider_name: string; provider_name_ar?: string; dhamani_code?: string; contact_email?: string; notes?: string;
}) {
  const claims = await requireStaff();
  const name = (input.provider_name ?? "").trim();
  if (!name) return { ok: false as const, reason: "اسم المزوّد مطلوب" };
  const sb = await createServerSupabaseClient();
  const row = {
    clinic_id: claims.clinic_id, provider_name: name,
    provider_name_ar: input.provider_name_ar?.trim() || null,
    dhamani_code: input.dhamani_code?.trim() || null,
    contact_email: input.contact_email?.trim() || null,
    notes: input.notes?.trim() || null,
  };
  const q = input.id
    ? sb.from("insurance_providers").update(row).eq("id", input.id).eq("clinic_id", claims.clinic_id)
    : sb.from("insurance_providers").insert(row);
  const { error } = await q;
  if (error) return { ok: false as const, reason: "تعذّر حفظ المزوّد" };
  rev();
  return { ok: true as const };
}

export async function archiveProvider(id: string) {
  const claims = await requireStaff();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("insurance_providers").update({ is_active: false })
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر الأرشفة" };
  rev();
  return { ok: true as const };
}

/* ─────────── Patient coverage ─────────── */
export async function savePatientInsurance(input: {
  patient_id: string; provider_id: string; policy_number?: string; coverage_percent: number; valid_until?: string | null;
}) {
  const claims = await requireStaff();
  if (!input.patient_id || !input.provider_id) return { ok: false as const, reason: "اختر المريض والمزوّد" };
  const cov = Math.max(0, Math.min(100, Number(input.coverage_percent) || 0));
  const sb = await createServerSupabaseClient();
  const row = {
    clinic_id: claims.clinic_id, patient_id: input.patient_id, provider_id: input.provider_id,
    policy_number: input.policy_number?.trim() || null, coverage_percent: cov,
    valid_until: input.valid_until || null, is_active: true, updated_at: new Date().toISOString(),
  };
  const { data: existing } = await sb.from("patient_insurance").select("id")
    .eq("patient_id", input.patient_id).eq("clinic_id", claims.clinic_id).limit(1);
  const { error } = existing?.length
    ? await sb.from("patient_insurance").update(row).eq("id", existing[0].id).eq("clinic_id", claims.clinic_id)
    : await sb.from("patient_insurance").insert(row);
  if (error) return { ok: false as const, reason: "تعذّر حفظ تأمين المريض" };
  rev();
  return { ok: true as const };
}

/* ─────────── Claims lifecycle ─────────── */
export async function createClaim(input: {
  patient_id: string; appt_id?: string | null; provider_id: string; submitted_amount: number;
}) {
  const claims = await requireStaff();
  const amt = Number(input.submitted_amount);
  if (!input.patient_id || !input.provider_id) return { ok: false as const, reason: "بيانات ناقصة" };
  if (!(amt > 0)) return { ok: false as const, reason: "المبلغ غير صالح" };
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("insurance_claims").insert({
    clinic_id: claims.clinic_id, patient_id: input.patient_id, appt_id: input.appt_id || null,
    provider_id: input.provider_id, submitted_amount: amt, currency: "OMR", status: "pending",
  });
  if (error) return { ok: false as const, reason: "تعذّر إنشاء المطالبة" };
  rev();
  return { ok: true as const };
}

export async function submitClaim(id: string, claimRef?: string) {
  const claims = await requireStaff();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("insurance_claims")
    .update({ status: "submitted", submitted_at: new Date().toISOString(), claim_ref: claimRef?.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id).eq("clinic_id", claims.clinic_id).eq("status", "pending");
  if (error) return { ok: false as const, reason: "تعذّر تقديم المطالبة" };
  rev();
  return { ok: true as const };
}

export async function resolveClaim(input: {
  id: string; outcome: "approved" | "rejected"; approved_amount?: number; rejection_reason?: string;
}) {
  const claims = await requireStaff();
  const sb = await createServerSupabaseClient();
  const patch: Record<string, unknown> = {
    status: input.outcome, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };
  if (input.outcome === "approved") patch.approved_amount = Number(input.approved_amount ?? 0) || 0;
  else patch.rejection_reason = input.rejection_reason?.trim() || null;
  const { error } = await sb.from("insurance_claims").update(patch)
    .eq("id", input.id).eq("clinic_id", claims.clinic_id).in("status", ["submitted", "pending"]);
  if (error) return { ok: false as const, reason: "تعذّر تحديث المطالبة" };
  rev();
  return { ok: true as const };
}

export async function cancelClaim(id: string) {
  const claims = await requireStaff();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("insurance_claims")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id).eq("clinic_id", claims.clinic_id).not("status", "in", "(approved,rejected)");
  if (error) return { ok: false as const, reason: "تعذّر إلغاء المطالبة" };
  rev();
  return { ok: true as const };
}

/** Best-effort: auto-open a pending claim when an insured patient is billed. Never throws;
    skips silently if the patient has no active insurance or a claim already exists for the appt. */
export async function logClaimForInvoice(e: {
  clinicId: string; patientId: string; apptId: string; invoiceTotal: number;
}): Promise<void> {
  try {
    const sb = await createServerSupabaseClient();
    const { data: ins } = await sb.from("patient_insurance")
      .select("provider_id, coverage_percent")
      .eq("clinic_id", e.clinicId).eq("patient_id", e.patientId).eq("is_active", true)
      .not("provider_id", "is", null).order("updated_at", { ascending: false }).limit(1);
    const cover = ins?.[0];
    if (!cover?.provider_id) return;

    const { data: existing } = await sb.from("insurance_claims").select("id")
      .eq("clinic_id", e.clinicId).eq("appt_id", e.apptId).limit(1);
    if (existing?.length) return;

    const amount = Math.round((e.invoiceTotal * (Number(cover.coverage_percent) || 0) / 100) * 1000) / 1000;
    if (!(amount > 0)) return;
    await sb.from("insurance_claims").insert({
      clinic_id: e.clinicId, patient_id: e.patientId, appt_id: e.apptId,
      provider_id: cover.provider_id, submitted_amount: amount, currency: "OMR", status: "pending",
    });
    rev();
  } catch {
    /* best-effort */
  }
}
