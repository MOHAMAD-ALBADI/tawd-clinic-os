import { redirect } from "next/navigation";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { ComparisonBars } from "@/components/reports/comparison-bars";

export const metadata = { title: "التقارير — طود" };

export default async function ReportsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const supabase = await createServerSupabaseClient();
  const now = new Date();
  const monthStart    = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0];
  const lastMonthEnd   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0];

  const [
    { data: apptsCurrent },
    { data: apptsLast },
    { data: invoicesCurrent },
    { data: invoicesLast },
    { count: patientsCount },
    { count: staffCount },
  ] = await Promise.all([
    supabase.from("appointments").select("id,status").eq("clinic_id", claims.clinic_id).gte("slot_time", `${monthStart}T00:00:00`),
    supabase.from("appointments").select("id,status").eq("clinic_id", claims.clinic_id).gte("slot_time", `${lastMonthStart}T00:00:00`).lte("slot_time", `${lastMonthEnd}T23:59:59`),
    supabase.from("invoices").select("total,status").eq("clinic_id", claims.clinic_id).gte("created_at", `${monthStart}T00:00:00`),
    supabase.from("invoices").select("total,status").eq("clinic_id", claims.clinic_id).gte("created_at", `${lastMonthStart}T00:00:00`).lte("created_at", `${lastMonthEnd}T23:59:59`),
    supabase.from("patients").select("id", { count: "exact", head: true }).eq("clinic_id", claims.clinic_id),
    supabase.from("tawd_staff_users").select("id", { count: "exact", head: true }).eq("clinic_id", claims.clinic_id),
  ]);

  const curAppts  = apptsCurrent ?? [];
  const lastAppts = apptsLast ?? [];
  const curInv    = invoicesCurrent ?? [];
  const lastInv   = invoicesLast ?? [];

  const revenue     = curInv.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total ?? 0), 0);
  const lastRevenue = lastInv.filter((i) => i.status === "paid").reduce((s, i) => s + (i.total ?? 0), 0);

  const completedCur  = curAppts.filter((a) => a.status === "completed").length;
  const completedLast = lastAppts.filter((a) => a.status === "completed").length;
  const completionPct = curAppts.length > 0 ? Math.round((completedCur / curAppts.length) * 100) : 0;
  const lastCompPct   = lastAppts.length > 0 ? Math.round((completedLast / lastAppts.length) * 100) : 0;

  const apptChange   = lastAppts.length > 0 ? Math.round(((curAppts.length - lastAppts.length) / lastAppts.length) * 100) : 0;
  const revenueChange = lastRevenue > 0 ? Math.round(((revenue - lastRevenue) / lastRevenue) * 100) : 0;

  const dayOfMonth  = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = Math.round((dayOfMonth / daysInMonth) * 100);

  const monthAr = now.toLocaleDateString("ar-SA", { month: "long", year: "numeric" });

  const revenueStr = revenue > 0
    ? revenue.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : "0.000";

  const circumference = 2 * Math.PI * 54;
  const dashOffset = circumference - (completionPct / 100) * circumference;

  const ChangeIcon = revenueChange > 0 ? ArrowUpRight : revenueChange < 0 ? ArrowDownRight : Minus;
  const changeColor = revenueChange > 0 ? "#4ADE80" : revenueChange < 0 ? "#F87171" : "rgba(148,163,184,0.5)";

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── PAGE HEADER ── */}
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color: "rgba(20,184,166,0.5)" }}>
            ANALYTICS
          </p>
          <h2 className="text-2xl font-black text-white tracking-tight leading-none">التقارير</h2>
        </div>
        <p className="text-[11px] font-medium pb-1" style={{ color: "rgba(148,163,184,0.35)" }}>
          {monthAr}
        </p>
      </div>

      {/* ── HERO ROW ── */}
      <div className="grid grid-cols-12 gap-4">

        {/* Revenue hero — 8 cols */}
        <div
          className="col-span-12 lg:col-span-8 rounded-3xl relative overflow-hidden"
          style={{
            background: "linear-gradient(145deg, rgba(20,184,166,0.07) 0%, rgba(10,13,22,0.92) 55%, rgba(10,13,22,0.97) 100%)",
            border: "1px solid rgba(20,184,166,0.12)",
            padding: "2rem 2.25rem 1.75rem",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(94,217,203,0.06)",
          }}
        >
          {/* Ambient glow */}
          <div
            aria-hidden
            style={{
              position: "absolute", top: -60, right: -60,
              width: 220, height: 220, borderRadius: "50%",
              background: "radial-gradient(circle, rgba(20,184,166,0.09) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />

          {/* Label + change badge */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "rgba(148,163,184,0.35)" }}>
              إيرادات {monthAr}
            </p>
            <div
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold"
              style={{
                background: revenueChange > 0 ? "rgba(74,222,128,0.1)" : revenueChange < 0 ? "rgba(248,113,113,0.1)" : "rgba(148,163,184,0.07)",
                color: changeColor,
                border: `1px solid ${changeColor}30`,
              }}
            >
              <ChangeIcon className="w-3 h-3" />
              {Math.abs(revenueChange)}%
              <span className="font-normal ms-0.5" style={{ color: "rgba(148,163,184,0.4)" }}>عن الشهر الماضي</span>
            </div>
          </div>

          {/* Revenue number */}
          <div className="flex items-baseline gap-3 mb-1">
            <span
              className="font-black ltr-nums leading-none"
              style={{
                fontSize: "clamp(2.8rem, 5vw, 4rem)",
                letterSpacing: "-0.04em",
                color: revenue > 0 ? "#14b8a6" : "rgba(20,184,166,0.15)",
                textShadow: revenue > 0 ? "0 0 60px rgba(20,184,166,0.35), 0 0 100px rgba(20,184,166,0.1)" : "none",
              }}
            >
              {revenueStr}
            </span>
            <span className="text-lg font-bold" style={{ color: "rgba(20,184,166,0.4)" }}>ر.ع</span>
          </div>

          <p className="text-[11px] mb-6" style={{ color: "rgba(148,163,184,0.3)" }}>
            الإيراد الشهري المُحصَّل · فواتير مدفوعة فقط
          </p>

          {/* Month progress bar */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "rgba(148,163,184,0.25)" }}>
                تقدم الشهر
              </span>
              <span className="text-[10px] ltr-nums font-medium" style={{ color: "rgba(148,163,184,0.35)" }}>
                يوم {dayOfMonth} من {daysInMonth}
              </span>
            </div>
            <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.04)" }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${monthProgress}%`,
                  background: "linear-gradient(90deg, rgba(20,184,166,0.4), rgba(20,184,166,0.7))",
                }}
              />
            </div>
          </div>
        </div>

        {/* Completion ring — 4 cols */}
        <div
          className="col-span-12 lg:col-span-4 rounded-3xl flex flex-col items-center justify-center relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
            padding: "2rem 1.5rem",
            minHeight: 200,
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-5" style={{ color: "rgba(148,163,184,0.3)" }}>
            معدل الإكمال
          </p>

          {/* SVG circle progress */}
          <div className="relative">
            <svg width={140} height={140} viewBox="0 0 140 140">
              {/* Track */}
              <circle cx="70" cy="70" r="54" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="8" />
              {/* Progress */}
              <circle
                cx="70" cy="70" r="54" fill="none"
                stroke="url(#comp-grad)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90 70 70)"
              />
              <defs>
                <linearGradient id="comp-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0f766e" />
                  <stop offset="100%" stopColor="#5dd9cb" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span
                className="font-black ltr-nums leading-none"
                style={{
                  fontSize: "2.4rem",
                  color: completionPct > 0 ? "#14b8a6" : "rgba(148,163,184,0.2)",
                  textShadow: completionPct > 0 ? "0 0 30px rgba(20,184,166,0.4)" : "none",
                }}
              >
                {completionPct}%
              </span>
              <span className="text-[10px] mt-1" style={{ color: "rgba(148,163,184,0.3)" }}>إكمال</span>
            </div>
          </div>

          <p className="text-[11px] mt-3 text-center" style={{ color: "rgba(148,163,184,0.3)" }}>
            {completedCur} مكتمل من {curAppts.length} موعد
          </p>
        </div>
      </div>

      {/* ── SECONDARY STATS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "إجمالي المواعيد", value: curAppts.length,    note: `${apptChange > 0 ? "+" : ""}${apptChange}% الشهر الماضي`, noteColor: apptChange >= 0 ? "#4ADE80" : "#F87171" },
          { label: "مواعيد مكتملة",  value: completedCur,        note: `${completedLast} الشهر الماضي`, noteColor: "rgba(148,163,184,0.3)" },
          { label: "إجمالي المرضى",  value: patientsCount ?? 0,  note: "مريض مسجّل", noteColor: "rgba(148,163,184,0.3)" },
          { label: "أعضاء الفريق",   value: staffCount ?? 0,     note: "موظف نشط", noteColor: "rgba(148,163,184,0.3)" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl"
            style={{
              background: "rgba(255,255,255,0.018)",
              border: "1px solid rgba(255,255,255,0.055)",
              backdropFilter: "blur(16px)",
              padding: "1.2rem 1.4rem",
            }}
          >
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] mb-3" style={{ color: "rgba(148,163,184,0.3)" }}>
              {s.label}
            </p>
            <p
              className="font-black ltr-nums leading-none mb-1.5"
              style={{ fontSize: "2.2rem", color: "rgba(226,232,240,0.9)", letterSpacing: "-0.03em" }}
            >
              {s.value}
            </p>
            <p className="text-[10px] font-medium" style={{ color: s.noteColor }}>
              {s.note}
            </p>
          </div>
        ))}
      </div>

      {/* ── VISUAL COMPARISON ── */}
      <div
        className="rounded-3xl"
        style={{
          background: "rgba(255,255,255,0.018)",
          border: "1px solid rgba(255,255,255,0.055)",
          backdropFilter: "blur(20px)",
          padding: "1.75rem 2rem",
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] mb-1" style={{ color: "rgba(148,163,184,0.3)" }}>
              COMPARISON
            </p>
            <h3 className="text-base font-bold text-white">مقارنة شهرية</h3>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="font-bold" style={{ color: "#14b8a6" }}>هذا الشهر</span>
            <span style={{ color: "rgba(148,163,184,0.3)" }}>الشهر الماضي</span>
          </div>
        </div>

        <ComparisonBars
          rows={[
            {
              label: "إجمالي المواعيد",
              current: curAppts.length, last: lastAppts.length,
              currentNum: curAppts.length, lastNum: lastAppts.length,
              color: "#14b8a6",
            },
            {
              label: "مواعيد مكتملة",
              current: completedCur, last: completedLast,
              currentNum: completedCur, lastNum: completedLast,
              color: "#38bdf8",
            },
            {
              label: "معدل الإكمال",
              current: `${completionPct}%`, last: `${lastCompPct}%`,
              currentNum: completionPct, lastNum: lastCompPct,
              color: "#5dd9cb",
            },
          ]}
        />
      </div>
    </div>
  );
}
