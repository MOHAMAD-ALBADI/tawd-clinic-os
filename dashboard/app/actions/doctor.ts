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

export type MedicalHistoryInput = {
  blood_type?: string | null;
  allergies: string[];
  chronic_diseases: string[];
  current_medications: string[];
  notes?: string | null;
};

const BLOOD_TYPES = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"]);

/** Create/update the patient's unified medical history (allergies drive the red-flag badge). */
export async function saveMedicalHistory(patientId: string, h: MedicalHistoryInput) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();
  const clean = (arr: string[]) =>
    [...new Set(arr.map((s) => s.trim()).filter(Boolean))].slice(0, 30);

  const { error } = await supabase.from("medical_histories").upsert(
    {
      patient_id: patientId,
      blood_type: h.blood_type && BLOOD_TYPES.has(h.blood_type) ? h.blood_type : "unknown",
      allergies: clean(h.allergies),
      chronic_diseases: clean(h.chronic_diseases),
      current_medications: clean(h.current_medications),
      notes: h.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "patient_id" }
  );
  if (error) throw new Error(error.message);
  revalidatePath(`/doctor/patients/${patientId}`);
  revalidatePath("/doctor");
}

export type ExamNoteInput = {
  complaint: string;   // الشكوى
  findings: string;    // الفحص
  diagnosis: string;   // التشخيص
  plan: string;        // الخطة
  isPrivate?: boolean;
  completeAppointment?: boolean;
};

/** Save a structured exam note; optionally mark the appointment completed. */
export async function saveExamNote(patientId: string, appointmentId: string | null, n: ExamNoteInput) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") throw new Error("غير مصرح");

  const parts = [
    n.complaint.trim() && `【الشكوى】 ${n.complaint.trim()}`,
    n.findings.trim() && `【الفحص】 ${n.findings.trim()}`,
    n.diagnosis.trim() && `【التشخيص】 ${n.diagnosis.trim()}`,
    n.plan.trim() && `【الخطة】 ${n.plan.trim()}`,
  ].filter(Boolean);
  if (parts.length === 0) throw new Error("الملاحظة فارغة");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("patient_notes").insert({
    clinic_id: claims.clinic_id,
    patient_id: patientId,
    doctor_id: claims.sub,
    note_text: parts.join("\n"),
    is_private: n.isPrivate ?? false,
  });
  if (error) throw new Error(error.message);

  if (appointmentId && n.completeAppointment) {
    await supabase
      .from("appointments")
      .update({ status: "completed", updated_at: new Date().toISOString() })
      .eq("id", appointmentId)
      .eq("doctor_id", claims.sub);
  }

  revalidatePath(`/doctor/patients/${patientId}`);
  revalidatePath("/doctor");
}

export type WeekDayInput = {
  day: "sunday" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";
  active: boolean;
  start: string; // "09:00"
  end: string;   // "18:00"
};

/** Replace the doctor's weekly working hours (feeds Sura's booking availability). */
export async function saveWeeklySchedule(days: WeekDayInput[]) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") throw new Error("غير مصرح");

  const valid = days.filter(
    (d) =>
      /^\d{2}:\d{2}$/.test(d.start) &&
      /^\d{2}:\d{2}$/.test(d.end) &&
      d.start < d.end
  );

  const supabase = await createServerSupabaseClient();

  // replace-all for this doctor: delete then insert active days
  const del = await supabase
    .from("doctor_schedules")
    .delete()
    .eq("doctor_id", claims.sub)
    .eq("clinic_id", claims.clinic_id);
  if (del.error) throw new Error(del.error.message);

  const rows = valid
    .filter((d) => d.active)
    .map((d) => ({
      clinic_id: claims.clinic_id,
      doctor_id: claims.sub,
      day_of_week: d.day,
      start_time: `${d.start}:00`,
      end_time: `${d.end}:00`,
      is_active: true,
    }));

  if (rows.length) {
    const ins = await supabase.from("doctor_schedules").insert(rows);
    if (ins.error) throw new Error(ins.error.message);
  }
  revalidatePath("/doctor/schedule");
}

/** Request a personal day off (stored as a doctor-specific clinic holiday). */
export async function requestLeave(dateISO: string, reason: string) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") throw new Error("غير مصرح");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) throw new Error("تاريخ غير صالح");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.from("clinic_holidays").insert({
    clinic_id: claims.clinic_id,
    holiday_date: dateISO,
    name: "Doctor leave",
    name_ar: reason.trim() || "إجازة شخصية",
    applies_to_all_doctors: false,
    doctor_id: claims.sub,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/doctor/schedule");
}

/** Update the doctor's own display names. */
export async function updateMyProfile(nameAr: string, nameEn: string) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") throw new Error("غير مصرح");
  if (!nameAr.trim() && !nameEn.trim()) throw new Error("الاسم فارغ");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("tawd_staff_users")
    .update({
      name_ar: nameAr.trim() || null,
      name: nameEn.trim() || nameAr.trim(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", claims.sub)
    .eq("clinic_id", claims.clinic_id);
  if (error) throw new Error(error.message);
  revalidatePath("/doctor/settings");
  revalidatePath("/doctor");
}

/** Change the doctor's own password (via the authenticated session). */
export async function changeMyPassword(newPassword: string) {
  const claims = await getUserClaims();
  if (!claims) throw new Error("غير مصرح");
  if (newPassword.length < 8) throw new Error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}

/** Cancel one of the doctor's own upcoming leaves. */
export async function cancelLeave(leaveId: string) {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") throw new Error("غير مصرح");

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase
    .from("clinic_holidays")
    .delete()
    .eq("id", leaveId)
    .eq("doctor_id", claims.sub);
  if (error) throw new Error(error.message);
  revalidatePath("/doctor/schedule");
}

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
