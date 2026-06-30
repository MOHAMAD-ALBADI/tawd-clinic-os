import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppointmentActions } from "@/components/doctor/appointment-actions";
import { Calendar, ChevronLeft } from "lucide-react";

export const metadata = { title: "مواعيدي — طود" };

const STATUS: Record<string, { label: string; color: string }> = {
  scheduled: { label: "مجدول", color: "#94A3B8" },
  confirmed: { label: "مؤكد", color: "#5dd9cb" },
  checked_in: { label: "حضَر", color: "#38bdf8" },
  in_progress: { label: "جارٍ الكشف", color: "#fbbf24" },
  completed: { label: "مكتمل", color: "#34D399" },
  cancelled: { label: "ملغي", color: "#94A3B8" },
  no_show: { label: "لم يحضر", color: "#F87171" },
};
type J = { name: string } | null;

function dayLabel(iso: string) {
  return new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
}
function fmtTime(iso: string) {
  return new Intl.DateTimeFormat("ar", { timeZone: "Asia/Muscat", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(iso));
}
function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Muscat", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export default async function DoctorAppointmentsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from("appointments")
    .select("id, slot_time, status, patient_id, patients(name), services(name_ar)")
    .eq("doctor_id", claims.sub)
    .is("deleted_at", null)
    .gte("slot_time", now.split("T")[0] + "T00:00:00")
    .order("slot_time")
    .limit(100);

  const appts = data ?? [];
  const groups = new Map<string, typeof appts>();
  for (const a of appts) {
    const k = dayKey(a.slot_time);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-white">مواعيدي القادمة</h2>
        <p className="text-sm mt-0.5" style={{ color: "rgba(148,163,184,0.6)" }}>{appts.length} موعد</p>
      </div>

      {groups.size === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>
          <Calendar className="w-10 h-10 mx-auto mb-3" style={{ color: "rgba(148,163,184,0.3)" }} />
          <p className="text-sm" style={{ color: "rgba(148,163,184,0.5)" }}>لا مواعيد قادمة</p>
        </div>
      ) : (
        [...groups.entries()].map(([k, list]) => (
          <div key={k}>
            <h3 className="text-xs font-bold mb-2 px-1" style={{ color: "#5dd9cb" }}>{dayLabel(list[0].slot_time)}</h3>
            <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(6,14,30,0.85)", border: "1px solid rgba(255,255,255,0.07)" }}>
              {list.map((a, i) => {
                const st = STATUS[a.status] ?? STATUS.scheduled;
                const name = (a.patients as unknown as J)?.name ?? "مجهول";
                const svc = (a.services as unknown as { name_ar: string } | null)?.name_ar ?? "";
                return (
                  <div key={a.id} className="flex items-center gap-4 px-4 py-3 flex-wrap" style={{ borderTop: i ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <span className="text-sm font-bold ltr-nums w-16 shrink-0" style={{ color: "#5dd9cb" }}>{fmtTime(a.slot_time)}</span>
                    <div className="flex-1 min-w-0">
                      <Link href={`/doctor/patients/${a.patient_id}`} className="font-semibold text-sm text-white hover:underline truncate block">{name}</Link>
                      <span className="text-xs" style={{ color: "rgba(148,163,184,0.55)" }}>{svc}</span>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0" style={{ background: `${st.color}1a`, color: st.color }}>{st.label}</span>
                    <AppointmentActions id={a.id} status={a.status} />
                    <Link href={`/doctor/patients/${a.patient_id}`} className="text-[11px] flex items-center gap-0.5 shrink-0" style={{ color: "rgba(148,163,184,0.5)" }}>الملف <ChevronLeft className="w-3 h-3" /></Link>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
