import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ScheduleEditor, type ScheduleRow, type LeaveRow } from "@/components/doctor/schedule-editor";

export const metadata = { title: "دوامي وإجازاتي — طود" };

export default async function DoctorSchedulePage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  const [{ data: schedule }, { data: leaves }] = await Promise.all([
    supabase
      .from("doctor_schedules")
      .select("day_of_week, start_time, end_time")
      .eq("doctor_id", claims.sub)
      .eq("is_active", true),
    supabase
      .from("clinic_holidays")
      .select("id, holiday_date, name_ar")
      .eq("doctor_id", claims.sub)
      .gte("holiday_date", today)
      .order("holiday_date"),
  ]);

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none">دوامي وإجازاتي</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>
          حدّد ساعات عملك — سُرى تحجز للمرضى ضمنها فقط
        </p>
      </div>

      <ScheduleEditor
        schedule={(schedule ?? []) as ScheduleRow[]}
        leaves={(leaves ?? []) as LeaveRow[]}
      />
    </div>
  );
}
