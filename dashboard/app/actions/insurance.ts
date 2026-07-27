"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { assertOwnClinic } from "@/lib/internal-guard";
import { clinicToday } from "@/lib/clinic-time";
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
const rev = () => {
  revalidatePath("/clinic-admin/insurance");
  revalidatePath("/clinic-admin/finance");
  revalidatePath("/clinic-admin/finance/invoices");
};
const round3 = (n: number) => Math.round((Number(n) || 0) * 1000) / 1000;

/** What a patient's policy will and will not cover, today.

    Eligibility is a date question as much as a percentage one: a policy that
    lapsed last month covers nothing, and opening a claim against it just creates
    a receivable that will never be paid. */
export async function checkEligibility(patientId: string) {
  const claims = await requireStaff();
  const sb = await createServerSupabaseClient();
  const { data } = await sb.from("patient_insurance")
    .select("coverage_percent, valid_until, policy_number, provider_id, insurance_providers!provider_id(provider_name, provider_name_ar)")
    .eq("clinic_id", claims.clinic_id).eq("patient_id", patientId).eq("is_active", true)
    .not("provider_id", "is", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();

  if (!data?.provider_id) return { covered: false as const, reason: "لا يوجد تأمين مسجّل" };

  const today = clinicToday();
  const until = (data.valid_until as string) ?? null;
  if (until && until < today) {
    return { covered: false as const, reason: `انتهت البوليصة في ${until}` };
  }

  const pr = data.insurance_providers as unknown as { provider_name?: string; provider_name_ar?: string } | null;
  return {
    covered: true as const,
    provider_id: data.provider_id as string,
    provider_name: pr?.provider_name_ar ?? pr?.provider_name ?? "مزوّد",
    policy_number: (data.policy_number as string) ?? "",
    coverage_percent: Number(data.coverage_percent) || 0,
    valid_until: until,
  };
}

/** Split an amount into what the insurer owes and what the patient pays now. */
export async function splitByCoverage(patientId: string, amount: number) {
  const el = await checkEligibility(patientId);
  const total = round3(amount);
  if (!el.covered) return { covered: false as const, reason: el.reason, insurer: 0, patient: total };
  const insurer = round3((total * el.coverage_percent) / 100);
  return {
    covered: true as const,
    provider_name: el.provider_name,
    coverage_percent: el.coverage_percent,
    insurer,
    patient: round3(total - insurer),
  };
}

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

/** Close a claim.

    An approval is money arriving, so it settles the linked invoice the same way
    the cashier does — a payments row with the `insurance` gateway. Without this
    the clinic approved claims all day and the invoice still read "غير محصّل",
    because every revenue figure in the product is derived from payments. */
export async function resolveClaim(input: {
  id: string; outcome: "approved" | "rejected"; approved_amount?: number; rejection_reason?: string;
}) {
  const claims = await requireStaff();
  const sb = await createServerSupabaseClient();

  const { data: claim } = await sb.from("insurance_claims")
    .select("id, status, invoice_id, submitted_amount")
    .eq("id", input.id).eq("clinic_id", claims.clinic_id).maybeSingle();
  if (!claim) return { ok: false as const, reason: "المطالبة غير موجودة" };
  if (!["submitted", "pending"].includes(claim.status as string)) {
    return { ok: false as const, reason: "المطالبة مغلقة بالفعل" };
  }

  const patch: Record<string, unknown> = {
    status: input.outcome, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };

  let settled = 0;
  if (input.outcome === "approved") {
    const approved = round3(input.approved_amount ?? claim.submitted_amount ?? 0);
    if (!(approved > 0)) return { ok: false as const, reason: "المبلغ المعتمد غير صالح" };
    patch.approved_amount = approved;

    if (claim.invoice_id) {
      const { data: inv } = await sb.from("invoices")
        .select("id, total, status").eq("id", claim.invoice_id).eq("clinic_id", claims.clinic_id)
        .is("deleted_at", null).maybeSingle();

      if (inv && !["cancelled", "refunded"].includes(inv.status as string)) {
        const { data: prior } = await sb.from("payments").select("amount")
          .eq("invoice_id", inv.id).eq("status", "completed");
        const already = round3((prior ?? []).reduce((s, p) => s + Number(p.amount ?? 0), 0));
        const due = round3(Number(inv.total ?? 0) - already);
        // an insurer paying more than the invoice still owes is a data error, not a windfall
        settled = Math.min(approved, Math.max(0, due));

        if (settled > 0) {
          const { error: perr } = await sb.from("payments").insert({
            invoice_id: inv.id, clinic_id: claims.clinic_id, gateway: "insurance",
            currency: "OMR", amount: settled, status: "completed", paid_at: new Date().toISOString(),
          });
          if (perr) return { ok: false as const, reason: "تعذّر قيد دفعة التأمين" };

          const paidSum = round3(already + settled);
          await sb.from("invoices")
            .update({
              status: paidSum >= Number(inv.total) - 0.0005 ? "paid" : "partially_paid",
              updated_at: new Date().toISOString(),
            })
            .eq("id", inv.id).eq("clinic_id", claims.clinic_id);
        }
      }
    }
  } else {
    patch.rejection_reason = input.rejection_reason?.trim() || null;
  }

  const { error } = await sb.from("insurance_claims").update(patch)
    .eq("id", input.id).eq("clinic_id", claims.clinic_id).in("status", ["submitted", "pending"]);
  if (error) return { ok: false as const, reason: "تعذّر تحديث المطالبة" };

  rev();
  return { ok: true as const, settled };
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

/** Best-effort: auto-open a pending claim when an insured patient is billed.

    Never throws — billing must not fail because the insurance side did. The claim
    carries invoice_id so approving it later can settle that exact invoice. */
export async function logClaimForInvoice(e: {
  clinicId: string; patientId: string; apptId?: string | null; invoiceId: string; invoiceTotal: number;
}): Promise<void> {
  try {
    /* Exported from a "use server" file, therefore a network endpoint. */
    await assertOwnClinic(e.clinicId);
    const sb = await createServerSupabaseClient();
    const { data: cover } = await sb.from("patient_insurance")
      .select("provider_id, coverage_percent, valid_until")
      .eq("clinic_id", e.clinicId).eq("patient_id", e.patientId).eq("is_active", true)
      .not("provider_id", "is", null).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!cover?.provider_id) return;

    /* An expired policy pays nothing. Opening a claim against it would only
       manufacture a receivable the clinic will chase and never collect. */
    const today = clinicToday();
    if (cover.valid_until && (cover.valid_until as string) < today) return;

    const { data: existing } = await sb.from("insurance_claims").select("id")
      .eq("clinic_id", e.clinicId).eq("invoice_id", e.invoiceId).neq("status", "cancelled").limit(1);
    if (existing?.length) return;

    const amount = round3((e.invoiceTotal * (Number(cover.coverage_percent) || 0)) / 100);
    if (!(amount > 0)) return;
    await sb.from("insurance_claims").insert({
      clinic_id: e.clinicId, patient_id: e.patientId, appt_id: e.apptId || null,
      invoice_id: e.invoiceId, provider_id: cover.provider_id,
      submitted_amount: amount, currency: "OMR", status: "pending",
    });
    rev();
  } catch {
    /* best-effort */
  }
}
