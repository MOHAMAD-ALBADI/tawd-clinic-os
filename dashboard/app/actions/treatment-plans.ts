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
const rev = () => {
  revalidatePath("/clinic-admin/treatment-plans");
  revalidatePath("/doctor/treatment-plans");
};

type Claims = Awaited<ReturnType<typeof getUserClaims>>;
/** A plain doctor may only touch their OWN plans. The clinic admin may touch any
    plan in the clinic. Defence-in-depth: RLS already blocks other clinics, this
    blocks doctor-vs-doctor within the same clinic. */
function doctorOnly(claims: NonNullable<Claims>): string | null {
  return hasRole(claims, "doctor") && claims.role !== "clinic_admin" ? claims.sub : null;
}

/** Resolve a plan the caller is allowed to mutate, or null. */
async function ownedPlanId(
  sb: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  claims: NonNullable<Claims>,
  planId: string
): Promise<string | null> {
  const mine = doctorOnly(claims);
  let q = sb.from("treatment_plans").select("id").eq("id", planId).eq("clinic_id", claims.clinic_id);
  if (mine) q = q.eq("doctor_id", mine);
  const { data } = await q.maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export type PlanStatus = "draft" | "proposed" | "accepted" | "in_progress" | "completed" | "cancelled";

export async function createPlan(input: {
  patient_id: string; doctor_id?: string | null; title?: string; notes?: string;
}) {
  const claims = await requireClinician();
  if (!input.patient_id) return { ok: false as const, reason: "اختر المريض" };
  const sb = await createServerSupabaseClient();
  /* A doctor creating a plan from their own page owns it — otherwise the plan
     would have no doctor_id and vanish from their (doctor-scoped) list. */
  const isDoctor = !!doctorOnly(claims);
  if (isDoctor) {
    // a doctor may only plan for a patient they actually treat
    const { data: seen } = await sb.from("appointments").select("id")
      .eq("clinic_id", claims.clinic_id).eq("doctor_id", claims.sub)
      .eq("patient_id", input.patient_id).is("deleted_at", null).limit(1);
    if (!seen?.length) return { ok: false as const, reason: "هذا المريض ليس من مرضاك" };
  }
  const { data, error } = await sb.from("treatment_plans").insert({
    clinic_id: claims.clinic_id,
    patient_id: input.patient_id,
    doctor_id: input.doctor_id || (isDoctor ? claims.sub : null),
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
  if (!(await ownedPlanId(sb, claims, id))) return { ok: false as const, reason: "الخطة غير متاحة لك" };
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
  if (!(await ownedPlanId(sb, claims, id))) return { ok: false as const, reason: "الخطة غير متاحة لك" };
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
  if (!(await ownedPlanId(sb, claims, input.plan_id))) return { ok: false as const, reason: "الخطة غير متاحة لك" };
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

/** Verify the item's parent plan is mutable by the caller. */
async function itemIsMine(
  sb: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  claims: NonNullable<Claims>,
  itemId: string
): Promise<boolean> {
  const { data } = await sb.from("treatment_plan_items")
    .select("plan_id").eq("id", itemId).eq("clinic_id", claims.clinic_id).maybeSingle();
  const planId = data?.plan_id as string | undefined;
  if (!planId) return false;
  return !!(await ownedPlanId(sb, claims, planId));
}

export async function togglePlanItem(id: string, done: boolean) {
  const claims = await requireClinician();
  const sb = await createServerSupabaseClient();
  if (!(await itemIsMine(sb, claims, id))) return { ok: false as const, reason: "الإجراء غير متاح لك" };
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
  if (!(await itemIsMine(sb, claims, id))) return { ok: false as const, reason: "الإجراء غير متاح لك" };
  const { error } = await sb.from("treatment_plan_items").delete()
    .eq("id", id).eq("clinic_id", claims.clinic_id);
  if (error) return { ok: false as const, reason: "تعذّر حذف الإجراء" };
  rev();
  return { ok: true as const };
}
