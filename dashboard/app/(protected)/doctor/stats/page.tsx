import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { TawdBarsGlyph } from "@/components/shell/tawd-logo";
import { arMonth } from "@/lib/ar-format";
import {
  TrendingUp, Users, CalendarX2, ClipboardCheck, NotebookPen, Coins,
  Timer, AlertTriangle, ChevronLeft,
} from "lucide-react";

export const metadata = { title: "إحصائياتي — طود" };
export const dynamic = "force-dynamic";

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const WEEKDAY = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export default async function DoctorStatsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "doctor") redirect("/login");

  const sb = await createServerSupabaseClient();
  const now = new Date();
  const muscatDay = new Date(now.getTime() + 4 * 3600_000).toISOString().slice(0, 10);
  const monthStart = `${muscatDay.slice(0, 7)}-01T00:00:00+04:00`;
  const prevMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const prevStart = `${prevMonth.toISOString().slice(0, 7)}-01T00:00:00+04:00`;

  const [
    { data: monthAppts }, { data: prevAppts }, { count: notesMonth },
    { data: schedule }, { data: plans }, { data: chartWork },
  ] = await Promise.all([
    sb.from("appointments")
      .select("id, status, slot_time, patient_id, duration_minutes, services(name_ar, price)")
      .eq("doctor_id", claims.sub).is("deleted_at", null)
      .gte("slot_time", monthStart).limit(3000),
    sb.from("appointments")
      .select("status").eq("doctor_id", claims.sub).is("deleted_at", null)
      .gte("slot_time", prevStart).lt("slot_time", monthStart).limit(3000),
    sb.from("patient_notes").select("id", { count: "exact", head: true })
      .eq("doctor_id", claims.sub).gte("created_at", monthStart),
    sb.from("doctor_schedules").select("day_of_week, start_time, end_time")
      .eq("doctor_id", claims.sub).eq("is_active", true),
    /* Plan acceptance is the number that separates a dentist who explains
       treatment from one who lists it. */
    sb.from("treatment_plans").select("id, status, total_estimate, created_at")
      .eq("doctor_id", claims.sub).gte("created_at", monthStart).limit(500),
    sb.from("dental_chart_entries").select("id, kind, created_at")
      .eq("doctor_id", claims.sub).gte("created_at", monthStart).limit(2000),
  ]);

  const appts = monthAppts ?? [];
  const done = appts.filter((a) => a.status === "completed");
  const noShow = appts.filter((a) => a.status === "no_show").length;
  const cancelled = appts.filter((a) => a.status === "cancelled").length;
  const upcoming = appts.filter(
    (a) => ["scheduled", "confirmed"].includes(a.status as string) && (a.slot_time as string) > now.toISOString()
  ).length;
  const closed = done.length + noShow + cancelled;

  const prev = prevAppts ?? [];
  const prevDone = prev.filter((a) => a.status === "completed").length;
  const prevClosed = prevDone + prev.filter((a) => ["no_show", "cancelled"].includes(a.status as string)).length;

  /* Value produced, from the service price on each completed visit. Not the
     clinic's collections — the doctor does not control whether the patient
     paid — but the work they actually delivered, which is theirs. */
  const produced = done.reduce(
    (s, a) => s + Number((a.services as unknown as { price: number | null } | null)?.price ?? 0), 0
  );

  const uniquePatients = new Set(done.map((a) => a.patient_id)).size;
  const returning = done.length - uniquePatients;

  /* Chair utilisation: minutes actually delivered against minutes the doctor
     made available this month. The single most useful productivity number and
     it needs the schedule, which is why it was never here. */
  const perDay = new Map<string, number>();
  for (const s of schedule ?? []) {
    const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    perDay.set(s.day_of_week as string, Math.max(0, mins(s.end_time as string) - mins(s.start_time as string)));
  }
  const y = now.getUTCFullYear(), m = now.getUTCMonth();
  const daysElapsed = Math.min(new Date(Date.UTC(y, m + 1, 0)).getUTCDate(), now.getUTCDate());
  let availableMinutes = 0;
  for (let d = 1; d <= daysElapsed; d++) {
    const wd = WEEKDAY[new Date(Date.UTC(y, m, d)).getUTCDay()];
    availableMinutes += perDay.get(wd) ?? 0;
  }
  const deliveredMinutes = done.reduce((s, a) => s + Number(a.duration_minutes ?? 30), 0);
  const utilisation = pct(deliveredMinutes, availableMinutes);

  /* Acceptance is measured against plans actually PUT to a patient. A draft is
     one the doctor has not proposed yet, so counting it would score them down
     for still thinking about it. */
  const ACCEPTED = ["accepted", "in_progress", "completed"];
  const offered = (plans ?? []).filter((p) => (p.status as string) !== "draft");
  const planTotal = offered.length;
  const planAccepted = offered.filter((p) => ACCEPTED.includes(p.status as string)).length;
  const planValue = offered
    .filter((p) => ACCEPTED.includes(p.status as string))
    .reduce((s, p) => s + Number(p.total_estimate ?? 0), 0);

  const documented = pct(notesMonth ?? 0, done.length);
  const attendance = pct(done.length, closed);
  const prevAttendance = pct(prevDone, prevClosed);
  const trend = attendance !== null && prevAttendance !== null ? attendance - prevAttendance : null;

  const svcCount: Record<string, number> = {};
  for (const a of done) {
    const n = (a.services as unknown as { name_ar: string } | null)?.name_ar;
    if (n) svcCount[n] = (svcCount[n] ?? 0) + 1;
  }
  const topServices = Object.entries(svcCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxSvc = topServices[0]?.[1] ?? 1;

  /* Busiest day of week, from what actually happened rather than the roster. */
  const byWeekday = new Array(7).fill(0);
  for (const a of done) byWeekday[new Date(a.slot_time as string).getUTCDay()]++;
  const peakDay = byWeekday.indexOf(Math.max(...byWeekday));
  const maxWd = Math.max(1, ...byWeekday);

  const treatmentsCharted = (chartWork ?? []).filter((c) => c.kind === "treatment").length;

  return (
    <div className="space-y-4 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">MY PRACTICE</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">إحصائياتي</h1>
        <p className="text-[12px] mt-1.5" style={{ color: "var(--text-4)" }}>{arMonth.format(now)}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="كشوفات مكتملة" value={done.length}
          sub={prevDone > 0 ? `الشهر الماضي ${prevDone}` : "أول شهر"} accent />
        <Kpi label="قيمة العمل المنجز" value={omr(produced)} sub="ر.ع من أسعار الخدمات" />
        <Kpi label="استغلال وقتك" value={utilisation === null ? "—" : `${utilisation}%`}
          sub={availableMinutes ? `${Math.round(deliveredMinutes / 60)} من ${Math.round(availableMinutes / 60)} ساعة` : "حدّد دوامك أولاً"}
          warn={utilisation !== null && utilisation < 45} />
        <Kpi label="نسبة الحضور" value={attendance === null ? "—" : `${attendance}%`}
          sub={`${noShow} غياب · ${cancelled} إلغاء`}
          trend={trend} warn={attendance !== null && attendance < 80} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="قبول خطط العلاج" value={planTotal ? `${pct(planAccepted, planTotal)}%` : "—"}
          sub={planTotal ? `${planAccepted} من ${planTotal} خطة` : "لم تُقترح خطط هذا الشهر"} />
        <Kpi label="قيمة الخطط المقبولة" value={omr(planValue)} sub="ر.ع" />
        <Kpi label="اكتمال التوثيق" value={documented === null ? "—" : `${documented}%`}
          sub={`${notesMonth ?? 0} ملاحظة لـ ${done.length} كشف`}
          warn={documented !== null && documented < 80} />
        <Kpi label="مرضى فريدون" value={uniquePatients}
          sub={returning > 0 ? `${returning} زيارة متكررة` : "لا زيارات متكررة"} />
      </div>

      {/* One honest warning beats four green numbers. */}
      {documented !== null && documented < 80 && done.length >= 3 && (
        <Link href="/doctor" className="panel flex items-center gap-3 flex-wrap"
          style={{ padding: "1rem 1.2rem", borderColor: "rgba(251,191,36,0.28)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: "#fbbf24" }} />
          <span className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            <span className="font-black ltr-nums">{done.length - (notesMonth ?? 0)}</span> كشفاً بلا ملاحظة سريرية هذا الشهر —
            التوثيق يحمي المريض ويحميك. القائمة في «جدولي».
          </span>
          <ChevronLeft className="w-3.5 h-3.5 ms-auto" style={{ color: "var(--text-4)" }} />
        </Link>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <TawdBarsGlyph size={13} />
            <h2>خدماتي الأكثر تقديماً</h2>
          </div>
          {topServices.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: "var(--text-4)" }}>
              لا كشوفات مكتملة هذا الشهر بعد
            </p>
          ) : (
            <div className="space-y-3">
              {topServices.map(([name, count]) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold" style={{ color: "var(--text-1)" }}>{name}</span>
                    <span className="text-xs font-bold ltr-nums text-white">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${Math.round((count / maxSvc) * 100)}%`, background: "var(--accent-2)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-1">
            <Timer className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>توزيع كشوفاتك على الأسبوع</h2>
          </div>
          <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
            {done.length > 0
              ? `أكثر أيامك ازدحاماً: ${DAY_NAMES[peakDay]}`
              : "لا بيانات كافية بعد"}
          </p>
          <div className="flex items-end justify-between gap-1.5" style={{ height: 96 }} dir="ltr">
            {byWeekday.map((n, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[10px] ltr-nums" style={{ color: "var(--text-4)" }}>{n || ""}</span>
                <div className="w-full rounded-t" title={`${DAY_NAMES[i]}: ${n}`}
                  style={{
                    height: `${(n / maxWd) * 100}%`, minHeight: n > 0 ? 3 : 0,
                    background: i === peakDay && n > 0 ? "var(--accent-1)" : "var(--accent-2)",
                    opacity: i === peakDay && n > 0 ? 0.95 : 0.45,
                  }} />
                <span className="text-[9.5px]" style={{ color: "var(--text-4)" }}>{DAY_NAMES[i].slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Mini icon={NotebookPen} label="ملاحظات سريرية" value={notesMonth ?? 0} />
        <Mini icon={ClipboardCheck} label="إجراءات على المخطط" value={treatmentsCharted} />
        <Mini icon={Users} label="مواعيد قادمة" value={upcoming} />
        <Mini icon={CalendarX2} label="غياب هذا الشهر" value={noShow} bad={noShow > 0} />
      </div>
    </div>
  );
}

function Kpi({
  label, value, sub, accent, warn, trend,
}: {
  label: string; value: number | string; sub: string;
  accent?: boolean; warn?: boolean; trend?: number | null;
}) {
  return (
    <div className="panel" style={{ padding: "1.1rem 1.2rem" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2.5" style={{ color: "var(--text-4)" }}>{label}</p>
      <div className="flex items-baseline gap-2 flex-wrap">
        <p className="font-black ltr-nums leading-none" style={{
          fontSize: "1.6rem",
          color: warn ? "#fbbf24" : accent ? "var(--accent-1)" : "#ffffff",
        }}>{value}</p>
        {trend !== null && trend !== undefined && trend !== 0 && (
          <span className="flex items-center gap-0.5 text-[11px] font-bold ltr-nums"
            style={{ color: trend > 0 ? "#34d399" : "#fda4b4" }}>
            <TrendingUp className="w-3 h-3" style={{ transform: trend < 0 ? "scaleY(-1)" : undefined }} />
            {trend > 0 ? "+" : ""}{trend}
          </span>
        )}
      </div>
      <p className="text-[10.5px] mt-1.5" style={{ color: "var(--text-4)" }}>{sub}</p>
    </div>
  );
}

function Mini({
  icon: Icon, label, value, bad,
}: { icon: typeof Coins; label: string; value: number; bad?: boolean }) {
  return (
    <div className="panel" style={{ padding: "0.95rem 1.1rem" }}>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px]" style={{ color: "var(--text-4)" }}>{label}</p>
        <Icon className="w-3 h-3" style={{ color: "var(--text-4)" }} />
      </div>
      <p className="font-black ltr-nums" style={{ fontSize: "1.15rem", color: bad ? "#fda4b4" : "#ffffff" }}>{value}</p>
    </div>
  );
}
