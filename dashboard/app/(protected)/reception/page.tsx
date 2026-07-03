import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TodayTimeline } from "@/components/dashboard/today-timeline";
import { BookingTrigger } from "@/components/reception/booking-trigger";
import type { TimelineSlot } from "@/types/tawd";

export const metadata = { title: "لوحة الاستقبال — طود" };

type JoinedPatient = { name: string } | null;
type JoinedService = { name: string } | null;
type JoinedDoctor  = { name: string } | null;

export default async function ReceptionPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "receptionist") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const today = new Date().toISOString().split("T")[0];

  const [appointmentsRes, patientsRes, servicesRes, doctorsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id,slot_time,status,patients(name),services(name),tawd_staff_users!doctor_id(name)")
      .eq("clinic_id", claims.clinic_id)
      .gte("slot_time", `${today}T00:00:00`)
      .lte("slot_time", `${today}T23:59:59`)
      .order("slot_time"),
    supabase.from("patients").select("id,name,phone").eq("clinic_id", claims.clinic_id).order("name"),
    supabase.from("services").select("id,name,price").eq("clinic_id", claims.clinic_id).order("name"),
    supabase.from("tawd_staff_users").select("id,name,name_ar").eq("clinic_id", claims.clinic_id).eq("role", "doctor"),
  ]);

  const appts    = appointmentsRes.data ?? [];
  const patients = patientsRes.data ?? [];
  const services = servicesRes.data ?? [];
  const doctors  = doctorsRes.data ?? [];

  const inClinic  = appts.filter((a) => ["checked_in", "in_progress"].includes(a.status)).length;
  const waiting   = appts.filter((a) => ["scheduled", "confirmed"].includes(a.status)).length;
  const completed = appts.filter((a) => a.status === "completed").length;
  const noShow    = appts.filter((a) => a.status === "no_show").length;

  const slots: TimelineSlot[] = appts.map((a) => ({
    id:           a.id,
    patient_name: (a.patients as unknown as JoinedPatient)?.name ?? "مجهول",
    time:         a.slot_time,
    service:      (a.services as unknown as JoinedService)?.name ?? "",
    status:       a.status,
    doctor_name:  (a.tawd_staff_users as unknown as JoinedDoctor)?.name,
  }));

  const nextAppt = appts.find((a) => ["scheduled", "confirmed"].includes(a.status));
  const nextName = (nextAppt?.patients as unknown as JoinedPatient)?.name;

  const todayFmt = new Intl.DateTimeFormat("ar-SA", {
    weekday: "long", day: "numeric", month: "long",
  }).format(new Date());

  /* Completion arc */
  const completionPct = appts.length > 0 ? Math.round((completed / appts.length) * 100) : 0;

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── COMMAND STRIP ── */}
      <div
        className="rounded-3xl relative overflow-hidden"
        style={{
          background: "linear-gradient(145deg, rgba(20,184,166,0.07) 0%, rgba(13,13,15,0.95) 60%)",
          border: "1px solid rgba(20,184,166,0.1)",
          padding: "1.5rem 2rem",
        }}
      >
        {/* Ambient orb */}
        <div aria-hidden style={{
          position: "absolute", top: -50, right: -50,
          width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(20,184,166,0.45)" }}>
              {todayFmt}
            </p>
            <h1 className="text-xl font-black text-white mb-1.5 leading-none">لوحة الاستقبال</h1>
            {nextAppt ? (
              <p className="text-[12px]" style={{ color: "rgba(148,163,184,0.55)" }}>
                الموعد القادم:{" "}
                <span className="font-bold" style={{ color: "#5dd9cb" }}>{nextName ?? "مجهول"}</span>
                {" · "}
                <span className="ltr-nums font-medium" style={{ color: "rgba(20,184,166,0.6)" }}>
                  {nextAppt.slot_time.substring(11, 16)}
                </span>
              </p>
            ) : (
              <p className="text-[12px]" style={{ color: "rgba(148,163,184,0.35)" }}>لا مواعيد قادمة</p>
            )}
          </div>
          <BookingTrigger
            patients={patients as { id: string; name: string; phone?: string }[]}
            services={services as { id: string; name: string; price?: number }[]}
            doctors={doctors  as { id: string; name: string; name_ar?: string }[]}
          />
        </div>

        {/* Inline stats strip */}
        <div className="relative flex items-center gap-1 mt-5 flex-wrap">
          {[
            { label: "المواعيد",   value: appts.length, color: "#5dd9cb",  live: appts.length > 0 },
            { label: "في العيادة", value: inClinic,     color: "#4ADE80",  live: inClinic > 0 },
            { label: "ينتظرون",   value: waiting,      color: "#38bdf8",  live: false },
            { label: "مكتملة",    value: completed,    color: "#94A3B8",  live: false },
          ].map((s, i) => (
            <div key={s.label} className="flex items-center gap-2">
              {i > 0 && <span style={{ color: "rgba(255,255,255,0.08)" }}>·</span>}
              <div className="flex items-center gap-1.5">
                {s.live && (
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse-slow shrink-0"
                    style={{ background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
                )}
                <span className="text-[13px] font-black ltr-nums" style={{ color: s.color }}>{s.value}</span>
                <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.4)" }}>{s.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Timeline — 8 cols */}
        <div
          className="col-span-12 lg:col-span-8 rounded-3xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.018)",
            border: "1px solid rgba(255,255,255,0.055)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center justify-between px-5 py-4"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(148,163,184,0.3)" }}>QUEUE</p>
              <p className="text-sm font-bold text-white mt-0.5">قائمة الانتظار</p>
            </div>
            {waiting > 0 && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full ltr-nums"
                style={{ background: "rgba(251,146,60,0.1)", color: "#38bdf8", border: "1px solid rgba(251,146,60,0.2)" }}>
                {waiting} ينتظر
              </span>
            )}
          </div>
          <div className="p-2">
            <TodayTimeline slots={slots} />
          </div>
        </div>

        {/* Sidebar — 4 cols */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-4">

          {/* Completion donut */}
          <div
            className="rounded-3xl flex flex-col items-center justify-center py-6 px-5 relative overflow-hidden"
            style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.055)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-4" style={{ color: "rgba(148,163,184,0.3)" }}>
              معدل الإنجاز
            </p>
            <div className="relative mb-2">
              <svg width={110} height={110} viewBox="0 0 110 110">
                <circle cx="55" cy="55" r="42" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
                <circle
                  cx="55" cy="55" r="42" fill="none"
                  stroke="url(#rec-grad)" strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 42}
                  strokeDashoffset={2 * Math.PI * 42 * (1 - completionPct / 100)}
                  transform="rotate(-90 55 55)"
                />
                <defs>
                  <linearGradient id="rec-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#0f766e" />
                    <stop offset="100%" stopColor="#5dd9cb" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-black ltr-nums text-2xl leading-none"
                  style={{ color: completionPct > 0 ? "#14b8a6" : "rgba(148,163,184,0.2)" }}>
                  {completionPct}%
                </span>
              </div>
            </div>
            <p className="text-[11px] text-center" style={{ color: "rgba(148,163,184,0.35)" }}>
              {completed} من {appts.length} موعد
            </p>
          </div>

          {/* Status breakdown */}
          <div
            className="rounded-3xl flex-1 p-5"
            style={{ background: "rgba(255,255,255,0.018)", border: "1px solid rgba(255,255,255,0.055)" }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-4" style={{ color: "rgba(148,163,184,0.3)" }}>
              توزيع الحالات
            </p>
            <div className="space-y-3">
              {[
                { label: "بانتظار الوصول", count: waiting,   color: "#38bdf8", pct: appts.length > 0 ? waiting   / appts.length : 0 },
                { label: "داخل العيادة",   count: inClinic,  color: "#4ADE80", pct: appts.length > 0 ? inClinic  / appts.length : 0 },
                { label: "مكتمل",          count: completed, color: "#5dd9cb", pct: appts.length > 0 ? completed / appts.length : 0 },
                { label: "لم يحضر",        count: noShow,    color: "#F87171", pct: appts.length > 0 ? noShow    / appts.length : 0 },
              ].map((s) => (
                <div key={s.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.5)" }}>{s.label}</span>
                    <span className="text-[12px] font-bold ltr-nums" style={{ color: s.color }}>{s.count}</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 4, background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${s.pct * 100}%`, background: s.color, opacity: 0.7, minWidth: s.count > 0 ? 4 : 0 }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Quick counts */}
            <div className="grid grid-cols-3 gap-2 mt-5 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              {[
                { label: "مرضى",  val: patients.length, color: "#5dd9cb" },
                { label: "خدمات", val: services.length, color: "#38bdf8" },
                { label: "أطباء", val: doctors.length,  color: "#4ADE80" },
              ].map((s) => (
                <div key={s.label} className="text-center rounded-2xl py-2.5"
                  style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-base font-black ltr-nums leading-none mb-0.5" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[9px]" style={{ color: "rgba(148,163,184,0.35)" }}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
