import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasRole } from "@/lib/auth/role-redirect";
import {
  WeekCalendar, type CalAppt, type CalDoctor, type CalShift,
} from "@/components/reception/week-calendar";

export const metadata = { title: "التقويم — طود" };
export const dynamic = "force-dynamic";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Muscat day key, and the Sunday that starts its week — the working week here
    runs Sunday to Thursday, so a Monday-first calendar reads wrong. */
function muscatKey(d = new Date()) {
  return new Date(d.getTime() + 4 * 3600_000).toISOString().slice(0, 10);
}
function weekStartKey(key: string) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

export default async function ReceptionCalendarPage() {
  const claims = await getUserClaims();
  if (!claims || !(hasRole(claims, "receptionist") || claims.role === "clinic_admin")) redirect("/login");

  const sb = await createServerSupabaseClient();
  const todayKey = muscatKey();
  const startKey = weekStartKey(todayKey);

  /* Four weeks of context: the desk pages back and forward and refetching on
     every arrow would make the calendar feel broken on a slow connection. */
  const from = new Date(`${startKey}T00:00:00+04:00`);
  from.setUTCDate(from.getUTCDate() - 14);
  const to = new Date(`${startKey}T00:00:00+04:00`);
  to.setUTCDate(to.getUTCDate() + 28);

  const [{ data: appts }, { data: docs }, { data: schedules }, { data: hist }] = await Promise.all([
    sb.from("appointments")
      .select("id, slot_time, duration_minutes, status, patient_id, doctor_id, patients!patient_id(name), services!service_id(name_ar)")
      .eq("clinic_id", claims.clinic_id).is("deleted_at", null)
      .gte("slot_time", from.toISOString()).lte("slot_time", to.toISOString())
      .order("slot_time").limit(2000),
    sb.from("tawd_staff_users").select("id, name, name_ar")
      .eq("clinic_id", claims.clinic_id).eq("role", "doctor").eq("is_active", true).is("deleted_at", null)
      .order("name_ar"),
    sb.from("doctor_schedules").select("doctor_id, day_of_week, start_time, end_time").eq("is_active", true),
    sb.from("medical_histories").select("patient_id, allergies").limit(5000),
  ]);

  const allergic = new Set(
    (hist ?? []).filter((h) => ((h.allergies as string[] | null) ?? []).length > 0).map((h) => h.patient_id as string)
  );

  const doctors: CalDoctor[] = (docs ?? []).map((d) => ({
    id: d.id as string, label: (d.name_ar ?? d.name) as string,
  }));
  const docIds = new Set(doctors.map((d) => d.id));

  const shifts: CalShift[] = (schedules ?? [])
    .filter((s) => docIds.has(s.doctor_id as string))
    .map((s) => ({
      doctorId: s.doctor_id as string,
      weekday: WEEKDAYS.indexOf(s.day_of_week as string),
      startMin: toMin(s.start_time as string),
      endMin: toMin(s.end_time as string),
    }))
    .filter((s) => s.weekday >= 0);

  const rows: CalAppt[] = (appts ?? []).map((a) => ({
    id: a.id as string,
    slotTime: a.slot_time as string,
    durationMinutes: Number(a.duration_minutes ?? 30),
    status: a.status as string,
    patientId: a.patient_id as string,
    patientName: (a.patients as unknown as { name?: string } | null)?.name ?? "مريض",
    doctorId: a.doctor_id as string,
    service: (a.services as unknown as { name_ar?: string } | null)?.name_ar ?? null,
    hasAllergy: allergic.has(a.patient_id as string),
  }));

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">CALENDAR</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">التقويم</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          الأسبوع بالكامل لكل طبيب — المساحة الزرقاء وقت متاح، اضغطها لتحجز فيه
        </p>
      </div>

      <WeekCalendar appts={rows} doctors={doctors} shifts={shifts} startKey={startKey} todayKey={todayKey} />
    </div>
  );
}
