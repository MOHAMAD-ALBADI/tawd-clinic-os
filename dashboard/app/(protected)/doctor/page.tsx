import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppointmentActions } from "@/components/doctor/appointment-actions";
import { Stethoscope, CheckCircle, Clock, Activity, ChevronLeft } from "lucide-react";

export const metadata = { title: "جدولي اليوم — طود" };

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: "مجدول", color: "#94A3B8" },
  confirmed: { label: "مؤكد", color: "#5dd9cb" },
  checked_in: { label: "حضَر", color: "#38bdf8" },
  in_progress: { label: "جارٍ الكشف", color: "#fbbf24" },
  completed: { label: "مكتمل", color: "#34D399" },
  cancelled: { label: "ملغي", color: "#94A3B8" },
  no_show: { label: "لم يحضر", color: "#F87171" },
};

function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}

type J = { name: string } | null;

function Kpi({ label, value, sub, color, live }: { label: string; value: number; sub?: string; color: string; live?: boolean }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: `linear-gradient(135deg, ${color}10 0%, rgba(6,14,30,0.9) 65%)`, border: `1px solid ${color}22` }}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: "rgba(148,163,184,0.6)" }}>{label}</span>
        {live && <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />}
      </div>
      <div className="text-3xl font-black mt-1" style={{ color }}>{value}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: "rgba(148,163,184,0.5)" }}>{sub}</div>}
    </div>
  );
}

export default async function DoctorTodayPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("appointments")
    .select("id, slot_time, status, patient_id, patients(name), services(name_ar)")
    .eq("doctor_id", claims.sub)
    .is("deleted_at", null)
    .gte("slot_time", `${today}T00:00:00`)
    .lte("slot_time", `${today}T23:59:59`)
    .order("slot_time");

  const appts = data ?? [];
  const completed = appts.filter((a) => a.status === "completed").length;
  const remaining = appts.filter((a) => ["scheduled", "confirmed", "checked_in"].includes(a.status)).length;
  const inProgress = appts.filter((a) => a.status === "in_progress").length;

  const todayAr = new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-white">جدولي اليوم</h2>
        <p className="text-sm mt-0.5" style={{ color: "rgba(148,163,184,0.6)" }}>{todayAr}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="إجمالي اليوم" value={appts.length} sub="موعد" color="#2dd4bf" live />
        <Kpi label="مكتملة" value={completed} color="#34D399" />
        <Kpi label="متبقية" value={remaining} color="#fbbf24" />
        <Kpi label="جارٍ الآن" value={inProgress} color="#38bdf8" live={inProgress > 0} />
      </div>

      <div className="rounded-2xl p-5" style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2"><Activity className="w-4 h-4" style={{ color: "#5dd9cb" }} /> مرضى اليوم</h3>

        {appts.length === 0 ? (
          <div className="text-center py-12">
            <Stethoscope className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(148,163,184,0.3)" }} />
            <p className="text-sm" style={{ color: "rgba(148,163,184,0.5)" }}>لا مواعيد اليوم</p>
          </div>
        ) : (
          <div className="space-y-2">
            {appts.map((a) => {
              const st = STATUS[a.status] ?? STATUS.scheduled;
              const name = (a.patients as unknown as J)?.name ?? "مجهول";
              const svc = (a.services as unknown as { name_ar: string } | null)?.name_ar ?? "";
              return (
                <div key={a.id} className="flex items-center gap-4 px-4 py-3 rounded-xl flex-wrap"
                  style={{ background: a.status === "in_progress" ? "rgba(251,191,36,0.06)" : "rgba(255,255,255,0.02)", border: `1px solid ${a.status === "in_progress" ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.05)"}` }}>
                  <span className="text-sm font-bold ltr-nums w-16 shrink-0" style={{ color: "#5dd9cb" }}>{fmtTime(a.slot_time)}</span>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>
                    {name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/doctor/patients/${a.patient_id}`} className="font-semibold text-sm text-white hover:underline truncate block">{name}</Link>
                    <span className="text-xs" style={{ color: "rgba(148,163,184,0.55)" }}>{svc}</span>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${st.color}1a`, color: st.color }}>{st.label}</span>
                  <AppointmentActions id={a.id} status={a.status} />
                  <Link href={`/doctor/patients/${a.patient_id}`} className="text-[11px] flex items-center gap-0.5 shrink-0" style={{ color: "rgba(148,163,184,0.5)" }}>
                    الملف <ChevronLeft className="w-3 h-3" />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
