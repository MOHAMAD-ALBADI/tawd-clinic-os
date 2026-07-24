"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logExpense } from "@/app/actions/expenses";
import { revalidatePath } from "next/cache";

async function requireAdmin() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  return claims;
}
const rev = () => revalidatePath("/clinic-admin/payroll");

export type HrInput = {
  staff_id: string;
  job_title?: string;
  hire_date?: string | null;
  contract_type?: string;
  basic_salary?: number;
  housing_allowance?: number;
  transport_allowance?: number;
  other_allowance?: number;
  annual_leave_days?: number;
  bank_name?: string;
  iban?: string;
};

/** Create/update a staff member's salary profile (1:1, upsert on staff_id). */
export async function saveHrProfile(input: HrInput) {
  const claims = await requireAdmin();
  if (!input.staff_id) return { ok: false as const, reason: "اختر الموظف" };
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("staff_hr_profiles").upsert(
    {
      clinic_id: claims.clinic_id,
      staff_id: input.staff_id,
      job_title: input.job_title?.trim() || null,
      hire_date: input.hire_date || null,
      contract_type: input.contract_type || "full_time",
      basic_salary: Number(input.basic_salary ?? 0) || 0,
      housing_allowance: Number(input.housing_allowance ?? 0) || 0,
      transport_allowance: Number(input.transport_allowance ?? 0) || 0,
      other_allowance: Number(input.other_allowance ?? 0) || 0,
      annual_leave_days: Number(input.annual_leave_days ?? 30) || 30,
      bank_name: input.bank_name?.trim() || null,
      iban: input.iban?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "staff_id" }
  );
  if (error) return { ok: false as const, reason: "تعذّر حفظ بيانات الراتب" };
  rev();
  return { ok: true as const };
}

/** Mark one staff member's attendance for a day (upsert on staff_id+date). */
export async function markAttendance(input: {
  staff_id: string; work_date: string; status: string; notes?: string;
}) {
  const claims = await requireAdmin();
  if (!input.staff_id || !input.work_date) return { ok: false as const, reason: "بيانات ناقصة" };
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("attendance").upsert(
    {
      clinic_id: claims.clinic_id,
      staff_id: input.staff_id,
      work_date: input.work_date,
      status: input.status,
      notes: input.notes?.trim() || null,
    },
    { onConflict: "staff_id,work_date" }
  );
  if (error) return { ok: false as const, reason: "تعذّر حفظ الحضور" };
  rev();
  return { ok: true as const };
}

/** Generate/refresh the draft payroll for a period (YYYY-MM). */
export async function generatePayroll(period: string) {
  const claims = await requireAdmin();
  if (!/^\d{4}-\d{2}$/.test(period)) return { ok: false as const, reason: "الشهر غير صالح" };
  const sb = await createServerSupabaseClient();
  const { data, error } = await sb.rpc("generate_payroll_draft", {
    p_clinic: claims.clinic_id, p_period: period, p_created_by: claims.sub,
  });
  if (error) {
    const finalized = /finalized/i.test(error.message);
    return { ok: false as const, reason: finalized ? "المسيّر معتمد ولا يمكن إعادة توليده" : "تعذّر توليد المسيّر" };
  }
  rev();
  return { ok: true as const, count: Number(data) || 0 };
}

/** Manual overrides on a payslip (overtime/bonus in additions, loans/other in deductions). */
export async function updatePayslip(
  id: string, patch: { additions?: number; deductions?: number; notes?: string }
) {
  const claims = await requireAdmin();
  const sb = await createServerSupabaseClient();
  const upd: Record<string, unknown> = {};
  if (patch.additions !== undefined) upd.additions = Number(patch.additions) || 0;
  if (patch.deductions !== undefined) upd.deductions = Number(patch.deductions) || 0;
  if (patch.notes !== undefined) upd.notes = patch.notes?.trim() || null;

  const { data: ps, error } = await sb.from("payslips").update(upd)
    .eq("id", id).eq("clinic_id", claims.clinic_id).select("run_id").maybeSingle();
  if (error || !ps) return { ok: false as const, reason: "تعذّر تحديث القسيمة" };
  await recomputeRunTotal(sb, claims.clinic_id, ps.run_id as string);
  rev();
  return { ok: true as const };
}

/** Lock a run: no further changes; salaries are final + logged as an expense. */
export async function finalizePayroll(runId: string) {
  const claims = await requireAdmin();
  const sb = await createServerSupabaseClient();
  const total = await recomputeRunTotal(sb, claims.clinic_id, runId);
  const { data: run, error } = await sb.from("payroll_runs")
    .update({ status: "finalized", finalized_at: new Date().toISOString() })
    .eq("id", runId).eq("clinic_id", claims.clinic_id).eq("status", "draft")
    .select("period").maybeSingle();
  if (error || !run) return { ok: false as const, reason: "تعذّر اعتماد المسيّر" };

  // book the total net as a salaries expense (idempotent via unique ref index)
  await logExpense({
    clinicId: claims.clinic_id, createdBy: claims.sub, category: "رواتب",
    amount: total, refType: "payroll", refId: runId, description: `رواتب شهر ${run.period}`,
  });
  rev();
  return { ok: true as const };
}

async function recomputeRunTotal(
  sb: Awaited<ReturnType<typeof createServerSupabaseClient>>, clinicId: string, runId: string
): Promise<number> {
  const { data } = await sb.from("payslips").select("net").eq("run_id", runId).eq("clinic_id", clinicId);
  const total = (data ?? []).reduce((s, p) => s + (Number(p.net) || 0), 0);
  await sb.from("payroll_runs").update({ total_net: total }).eq("id", runId).eq("clinic_id", clinicId);
  return total;
}
