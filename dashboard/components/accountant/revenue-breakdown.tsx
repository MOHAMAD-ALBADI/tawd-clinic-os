"use client";

import { Download, TrendingUp, Stethoscope, CreditCard, Sparkles } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";

export type Slice = { label: string; total: number; count: number };
export type MonthPoint = { month: string; billed: number; collected: number };

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** Where the money comes from.

    Bars rather than a pie: the question is almost always "which is bigger and by
    how much", and a length answers that at a glance where an angle does not. */
export function RevenueBreakdown({
  billed, collected, drawer, invoiceCount,
  byService, byDoctor, byMethod, months, periodLabel,
}: {
  billed: number; collected: number; drawer: number; invoiceCount: number;
  byService: Slice[]; byDoctor: Slice[]; byMethod: Slice[];
  months: MonthPoint[];
  periodLabel: string;
}) {
  /* Collected can exceed billed inside a window — a January invoice paid in
     February is real money in February — so this is capped for display rather
     than presented as an impossible percentage over 100. */
  const rate = billed > 0 ? Math.min(100, Math.round((collected / billed) * 100)) : null;
  const uncollected = Math.max(0, billed - collected);

  function exportCsv() {
    const section = (title: string, rows: Slice[]) => [
      [], [title], ["البند", "المبلغ", "العدد"],
      ...rows.map((r) => [r.label, r.total.toFixed(3), String(r.count)]),
    ];
    const csv = toCsv(months, [
      { header: "الشهر", value: (m) => m.month },
      { header: "مفوتَر", value: (m) => m.billed.toFixed(3) },
      { header: "محصّل", value: (m) => m.collected.toFixed(3) },
    ], [
      [], ["الفترة", periodLabel],
      ["إجمالي المفوتَر", billed.toFixed(3)],
      ["إجمالي المحصّل", collected.toFixed(3)],
      ["نقداً في الصندوق", drawer.toFixed(3)],
      ...section("حسب الخدمة", byService),
      ...section("حسب الطبيب", byDoctor),
      ...section("حسب طريقة الدفع", byMethod),
    ]);
    downloadCsv(`revenue-${periodLabel.replace(/[^\w-]+/g, "-")}`, csv);
  }

  const peak = Math.max(1, ...months.map((m) => Math.max(m.billed, m.collected)));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="مفوتَر في الفترة" value={omr(billed)} sub={`${invoiceCount} فاتورة`} />
        <Card label="محصّل في الفترة" value={omr(collected)}
          sub={rate !== null ? `نسبة التحصيل ${rate}%` : "—"} accent />
        <Card label="لم يُحصَّل بعد" value={omr(uncollected)}
          sub="من فواتير الفترة" warn={uncollected > 0} />
        <Card label="نقداً في الصندوق" value={omr(drawer)} sub="الباقي يذهب للبنك" />
      </div>

      {months.length > 1 && (
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-1">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>الفوترة مقابل التحصيل</h2>
          </div>
          <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
            المسافة بين العمودين هي مشكلة التحصيل — لا تظهر إن نظرت لأحدهما وحده
          </p>
          <div className="flex items-end gap-2 overflow-x-auto pb-1" style={{ minHeight: 130 }}>
            {months.map((m) => (
              <div key={m.month} className="flex flex-col items-center gap-1.5 shrink-0" style={{ width: 54 }}>
                <div className="flex items-end gap-1" style={{ height: 100 }}>
                  <span title={`مفوتَر ${omr(m.billed)}`} className="rounded-t"
                    style={{
                      width: 16, background: "rgba(255,255,255,0.18)",
                      height: `${Math.max(2, (m.billed / peak) * 100)}%`,
                    }} />
                  <span title={`محصّل ${omr(m.collected)}`} className="rounded-t"
                    style={{
                      width: 16, background: "var(--accent-1)",
                      height: `${Math.max(2, (m.collected / peak) * 100)}%`,
                    }} />
                </div>
                <span className="text-[10px] ltr-nums" style={{ color: "var(--text-4)" }}>
                  {m.month.slice(5)}/{m.month.slice(2, 4)}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[11px]" style={{ color: "var(--text-4)" }}>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "rgba(255,255,255,0.18)" }} /> مفوتَر
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: "var(--accent-1)" }} /> محصّل
            </span>
          </div>
        </div>
      )}

      <div className="flex justify-end no-print">
        <button className="btn-ghost" onClick={exportCsv}>
          <Download className="w-3.5 h-3.5" /> تصدير التحليل
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Breakdown title="حسب الخدمة" icon={Sparkles} rows={byService} note="من بنود الفواتير الصادرة في الفترة" />
        <Breakdown title="حسب الطبيب" icon={Stethoscope} rows={byDoctor} note="حسب طبيب الموعد المرتبط بالفاتورة" />
      </div>

      <Breakdown title="حسب طريقة الدفع" icon={CreditCard} rows={byMethod}
        note="من الدفعات المستلمة فعلاً في الفترة — لا من الفواتير" />
    </div>
  );
}

function Breakdown({ title, icon: Icon, rows, note }: {
  title: string; icon: typeof Sparkles; rows: Slice[]; note: string;
}) {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const top = rows.slice(0, 12);
  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="section-title mb-1">
        <Icon className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
        <h2>{title}</h2>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>{note}</p>

      {top.length === 0 ? (
        <p className="text-[12px] text-center py-8" style={{ color: "var(--text-4)" }}>لا بيانات في هذه الفترة</p>
      ) : (
        <div className="space-y-2.5">
          {top.map((r) => {
            const pct = total > 0 ? (r.total / total) * 100 : 0;
            return (
              <div key={r.label}>
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[12.5px] truncate" style={{ color: "var(--text-2)" }}>{r.label}</span>
                  <span className="text-[12px] font-black ltr-nums shrink-0 text-white">
                    {omr(r.total)}
                    <span className="text-[10px] font-normal ms-1.5" style={{ color: "var(--text-4)" }}>
                      {Math.round(pct)}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div className="h-full rounded-full"
                    style={{ width: `${Math.max(1, pct)}%`, background: "var(--accent-2)" }} />
                </div>
              </div>
            );
          })}
          {rows.length > top.length && (
            <p className="text-[11px] pt-1" style={{ color: "var(--text-4)" }}>
              و{rows.length - top.length} بنداً آخر — في ملف التصدير
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, sub, accent, warn }: {
  label: string; value: string; sub: string; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className="panel" style={{ padding: "0.95rem 1.1rem" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
        style={{ color: "var(--text-4)" }}>{label}</p>
      <p className="font-black ltr-nums leading-none" style={{
        fontSize: "1.3rem",
        color: warn ? "#fbbf24" : accent ? "var(--accent-1)" : "#ffffff",
      }}>{value}</p>
      <p className="text-[10.5px] mt-1.5" style={{ color: "var(--text-4)" }}>{sub}</p>
    </div>
  );
}
