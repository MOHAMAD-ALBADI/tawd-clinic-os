import { redirect } from "next/navigation";
import { Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { getUserClaims }             from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AppointmentTimeline }       from "@/components/dashboard/appointment-timeline";
import { LoyaltyCenter }             from "@/components/dashboard/loyalty-center";
import { SuraWidget }                from "@/components/dashboard/sura-widget";
import { WeekBars }                  from "@/components/dashboard/week-bars";
import { StatusRing }                from "@/components/dashboard/status-ring";
import { SparkLine }                 from "@/components/dashboard/spark-line";
import { KpiGrid }                   from "@/components/dashboard/kpi-grid";
import { SuraRecoveryPanel }         from "@/components/dashboard/sura-recovery";
import { EmergencyAlerts }           from "@/components/dashboard/emergency-alerts";
import { TawdBarsGlyph }             from "@/components/shell/tawd-logo";

export const metadata = { title: "لوحة التحكم — طود" };

export default async function ClinicAdminPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb         = await createServerSupabaseClient();
  const now        = new Date();
  const today      = now.toISOString().split("T")[0];
  const todayStart = `${today}T00:00:00`;
  const todayEnd   = `${today}T23:59:59`;
  const weekAgo    = new Date(Date.now() - 6 * 86_400_000).toISOString().split("T")[0];

  const [
    apptRes, clinicRes, patientsNewRes,
    todayRevenueRes, pendingInvoicesRes, hitlRes,
    staffRes, weekApptRes,
    campaignsRes, loyaltyRes, templatesRes,
    yesterdayRevenueRes, recoveryRes, waitlistRes, alertsRes,
  ] = await Promise.all([
    sb.from("appointments")
      .select("id, slot_time, status, patients!patient_id(name), services!service_id(name, name_ar), tawd_staff_users!doctor_id(id, name, name_ar)")
      .eq("clinic_id", claims.clinic_id)
      .gte("slot_time", todayStart).lte("slot_time", todayEnd)
      .is("deleted_at", null).order("slot_time"),

    sb.from("tawd_clinics").select("name, name_ar").eq("id", claims.clinic_id).single(),

    sb.from("patients").select("id", { count: "exact", head: true })
      .eq("clinic_id", claims.clinic_id)
      .gte("created_at", todayStart).lte("created_at", todayEnd),

    sb.from("invoices").select("total")
      .eq("clinic_id", claims.clinic_id).eq("status", "paid")
      .gte("created_at", todayStart).lte("created_at", todayEnd),

    sb.from("invoices").select("total")
      .eq("clinic_id", claims.clinic_id).in("status", ["sent", "partially_paid", "overdue"]).is("deleted_at", null),

    sb.from("ai_review_queue")
      .select("id, ai_draft, ai_intent, confidence_score, status, created_at, patients!patient_id(name)", { count: "exact" })
      .eq("clinic_id", claims.clinic_id).eq("status", "pending")
      .order("priority", { ascending: false }).order("created_at").limit(10),

    sb.from("tawd_staff_users").select("id, name, name_ar, role")
      .eq("clinic_id", claims.clinic_id).eq("is_active", true).is("deleted_at", null),

    sb.from("appointments").select("slot_time, status")
      .eq("clinic_id", claims.clinic_id)
      .gte("slot_time", `${weekAgo}T00:00:00`).is("deleted_at", null).limit(1000),

    sb.from("broadcast_campaigns")
      .select("id, name, status, total_recipients, sent_count, failed_count, scheduled_at, started_at, completed_at")
      .eq("clinic_id", claims.clinic_id).order("created_at", { ascending: false }).limit(10),

    sb.from("loyalty_settings")
      .select("points_per_visit, points_per_referral, redemption_rate, is_active, points_per_omr, min_redeem_points, max_redeem_pct, expiry_months")
      .eq("clinic_id", claims.clinic_id).maybeSingle(),

    sb.from("notification_templates")
      .select("id, name, template_type, channel, is_active")
      .eq("clinic_id", claims.clinic_id).eq("is_active", true).limit(20),

    sb.from("invoices").select("total")
      .eq("clinic_id", claims.clinic_id).eq("status", "paid")
      .gte("created_at", new Date(Date.now() - 86_400_000).toISOString().split("T")[0] + "T00:00:00")
      .lte("created_at", new Date(Date.now() - 86_400_000).toISOString().split("T")[0] + "T23:59:59"),

    sb.from("automation_recovery_ledger").select("amount")
      .eq("clinic_id", claims.clinic_id)
      .gte("occurred_at", `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01T00:00:00`),

    sb.from("appointment_waitlist")
      .select("id, created_at, patients!patient_id(name), services!service_id(name_ar)")
      .eq("clinic_id", claims.clinic_id).eq("status", "waiting")
      .order("priority", { ascending: false }).limit(6),

    sb.from("sura_alerts")
      .select("id, kind, phone, patient_name, message, created_at")
      .eq("clinic_id", claims.clinic_id).in("kind", ["emergency", "complaint"]).eq("status", "open")
      .order("created_at", { ascending: false }).limit(10),
  ]);

  const appts           = apptRes.data       ?? [];
  const clinic          = clinicRes.data;
  const clinicName      = clinic?.name_ar    ?? clinic?.name ?? "عيادتك";
  const newToday        = patientsNewRes.count ?? 0;
  const todayRevenue    = (todayRevenueRes.data ?? []).reduce((s, i) => s + Number((i as any).total ?? 0), 0);
  const yesterdayRev    = (yesterdayRevenueRes.data ?? []).reduce((s, i) => s + Number((i as any).total ?? 0), 0);
  const pendingTotal    = (pendingInvoicesRes.data ?? []).reduce((s, i) => s + Number((i as any).total ?? 0), 0);
  const hitlItems       = hitlRes.data       ?? [];
  const hitlCount       = hitlRes.count      ?? 0;
  const staff           = staffRes.data      ?? [];
  const doctors         = staff.filter((s) => s.role === "doctor");
  const campaigns       = (campaignsRes.data ?? []) as import("@/components/dashboard/loyalty-center").Campaign[];
  const loyaltySettings = loyaltyRes.data    ?? null;
  const templates       = (templatesRes.data ?? []) as import("@/components/dashboard/loyalty-center").NotifTemplate[];

  const recovery        = recoveryRes.data ?? [];
  const recoveredTotal  = recovery.reduce((s, r) => s + Number((r as { amount?: number }).amount ?? 0), 0);
  const recoveredCount  = recovery.length;
  const relTime = (iso: string) => {
    const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
    return h < 1 ? "الآن" : h < 24 ? `منذ ${h} ساعة` : `منذ ${Math.floor(h / 24)} يوم`;
  };
  const waitlist = (waitlistRes.data ?? []).map((w) => {
    const ww = w as { id: string; created_at: string; patients?: { name?: string }; services?: { name_ar?: string } };
    return { id: ww.id, name: ww.patients?.name ?? "مريض", service: ww.services?.name_ar ?? null, waitingFor: relTime(ww.created_at) };
  });

  const emergencyAlerts = (alertsRes.data ?? []).map((a) => {
    const aa = a as { id: string; kind?: string; phone?: string; patient_name?: string; message?: string; created_at: string };
    return { id: aa.id, kind: aa.kind ?? "emergency", phone: aa.phone ?? null, patientName: aa.patient_name ?? null, message: aa.message ?? null, ago: relTime(aa.created_at) };
  });

  const completed  = appts.filter((a) => a.status === "completed").length;
  const inProgress = appts.filter((a) => ["checked_in", "in_progress"].includes(a.status)).length;
  const pending    = appts.filter((a) => ["scheduled", "confirmed"].includes(a.status)).length;
  const noShow     = appts.filter((a) => a.status === "no_show").length;
  const completionRate = appts.length > 0 ? Math.round((completed / appts.length) * 100) : 0;

  const revenueChange = yesterdayRev > 0
    ? Math.round(((todayRevenue - yesterdayRev) / yesterdayRev) * 100)
    : null;

  /* week bars */
  const DAY_LABELS   = ["أح", "إث", "ث", "أر", "خ", "ج", "س"];
  const weekAllAppts = weekApptRes.data ?? [];
  const weekBars = Array.from({ length: 7 }, (_, i) => {
    const d      = new Date(Date.now() - (6 - i) * 86_400_000);
    const dayStr = d.toISOString().split("T")[0];
    const dayAppts = weekAllAppts.filter((a) => a.slot_time.startsWith(dayStr));
    return {
      day: DAY_LABELS[d.getDay()],
      total: dayAppts.length,
      completed: dayAppts.filter((a) => a.status === "completed").length,
      isToday: dayStr === today,
    };
  });

  const weekSparkData = weekBars.map((b) => b.total);

  /* status ring — ONE hue family: teal=alive/done, neutral=waiting, muted red=lost */
  const ringData = [
    { name: "مكتمل",  value: completed,  color: "rgba(45,212,191,0.55)" },
    { name: "جارٍ",   value: inProgress, color: "#2dd4bf" },
    { name: "انتظار", value: pending,    color: "rgba(255,255,255,0.16)" },
    { name: "غياب",  value: noShow,     color: "rgba(244,63,94,0.55)" },
  ];

  /* next upcoming appointment (the "what's next" reading) */
  const nextAppt = appts.find(
    (a) => ["scheduled", "confirmed"].includes(a.status) && new Date(a.slot_time) > now
  );
  const nextApptTime = nextAppt
    ? new Date(nextAppt.slot_time).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
    : null;

  const h        = now.getHours();
  const greeting = h < 12 ? "صباح الخير" : h < 18 ? "مساء الخير" : "مساء النور";
  const todayAr  = new Intl.DateTimeFormat("ar-SA", { weekday: "long", day: "numeric", month: "long" }).format(now);
  const workStart = 8; const workEnd = 18;
  const dayPct   = Math.min(100, Math.max(0, Math.round(((h + now.getMinutes() / 60) - workStart) / (workEnd - workStart) * 100)));

  return (
    <div className="space-y-4 pb-28 animate-fade-in">

      {/* ══ EMERGENCY ALERTS (safety-critical, top) ══ */}
      <EmergencyAlerts alerts={emergencyAlerts} />

      {/* ══ HERO ROW ══ */}
      <div className="grid grid-cols-12 gap-4">

        {/* Revenue readout — col 7 */}
        <div
          className="col-span-12 lg:col-span-7 panel-feature relative overflow-hidden flex flex-col justify-between"
          style={{ padding: "1.75rem 2rem", minHeight: 280 }}
        >
          {/* header */}
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--text-3)" }}>
                {greeting} — {todayAr}
              </p>
              <h1 className="font-bold text-white mt-1 leading-tight" style={{ fontSize: "clamp(1.4rem, 2.5vw, 1.85rem)", letterSpacing: "-0.01em" }}>
                {clinicName}
              </h1>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.18)" }}>
              <span className="live-dot" />
              <span className="text-[11px] font-semibold" style={{ color: "#5dd9cb" }}>مباشر</span>
            </div>
          </div>

          {/* The reading: today's revenue — centered, always legible */}
          <div className="relative flex-1 flex flex-col justify-center py-5">
            <div className="flex items-center gap-3 mb-2">
              <p className="eyebrow" style={{ color: "var(--accent-2)" }}>
                إيراد اليوم · ر.ع
              </p>
              {revenueChange !== null && (
                <span className={`badge ltr-nums ${revenueChange >= 0 ? "badge-ok" : "badge-bad"}`} style={{ padding: "0.125rem 0.5rem", fontSize: 10 }}>
                  {revenueChange >= 0
                    ? <ArrowUpRight className="w-2.5 h-2.5" />
                    : <ArrowDownRight className="w-2.5 h-2.5" />}
                  {Math.abs(revenueChange)}%
                </span>
              )}
            </div>
            <p
              className="ltr-nums font-bold leading-none"
              style={{
                fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)",
                color: todayRevenue > 0 ? "#ffffff" : "rgba(255,255,255,0.45)",
                letterSpacing: "-0.03em",
              }}
            >
              {todayRevenue > 0
                ? todayRevenue.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
                : "0.000"}
            </p>

            {/* ops strip — what matters right now */}
            <div className="flex items-center gap-5 mt-6 flex-wrap">
              <div className="flex items-baseline gap-2">
                <span className="eyebrow" style={{ fontSize: 9 }}>الموعد القادم</span>
                {nextAppt ? (
                  <span className="text-sm font-semibold text-white">
                    <span className="ltr-nums">{nextApptTime}</span>
                    <span style={{ color: "var(--text-3)" }}> · {(nextAppt as any).patients?.name ?? "مريض"}</span>
                  </span>
                ) : (
                  <span className="text-sm font-medium" style={{ color: "var(--text-3)" }}>لا مواعيد قادمة اليوم</span>
                )}
              </div>
              <span className="w-px h-4" style={{ background: "rgba(255,255,255,0.1)" }} />
              <div className="flex items-baseline gap-2">
                <span className="eyebrow" style={{ fontSize: 9 }}>معدل الإتمام</span>
                <span className="text-sm font-bold ltr-nums text-white">{completionRate}%</span>
              </div>
            </div>
          </div>

          {/* day progress + week sparkline row */}
          <div className="relative grid grid-cols-2 gap-4 items-end">
            <div>
              <div className="flex items-center justify-between text-[10px] mb-1.5" style={{ color: "var(--text-4)" }}>
                <span>يوم العمل</span>
                <span className="font-bold ltr-nums" style={{ color: "var(--text-2)" }}>{dayPct}%</span>
              </div>
              <div className="h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${dayPct}%`,
                    background: "linear-gradient(90deg, rgba(255,255,255,0.25), var(--accent-1))",
                    transition: "width 0.8s ease",
                  }}
                />
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="eyebrow" style={{ fontSize: 9 }}>7 أيام</p>
              <SparkLine data={weekSparkData} color="rgba(255,255,255,0.45)" width={100} height={36} />
            </div>
          </div>
        </div>

        {/* Right col — 5 cols */}
        <div className="col-span-12 lg:col-span-5 grid grid-rows-2 gap-4">

          {/* Status ring card */}
          <div className="panel relative overflow-hidden flex items-center gap-5" style={{ padding: "1.25rem 1.5rem" }}>
            <div className="relative shrink-0">
              <StatusRing data={ringData} total={appts.length} />
            </div>
            <div className="relative flex-1 space-y-2">
              <p className="eyebrow">مواعيد اليوم</p>
              {[
                { label: "مكتمل",  v: completed,  c: "rgba(45,212,191,0.55)" },
                { label: "جارٍ",   v: inProgress, c: "#2dd4bf" },
                { label: "انتظار", v: pending,    c: "rgba(255,255,255,0.3)" },
                { label: "غياب",  v: noShow,     c: "rgba(244,63,94,0.6)" },
              ].map((s) => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.c }} />
                    <span className="text-[11px]" style={{ color: "var(--text-3)" }}>{s.label}</span>
                  </div>
                  <span className="text-sm font-bold ltr-nums" style={{ color: s.v > 0 ? "#ffffff" : "rgba(255,255,255,0.15)" }}>
                    {s.v}
                  </span>
                </div>
              ))}
              {appts.length > 0 && (
                <div className="pt-1.5 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: "var(--text-4)" }}>معدل الإتمام</span>
                    <span className="text-[11px] font-bold ltr-nums" style={{ color: completionRate >= 70 ? "#5dd9cb" : "var(--text-1)" }}>
                      {completionRate}%
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Doctors card */}
          <div className="panel relative overflow-hidden" style={{ padding: "1.25rem 1.5rem" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow">الكادر الطبي النشط</p>
              <span className="font-bold ltr-nums text-xl text-white">{doctors.length}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {doctors.slice(0, 4).map((d) => (
                <div
                  key={d.id}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "var(--text-2)",
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: "var(--accent-1)" }} />
                  {d.name_ar ?? d.name}
                </div>
              ))}
              {doctors.length === 0 && (
                <p className="text-xs" style={{ color: "var(--text-4)" }}>لا يوجد أطباء نشطون</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══ 4 KPI CARDS ══ */}
      <KpiGrid items={[
        {
          label: "مواعيد اليوم",
          value: appts.length,
          sub: `${pending} انتظار · ${inProgress} جارٍ`,
          color: "var(--text-2)",
          glow: "", border: "",
          spark: weekSparkData,
          iconName: "Calendar",
        },
        {
          label: "مرضى جدد",
          value: newToday,
          sub: "تسجيل جديد اليوم",
          color: "var(--text-2)",
          glow: "", border: "",
          spark: [0, 1, 0, 2, 1, 3, newToday],
          iconName: "UserPlus",
        },
        {
          label: "فواتير معلقة",
          value: pendingTotal > 0
            ? pendingTotal.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
            : "0.000",
          sub: "ريال عُماني غير مدفوع",
          color: pendingTotal > 0 ? "#fbbf24" : "var(--text-2)",
          glow: "", border: "",
          spark: [3, 2, 4, 2, 3, 5, pendingTotal > 0 ? 1 : 0],
          iconName: "Banknote",
        },
        {
          label: "طابور سُرى",
          value: hitlCount,
          sub: hitlCount > 0 ? "تحتاج مراجعة فورية" : "الطابور فارغ ✓",
          color: hitlCount > 0 ? "#2dd4bf" : "var(--text-2)",
          glow: "", border: "",
          spark: [0, 1, 0, 0, 1, 2, hitlCount],
          iconName: "Bot",
        },
      ]} />

      {/* ══ SURA RECOVERY (ROI) + WAITLIST ══ */}
      <SuraRecoveryPanel recovered={recoveredTotal} count={recoveredCount} waitlist={waitlist} />

      {/* ══ TIMELINE + LOYALTY ══ */}
      <div className="grid grid-cols-12 gap-4">

        {/* Timeline — 7 cols */}
        <div className="col-span-12 lg:col-span-7 panel overflow-hidden" style={{ padding: "1.5rem" }}>
          <div className="flex items-center justify-between mb-4">
            <div className="section-title">
              <TawdBarsGlyph size={13} />
              <h2>جدول اليوم الحي</h2>
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: "rgba(45,212,191,0.08)", border: "1px solid rgba(45,212,191,0.16)" }}>
                <span className="live-dot" style={{ width: 4, height: 4 }} />
                <span className="text-[9px] font-bold" style={{ color: "#5dd9cb" }}>LIVE</span>
              </div>
            </div>
            <a
              href="/clinic-admin/appointments"
              className="flex items-center gap-1 text-[11px] font-semibold transition-colors"
              style={{ color: "var(--text-3)" }}
            >
              عرض الكل
              <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          <AppointmentTimeline appointments={appts as any} doctors={doctors as any} />
        </div>

        {/* Loyalty + Week — 5 cols */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4">

          {/* Mini week summary */}
          <div className="panel overflow-hidden" style={{ padding: "1.25rem 1.5rem" }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5" style={{ color: "var(--text-3)" }} />
                <p className="eyebrow">توزيع الأسبوع</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px]" style={{ color: "var(--text-4)" }}>الإجمالي</span>
                <span className="font-bold ltr-nums text-white">
                  {weekBars.reduce((s, b) => s + b.total, 0)}
                </span>
              </div>
            </div>
            <WeekBars data={weekBars} />
          </div>

          {/* Loyalty center */}
          <div className="flex-1">
            <LoyaltyCenter loyaltySettings={loyaltySettings} campaigns={campaigns} templates={templates} />
          </div>
        </div>
      </div>

      <SuraWidget hitlItems={hitlItems as any} hitlCount={hitlCount} />
    </div>
  );
}
