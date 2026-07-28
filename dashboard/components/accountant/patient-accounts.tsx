"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, Download, Users, ChevronLeft, Phone } from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";

export type PatientAccount = {
  id: string;
  name: string;
  phone: string | null;
  billed: number;
  collected: number;
  owed: number;
  oldestDays: number | null;
  invoiceCount: number;
};

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

type Tab = "owing" | "all";

/** Who owes what, and the way in to each statement.

    The debt chase lived on the invoice, which is the wrong unit: a patient with
    four part-paid invoices appeared four times and nowhere did the product say
    what that person owes in total. */
export function PatientAccounts({ accounts, capped }: {
  accounts: PatientAccount[]; capped: boolean;
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<Tab>("owing");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return accounts
      .filter((a) => {
        if (tab === "owing" && a.owed <= 0.0005) return false;
        if (term && !`${a.name} ${a.phone ?? ""}`.toLowerCase().includes(term)) return false;
        return true;
      })
      .sort((a, b) => b.owed - a.owed || b.billed - a.billed);
  }, [accounts, q, tab]);

  const totalOwed = rows.reduce((s, a) => s + a.owed, 0);
  const owingCount = accounts.filter((a) => a.owed > 0.0005).length;

  function exportCsv() {
    const csv = toCsv(rows, [
      { header: "المريض", value: (a) => a.name },
      { header: "الجوال", value: (a) => a.phone ?? "" },
      { header: "عدد الفواتير", value: (a) => a.invoiceCount },
      { header: "إجمالي الفواتير", value: (a) => a.billed.toFixed(3) },
      { header: "المحصّل", value: (a) => a.collected.toFixed(3) },
      { header: "المستحق", value: (a) => a.owed.toFixed(3) },
      { header: "عمر أقدم دين (يوم)", value: (a) => a.oldestDays ?? "" },
    ], [[], ["عدد المرضى المعروضين", String(rows.length)], ["إجمالي المستحق", totalOwed.toFixed(3)]]);
    downloadCsv("patient-accounts", csv);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Card label="إجمالي المستحق" value={omr(totalOwed)} sub={`${rows.length} مريض معروض`} accent />
        <Card label="مرضى عليهم مستحقات" value={String(owingCount)} sub={`من ${accounts.length}`} />
        <Card label="أقدم دين"
          value={rows[0]?.oldestDays != null
            ? String(Math.max(...rows.map((r) => r.oldestDays ?? 0)))
            : "—"}
          sub="يوم" />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {([["owing", "عليهم مستحقات"], ["all", "كل المرضى"]] as [Tab, string][]).map(([k, label]) => {
          const on = tab === k;
          const n = k === "owing" ? owingCount : accounts.length;
          return (
            <button key={k} onClick={() => setTab(k)}
              className="flex items-center gap-1.5 text-[12.5px] font-bold px-3 py-2 rounded-xl transition-colors"
              style={{
                background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
                border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
                color: on ? "var(--accent-1)" : "var(--text-3)",
              }}>
              {label}<span className="ltr-nums text-[11px] opacity-70">{n}</span>
            </button>
          );
        })}
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2"
            style={{ insetInlineStart: 12, color: "var(--text-4)" }} />
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث باسم المريض أو رقمه…" style={{ paddingInlineStart: 34 }} />
          {q && (
            <button onClick={() => setQ("")} className="absolute top-1/2 -translate-y-1/2"
              style={{ insetInlineEnd: 12 }}>
              <X className="w-3.5 h-3.5" style={{ color: "var(--text-4)" }} />
            </button>
          )}
        </div>
        <button className="btn-ghost" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="w-3.5 h-3.5" /> تصدير
        </button>
      </div>

      {capped && (
        <p className="text-[12px] px-3.5 py-2.5 rounded-xl"
          style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.28)", color: "#fbbf24" }}>
          تُعرض أحدث الفواتير فقط — مرضى بفواتير أقدم قد لا يظهرون.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 py-16">
          <Users className="w-7 h-7" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {q ? "لا مريض يطابق البحث" : tab === "owing" ? "لا مستحقات على أحد ✓" : "لا حسابات بعد"}
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {rows.map((a, i) => (
            <Link key={a.id} href={`/accountant/patients/${a.id}`}
              className="flex items-center gap-3 px-4 py-3 flex-wrap hover:bg-white/[0.02] transition-colors"
              style={{ borderTop: i ? "1px solid var(--hairline-2)" : "none" }}>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold text-white truncate">{a.name}</p>
                <p className="flex items-center gap-2 text-[10.5px]" style={{ color: "var(--text-4)" }}>
                  {a.phone && (
                    <span className="inline-flex items-center gap-1 ltr-nums">
                      <Phone className="w-3 h-3" />{a.phone}
                    </span>
                  )}
                  <span className="ltr-nums">{a.invoiceCount} فاتورة</span>
                  {a.oldestDays != null && a.owed > 0.0005 && (
                    <span className="ltr-nums" style={{ color: a.oldestDays > 90 ? "#fda4b4" : "var(--text-4)" }}>
                      أقدم دين {a.oldestDays} يوم
                    </span>
                  )}
                </p>
              </div>

              <div className="text-end shrink-0" style={{ minWidth: 88 }}>
                <p className="text-[10px]" style={{ color: "var(--text-4)" }}>فُوتر</p>
                <p className="text-[12.5px] font-bold ltr-nums" style={{ color: "var(--text-2)" }}>{omr(a.billed)}</p>
              </div>
              <div className="text-end shrink-0" style={{ minWidth: 88 }}>
                <p className="text-[10px]" style={{ color: "var(--text-4)" }}>محصّل</p>
                <p className="text-[12.5px] font-bold ltr-nums" style={{ color: "#34d399" }}>{omr(a.collected)}</p>
              </div>
              <div className="text-end shrink-0" style={{ minWidth: 92 }}>
                <p className="text-[10px]" style={{ color: "var(--text-4)" }}>مستحق</p>
                <p className="text-[14px] font-black ltr-nums"
                  style={{ color: a.owed > 0.0005 ? "#fbbf24" : "var(--text-4)" }}>{omr(a.owed)}</p>
              </div>

              <ChevronLeft className="w-4 h-4 shrink-0" style={{ color: "var(--text-4)" }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ label, value, sub, accent }: {
  label: string; value: string; sub: string; accent?: boolean;
}) {
  return (
    <div className="panel" style={{ padding: "0.95rem 1.1rem" }}>
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
        style={{ color: "var(--text-4)" }}>{label}</p>
      <p className="font-black ltr-nums leading-none"
        style={{ fontSize: "1.3rem", color: accent ? "var(--accent-1)" : "#ffffff" }}>{value}</p>
      <p className="text-[10.5px] mt-1.5 ltr-nums" style={{ color: "var(--text-4)" }}>{sub}</p>
    </div>
  );
}
