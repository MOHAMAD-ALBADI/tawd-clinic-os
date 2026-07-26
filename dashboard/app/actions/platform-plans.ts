"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";
import { MODULES, type ModuleKey } from "@/lib/modules";

/* Plan templates — starting points for a quote, not a published price list.

   Nothing here binds a clinic. Every clinic is priced after a consultation and
   its agreed terms live in clinic_entitlements, copied from a template at signup
   and edited freely afterwards. Editing a template changes what the NEXT quote
   starts from and never re-prices anyone. */

async function requirePlatform() {
  const claims = await getUserClaims();
  if (!claims || !hasRole(claims, "platform_admin")) throw new Error("غير مصرح");
  return claims;
}

const VALID = new Set<string>(MODULES.map((m) => m.key));

export type PlanInput = {
  code: string;
  name_ar: string;
  description_ar: string;
  price_omr: number;
  per_doctor_omr: number;
  setup_fee_omr: number;
  /** null = unlimited */
  max_doctors: number | null;
  max_staff: number | null;
  max_patients: number | null;
  max_whatsapp_msgs: number | null;
  modules: string[];
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
};

export async function savePlan(input: PlanInput) {
  await requirePlatform();
  const code = input.code.trim().toLowerCase();
  if (!/^[a-z][a-z0-9_]{1,20}$/.test(code)) {
    return { ok: false as const, reason: "رمز الباقة بالإنجليزية بدون مسافات" };
  }
  if (!input.name_ar.trim()) return { ok: false as const, reason: "اسم الباقة مطلوب" };

  /* A module the code does not implement would be sold and then not appear.
     Anything unrecognised is dropped rather than stored. */
  const modules = [...new Set(input.modules.filter((m) => VALID.has(m)))];

  const limit = (v: number | null) =>
    v === null || !Number.isFinite(v) || v <= 0 ? null : Math.floor(v);
  const money = (v: number) => Math.max(0, Math.round((Number(v) || 0) * 1000) / 1000);

  const sb = await createServiceRoleClient();

  /* One default at a time, otherwise the new-clinic form silently picks
     whichever row came back first. */
  if (input.is_default) {
    await sb.from("platform_plans").update({ is_default: false }).neq("code", code);
  }

  const { error } = await sb.from("platform_plans").upsert({
    code,
    name_ar: input.name_ar.trim(),
    description_ar: input.description_ar.trim() || null,
    price_omr: money(input.price_omr),
    per_doctor_omr: money(input.per_doctor_omr),
    setup_fee_omr: money(input.setup_fee_omr),
    max_doctors: limit(input.max_doctors),
    max_staff: limit(input.max_staff),
    max_patients: limit(input.max_patients),
    max_whatsapp_msgs: limit(input.max_whatsapp_msgs),
    modules,
    is_active: input.is_active,
    is_default: input.is_default,
    sort_order: Math.max(0, Math.floor(Number(input.sort_order) || 0)),
    updated_at: new Date().toISOString(),
  }, { onConflict: "code" });

  if (error) return { ok: false as const, reason: `تعذّر حفظ الباقة: ${error.message}` };
  revalidatePath("/platform-admin/settings");
  revalidatePath("/platform-admin/clinics/new");
  return { ok: true as const };
}

/** Retire a template.

    Never deleted: clinics record which template their terms came from, and
    removing it would leave those rows pointing at something nobody can describe.
    Retiring hides it from new quotes and changes nothing for existing customers,
    whose terms were copied, not referenced. */
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

/* ── the contract, per clinic ─────────────────────────────────────────────── */

export type EntitlementInput = {
  clinicId: string;
  sourcePlan: string | null;
  modules: string[];
  maxDoctors: number | null;
  maxStaff: number | null;
  maxPatients: number | null;
  maxWhatsappMsgs: number | null;
  basePriceOmr: number;
  perDoctorOmr: number;
  setupFeeOmr: number;
  contractedDoctors: number;
  discountPct: number;
  notes: string;
};

/** Write what was agreed with this clinic, and keep the subscription in step.

    The monthly figure the operator sees on the subscriptions screen and in MRR
    is tawd_subscriptions.price_omr. Saving terms here without updating it would
    give two answers to "what does this clinic pay" — the exact bug class that
    has bitten this codebase repeatedly. */
export async function saveEntitlements(input: EntitlementInput) {
  const claims = await requirePlatform();
  const sb = await createServiceRoleClient();

  const modules = [...new Set(input.modules.filter((m) => VALID.has(m)))] as ModuleKey[];
  const limit = (v: number | null) =>
    v === null || !Number.isFinite(v) || v <= 0 ? null : Math.floor(v);
  const money = (v: number) => Math.max(0, Math.round((Number(v) || 0) * 1000) / 1000);

  const contracted = Math.max(0, Math.floor(Number(input.contractedDoctors) || 0));
  const discount = Math.min(100, Math.max(0, Number(input.discountPct) || 0));
  const base = money(input.basePriceOmr);
  const perDoc = money(input.perDoctorOmr);
  const monthly = money((base + perDoc * contracted) * (1 - discount / 100));

  /* A cap below what the clinic already has would not delete anyone — it would
     just freeze them out of adding the next one, with no explanation on this
     screen. Say so here instead. */
  const [{ count: doctors }, { count: staff }, { count: patients }] = await Promise.all([
    sb.from("tawd_staff_users").select("id", { count: "exact", head: true })
      .eq("clinic_id", input.clinicId).eq("role", "doctor").eq("is_active", true).is("deleted_at", null),
    sb.from("tawd_staff_users").select("id", { count: "exact", head: true })
      .eq("clinic_id", input.clinicId).eq("is_active", true).is("deleted_at", null),
    sb.from("patients").select("id", { count: "exact", head: true })
      .eq("clinic_id", input.clinicId).is("deleted_at", null),
  ]);

  const warnings: string[] = [];
  const md = limit(input.maxDoctors), ms = limit(input.maxStaff), mp = limit(input.maxPatients);
  if (md != null && (doctors ?? 0) > md) warnings.push(`لديهم ${doctors} طبيب والحد ${md}`);
  if (ms != null && (staff ?? 0) > ms) warnings.push(`لديهم ${staff} حساب والحد ${ms}`);
  if (mp != null && (patients ?? 0) > mp) warnings.push(`لديهم ${patients} مريض والحد ${mp}`);

  const { error } = await sb.from("clinic_entitlements").upsert({
    clinic_id: input.clinicId,
    source_plan: input.sourcePlan,
    modules,
    max_doctors: md,
    max_staff: ms,
    max_patients: mp,
    max_whatsapp_msgs: limit(input.maxWhatsappMsgs),
    base_price_omr: base,
    per_doctor_omr: perDoc,
    setup_fee_omr: money(input.setupFeeOmr),
    contracted_doctors: contracted,
    discount_pct: discount,
    notes: input.notes.trim() || null,
    updated_by: claims.sub,
    updated_at: new Date().toISOString(),
  }, { onConflict: "clinic_id" });
  if (error) return { ok: false as const, reason: `تعذّر حفظ الاتفاق: ${error.message}` };

  await sb.from("tawd_subscriptions")
    .update({ price_omr: monthly, plan: input.sourcePlan ?? undefined, updated_at: new Date().toISOString() })
    .eq("clinic_id", input.clinicId);
  if (input.sourcePlan) {
    await sb.from("tawd_clinics").update({ plan: input.sourcePlan }).eq("id", input.clinicId);
  }

  revalidatePath(`/platform-admin/clinics/${input.clinicId}`);
  revalidatePath("/platform-admin/subscriptions");
  revalidatePath("/platform-admin");
  return { ok: true as const, monthly, warnings };
}
