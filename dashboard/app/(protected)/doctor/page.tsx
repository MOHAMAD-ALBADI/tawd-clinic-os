import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { KPICard } from "@/components/dashboard/kpi-card";
import { TodayTimeline } from "@/components/dashboard/today-timeline";
import { Stethoscope, CheckCircle, Clock, UserCircle } from "lucide-react";
import type { TimelineSlot } from "@/types/tawd";

export const metadata = { title: "جدولي اليوم — طود" };

type JoinedPatient = { name: string } | null;
type JoinedService = { name: string } | null;

export default async function DoctorPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  const { data: appointments } = await supabase
    .from("appointments")
    .select("id, slot_time, status, patients(name), services(name)")
    .eq("doctor_id", claims.sub)
    .gte("slot_time", `${today}T00:00:00`)
    .lte("slot_time", `${today}T23:59:59`)
    .order("slot_time");

  const appts = appointments ?? [];
  const completed = appts.filter((a) => a.status === "completed").length;
  const remaining = appts.filter((a) =>
    ["scheduled", "confirmed", "checked_in"].includes(a.status)
  ).length;
  const inProgress = appts.filter((a) => a.status === "in_progress").length;

  const slots: TimelineSlot[] = appts.map((a) => ({
    id: a.id,
    patient_name: (a.patients as unknown as JoinedPatient)?.name ?? "مجهول",
    time: a.slot_time,
    service: (a.services as unknown as JoinedService)?.name ?? "",
    status: a.status,
  }));

  const nextPatient = appts.find((a) =>
    ["confirmed", "checked_in"].includes(a.status)
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <h2 className="text-xl font-bold" style={{ color: "hsl(var(--foreground))" }}>
        جدولي اليوم
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="إجمالي اليوم"
          value={appts.length}
          subLabel="مريض"
          variant="gold"
          isLive
          icon={<Stethoscope className="w-4 h-4 text-tawd-600" />}
        />
        <KPICard
          label="مكتملة"
          value={completed}
          variant="success"
          icon={<CheckCircle className="w-4 h-4 text-emerald-600" />}
        />
        <KPICard
          label="متبقية"
          value={remaining}
          variant="gold"
          icon={<Clock className="w-4 h-4 text-amber-500" />}
        />
        <KPICard
          label="جارٍ الآن"
          value={inProgress}
          variant={inProgress > 0 ? "teal" : "slate"}
          isLive={inProgress > 0}
          icon={<UserCircle className="w-4 h-4 text-tawd-600" />}
        />
      </div>

      {nextPatient && (
        <div
          className="rounded-xl border border-tawd-600/30 p-4 flex items-center gap-4"
          style={{ background: "rgba(20,184,166,0.08)" }}
        >
          <div className="w-10 h-10 rounded-full bg-tawd-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            {(nextPatient.patients as unknown as JoinedPatient)?.name?.charAt(0) ?? "م"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-tawd-600 font-medium mb-0.5">المريض التالي</p>
            <p className="font-semibold text-sm truncate" style={{ color: "hsl(var(--foreground))" }}>
              {(nextPatient.patients as unknown as JoinedPatient)?.name ?? "مجهول"}
            </p>
            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
              {(nextPatient.services as unknown as JoinedService)?.name}
            </p>
          </div>
          <span className="text-xs font-medium text-tawd-600 bg-tawd-50 px-2 py-1 rounded-full">
            {nextPatient.status === "checked_in" ? "في الانتظار" : "مؤكد"}
          </span>
        </div>
      )}

      <div
        className="rounded-xl border p-5 card-elevated"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        <h3 className="font-semibold mb-4" style={{ color: "hsl(var(--foreground))" }}>
          قائمة المرضى
        </h3>
        <TodayTimeline slots={slots} />
      </div>
    </div>
  );
}
