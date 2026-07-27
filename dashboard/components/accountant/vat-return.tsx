"use client";

import { useMemo, useState } from "react";
import {
  Download, Printer, AlertTriangle, CheckCircle2, Calendar, Receipt, Info,
} from "lucide-react";
import { arDateShort } from "@/lib/ar-format";

export type VatInvoice = {
  id: string; number: string; date: string; patientName: string;
  subtotal: number; discount: number; vat: number; total: number; status: string;
};

export type VatPeriod = { label: string; start: string; end: string; due: string };

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** The quarterly return, and the invoice list behind every figure on it.

    An accountant will not file a number they cannot trace, so the summary and
    the supporting rows are on the same page and the CSV carries both. */
export function VatReturn({
  invoices, period, daysToDue, quarterClosed, clinicName, vatNumber,
}: {
  invoices: VatInvoice[]; period: VatPeriod; daysToDue: number;
  quarterClosed: boolean; clinicName: string; vatNumber: string | null;
}) {
  const [showAll, setShowAll] = useState(false);

  const totals = useMemo(() => {
    let net = 0, vat = 0, gross = 0, discount = 0, refunded = 0, unpaid = 0;
    for (const i of invoices) {
      if (i.status === "refunded") { refunded += i.total; continue; }
      net += i.subtotal - i.discount;
      vat += i.vat;
      gross += i.total;
      discount += i.discount;
      if (["sent", "overdue", "partially_paid"].includes(i.status)) unpaid += i.total;
    }
    return { net, vat, gross, discount, refunded, unpaid, count: invoices.length };
  }, [invoices]);

  /* By month, because the return is filed per quarter but reconciled per month
     and a jump in one month is the first sign of a mistake. */
  const byMonth = useMemo(() => {
    const m = new Map<string, { net: number; vat: number; n: number }>();
    for (const i of invoices) {
      if (i.status === "refunded") continue;
      const k = i.date.slice(0, 7);
      const cur = m.get(k) ?? { net: 0, vat: 0, n: 0 };
      cur.net += i.subtotal - i.discount;
      cur.vat += i.vat;
      cur.n += 1;
      m.set(k, cur);
    }
    return [...m.entries()].sort();
  }, [invoices]);

  /* An invoice with a total but no VAT line is either genuinely exempt or a
     mistake, and the accountant is the one who can tell. Silence would let the
     return understate the tax due. */
  const zeroVat = invoices.filter((i) => i.status !== "refunded" && i.vat === 0 && i.total > 0);

  function csv() {
    const head = ["رقم الفاتورة", "التاريخ", "المريض", "الصافي", "الخصم", "الضريبة", "الإجمالي", "الحالة"];
    const lines = invoices.map((i) => [
      i.number, i.date.slice(0, 10), i.patientName.replace(/,/g, " "),
      (i.subtotal - i.discount).toFixed(3), i.discount.toFixed(3),
      i.vat.toFixed(3), i.total.toFixed(3), i.status,
    ].join(","));
    const summary = [
      "", `العيادة,${clinicName}`, `الرقم الضريبي,${vatNumber ?? "غير مسجّل"}`,
      `الفترة,${period.label}`, `من,${period.start}`, `إلى,${period.end}`,
      `صافي المبيعات,${totals.net.toFixed(3)}`,
      `ضريبة المخرجات,${totals.vat.toFixed(3)}`,
      `الإجمالي,${totals.gross.toFixed(3)}`,
    ].join("\n");
    /* BOM so Excel opens Arabic correctly rather than as mojibake. */
    const blob = new Blob(["﻿" + [head.join(","), ...lines, summary].join("\n")],
      { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `VAT-${period.label.replace(" ", "-")}.csv`;
    a.click();
  }

  const overdue = quarterClosed && daysToDue < 0;
  const dueSoon = quarterClosed && daysToDue >= 0 && daysToDue <= 10;

  return (
    <div className="space-y-4">
      {/* The deadline, with the consequence attached. A date alone does not
          convey a 5,000-rial penalty. */}
      <div className="panel flex items-start gap-3 flex-wrap" style={{
        padding: "1rem 1.2rem",
        borderColor: overdue ? "rgba(248,113,113,0.35)" : dueSoon ? "rgba(251,191,36,0.3)" : undefined,
      }}>
        <Calendar className="w-4 h-4 shrink-0 mt-0.5"
          style={{ color: overdue ? "#fda4b4" : dueSoon ? "#fbbf24" : "var(--accent-1)" }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-bold" style={{ color: overdue ? "#fda4b4" : "#ffffff" }}>
            {!quarterClosed
              ? `الربع جارٍ — يُقفل ${period.end} ويُقدَّم حتى ${period.due}`
              : overdue
              ? `تأخّر الإقرار ${Math.abs(daysToDue)} يوماً عن ${period.due}`
              : `موعد التقديم ${period.due} — باقٍ ${daysToDue} يوم`}
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--text-4)" }}>
            الإقرار ربع سنوي ويُقدَّم خلال ٣٠ يوماً من نهاية الربع. التأخير غرامة إدارية من ٥٠٠ إلى ٥٠٠٠ ر.ع،
            والسداد المتأخر ١٪ شهرياً.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="صافي المبيعات" value={omr(totals.net)} sub="قبل الضريبة" />
        <Card label="ضريبة المخرجات" value={omr(totals.vat)} sub="المستحقة للجهاز" accent />
        <Card label="إجمالي الفواتير" value={omr(totals.gross)} sub={`${totals.count} فاتورة`} />
        <Card label="غير محصَّل من الفترة" value={omr(totals.unpaid)}
          sub="الضريبة تُستحق بالفوترة لا بالتحصيل" warn={totals.unpaid > 0} />
      </div>

      {zeroVat.length > 0 && (
        <div className="panel flex items-start gap-3" style={{ padding: "1rem 1.2rem", borderColor: "rgba(251,191,36,0.28)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            <span className="font-black ltr-nums">{zeroVat.length}</span> فاتورة بمبلغ وبلا ضريبة —
            إما خدمات معفاة أو خطأ في الاحتساب. راجعها قبل التقديم؛ النقص في الإقرار مسؤوليتكم.
          </p>
        </div>
      )}

      {totals.refunded > 0 && (
        <div className="panel flex items-start gap-3" style={{ padding: "1rem 1.2rem" }}>
          <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent-1)" }} />
          <p className="text-[12.5px]" style={{ color: "var(--text-2)" }}>
            <span className="font-black ltr-nums">{omr(totals.refunded)}</span> ر.ع فواتير مستردة في هذه الفترة —
            مستبعدة من المجاميع أعلاه. تُعالَج كإشعار دائن حسب تاريخ الاسترداد.
          </p>
        </div>
      )}

      {byMonth.length > 0 && (
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-3">
            <Receipt className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>التوزيع الشهري</h2>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            {byMonth.map(([month, v]) => (
              <div key={month} className="rounded-xl px-3.5 py-3"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                <p className="text-[11px] ltr-nums mb-1" style={{ color: "var(--text-4)" }}>{month}</p>
                <p className="text-[15px] font-black ltr-nums text-white">{omr(v.vat)}</p>
                <p className="text-[10.5px] ltr-nums" style={{ color: "var(--text-4)" }}>
                  ضريبة · صافي {omr(v.net)} · {v.n} فاتورة
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
          style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div className="section-title">
            <Receipt className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>الفواتير المؤيِّدة</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn-ghost" onClick={csv}>
              <Download className="w-3.5 h-3.5" /> تصدير CSV
            </button>
            <button className="btn-ghost" onClick={() => window.print()}>
              <Printer className="w-3.5 h-3.5" /> طباعة
            </button>
          </div>
        </div>

        {invoices.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14">
            <CheckCircle2 className="w-7 h-7" style={{ color: "var(--text-4)" }} />
            <p className="text-sm" style={{ color: "var(--text-3)" }}>لا فواتير في هذه الفترة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {["الفاتورة", "التاريخ", "المريض", "الصافي", "الضريبة", "الإجمالي"].map((h) => (
                    <th key={h} className="text-start px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showAll ? invoices : invoices.slice(0, 25)).map((i) => (
                  <tr key={i.id} style={{ borderTop: "1px solid var(--hairline-2)" }}>
                    <td className="px-3 py-2.5 ltr-nums font-bold text-white">{i.number}</td>
                    <td className="px-3 py-2.5 ltr-nums" style={{ color: "var(--text-3)" }}>
                      {arDateShort.format(new Date(i.date))}
                    </td>
                    <td className="px-3 py-2.5 truncate" style={{ color: "var(--text-2)", maxWidth: 180 }}>
                      {i.patientName}
                    </td>
                    <td className="px-3 py-2.5 ltr-nums" style={{ color: "var(--text-2)" }}>
                      {omr(i.subtotal - i.discount)}
                    </td>
                    <td className="px-3 py-2.5 ltr-nums font-bold"
                      style={{ color: i.vat === 0 ? "#fbbf24" : "var(--accent-1)" }}>
                      {omr(i.vat)}
                    </td>
                    <td className="px-3 py-2.5 ltr-nums font-bold text-white">{omr(i.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid var(--hairline)" }}>
                  <td className="px-3 py-3 font-black text-white" colSpan={3}>الإجمالي</td>
                  <td className="px-3 py-3 ltr-nums font-black text-white">{omr(totals.net)}</td>
                  <td className="px-3 py-3 ltr-nums font-black" style={{ color: "var(--accent-1)" }}>{omr(totals.vat)}</td>
                  <td className="px-3 py-3 ltr-nums font-black text-white">{omr(totals.gross)}</td>
                </tr>
              </tfoot>
            </table>
            {invoices.length > 25 && !showAll && (
              <button className="btn-ghost w-full" onClick={() => setShowAll(true)}>
                عرض كل {invoices.length} فاتورة
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, sub, accent, warn }: {
  label: string; value: string; sub: string; accent?: boolean; warn?: boolean;
}) {
  return (
    <div className="panel" style={{ padding: "1.1rem 1.2rem" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: "var(--text-4)" }}>{label}</p>
      <p className="font-black ltr-nums leading-none"
        style={{ fontSize: "1.5rem", color: warn ? "#fbbf24" : accent ? "var(--accent-1)" : "#ffffff" }}>
        {value}
      </p>
      <p className="text-[10.5px] mt-1.5" style={{ color: "var(--text-4)" }}>{sub}</p>
    </div>
  );
}
