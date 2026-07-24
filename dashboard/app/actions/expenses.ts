"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

async function requireFinance() {
  const claims = await getUserClaims();
  if (!claims || !(claims.role === "clinic_admin" || hasRole(claims, "accountant"))) {
    throw new Error("غير مصرح");
  }
  return claims;
}
const rev = () => { revalidatePath("/clinic-admin/finance"); revalidatePath("/accountant"); };

export type ExpenseInput = {
  category: string;
  amount: number;
  expense_date?: string;
  payment_method?: string;
  description?: string;
  vendor?: string;
};

/** Record a manual clinic expense. */
export async function addExpense(input: ExpenseInput) {
  const claims = await requireFinance();
  const amount = Number(input.amount);
  if (!(amount > 0)) return { ok: false as const, reason: "المبلغ يجب أن يكون أكبر من صفر" };
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("expenses").insert({
    clinic_id: claims.clinic_id,
    category: input.category?.trim() || "أخرى",
    amount,
    expense_date: input.expense_date || new Date().toISOString().slice(0, 10),
    payment_method: input.payment_method || "cash",
    description: input.description?.trim() || null,
    vendor: input.vendor?.trim() || null,
    ref_type: "manual",
    created_by: claims.sub,
  });
  if (error) return { ok: false as const, reason: "تعذّر تسجيل المصروف" };
  rev();
  return { ok: true as const };
}

/** Soft-delete a manual expense (auto-linked ones stay to preserve the audit trail). */
export async function deleteExpense(id: string) {
  const claims = await requireFinance();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id).eq("clinic_id", claims.clinic_id).eq("ref_type", "manual");
  if (error) return { ok: false as const, reason: "تعذّر حذف المصروف" };
  rev();
  return { ok: true as const };
}

/** Best-effort auto-log used by the payroll + inventory hooks. Never throws;
    the partial-unique (ref_type,ref_id) index prevents double-logging. */
export async function logExpense(e: {
  clinicId: string; createdBy: string; category: string; amount: number;
  refType: string; refId?: string | null; description?: string;
}): Promise<void> {
  try {
    if (!(Number(e.amount) > 0)) return;
    const sb = await createServerSupabaseClient();
    await sb.from("expenses").insert({
      clinic_id: e.clinicId,
      category: e.category,
      amount: Number(e.amount),
      expense_date: new Date().toISOString().slice(0, 10),
      payment_method: "bank_transfer",
      description: e.description ?? null,
      ref_type: e.refType,
      ref_id: e.refId ?? null,
      created_by: e.createdBy,
    });
    rev();
  } catch {
    /* best-effort — a bookkeeping hiccup must not break payroll/inventory */
  }
}
