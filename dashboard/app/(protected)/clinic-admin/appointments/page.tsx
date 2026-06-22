import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppointmentsTable } from "@/components/appointments/appointments-table";
import { BookingTrigger } from "@/components/reception/booking-trigger";
import { Clock, Loader2, CheckCircle2, XCircle } from "lucide-react";

export const metadata = { title: "المواعيد — طود" };

type Joined = { name: string } | null;

export default async function AppointmentsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();

  const [apptRes, patientsRes, servicesRes, doctorsRes] = await Promise.all([
    supabase
      .from("appointments")
      .select("id,slot_time,status,patients(name),services(name),tawd_staff_users!doctor_id(name)")
      .eq("clinic_id", claims.clinic_id)
      .order("slot_time", { ascending: false })
      .limit(200),
    supabase.from("patients").select("id,name,phone").eq("clinic_id", claims.clinic_id).order("name"),
    supabase.from("services").select("id,name,price").eq("clinic_id", claims.clinic_id).eq("is_active", true).order("name"),
    supabase.from("tawd_staff_users").select("id,name,name_ar").eq("clinic_id", claims.clinic_id).eq("role", "doctor"),
  ]);

  const raw      = apptRes.data ?? [];
  const patients = patientsRes.data ?? [];
  const services = servicesRes.data ?? [];
  const doctors  = doctorsRes.data ?? [];

  const appts = raw.map((r) => ({
    id:           r.id,
    slot_time:    r.slot_time,
    status:       r.status,
    patient_name: (r.patients as unknown as Joined)?.name ?? "—",
    service_name: (r.services as unknown as Joined)?.name ?? "—",
    doctor_name:  (r.tawd_staff_users as unknown as Joined)?.name ?? "—",
  }));

  const sc = raw.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1; return acc;
  }, {});

  const waiting   = (sc["scheduled"] ?? 0) + (sc["confirmed"] ?? 0);
  const inProg    = sc["in_progress"] ?? 0;
  const done      = sc["completed"] ?? 0;
  const cancelled = (sc["cancelled"] ?? 0) + (sc["no_show"] ?? 0);
  const total     = appts.length;
  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  const stats = [
    { label: "قيد الانتظار",  count: waiting,   color: "#38bdf8", Icon: Clock,          pct: total > 0 ? waiting   / total : 0 },
    { label: "جارٍ الفحص",   count: inProg,    color: "#38bdf8", Icon: Loader2,         pct: total > 0 ? inProg    / total : 0 },
    { label: "مكتمل",         count: done,      color: "#4ADE80", Icon: CheckCircle2,    pct: total > 0 ? done      / total : 0 },
    { label: "ملغي / غياب",  count: cancelled, color: "#F87171", Icon: XCircle,         pct: total > 0 ? cancelled / total : 0 },
  ];

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── HEADER ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(20,184,166,0.5)" }}>SCHEDULE</p>
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">المواعيد</h2>
          <p className="text-[12px] mt-1" style={{ color: "rgba(148,163,184,0.4)" }}>
            <span className="ltr-nums font-bold text-white">{total}</span> موعد مسجّل
          </p>
        </div>
        <BookingTrigger
          patients={patients as { id: string; name: string; phone?: string }[]}
          services={services as { id: string; name: string; price?: number }[]}
          doctors={doctors  as { id: string; name: string; name_ar?: string }[]}
        />
      </div>

      {/* ── STATUS OVERVIEW ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* 4 status pills — 8 cols */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.018)",
                border: `1px solid ${s.color}18`,
                padding: "1.1rem 1.2rem",
                backdropFilter: "blur(16px)",
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: "rgba(148,163,184,0.35)" }}>{s.label}</p>
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: `${s.color}14` }}>
                  <s.Icon className="w-3 h-3" style={{ color: s.color }} />
                </div>
              </div>
              <p className="font-black ltr-nums leading-none mb-2.5"
                style={{ fontSize: "2rem", color: s.color, letterSpacing: "-0.03em" }}>
                {s.count}
              </p>
              {/* Mini progress bar */}
              <div className="rounded-full overflow-hidden" style={{ height: 3, background: "rgba(255,255,255,0.04)" }}>
                <div className="h-full rounded-full"
                  style={{ width: `${s.pct * 100}%`, background: s.color, opacity: 0.6, minWidth: s.count > 0 ? 3 : 0 }} />
              </div>
            </div>
          ))}
        </div>

        {/* Completion summary — 4 cols */}
        <div
          className="col-span-12 lg:col-span-4 rounded-2xl flex flex-col items-center justify-center py-5 px-4"
          style={{
            background: "rgba(255,255,255,0.018)",
            border: "1px solid rgba(255,255,255,0.055)",
            backdropFilter: "blur(16px)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "rgba(148,163,184,0.3)" }}>
            نسبة الإكمال
          </p>
          <div className="relative mb-2">
            <svg width={90} height={90} viewBox="0 0 90 90">
              <circle cx="45" cy="45" r="34" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="6" />
              <circle cx="45" cy="45" r="34" fill="none"
                stroke="url(#appt-grad)" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 34}
                strokeDashoffset={2 * Math.PI * 34 * (1 - completionPct / 100)}
                transform="rotate(-90 45 45)"
              />
              <defs>
                <linearGradient id="appt-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0f766e" />
                  <stop offset="100%" stopColor="#4ADE80" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-black ltr-nums text-xl leading-none"
                style={{ color: completionPct > 0 ? "#4ADE80" : "rgba(148,163,184,0.2)" }}>
                {completionPct}%
              </span>
            </div>
          </div>
          <p className="text-[10px] text-center" style={{ color: "rgba(148,163,184,0.35)" }}>
            {done} مكتمل من {total}
          </p>
        </div>
      </div>

      {/* ── TABLE ── */}
      <div
        className="rounded-3xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.018)",
          border: "1px solid rgba(255,255,255,0.055)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em]" style={{ color: "rgba(148,163,184,0.3)" }}>LOG</p>
            <p className="text-sm font-bold text-white mt-0.5">قائمة المواعيد</p>
          </div>
          <span className="text-[11px] font-bold ltr-nums px-2.5 py-1 rounded-full"
            style={{ background: "rgba(20,184,166,0.08)", color: "rgba(94,217,203,0.7)", border: "1px solid rgba(20,184,166,0.15)" }}>
            {total}
          </span>
        </div>
        <AppointmentsTable appts={appts} />
      </div>
    </div>
  );
}
