"use client";

import { useMemo, useState } from "react";
import {
  Download, Printer, AlertTriangle, CheckCircle2, Calendar, Receipt, Info, Undo2,
} from "lucide-react";
import { arDateShort } from "@/lib/ar-format";

export type VatInvoice = {
  id: string; number: string; date: string; patientName: string;
  subtotal: number; discount: number; vat: number; total: number; status: string;
};

export type VatAdjustment = {
  id: string;
  kind: "refund" | "credit_note" | "write_off";
  date: string;
  invoiceNumber: string;
  patientName: string;
  amount: number;
  /** the tax share of `amount`, at the invoice's own effective rate */
  vat: number;
  reason: string;
};

export type VatPeriod = { label: string; start: string; end: string; due: string };

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const ADJ_AR: Record<VatAdjustment["kind"], string> = {
  refund: "استرداد", credit_note: "إشعار دائن", write_off: "شطب",
};

/** The quarterly return, and the invoice list behind every figure on it.

    An accountant will not file a number they cannot trace, so the summary and
    the supporting rows are on the same page and the CSV carries both. */
export function VatReturn({
  invoices, adjustments, period, daysToDue, quarterClosed, clinicName, vatNumber,
}: {
  invoices: VatInvoice[]; adjustments: VatAdjustment[];
  period: VatPeriod; daysToDue: number;
  quarterClosed: boolean; clinicName: string; vatNumber: string | null;
}) {
  const [showAll, setShowAll] = useState(false);

  /* Every invoice raised in the quarter declares its own tax, at the amount it
     was raised for. The tax is due on the supply, so an unpaid invoice is still
     declared — and an invoice later corrected is still declared here, with the
     correction landing in the quarter the correction was made. */
  const totals = useMemo(() => {
    let net = 0, vat = 0, gross = 0, discount = 0, unpaid = 0;
    for (const i of invoices) {
      net += i.subtotal - i.discount;
      vat += i.vat;
      gross += i.total;
      discount += i.discount;
      if (["sent", "overdue", "partially_paid"].includes(i.status)) unpaid += i.total;
    }
    return { net, vat, gross, discount, unpaid, count: invoices.length };
  }, [invoices]);

  /* Credit notes and refunds reduce the tax on a supply that was over-declared,
     so they come off output tax in the period they were issued.

     Write-offs do not. Bad-debt relief in Oman is conditional — the debt has to
     be genuinely irrecoverable and aged, and the claim is made deliberately —
     so deducting it automatically would file a return that understates the
     liability while looking complete. It is listed, and left to the accountant. */
  const adj = useMemo(() => {
    let creditVat = 0, refundVat = 0, writtenOff = 0, writtenOffVat = 0,
        creditAmount = 0, refundAmount = 0;
    for (const a of adjustments) {
      if (a.kind === "credit_note") { creditVat += a.vat; creditAmount += a.amount; }
      else if (a.kind === "refund")  { refundVat += a.vat; refundAmount += a.amount; }
      else { writtenOff += a.amount; writtenOffVat += a.vat; }
    }
    const reliefVat = creditVat + refundVat;
    return {
      creditVat, refundVat, writtenOff, writtenOffVat,
      creditAmount, refundAmount, reliefVat,
      count: adjustments.length,
    };
  }, [adjustments]);

  const netVatDue = totals.vat - adj.reliefVat;

  /* By month, because the return is filed per quarter but reconciled per month
     and a jump in one month is the first sign of a mistake. */
  const byMonth = useMemo(() => {
    const m = new Map<string, { net: number; vat: number; n: number }>();
    for (const i of invoices) {
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
  const zeroVat = invoices.filter((i) => i.vat === 0 && i.total > 0);

  function csv() {
    const head = ["رقم الفاتورة", "التاريخ", "المريض", "الصافي", "الخصم", "الضريبة", "الإجمالي", "الحالة"];
    const lines = invoices.map((i) => [
      i.number, i.date.slice(0, 10), i.patientName.replace(/,/g, " "),
      (i.subtotal - i.discount).toFixed(3), i.discount.toFixed(3),
      i.vat.toFixed(3), i.total.toFixed(3), i.status,
    ].join(","));
    /* The adjustments travel with the return, because the netted figure is not
       defensible without the rows that produced it. */
    const adjLines = adjustments.length
      ? ["", "التسويات في الفترة", "النوع,التاريخ,الفاتورة,المريض,المبلغ,الضريبة,السبب",
         ...adjustments.map((a) => [
           ADJ_AR[a.kind], a.date.slice(0, 10), a.invoiceNumber,
           a.patientName.replace(/,/g, " "), a.amount.toFixed(3), a.vat.toFixed(3),
           a.reason.replace(/,/g, " "),
         ].join(","))]
      : [];
    const summary = [
      "", `العيادة,${clinicName}`, `الرقم الضريبي,${vatNumber ?? "غير مسجّل"}`,
      `الفترة,${period.label}`, `من,${period.start}`, `إلى,${period.end}`,
      `صافي المبيعات,${totals.net.toFixed(3)}`,
      `ضريبة المخرجات,${totals.vat.toFixed(3)}`,
      `ضريبة إشعارات الدائن والاسترداد,${adj.reliefVat.toFixed(3)}`,
      `صافي الضريبة المستحقة,${netVatDue.toFixed(3)}`,
      `شطب ديون (بلا خصم ضريبي تلقائي),${adj.writtenOff.toFixed(3)}`,
      `الإجمالي,${totals.gross.toFixed(3)}`,
    ].join("\n");
    /* BOM so Excel opens Arabic correctly rather than as mojibake. */
    const blob = new Blob(["﻿" + [head.join(","), ...lines, ...adjLines, summary].join("\n")],
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
        <Card label="ضريبة المخرجات" value={omr(totals.vat)} sub="على الفواتير الصادرة" />
        {adj.reliefVat > 0 ? (
          <Card label="صافي الضريبة المستحقة" value={omr(netVatDue)}
            sub={`بعد خصم ${omr(adj.reliefVat)} إشعارات دائن واسترداد`} accent />
        ) : (
          <Card label="إجمالي الفواتير" value={omr(totals.gross)} sub={`${totals.count} فاتورة`} />
        )}
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

      {adjustments.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap"
            style={{ borderBottom: "1px solid var(--hairline)" }}>
            <div className="section-title">
              <Undo2 className="w-3.5 h-3.5" style={{ color: "#c4b5fd" }} />
              <h2>التسويات في هذه الفترة</h2>
            </div>
            <span className="text-[11px]" style={{ color: "var(--text-4)" }}>
              خصم ضريبي <span className="font-black ltr-nums" style={{ color: "var(--accent-1)" }}>
                {omr(adj.reliefVat)}
              </span> ر.ع
            </span>
          </div>

          <div className="px-4 py-3 space-y-1">
            {adjustments.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl flex-wrap"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    background: a.kind === "write_off" ? "rgba(253,164,180,0.12)" : "rgba(167,139,250,0.12)",
                    color: a.kind === "write_off" ? "#fda4b4" : "#c4b5fd",
                  }}>
                  {ADJ_AR[a.kind]}
                </span>
                <span className="text-[11px] ltr-nums shrink-0" style={{ color: "var(--text-4)" }}>
                  {arDateShort.format(new Date(a.date))}
                </span>
                <span className="text-[11.5px] font-bold ltr-nums text-white shrink-0">{a.invoiceNumber}</span>
                <span className="text-[11.5px] flex-1 min-w-0 truncate" style={{ color: "var(--text-3)" }}>
                  {a.patientName} — {a.reason}
                </span>
                <span className="text-[12px] font-black ltr-nums shrink-0 text-white">{omr(a.amount)}</span>
                <span className="text-[11px] ltr-nums shrink-0" style={{ width: 66, textAlign: "end",
                  color: a.kind === "write_off" ? "var(--text-4)" : "var(--accent-1)" }}>
                  {a.kind === "write_off" ? "—" : omr(a.vat)}
                </span>
              </div>
            ))}
          </div>

          {/* Bad-debt relief is a claim, not an automatic deduction. Netting it
              here would produce a return that looks complete and understates the
              liability — which is the clinic's exposure, not ours to assume. */}
          {adj.writtenOff > 0 && (
            <div className="flex items-start gap-3 px-4 py-3"
              style={{ borderTop: "1px solid var(--hairline)", background: "rgba(251,191,36,0.05)" }}>
              <Info className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#fbbf24" }} />
              <p className="text-[12px]" style={{ color: "var(--text-2)" }}>
                <span className="font-black ltr-nums">{omr(adj.writtenOff)}</span> ر.ع ديون مشطوبة
                {adj.writtenOffVat > 0 && <> منها ضريبة <span className="font-black ltr-nums">{omr(adj.writtenOffVat)}</span> ر.ع</>}
                {" "}— غير مخصومة من الإقرار أعلاه. خصم الدين المعدوم في عُمان مطالبة مشروطة بتعذّر التحصيل فعلياً
                ومضيّ المدة، فالقرار قرارُكم لا قرارُ النظام.
              </p>
            </div>
          )}
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
