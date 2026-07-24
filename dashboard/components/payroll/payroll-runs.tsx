"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play, Lock, Save, CheckCircle2, AlertTriangle, FileText, RefreshCw } from "lucide-react";
import { generatePayroll, updatePayslip, finalizePayroll } from "@/app/actions/payroll";

export type RunRow = { id: string; period: string; status: "draft" | "finalized"; total_net: number };
export type PayslipRow = {
  id: string; staff_id: string; staff_name: string;
  basic: number; allowances: number; additions: number; deductions: number;
  absence_days: number; gross: number; net: number; notes: string;
};

const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

export function PayrollRuns({ period, runs, currentRun, payslips }: {
  period: string; runs: RunRow[]; currentRun: RunRow | null; payslips: PayslipRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { additions: string; deductions: string }>>({});

  function ok(m: string) { setFlash(m); setTimeout(() => setFlash(null), 2500); }
  const isDraft = currentRun?.status === "draft";
  const isFinal = currentRun?.status === "finalized";

  function gen() {
    setErr(null);
    start(async () => {
      try {
        const r = await generatePayroll(period);
        if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; }
        ok(`تم توليد المسيّر — ${r.count} قسيمة`); router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }
  function saveRow(p: PayslipRow) {
    const e = edits[p.id];
    if (!e) return;
    setErr(null);
    start(async () => {
      try {
        const r = await updatePayslip(p.id, { additions: Number(e.additions), deductions: Number(e.deductions) });
        if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; }
        setEdits((prev) => { const c = { ...prev }; delete c[p.id]; return c; });
        ok("حُفظت القسيمة"); router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }
  function finalize() {
    if (!currentRun) return;
    setErr(null);
    start(async () => {
      try {
        const r = await finalizePayroll(currentRun.id);
        if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; }
        ok("تم اعتماد المسيّر"); router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  const totalNet = payslips.reduce((s, p) => {
    const e = edits[p.id];
    const add = e ? Number(e.additions) || 0 : p.additions;
    const ded = e ? Number(e.deductions) || 0 : p.deductions;
    return s + (p.basic + p.allowances + add - ded);
  }, 0);

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="section-title">
          <FileText className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
          <h2>مسيّر الرواتب — <span className="ltr-nums">{period}</span></h2>
          {isFinal && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(45,212,191,0.14)", color: "#5dd9cb", border: "1px solid rgba(45,212,191,0.3)" }}>معتمد</span>}
          {isDraft && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.25)" }}>مسودّة</span>}
        </div>
        <div className="flex items-center gap-2">
          {!currentRun && <button className="btn-primary" disabled={pending} onClick={gen}><Play className="w-3.5 h-3.5" /> توليد المسيّر</button>}
          {isDraft && <>
            <button className="btn-ghost" disabled={pending} onClick={gen}><RefreshCw className="w-3.5 h-3.5" /> إعادة التوليد</button>
            <button className="btn-primary" disabled={pending} onClick={finalize}><Lock className="w-3.5 h-3.5" /> اعتماد</button>
          </>}
        </div>
      </div>

      {flash && <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3" style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.25)", color: "#5dd9cb" }}><CheckCircle2 className="w-4 h-4" /> {flash}</div>}
      {err && <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#fda4b4" }}><AlertTriangle className="w-4 h-4" /> {err}</div>}

      {!currentRun ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>لا مسيّر لهذا الشهر بعد — اضغط «توليد المسيّر» لإنشائه من رواتب الموظفين وحضورهم</p>
      ) : payslips.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>لا قسائم — تأكد من إعداد رواتب الموظفين ثم أعد التوليد</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                {["الموظف", "أساسي", "بدلات", "غياب", "إضافات", "استقطاعات", "الصافي", ""].map((h) => (
                  <th key={h} className="text-start px-2.5 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-4)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payslips.map((p) => {
                const e = edits[p.id];
                const add = e ? e.additions : String(p.additions);
                const ded = e ? e.deductions : String(p.deductions);
                const net = p.basic + p.allowances + (Number(add) || 0) - (Number(ded) || 0);
                return (
                  <tr key={p.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <td className="px-2.5 py-2.5 font-bold text-white">{p.staff_name}</td>
                    <td className="px-2.5 py-2.5 ltr-nums" style={{ color: "var(--text-2)" }}>{fmt(p.basic)}</td>
                    <td className="px-2.5 py-2.5 ltr-nums" style={{ color: "var(--text-2)" }}>{fmt(p.allowances)}</td>
                    <td className="px-2.5 py-2.5 ltr-nums" style={{ color: p.absence_days > 0 ? "#fbbf24" : "var(--text-4)" }}>{p.absence_days}</td>
                    <td className="px-2.5 py-2.5">
                      {isDraft ? (
                        <input className="field ltr-nums" style={{ width: 84, padding: "0.3rem 0.5rem" }} type="number" min={0} step="0.001" dir="ltr" value={add}
                          onChange={(ev) => setEdits((prev) => ({ ...prev, [p.id]: { additions: ev.target.value, deductions: ded } }))} />
                      ) : <span className="ltr-nums" style={{ color: "var(--text-2)" }}>{fmt(p.additions)}</span>}
                    </td>
                    <td className="px-2.5 py-2.5">
                      {isDraft ? (
                        <input className="field ltr-nums" style={{ width: 84, padding: "0.3rem 0.5rem" }} type="number" min={0} step="0.001" dir="ltr" value={ded}
                          onChange={(ev) => setEdits((prev) => ({ ...prev, [p.id]: { additions: add, deductions: ev.target.value } }))} />
                      ) : <span className="ltr-nums" style={{ color: "var(--text-2)" }}>{fmt(p.deductions)}</span>}
                    </td>
                    <td className="px-2.5 py-2.5 font-black ltr-nums text-white">{fmt(net)}</td>
                    <td className="px-2.5 py-2.5 text-end">
                      {isDraft && e && (
                        <button title="حفظ" disabled={pending} onClick={() => saveRow(p)}
                          className="w-7 h-7 rounded-lg inline-flex items-center justify-center"
                          style={{ background: "rgba(45,212,191,0.12)", border: "1px solid rgba(45,212,191,0.3)", color: "#5dd9cb" }}>
                          <Save className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "1px solid var(--hairline)" }}>
                <td colSpan={6} className="px-2.5 py-3 text-end font-bold" style={{ color: "var(--text-2)" }}>إجمالي صافي الرواتب</td>
                <td colSpan={2} className="px-2.5 py-3 font-black ltr-nums" style={{ color: "#5dd9cb", fontSize: "1.05rem" }}>{fmt(totalNet)} ر.ع</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {runs.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--text-4)" }}>سجل المسيّرات</p>
          <div className="flex flex-wrap gap-2">
            {runs.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-[12px] px-3 py-1.5 rounded-xl"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
                <span className="ltr-nums font-bold text-white">{r.period}</span>
                <span style={{ color: r.status === "finalized" ? "#5dd9cb" : "#fbbf24" }}>{r.status === "finalized" ? "معتمد" : "مسودّة"}</span>
                <span className="ltr-nums" style={{ color: "var(--text-3)" }}>{fmt(r.total_net)} ر.ع</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
