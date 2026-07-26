import "server-only";
import { cache } from "react";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  type Entitlements, type ModuleKey, OPEN_ENTITLEMENTS,
} from "@/lib/modules";

/* Reading the contract.

   Everything that gates a module goes through here, so there is exactly one
   answer to "what did this clinic buy" and one place to change how it is
   decided. Cached per request: a page, its layout and three server actions all
   asking costs one query. */

type Row = {
  clinic_id: string;
  source_plan: string | null;
  modules: string[] | null;
  max_doctors: number | null;
  max_staff: number | null;
  max_patients: number | null;
  max_whatsapp_msgs: number | null;
  base_price_omr: string | number;
  per_doctor_omr: string | number;
  setup_fee_omr: string | number;
  contracted_doctors: number;
  discount_pct: string | number;
  notes: string | null;
};

// PostgREST hands NUMERIC back as a string; arithmetic on it silently concatenates
const n = (v: string | number | null | undefined) => Number(v ?? 0);

function shape(r: Row): Entitlements {
  return {
    clinicId: r.clinic_id,
    sourcePlan: r.source_plan,
    modules: (r.modules ?? []) as ModuleKey[],
    maxDoctors: r.max_doctors,
    maxStaff: r.max_staff,
    maxPatients: r.max_patients,
    maxWhatsappMsgs: r.max_whatsapp_msgs,
    basePriceOmr: n(r.base_price_omr),
    perDoctorOmr: n(r.per_doctor_omr),
    setupFeeOmr: n(r.setup_fee_omr),
    contractedDoctors: r.contracted_doctors ?? 1,
    discountPct: n(r.discount_pct),
    notes: r.notes,
  };
}

/** The signed-in clinic's own entitlements. RLS keeps it to their row. */
export const getEntitlements = cache(async (clinicId: string): Promise<Entitlements> => {
  if (!clinicId) return OPEN_ENTITLEMENTS("");
  const sb = await createServerSupabaseClient();
  const { data } = await sb.from("clinic_entitlements")
    .select("*").eq("clinic_id", clinicId).maybeSingle();
  return data ? shape(data as Row) : OPEN_ENTITLEMENTS(clinicId);
});

/** Any clinic's entitlements, for the platform operator. */
export const getEntitlementsAsPlatform = cache(async (clinicId: string): Promise<Entitlements> => {
  const sb = await createServiceRoleClient();
  const { data } = await sb.from("clinic_entitlements")
    .select("*").eq("clinic_id", clinicId).maybeSingle();
  return data ? shape(data as Row) : OPEN_ENTITLEMENTS(clinicId);
});

export async function hasModule(clinicId: string, key: ModuleKey): Promise<boolean> {
  const e = await getEntitlements(clinicId);
  return e.modules.includes(key);
}

export type LimitCheck =
  | { ok: true; used: number; limit: number | null }
  | { ok: false; used: number; limit: number; reason: string };

/** Is there room for one more?

    Counted live rather than tracked in a counter, because a counter that drifts
    either blocks a clinic that has room or lets one past the limit it pays for.
    These tables are small enough per clinic that a COUNT is the honest answer. */
export async function checkLimit(
  clinicId: string,
  what: "doctors" | "staff" | "patients",
): Promise<LimitCheck> {
  const e = await getEntitlements(clinicId);
  const limit =
    what === "doctors" ? e.maxDoctors
    : what === "staff" ? e.maxStaff
    : e.maxPatients;

  if (limit == null) return { ok: true, used: 0, limit: null };

  const sb = await createServiceRoleClient();
  let used = 0;

  if (what === "patients") {
    const { count } = await sb.from("patients")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId).is("deleted_at", null);
    used = count ?? 0;
  } else {
    let q = sb.from("tawd_staff_users")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId).eq("is_active", true).is("deleted_at", null);
    if (what === "doctors") q = q.eq("role", "doctor");
    const { count } = await q;
    used = count ?? 0;
  }

  if (used >= limit) {
    const noun = what === "doctors" ? "طبيب" : what === "staff" ? "حساب" : "مريض";
    return {
      ok: false, used, limit,
      reason: `وصلت عيادتكم للحد المتفق عليه (${limit} ${noun}). للتوسعة تواصلوا مع فريق طود.`,
    };
  }
  return { ok: true, used, limit };
}
