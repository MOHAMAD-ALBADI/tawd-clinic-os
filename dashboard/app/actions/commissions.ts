"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { assertOwnClinic } from "@/lib/internal-guard";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logExpense } from "@/app/actions/expenses";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  return claims;
}
const rev = () => { revalidatePath("/clinic-admin/finance/commissions"); revalidatePath("/clinic-admin/finance"); };

/** Approve a pending commission (clinic agrees the doctor earned it). */
export async function approveCommission(id: string) {
  const claims = await requireAdmin();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("doctor_commissions")
    .update({ status: "approved" })
    .eq("id", id).eq("clinic_id", claims.clinic_id).eq("status", "pending");
  if (error) return { ok: false as const, reason: "تعذّر اعتماد العمولة" };
  rev();
  return { ok: true as const };
}

/** Mark an approved commission as paid + book it as a clinic expense (idempotent). */
export async function payCommission(id: string) {
  const claims = await requireAdmin();
  const sb = await createServerSupabaseClient();
  const { data: row, error } = await sb.from("doctor_commissions")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id).eq("clinic_id", claims.clinic_id).eq("status", "approved")
    .select("id, commission_amount").maybeSingle();
  if (error || !row) return { ok: false as const, reason: "تعذّر صرف العمولة" };

  await logExpense({
    clinicId: claims.clinic_id, createdBy: claims.sub, category: "عمولات",
    amount: Number(row.commission_amount) || 0,
    refType: "commission", refId: row.id as string, description: "صرف عمولة طبيب",
  });
  rev();
  return { ok: true as const };
}

/** Cancel a commission that shouldn't have been created (pending only). */
export async function deleteCommission(id: string) {
  const claims = await requireAdmin();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("doctor_commissions").delete()
    .eq("id", id).eq("clinic_id", claims.clinic_id).eq("status", "pending");
  if (error) return { ok: false as const, reason: "تعذّر حذف العمولة" };
  rev();
  return { ok: true as const };
}

/** Best-effort: accrue a doctor's commission when an invoice is issued. Never throws.
    Rate comes from the doctor's HR profile; the unique index on invoice_id makes it
    safe to call more than once for the same invoice. */
export async function logCommissionForInvoice(e: {
  clinicId: string; doctorId: string | null; invoiceId: string; invoiceTotal: number;
}): Promise<void> {
  try {
    if (!e.doctorId) return;
    /* Exported from a "use server" file, therefore a network endpoint. */
    await assertOwnClinic(e.clinicId);
    const sb = await createServerSupabaseClient();
    const { data: prof } = await sb.from("staff_hr_profiles")
      .select("commission_rate").eq("clinic_id", e.clinicId).eq("staff_id", e.doctorId).maybeSingle();
    const rate = Number(prof?.commission_rate) || 0;
    if (!(rate > 0)) return;

    const amount = Math.round((e.invoiceTotal * rate / 100) * 1000) / 1000;
    if (!(amount > 0)) return;

    await sb.from("doctor_commissions").insert({
      clinic_id: e.clinicId, doctor_id: e.doctorId, invoice_id: e.invoiceId,
      commission_rate: rate, commission_amount: amount, currency: "OMR", status: "pending",
    });
    rev();
  } catch {
    /* best-effort — commission accounting must never block billing */
  }
}
