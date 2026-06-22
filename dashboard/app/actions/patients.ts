"use server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
