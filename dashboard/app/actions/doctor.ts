"use server";

import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

type ApptStatus = "checked_in" | "in_progress" | "completed" | "no_show" | "cancelled";

/** Move one of the doctor's own appointments to a new status. */
export async function setAppointmentStatus(appointmentId: string, status: ApptStatus) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "cancelled" || status === "no_show") {
    patch.cancelled_at = new Date().toISOString();
    patch.cancelled_by = claims.sub;
  }

  const { error } = await supabase
    .from("appointments")
    .update(patch)
    .eq("id", appointmentId)
    .eq("doctor_id", claims.sub); // a doctor can only touch their own appointments

  if (error) throw new Error(error.message);
  revalidatePath("/doctor");
  revalidatePath("/doctor/appointments");
}

/** Add a clinical note to a patient's file (authored by the doctor). */
export async function addClinicalNote(patientId: string, noteText: string, isPrivate = false) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") throw new Error("غير مصرح");
  if (!noteText.trim()) throw new Error("الملاحظة فارغة");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("patient_notes").insert({
    clinic_id: claims.clinic_id,
    patient_id: patientId,
    doctor_id: claims.sub,
    note_text: noteText.trim(),
    is_private: isPrivate,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/doctor/patients/${patientId}`);
}

export type VitalsInput = {
  weight_kg?: number | null;
  height_cm?: number | null;
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  pulse_bpm?: number | null;
  temperature_c?: number | null;
  oxygen_saturation?: number | null;
};

/** Record a vitals reading for a patient. */
export async function recordVitals(patientId: string, v: VitalsInput) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();

  const num = (x: number | null | undefined) =>
    x === null || x === undefined || Number.isNaN(x) ? null : x;
  const w = num(v.weight_kg);
  const h = num(v.height_cm);
  // NOTE: bmi is a generated column in Postgres — never insert it.
  const { error } = await supabase.from("patient_vitals").insert({
    clinic_id: claims.clinic_id,
    patient_id: patientId,
    weight_kg: w,
    height_cm: h,
    blood_pressure_systolic: num(v.blood_pressure_systolic),
    blood_pressure_diastolic: num(v.blood_pressure_diastolic),
    pulse_bpm: num(v.pulse_bpm),
    temperature_c: num(v.temperature_c),
    oxygen_saturation: num(v.oxygen_saturation),
    recorded_by: claims.sub,
  });

  if (error) throw new Error(error.message);
  revalidatePath(`/doctor/patients/${patientId}`);
}
