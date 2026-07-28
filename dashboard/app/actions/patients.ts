"use server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { checkLimit } from "@/lib/entitlements";
import { loadOpenReceivables, owedByPatient } from "@/lib/receivables";

type PatientInput = {
  name: string;
  phone: string;
  dob?: string;
  gender?: string;
  email?: string;
  national_id?: string;
};

function assertAdmin(claims: Awaited<ReturnType<typeof getUserClaims>>) {
  if (!claims || claims.role !== "clinic_admin") throw new Error("غير مصرح");
  return claims;
}

export async function createPatient(data: PatientInput) {
  const claims = assertAdmin(await getUserClaims());
  if (!data.name?.trim()) throw new Error("اسم المريض مطلوب");
  if (!data.phone?.trim()) throw new Error("رقم الجوال مطلوب");

  /* Only the manager's own "add patient" and the bulk import are capped.
     Reception, the booking page and Sura are not — a patient standing at the
     desk is never turned away because a contract line is full. The overage
     shows on the operator's side instead. */
  const room = await checkLimit(claims.clinic_id, "patients");
  if (!room.ok) throw new Error(room.reason);

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("patients").insert({
    clinic_id: claims.clinic_id,
    name: data.name.trim(),
    phone: data.phone.trim(),
    dob: data.dob || null,
    gender: data.gender || null,
    email: data.email?.trim() || null,
    national_id: data.national_id?.trim() || null,
    loyalty_points: 0,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/patients");
  revalidatePath("/clinic-admin");
  return { success: true };
}

export async function updatePatient(id: string, data: PatientInput) {
  const claims = assertAdmin(await getUserClaims());
  if (!data.name?.trim()) throw new Error("اسم المريض مطلوب");
  if (!data.phone?.trim()) throw new Error("رقم الجوال مطلوب");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("patients")
    .update({
      name: data.name.trim(),
      phone: data.phone.trim(),
      dob: data.dob || null,
      gender: data.gender || null,
      email: data.email?.trim() || null,
      national_id: data.national_id?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/patients");
  revalidatePath(`/clinic-admin/patients/${id}`);
  return { success: true };
}

/* Soft archive — NEVER hard-delete a medical record. */
export async function archivePatient(id: string, reason?: string) {
  const claims = assertAdmin(await getUserClaims());
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("patients")
    .update({
      is_archived: true,
      archive_reason: reason?.trim() || null,
      archived_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/patients");
  return { success: true };
}

export async function restorePatient(id: string) {
  const claims = assertAdmin(await getUserClaims());
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("patients")
    .update({ is_archived: false, archive_reason: null, archived_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/clinic-admin/patients");
  return { success: true };
}

/* Finding a patient in a clinic bigger than one page.

   The directory loaded the newest five thousand and filtered them in the browser,
   so search worked beautifully until a clinic passed five thousand patients and
   then silently stopped finding the oldest ones — the worst kind of failure,
   because the box still works and the answer is just wrong. Someone registered
   six years ago is exactly who rings up asking for their records.

   So the typing goes to the database. Same row shape the page builds, so the
   directory renders results and its own first page identically. */
export type DirectoryHit = {
  id: string;
  name: string;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  lastVisit: string | null;
  nextAppt: string | null;
  balance: number;
  allergies: string[];
  chronic: string[];
};

export async function searchPatients(term: string): Promise<DirectoryHit[]> {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");
  /* Every clinic role legitimately looks a patient up; the platform operator does
     it through the clinic's own account, not across tenants. */
  const t = term.trim();
  if (t.length < 2) return [];

  const sb = await createServerSupabaseClient();
  /* Escaped: a % or _ typed into the box would otherwise become a wildcard and
     a lone % would match the entire clinic. */
  const like = `%${t.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

  const { data: people } = await sb
    .from("patients")
    .select("id, name, phone, gender, dob")
    .eq("clinic_id", claims.clinic_id).is("deleted_at", null).eq("is_archived", false)
    .or(`name.ilike.${like},name_ar.ilike.${like},phone.ilike.${like}`)
    .order("name")
    .limit(60);

  const ids = (people ?? []).map((p) => p.id as string);
  if (!ids.length) return [];

  const nowIso = new Date().toISOString();
  const [{ data: visits }, { data: future }, { data: hist }, owing] = await Promise.all([
    sb.from("appointments").select("patient_id, slot_time")
      .eq("clinic_id", claims.clinic_id).eq("status", "completed").is("deleted_at", null)
      .in("patient_id", ids).order("slot_time", { ascending: false }),
    sb.from("appointments").select("patient_id, slot_time")
      .eq("clinic_id", claims.clinic_id).in("status", ["scheduled", "confirmed"])
      .is("deleted_at", null).in("patient_id", ids)
      .gte("slot_time", nowIso).order("slot_time"),
    sb.from("medical_histories").select("patient_id, allergies, chronic_diseases")
      .in("patient_id", ids),
    loadOpenReceivables(sb, claims.clinic_id, { patientIds: ids }),
  ]);

  const last = new Map<string, string>();
  for (const v of visits ?? []) {
    const pid = v.patient_id as string;
    if (!last.has(pid)) last.set(pid, v.slot_time as string);
  }
  const next = new Map<string, string>();
  for (const a of future ?? []) {
    const pid = a.patient_id as string;
    if (!next.has(pid)) next.set(pid, a.slot_time as string);
  }
  const flags = new Map<string, { a: string[]; c: string[] }>();
  for (const h of hist ?? []) {
    flags.set(h.patient_id as string, {
      a: (h.allergies as string[] | null) ?? [],
      c: (h.chronic_diseases as string[] | null) ?? [],
    });
  }
  const owed = owedByPatient(owing);

  return (people ?? []).map((p) => {
    const id = p.id as string;
    const f = flags.get(id);
    return {
      id,
      name: (p.name as string) ?? "—",
      phone: (p.phone as string | null) ?? null,
      gender: (p.gender as string | null) ?? null,
      dob: (p.dob as string | null) ?? null,
      lastVisit: last.get(id) ?? null,
      nextAppt: next.get(id) ?? null,
      balance: Number((owed.get(id) ?? 0).toFixed(3)),
      allergies: f?.a ?? [],
      chronic: f?.c ?? [],
    };
  });
}
