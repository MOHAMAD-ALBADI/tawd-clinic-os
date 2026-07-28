"use client";

import { Download, Printer, ReceiptText, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { toCsv, downloadCsv } from "@/lib/csv";
import { arDateShort } from "@/lib/ar-format";

export type StatementRow = {
  id: string;
  at: string;
  kind: string;
  label: string;
  detail: string;
  delta: number;
  balance: number;
  invoiceNumber: string | null;
  invoiceId: string | null;
};

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const TONE: Record<string, string> = {
  invoice: "#ffffff",
  payment: "#34d399",
  credit_note: "#38bdf8",
  write_off: "#fda4b4",
  refund: "#c4b5fd",
};

/** The statement, on screen and on paper.

    Printable because the commonest use is handing it to the patient who is
    disputing an amount, and exportable because the second commonest is sending it
    to whoever is asking on their behalf. */
export function StatementView({
  rows, patientName, patientPhone, totals, clinicName,
}: {
  rows: StatementRow[];
  patientName: string;
  patientPhone: string | null;
  totals: { billed: number; collected: number; credited: number; refunded: number; balance: number };
  clinicName: string;
}) {
  function exportCsv() {
    const csv = toCsv(rows, [
      { header: "التاريخ", value: (r) => r.at.slice(0, 10) },
      { header: "الحركة", value: (r) => r.label },
      { header: "الفاتورة", value: (r) => r.invoiceNumber ?? "" },
      { header: "التفصيل", value: (r) => r.detail },
      { header: "مدين", value: (r) => (r.delta > 0 ? r.delta.toFixed(3) : "") },
      { header: "دائن", value: (r) => (r.delta < 0 ? Math.abs(r.delta).toFixed(3) : "") },
      { header: "الرصيد", value: (r) => r.balance.toFixed(3) },
    ], [
      [],
      ["المريض", patientName],
      ["إجمالي الفواتير", totals.billed.toFixed(3)],
      ["إجمالي المحصّل", totals.collected.toFixed(3)],
      ["إشعارات دائن وشطب", totals.credited.toFixed(3)],
      ["مستردّ", totals.refunded.toFixed(3)],
      ["الرصيد المستحق", totals.balance.toFixed(3)],
    ]);
    downloadCsv(`statement-${patientName.replace(/\s+/g, "-")}`, csv);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2 no-print">
        <button className="btn-ghost" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-3.5 h-3.5" /> تصدير
        </button>
        <button className="btn-primary" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> طباعة
        </button>
      </div>

      <div className="panel print:bg-white" style={{ padding: "1.75rem" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap pb-5"
          style={{ borderBottom: "1px solid var(--hairline)" }}>
          <div>
            <p className="eyebrow">كشف حساب · STATEMENT OF ACCOUNT</p>
            <h2 className="text-xl font-black text-white print:text-black leading-none mt-1">{patientName}</h2>
            {patientPhone && (
              <p className="text-[12px] ltr-nums mt-1" style={{ color: "var(--text-3)" }}>{patientPhone}</p>
            )}
          </div>
          <div className="text-end">
            <p className="text-[11px]" style={{ color: "var(--text-4)" }}>الرصيد المستحق</p>
            <p className="text-2xl font-black ltr-nums leading-none mt-1"
              style={{ color: totals.balance > 0.0005 ? "#fbbf24" : "#34d399" }}>
              {omr(Math.max(0, totals.balance))}
            </p>
            <p className="text-[10.5px] mt-1" style={{ color: "var(--text-4)" }}>
              {totals.balance > 0.0005 ? "ر.ع على المريض" : "لا مستحقات ✓"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 py-5">
          <Fig label="إجمالي الفواتير" value={omr(totals.billed)} />
          <Fig label="المحصّل" value={omr(totals.collected)} tone="#34d399" />
          {totals.credited > 0 && <Fig label="إشعار دائن / شطب" value={omr(totals.credited)} tone="#38bdf8" />}
          {totals.refunded > 0 && <Fig label="مستردّ للمريض" value={omr(totals.refunded)} tone="#c4b5fd" />}
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12">
            <ReceiptText className="w-7 h-7" style={{ color: "var(--text-4)" }} />
            <p className="text-sm" style={{ color: "var(--text-3)" }}>لا حركات مالية لهذا المريض</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]" style={{ minWidth: 620 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {["التاريخ", "الحركة", "الفاتورة", "مدين", "دائن", "الرصيد"].map((h) => (
                    <th key={h} className="text-start px-2 py-2.5 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--text-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} style={{ borderTop: "1px solid var(--hairline-2)" }}>
                    <td className="px-2 py-2.5 ltr-nums whitespace-nowrap" style={{ color: "var(--text-3)" }}>
                      {arDateShort.format(new Date(r.at))}
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="font-bold" style={{ color: TONE[r.kind] ?? "#fff" }}>{r.label}</span>
                      {r.detail && (
                        <span className="block text-[10.5px] truncate" style={{ color: "var(--text-4)", maxWidth: 230 }}>
                          {r.detail}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2.5 ltr-nums" style={{ color: "var(--text-3)" }}>
                      {r.invoiceId ? (
                        <Link href={`/accountant/invoices/${r.invoiceId}`} className="hover:underline">
                          {r.invoiceNumber ?? "—"}
                        </Link>
                      ) : (r.invoiceNumber ?? "—")}
                    </td>
                    {/* Two columns rather than one signed number: an accountant
                        reads debit and credit, and a minus sign in a single
                        column is the thing that gets misread. */}
                    <td className="px-2 py-2.5 ltr-nums" style={{ color: "var(--text-2)" }}>
                      {r.delta > 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" style={{ color: "#fbbf24" }} />{omr(r.delta)}
                        </span>
                      ) : ""}
                    </td>
                    <td className="px-2 py-2.5 ltr-nums" style={{ color: "var(--text-2)" }}>
                      {r.delta < 0 ? (
                        <span className="inline-flex items-center gap-1">
                          <ArrowDownLeft className="w-3 h-3" style={{ color: "#34d399" }} />{omr(Math.abs(r.delta))}
                        </span>
                      ) : ""}
                    </td>
                    <td className="px-2 py-2.5 ltr-nums font-black"
                      style={{ color: r.balance > 0.0005 ? "#ffffff" : "#34d399" }}>
                      {omr(r.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-center text-[11px] mt-8 pt-4"
          style={{ color: "var(--text-4)", borderTop: "1px solid var(--hairline-2)" }}>
          {clinicName} · كشف حساب صادر من نظام طَود
        </p>
      </div>
    </div>
  );
}

function Fig({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl px-3.5 py-2.5"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
      <p className="text-[10px] mb-1" style={{ color: "var(--text-4)" }}>{label}</p>
      <p className="text-[15px] font-black ltr-nums" style={{ color: tone ?? "#ffffff" }}>{value}</p>
    </div>
  );
}
