import { redirect } from "next/navigation";
import { clinicToday, clinicMonthStart, clinicMonthRange } from "@/lib/clinic-time";
import { getUserClaims } from "@/lib/auth/get-user-claims";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  TrendingUp, TrendingDown, Percent, UserPlus, Repeat, CalendarX,
  Stethoscope, Scissors, ClipboardCheck, Wallet,
} from "lucide-react";

export const metadata = { title: "التقارير — طود" };

/* Reports built on the metrics clinics are actually judged by — collection rate
   (where revenue leaks), no-show rate, treatment-plan acceptance, per-doctor
   productivity — instead of plain row counts. Every figure comes from data the
   clinic already produces, and is compared with last month so a number always
   carries a direction. */

const n = (v: unknown) => Number(v ?? 0) || 0;
const omr = (v: number) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export default async function ReportsPage() {
  const claims = await getUserClaims();
  if (!claims || claims.role !== "clinic_admin") redirect("/login");

  const sb = await createServerSupabaseClient();
  const now = new Date();

  /* Months are the clinic's, not UTC — the last four hours of every month were
     landing in the next one. */
  const thisMonth = clinicMonthStart(clinicToday(now));
  const [my, mm] = thisMonth.split("-").map(Number);
  const prevMonth = `${new Date(Date.UTC(my, mm - 2, 1)).toISOString().slice(0, 7)}-01`;
  const thisRange = clinicMonthRange(thisMonth);
  const prevRange = clinicMonthRange(prevMonth);
  const monthLabel = thisMonth.slice(0, 7);

  /* Counted by the database.

     This page used to pull up to 100,000 rows per metric — eight such queries —
     and add them up in JavaScript. PostgREST caps rows, so past the cap the
     totals simply stop growing: no error, revenue silently understated. The
     same pattern was removed from the platform dashboard twice. */
  const [thisRes, prevRes, staffRes] = await Promise.all([
    sb.rpc("clinic_report_totals", {
      p_clinic_id: claims.clinic_id, p_from: thisRange.startUtc, p_to: thisRange.endUtc,
    }),
    sb.rpc("clinic_report_totals", {
      p_clinic_id: claims.clinic_id, p_from: prevRange.startUtc, p_to: prevRange.endUtc,
    }),
    sb.from("tawd_staff_users").select("id, name, name_ar, role")
      .eq("clinic_id", claims.clinic_id).eq("is_active", true).is("deleted_at", null),
  ]);

  type Totals = {
    appts: { total: number; completed: number; no_show: number; cancelled: number; unique_patients: number };
    billed: number; collected: number; expenses: number; new_patients: number;
    plans: { proposed: number; accepted: number; accepted_value: number };
    by_doctor: { doctor_id: string; completed: number; no_show: number; total: number }[];
    by_service: { service_id: string; completed: number }[];
  };
  const EMPTY: Totals = {
    appts: { total: 0, completed: 0, no_show: 0, cancelled: 0, unique_patients: 0 },
    billed: 0, collected: 0, expenses: 0, new_patients: 0,
    plans: { proposed: 0, accepted: 0, accepted_value: 0 },
    by_doctor: [], by_service: [],
  };
  const T = (thisRes.data as Totals | null) ?? EMPTY;
  const P = (prevRes.data as Totals | null) ?? EMPTY;
  const staff = staffRes.data ?? [];

  /* ── operations ── */
  const totalAppts = n(T.appts.total);
  const completed = n(T.appts.completed);
  const noShow = n(T.appts.no_show);
  const cancelled = n(T.appts.cancelled);
  const finished = completed + noShow; // only appointments with a known outcome
  const noShowRate = pct(noShow, finished);
  const prevFinished = n(P.appts.completed) + n(P.appts.no_show);
  const prevNoShowRate = pct(n(P.appts.no_show), prevFinished);

  /* ── money: billed vs collected is where revenue leaks ── */
  const billed = n(T.billed);
  const collected = n(T.collected);
  const prevCollected = n(P.collected);
  const expenses = n(T.expenses);
  const collectionRate = pct(collected, billed);
  const profit = collected - expenses;
  const revPerVisit = completed > 0 ? collected / completed : 0;
  const revenueTrend = prevCollected > 0 ? Math.round(((collected - prevCollected) / prevCollected) * 100) : null;

  /* ── patients: new vs returning this month ── */
  const uniquePatients = n(T.appts.unique_patients);
  const newThisMonth = n(T.new_patients);
  const returning = Math.max(0, uniquePatients - newThisMonth);

  /* ── treatment plans: acceptance is the core clinical-sales metric ── */
  const proposed = n(T.plans.proposed);
  const accepted = n(T.plans.accepted);
  const acceptanceRate = pct(accepted, proposed);
  const pipeline = n(T.plans.accepted_value);

  /* ── per-doctor productivity ── */
  const doctorName = (id: string) => {
    const d = staff.find((s) => s.id === id);
    return (d?.name_ar ?? d?.name ?? "—") as string;
  };
  const doctorRows = T.by_doctor
    .map((d) => ({ name: doctorName(d.doctor_id), done: n(d.completed), total: n(d.total) }))
    .sort((a, b) => b.done - a.done);

  /* ── top services by volume ── */
  const topSvc = T.by_service.slice(0, 5);
  let serviceRows: { name: string; count: number }[] = [];
  if (topSvc.length) {
    const { data: svcs } = await sb.from("services").select("id, name, name_ar")
      .in("id", topSvc.map((x) => x.service_id));
    serviceRows = topSvc.map((x) => {
      const s = (svcs ?? []).find((y) => y.id === x.service_id);
      return { name: (s?.name_ar ?? s?.name ?? "خدمة") as string, count: n(x.completed) };
    });
  }

  const kpis = [
    { label: "محصّل هذا الشهر", value: omr(collected), unit: "ر.ع", Icon: Wallet,
      trend: revenueTrend, color: "var(--accent-1)" },
    { label: "معدل التحصيل", value: `${collectionRate}%`, unit: `من ${omr(billed)} مفوتر`,
      Icon: Percent, trend: null, color: collectionRate >= 80 ? "var(--accent-1)" : "#fbbf24" },
    { label: "صافي الربح", value: omr(profit), unit: "ر.ع بعد المصروفات", Icon: TrendingUp,
      trend: null, color: profit >= 0 ? "var(--accent-1)" : "#fda4b4" },
    { label: "متوسط إيراد الزيارة", value: omr(revPerVisit), unit: "ر.ع", Icon: TrendingUp,
      trend: null, color: "var(--accent-1)" },
    { label: "معدل عدم الحضور", value: `${noShowRate}%`,
      unit: prevFinished > 0 ? `الشهر الماضي ${prevNoShowRate}%` : "لا مقارنة بعد",
      Icon: CalendarX, trend: null,
      color: noShowRate <= 10 ? "var(--accent-1)" : noShowRate <= 20 ? "#fbbf24" : "#fda4b4" },
    { label: "مواعيد مكتملة", value: String(completed), unit: `من ${totalAppts} موعد`,
      Icon: ClipboardCheck, trend: null, color: "var(--accent-1)" },
    { label: "مرضى جدد", value: String(newThisMonth), unit: `عائدون ${returning}`,
      Icon: UserPlus, trend: null, color: "var(--accent-1)" },
    { label: "قبول خطط العلاج", value: proposed > 0 ? `${acceptanceRate}%` : "—",
      unit: pipeline > 0 ? `معروض ${omr(pipeline)} ر.ع` : "لا خطط معروضة", Icon: Repeat,
      trend: null, color: acceptanceRate >= 50 ? "var(--accent-1)" : "#fbbf24" },
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-20">
      <div>
        <p className="eyebrow">REPORTS</p>
        <h1 className="text-2xl font-black text-white tracking-tight leading-none mt-1">التقارير</h1>
        <p className="text-[12px] mt-1" style={{ color: "var(--text-4)" }}>
          أداء العيادة لشهر <span className="ltr-nums">{monthLabel}</span> — مقارنةً بالشهر الماضي
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="panel" style={{ padding: "1.1rem 1.2rem" }}>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-4)" }}>{k.label}</p>
              <k.Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
            <div className="flex items-end gap-2">
              <p className="font-black ltr-nums leading-none" style={{ fontSize: "1.7rem", color: k.color }}>{k.value}</p>
              {k.trend != null && (
                <span className="flex items-center gap-0.5 text-[11px] font-bold ltr-nums mb-0.5"
                  style={{ color: k.trend >= 0 ? "var(--accent-1)" : "#fda4b4" }}>
                  {k.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(k.trend)}%
                </span>
              )}
            </div>
            <p className="text-[10.5px] mt-1.5 ltr-nums" style={{ color: "var(--text-4)" }}>{k.unit}</p>
          </div>
        ))}
      </div>

      {/* revenue leakage — the most actionable finance number on the page */}
      {billed > 0 && collected < billed && (
        <div className="panel" style={{ padding: "1.1rem 1.25rem", border: "1px solid rgba(251,191,36,0.22)" }}>
          <p className="text-[13px]" style={{ color: "var(--text-2)" }}>
            <span className="font-bold ltr-nums" style={{ color: "#fbbf24" }}>{omr(billed - collected)} ر.ع</span>
            {" "}مفوترة ولم تُحصّل بعد هذا الشهر — راجع الفواتير غير المسددة.
          </p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {/* per-doctor productivity */}
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <Stethoscope className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>إنتاجية الأطباء</h2>
          </div>
          {doctorRows.length === 0 ? (
            <p className="text-[12px] text-center py-6" style={{ color: "var(--text-4)" }}>لا مواعيد هذا الشهر</p>
          ) : (
            <div className="space-y-2.5">
              {doctorRows.map((d) => (
                <div key={d.name}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="text-white font-semibold">{d.name}</span>
                    <span className="ltr-nums" style={{ color: "var(--text-3)" }}>{d.done} / {d.total} مكتمل</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full rounded-full" style={{ width: `${pct(d.done, d.total)}%`, background: "var(--accent-1)", opacity: 0.75 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* top services */}
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-4">
            <Scissors className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>أكثر الخدمات طلباً</h2>
          </div>
          {serviceRows.length === 0 ? (
            <p className="text-[12px] text-center py-6" style={{ color: "var(--text-4)" }}>لا بيانات بعد</p>
          ) : (
            <div className="space-y-2.5">
              {serviceRows.map((s) => (
                <div key={s.name}>
                  <div className="flex items-center justify-between text-[12px] mb-1">
                    <span className="text-white font-semibold">{s.name}</span>
                    <span className="ltr-nums" style={{ color: "var(--text-3)" }}>{s.count}</span>
                  </div>
                  <div className="rounded-full overflow-hidden" style={{ height: 5, background: "rgba(255,255,255,0.04)" }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${pct(s.count, serviceRows[0].count)}%`, background: "var(--accent-1)", opacity: 0.75 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* appointment outcomes */}
      <div className="panel" style={{ padding: "1.25rem" }}>
        <div className="section-title mb-4">
          <ClipboardCheck className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>مصير مواعيد الشهر</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { l: "مكتملة", v: completed, c: "var(--accent-1)" },
            { l: "لم يحضر", v: noShow, c: "#fda4b4" },
            { l: "ملغاة", v: cancelled, c: "var(--text-3)" },
            { l: "قادمة / جارية", v: Math.max(0, totalAppts - completed - noShow - cancelled), c: "var(--accent-1)" },
          ].map((x) => (
            <div key={x.l} className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-4)" }}>{x.l}</p>
              <p className="font-black ltr-nums mt-1" style={{ fontSize: "1.4rem", color: x.c }}>{x.v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
