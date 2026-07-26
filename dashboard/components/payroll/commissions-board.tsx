"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Coins, Banknote, Trash2, AlertTriangle } from "lucide-react";
import { approveCommission, payCommission, deleteCommission } from "@/app/actions/commissions";

export type CommissionRow = {
  id: string; doctor_name: string; rate: number; amount: number;
  status: "pending" | "approved" | "paid"; created_at: string;
};

const STATUS: Record<CommissionRow["status"], { label: string; color: string }> = {
  pending: { label: "بانتظار الاعتماد", color: "#fbbf24" },
  approved: { label: "معتمدة", color: "var(--accent-1)" },
  paid: { label: "مصروفة", color: "var(--accent-1)" },
};
const fmt = (v: number) => new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(v);

/** Doctor commissions accrue automatically when an invoice is issued (rate from the
    doctor's salary profile). Admin approves, then marks paid — which books an expense. */
export function CommissionsBoard({ commissions }: { commissions: CommissionRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; reason?: string }>, msg: string) {
    setErr(null);
    start(async () => {
      try {
        const r = await fn();
        if (!r.ok) { setErr(r.reason ?? "تعذّر"); return; }
        setFlash(msg); setTimeout(() => setFlash(null), 2500); router.refresh();
      } catch { setErr("تعذّر الاتصال"); }
    });
  }

  const pendingSum = commissions.filter((c) => c.status === "pending").reduce((s, c) => s + c.amount, 0);
  const approvedSum = commissions.filter((c) => c.status === "approved").reduce((s, c) => s + c.amount, 0);

  return (
    <div className="panel" style={{ padding: "1.25rem" }}>
      <div className="section-title mb-1">
        <Coins className="w-3.5 h-3.5" style={{ color: "var(--accent-1)" }} />
        <h2>عمولات الأطباء</h2>
      </div>
      <p className="text-[11px] mb-4" style={{ color: "var(--text-4)" }}>
        تُحتسب تلقائياً عند إصدار الفاتورة حسب نسبة العمولة في ملف راتب الطبيب — اعتمدها ثم اصرفها (تُسجَّل كمصروف)
      </p>

      {flash && <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3" style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}><CheckCircle2 className="w-4 h-4" /> {flash}</div>}
      {err && <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3" style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#fda4b4" }}><AlertTriangle className="w-4 h-4" /> {err}</div>}

      {commissions.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: "var(--text-4)" }}>
          لا عمولات — حدّد «نسبة العمولة» في ملف راتب الطبيب، وستُحتسب تلقائياً مع كل فاتورة
        </p>
      ) : (
        <>
          <div className="flex items-center gap-5 mb-3 flex-wrap text-[12px]">
            <span style={{ color: "var(--text-3)" }}>بانتظار الاعتماد: <span className="ltr-nums font-bold" style={{ color: "#fbbf24" }}>{fmt(pendingSum)}</span> ر.ع</span>
            <span style={{ color: "var(--text-3)" }}>معتمدة للصرف: <span className="ltr-nums font-bold" style={{ color: "var(--accent-1)" }}>{fmt(approvedSum)}</span> ر.ع</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--hairline)" }}>
                  {["الطبيب", "النسبة", "المبلغ", "الحالة", ""].map((h) => (
                    <th key={h} className="text-start px-2.5 py-2.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--text-4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => {
                  const st = STATUS[c.status];
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                      <td className="px-2.5 py-2.5 font-bold text-white">{c.doctor_name}</td>
                      <td className="px-2.5 py-2.5 ltr-nums" style={{ color: "var(--text-3)" }}>{c.rate}%</td>
                      <td className="px-2.5 py-2.5 font-bold ltr-nums text-white">{fmt(c.amount)}</td>
                      <td className="px-2.5 py-2.5">
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${st.color}1a`, color: st.color, border: `1px solid ${st.color}44` }}>
                          <span className="w-1 h-1 rounded-full" style={{ background: st.color }} />{st.label}
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5">
                        <div className="flex items-center gap-1 justify-end">
                          {c.status === "pending" && (
                            <>
                              <button title="اعتماد" disabled={pending} onClick={() => run(() => approveCommission(c.id), "اعتُمدت العمولة")}
                                className="w-7 h-7 rounded-lg inline-flex items-center justify-center"
                                style={{ background: "rgb(var(--accent-1-rgb) / 0.14)", border: "1px solid rgb(var(--accent-1-rgb) / 0.33)", color: "var(--accent-1)" }}>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              </button>
                              <button title="حذف" disabled={pending} onClick={() => run(() => deleteCommission(c.id), "حُذفت العمولة")}
                                className="w-7 h-7 rounded-lg inline-flex items-center justify-center"
                                style={{ background: "rgba(244,63,94,0.08)", border: "1px solid rgba(244,63,94,0.2)", color: "#fda4b4" }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {c.status === "approved" && (
                            <button title="صرف" disabled={pending} onClick={() => run(() => payCommission(c.id), "صُرفت العمولة وسُجّلت كمصروف")}
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg"
                              style={{ background: "rgb(var(--accent-1-rgb) / 0.14)", border: "1px solid rgb(var(--accent-1-rgb) / 0.33)", color: "var(--accent-1)" }}>
                              <Banknote className="w-3.5 h-3.5" /> صرف
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
