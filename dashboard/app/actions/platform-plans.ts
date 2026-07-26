"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

/* The plan catalogue — what each tier costs and what it includes.

   Kept separate from tawd_subscriptions on purpose: a subscription records what
   ONE clinic agreed to and must not change when the price list does. A clinic on
   120 OMR stays on 120 until someone moves it, even if "pro" is repriced
   tomorrow. Editing the catalogue changes what NEW clinics are offered. */

async function requirePlatform() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) throw new Error("غير مصرح");
  return claims;
}

export type PlanInput = {
  code: string;
  name_ar: string;
  price_omr: number;
  /** null = unlimited */
  max_staff: number | null;
  max_patients: number | null;
  has_sura: boolean;
  has_inventory: boolean;
  has_payroll: boolean;
  has_insurance: boolean;
  is_active: boolean;
};

export async function savePlan(input: PlanInput) {
  await requirePlatform();
  const code = input.code.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,20}$/.test(code)) {
    return { ok: false as const, reason: "رمز الباقة بالإنجليزية بدون مسافات" };
  }
  if (!input.name_ar.trim()) return { ok: false as const, reason: "اسم الباقة مطلوب" };

  const clean = (v: number | null) =>
    v === null || !Number.isFinite(v) || v <= 0 ? null : Math.floor(v);

  const sb = await createServiceRoleClient();
  const { error } = await sb.from("platform_plans").upsert({
    code,
    name_ar: input.name_ar.trim(),
    price_omr: Math.max(0, Number(input.price_omr) || 0),
    max_staff: clean(input.max_staff),
    max_patients: clean(input.max_patients),
    has_sura: input.has_sura,
    has_inventory: input.has_inventory,
    has_payroll: input.has_payroll,
    has_insurance: input.has_insurance,
    is_active: input.is_active,
    updated_at: new Date().toISOString(),
  }, { onConflict: "code" });

  if (error) return { ok: false as const, reason: "تعذّر حفظ الباقة" };
  revalidatePath("/platform-admin/settings");
  revalidatePath("/platform-admin/subscriptions");
  return { ok: true as const };
}

/** Retire a plan from the price list.

    Never deleted: clinics reference the code on their subscription, and removing
    it would leave those rows pointing at a tier nobody can describe. Retiring
    hides it from new sales and leaves existing customers exactly as they are. */
export async function setPlanActive(code: string, active: boolean) {
  await requirePlatform();
  const sb = await createServiceRoleClient();
  const { error } = await sb.from("platform_plans")
    .update({ is_active: active, updated_at: new Date().toISOString() })
    .eq("code", code);
  if (error) return { ok: false as const, reason: "تعذّر تحديث الباقة" };
  revalidatePath("/platform-admin/settings");
  return { ok: true as const };
}
