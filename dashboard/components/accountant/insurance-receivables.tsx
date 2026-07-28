"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search, X, Download, ShieldCheck, AlertTriangle, Clock, Send, ChevronLeft,
} from "lucide-react";
import { toCsv, downloadCsv } from "@/lib/csv";
import { arDateShort } from "@/lib/ar-format";

export type ClaimRow = {
  id: string;
  status: string;
  claimRef: string | null;
  submitted: number;
  approved: number | null;
  patientId: string | null;
  patientName: string;
  providerName: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  invoiceTotal: number;
  ageDays: number;
  rejectionReason: string | null;
  resolvedAt: string | null;
};

const omr = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

const STATUS: Record<string, { label: string; colour: string }> = {
  pending:   { label: "لم تُرسل",  colour: "#fbbf24" },
  submitted: { label: "مُرسلة",    colour: "#38bdf8" },
  approved:  { label: "معتمدة",    colour: "#34d399" },
  rejected:  { label: "مرفوضة",    colour: "#fda4b4" },
};

type Tab = "outstanding" | "rejected" | "all";

/** What insurers owe, and what they have refused.

    Outstanding is `pending` plus `submitted`: the clinic has done the work and
    the money has not arrived. Approved claims are settled the moment they are
    approved — the settlement writes a payment — so they are collected, not
    outstanding, and counting them again would double the receivable. */
export function InsuranceReceivables({ claims }: { claims: ClaimRow[] }) {
  const [tab, setTab] = useState<Tab>("outstanding");
  const [q, setQ] = useState("");

  const outstanding = claims.filter((c) => c.status === "pending" || c.status === "submitted");
  const rejected = claims.filter((c) => c.status === "rejected");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = tab === "outstanding" ? outstanding : tab === "rejected" ? rejected : claims;
    return base
      .filter((c) => !term ||
        `${c.patientName} ${c.providerName} ${c.claimRef ?? ""} ${c.invoiceNumber ?? ""}`
          .toLowerCase().includes(term))
      .sort((a, b) => b.ageDays - a.ageDays);
  }, [claims, outstanding, rejected, tab, q]);

  const owed = outstanding.reduce((s, c) => s + c.submitted, 0);
  const unsent = outstanding.filter((c) => c.status === "pending");
  const stale = outstanding.filter((c) => c.ageDays > 60);
  const backOnPatient = rejected.reduce((s, c) => s + c.submitted, 0);

  /* Which insurer is slow. A single "owed" figure cannot start a phone call. */
  const byProvider = useMemo(() => {
    const m = new Map<string, { total: number; n: number; oldest: number }>();
    for (const c of outstanding) {
      const cur = m.get(c.providerName) ?? { total: 0, n: 0, oldest: 0 };
      cur.total += c.submitted; cur.n += 1;
      cur.oldest = Math.max(cur.oldest, c.ageDays);
      m.set(c.providerName, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [outstanding]);

  function exportCsv() {
    const csv = toCsv(rows, [
      { header: "الحالة", value: (c) => STATUS[c.status]?.label ?? c.status },
      { header: "الشركة", value: (c) => c.providerName },
      { header: "المريض", value: (c) => c.patientName },
      { header: "الفاتورة", value: (c) => c.invoiceNumber ?? "" },
      { header: "رقم المطالبة", value: (c) => c.claimRef ?? "" },
      { header: "المُطالَب به", value: (c) => c.submitted.toFixed(3) },
      { header: "المعتمد", value: (c) => (c.approved != null ? c.approved.toFixed(3) : "") },
      { header: "العمر بالأيام", value: (c) => c.ageDays },
      { header: "سبب الرفض", value: (c) => c.rejectionReason ?? "" },
    ], [
      [],
      ["مستحق على شركات التأمين", owed.toFixed(3)],
      ["مرفوض ورجع على المرضى", backOnPatient.toFixed(3)],
    ]);
    downloadCsv("insurance-receivables", csv);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="مستحق على التأمين" value={omr(owed)} sub={`${outstanding.length} مطالبة`} accent />
        <Card label="لم تُرسل بعد" value={String(unsent.length)}
          sub={unsent.length ? `${omr(unsent.reduce((s, c) => s + c.submitted, 0))} ر.ع معطّلة عندنا` : "لا شيء معطّل ✓"}
          warn={unsent.length > 0} />
        <Card label="أقدم من ٦٠ يوم" value={String(stale.length)}
          sub={stale.length ? "تحتاج متابعة مع الشركة" : "لا تأخير ✓"} warn={stale.length > 0} />
        <Card label="رجعت على المريض" value={omr(backOnPatient)}
          sub={`${rejected.length} مطالبة مرفوضة`} warn={backOnPatient > 0} />
      </div>

      {/* The gap nobody was told about. */}
      {rejected.length > 0 && (
        <div className="flex items-start gap-2 text-[12.5px] px-3.5 py-3 rounded-xl"
          style={{ background: "rgba(248,113,113,0.07)", border: "1px solid rgba(248,113,113,0.26)", color: "var(--text-2)" }}>
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "#fda4b4" }} />
          <span>
            <b style={{ color: "#fda4b4" }}>مطالبات مرفوضة</b> — رفض الشركة يعني أن المبلغ يعود على المريض،
            ولا شيء في النظام كان يبلّغ أحداً بذلك: الفاتورة تبقى غير مسدّدة والمطالبة تبقى مرفوضة
            ولا أحد يربط بينهما. راجعوا القائمة وطالبوا المرضى.
          </span>
        </div>
      )}

      {byProvider.length > 0 && tab === "outstanding" && (
        <div className="panel" style={{ padding: "1.25rem" }}>
          <div className="section-title mb-3">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
            <h2>حسب الشركة</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {byProvider.map(([name, v]) => (
              <div key={name} className="rounded-xl px-3.5 py-2.5"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                <p className="text-[12.5px] font-bold text-white truncate">{name}</p>
                <p className="text-[15px] font-black ltr-nums mt-0.5" style={{ color: "var(--accent-1)" }}>
                  {omr(v.total)}
                </p>
                <p className="text-[10.5px] ltr-nums" style={{ color: v.oldest > 60 ? "#fbbf24" : "var(--text-4)" }}>
                  {v.n} مطالبة · أقدمها {v.oldest} يوم
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {([["outstanding", "مستحقة"], ["rejected", "مرفوضة"], ["all", "الكل"]] as [Tab, string][])
          .map(([k, label]) => {
            const on = tab === k;
            const n = k === "outstanding" ? outstanding.length : k === "rejected" ? rejected.length : claims.length;
            return (
              <button key={k} onClick={() => setTab(k)}
                className="flex items-center gap-1.5 text-[12.5px] font-bold px-3 py-2 rounded-xl transition-colors"
                style={{
                  background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
                  border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
                  color: on ? "var(--accent-1)" : k === "rejected" && n > 0 ? "#fda4b4" : "var(--text-3)",
                }}>
                {label}<span className="ltr-nums text-[11px] opacity-70">{n}</span>
              </button>
            );
          })}
        <div className="relative flex-1" style={{ minWidth: 200 }}>
          <Search className="w-3.5 h-3.5 absolute top-1/2 -translate-y-1/2"
            style={{ insetInlineStart: 12, color: "var(--text-4)" }} />
          <input className="field" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث بالمريض أو الشركة أو رقم المطالبة…" style={{ paddingInlineStart: 34 }} />
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

      {rows.length === 0 ? (
        <div className="panel flex flex-col items-center gap-2 py-16">
          <ShieldCheck className="w-7 h-7" style={{ color: "var(--text-4)" }} />
          <p className="text-sm" style={{ color: "var(--text-3)" }}>
            {q ? "لا مطالبة تطابق البحث"
              : tab === "outstanding" ? "لا مستحقات على شركات التأمين ✓"
              : tab === "rejected" ? "لا مطالبات مرفوضة ✓" : "لا مطالبات بعد"}
          </p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          {rows.map((c, i) => {
            const st = STATUS[c.status] ?? STATUS.pending;
            const late = (c.status === "submitted" || c.status === "pending") && c.ageDays > 60;
            return (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 flex-wrap"
                style={{ borderTop: i ? "1px solid var(--hairline-2)" : "none" }}>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: `${st.colour}1a`, color: st.colour, border: `1px solid ${st.colour}40` }}>
                  {st.label}
                </span>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-bold text-white truncate">
                    {c.patientName}
                    <span className="font-normal" style={{ color: "var(--text-4)" }}> — {c.providerName}</span>
                  </p>
                  <p className="flex items-center gap-2 text-[10.5px] flex-wrap" style={{ color: "var(--text-4)" }}>
                    {c.invoiceNumber && <span className="ltr-nums">{c.invoiceNumber}</span>}
                    {c.claimRef && <span className="ltr-nums">مطالبة {c.claimRef}</span>}
                    <span className="inline-flex items-center gap-1 ltr-nums"
                      style={{ color: late ? "#fbbf24" : "var(--text-4)" }}>
                      {c.status === "pending" ? <Send className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {c.ageDays} يوم
                    </span>
                  </p>
                  {c.rejectionReason && (
                    <p className="text-[10.5px] mt-0.5" style={{ color: "#fda4b4" }}>
                      سبب الرفض: {c.rejectionReason}
                    </p>
                  )}
                  {c.resolvedAt && (
                    <p className="text-[10px] ltr-nums" style={{ color: "var(--text-4)" }}>
                      حُسمت {arDateShort.format(new Date(c.resolvedAt))}
                    </p>
                  )}
                </div>

                <div className="text-end shrink-0" style={{ minWidth: 90 }}>
                  <p className="text-[13px] font-black ltr-nums text-white">{omr(c.submitted)}</p>
                  {c.approved != null && c.approved !== c.submitted && (
                    <p className="text-[10.5px] ltr-nums" style={{ color: "#34d399" }}>
                      اعتُمد {omr(c.approved)}
                    </p>
                  )}
                </div>

                {c.patientId && (
                  <Link href={`/accountant/patients/${c.patientId}`} className="btn-ghost shrink-0"
                    title="كشف حساب المريض">
                    <ChevronLeft className="w-4 h-4" style={{ color: "var(--text-4)" }} />
                  </Link>
                )}
              </div>
            );
          })}
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
