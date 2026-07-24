"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

async function requireClinician() {
  const claims = await getUserClaims();
  if (!claims || !(claims.role === "clinic_admin" || hasRole(claims, "doctor"))) {
    throw new Error("غير مصرح");
  }
  return claims;
}
const rev = () => { revalidatePath("/clinic-admin/treatment-plans"); revalidatePath("/doctor"); };

export type PlanStatus = "draft" | "proposed" | "accepted" | "in_progress" | "completed" | "cancelled";

export async function createPlan(input: {
  patient_id: string; doctor_id?: string | null; title?: string; notes?: string;
}) {
  const claims = await requireClinician();
  if (!input.patient_id) return { ok: false as const, reason: "اختر المريض" };
  const sb = await createServerSupabaseClient();
  const { data, error } = await sb.from("treatment_plans").insert({
    clinic_id: claims.clinic_id,
    patient_id: input.patient_id,
    doctor_id: input.doctor_id || null,
    title: input.title?.trim() || "خطة علاج",
    notes: input.notes?.trim() || null,
    created_by: claims.sub,
  }).select("id").single();
  if (error) return { ok: false as const, reason: "تعذّر إنشاء الخطة" };
  rev();
  return { ok: true as const, id: data.id as string };
}

export async function updatePlanStatus(id: string, status: PlanStatus) {
  const claims = await requireClinician();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("treatment_plans")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر تحديث الحالة" };
  rev();
  return { ok: true as const };
}

export async function deletePlan(id: string) {
  const claims = await requireClinician();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("treatment_plans").delete()
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر حذف الخطة" };
  rev();
  return { ok: true as const };
}

export async function addPlanItem(input: {
  plan_id: string; service_id?: string | null; description: string;
  tooth_number?: string; quantity?: number; unit_price?: number;
}) {
  const claims = await requireClinician();
  const desc = (input.description ?? "").trim();
  if (!input.plan_id || !desc) return { ok: false as const, reason: "أدخل وصف الإجراء" };
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("treatment_plan_items").insert({
    clinic_id: claims.clinic_id,
    plan_id: input.plan_id,
    service_id: input.service_id || null,
    description: desc,
    tooth_number: input.tooth_number?.trim() || null,
    quantity: Math.max(1, Number(input.quantity ?? 1) || 1),
    unit_price: Number(input.unit_price ?? 0) || 0,
  });
  if (error) return { ok: false as const, reason: "تعذّر إضافة الإجراء" };
  rev();
  return { ok: true as const };
}

export async function togglePlanItem(id: string, done: boolean) {
  const claims = await requireClinician();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("treatment_plan_items")
    .update({ status: done ? "done" : "pending", done_at: done ? new Date().toISOString() : null })
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر تحديث الإجراء" };
  rev();
  return { ok: true as const };
}

export async function deletePlanItem(id: string) {
  const claims = await requireClinician();
  const sb = await createServerSupabaseClient();
  const { error } = await sb.from("treatment_plan_items").delete()
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر حذف الإجراء" };
  rev();
  return { ok: true as const };
}
