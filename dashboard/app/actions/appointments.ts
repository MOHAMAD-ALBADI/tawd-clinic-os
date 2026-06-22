"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { revalidatePath } from "next/cache";

/* Matches the appointment_status enum exactly. */
export type AppointmentStatus =
  | "scheduled" | "confirmed" | "checked_in"
  | "in_progress" | "completed" | "cancelled" | "no_show";

function revalidateAppt() {
  revalidatePath("/clinic-admin");
  revalidatePath("/clinic-admin/appointments");
  revalidatePath("/reception");
  revalidatePath("/doctor");
}

export async function updateAppointmentStatus(appointmentId: string, newStatus: AppointmentStatus) {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();
  const patch: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };
  if (newStatus === "cancelled") {
    patch.cancelled_at = new Date().toISOString();
    patch.cancelled_by = claims.sub;
  }
  const { error } = await supabase
    .from("appointments")
    .update(patch)
    .eq("id", appointmentId)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);

  revalidateAppt();
  return { success: true };
}

export async function createAppointment(data: {
  patient_id: string;
  service_id: string;
  doctor_id: string;
  slot_time: string;
  duration_minutes?: number;
  type?: "new_patient" | "follow_up" | "consultation" | "procedure" | "emergency";
  notes?: string;
}) {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");
  if (!data.patient_id) throw new Error("اختر المريض");
  if (!data.doctor_id) throw new Error("اختر الطبيب");
  if (!data.slot_time) throw new Error("اختر الوقت");

  const supabase = await createServerSupabaseClient();
  const { data: appt, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id:  claims.clinic_id,
      patient_id: data.patient_id,
      service_id: data.service_id || null,
      doctor_id:  data.doctor_id,
      slot_time:  data.slot_time,
      duration_minutes: data.duration_minutes ?? 30,
      type:       data.type ?? "consultation",
      status:     "confirmed",
      notes:      data.notes?.trim() || null,
    })
    .select("id, slot_time")
    .single();
  if (error) throw new Error(error.message);

  revalidateAppt();
  return { success: true, appointment: appt };
}

export async function rescheduleAppointment(id: string, slotTime: string, durationMinutes?: number) {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");
  if (!slotTime) throw new Error("اختر الوقت الجديد");

  const supabase = await createServerSupabaseClient();
  const patch: Record<string, unknown> = { slot_time: slotTime, status: "confirmed", updated_at: new Date().toISOString() };
  if (durationMinutes) patch.duration_minutes = durationMinutes;
  const { error } = await supabase
    .from("appointments")
    .update(patch)
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);

  revalidateAppt();
  return { success: true };
}

/* Soft cancel — keeps the record, sets status + reason. No hard delete. */
export async function cancelAppointment(id: string, reason?: string) {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      cancellation_reason: reason?.trim() || null,
      cancelled_at: new Date().toISOString(),
      cancelled_by: claims.sub,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);

  revalidateAppt();
  return { success: true };
}
