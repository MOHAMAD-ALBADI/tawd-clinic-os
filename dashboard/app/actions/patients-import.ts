"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import { revalidatePath } from "next/cache";

export type ImportRow = {
  name: string;
  phone?: string;
  dob?: string;
  gender?: string;
  email?: string;
  national_id?: string;
};

const normPhone = (p?: string) => (p ?? "").replace(/[^\d+]/g, "").replace(/^00/, "+");
const normGender = (g?: string): string | null => {
  const s = (g ?? "").trim().toLowerCase();
  if (/(^m$|male|ذكر|رجل|ولد)/.test(s)) return "male";
  if (/(^f$|female|أنثى|انثى|امرأة|بنت)/.test(s)) return "female";
  return null;
};
const normDob = (d?: string): string | null => {
  const s = (d ?? "").trim();
  if (!s) return null;
  // accept YYYY-MM-DD or DD/MM/YYYY or DD-MM-YYYY
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
};

/** Bulk-import patients (clinic_admin → own clinic; platform_admin → target clinic).
    Dedups by phone within the clinic + within the batch. Never throws on bad rows. */
export async function importPatients(rows: ImportRow[], targetClinicId?: string) {
  const claims = await getUserClaims();
  if (!claims) return { ok: false as const, reason: "غير مصرح" };

  let clinicId: string;
  let sb: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  if (hasRole(claims, "platform_admin")) {
    if (!targetClinicId) return { ok: false as const, reason: "لم تُحدَّد العيادة" };
    clinicId = targetClinicId;
    sb = await createServiceRoleClient();
  } else if (claims.role === "clinic_admin") {
    clinicId = claims.clinic_id;
    sb = await createServerSupabaseClient();
  } else {
    return { ok: false as const, reason: "غير مصرح" };
  }

  const clean = (rows ?? [])
    .map((r) => ({
      name: (r.name ?? "").trim(),
      phone: normPhone(r.phone),
      dob: normDob(r.dob),
      gender: normGender(r.gender),
      email: (r.email ?? "").trim() || null,
      national_id: (r.national_id ?? "").trim() || null,
    }))
    .filter((r) => r.name.length > 0)
    .slice(0, 5000);

  if (clean.length === 0) return { ok: false as const, reason: "لا صفوف صالحة — تأكد من عمود الاسم" };

  /* existing phones in this clinic for dedup */
  const { data: existing } = await sb
    .from("patients").select("phone")
    .eq("clinic_id", clinicId).is("deleted_at", null).limit(100000);
  const existingSet = new Set((existing ?? []).map((p) => normPhone(p.phone as string)).filter(Boolean));

  const seen = new Set<string>();
  const toInsert: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const r of clean) {
    if (r.phone && (existingSet.has(r.phone) || seen.has(r.phone))) { skipped++; continue; }
    if (r.phone) seen.add(r.phone);
    toInsert.push({
      clinic_id: clinicId,
      name: r.name,
      phone: r.phone || null,
      dob: r.dob,
      gender: r.gender,
      email: r.email,
      national_id: r.national_id,
      source_channel: "import",
    });
  }

  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < toInsert.length; i += 500) {
    const chunk = toInsert.slice(i, i + 500);
    const { error, count } = await sb.from("patients").insert(chunk, { count: "exact" });
    if (error) errors.push(error.message);
    else inserted += count ?? chunk.length;
  }

  revalidatePath("/clinic-admin/patients");
  if (targetClinicId) revalidatePath(`/platform-admin/clinics/${targetClinicId}`);
  return {
    ok: true as const,
    inserted,
    skipped,
    total: rows?.length ?? 0,
    errors: errors.slice(0, 3),
  };
}
