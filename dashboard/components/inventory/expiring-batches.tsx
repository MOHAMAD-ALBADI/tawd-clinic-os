"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Trash2, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { writeOffBatch } from "@/app/actions/inventory";

export type ExpiringBatch = {
  id: string;
  name: string;
  batchNumber: string | null;
  qty: number;
  unit: string;
  date: string;
  days: number;
};

const num = (n: number) =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 3 }).format(n);

/** Batches near or past their expiry date, with the one action that panel has
    always been missing.

    Warning that something expires and then offering no way to take it off the
    shelf leaves the clinic with two bad options: leave expired goods counted as
    stock, or correct the count as a stock-take and lose the fact that the loss
    was waste. */
export function ExpiringBatches({ batches }: { batches: ExpiringBatch[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<ExpiringBatch | null>(null);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function open(b: ExpiringBatch) {
    setErr(null);
    setTarget(b);
    /* Almost every write-off is the whole batch, so pre-fill it and let the
       rarer partial loss be the thing that needs typing. */
    setQty(String(b.qty));
    setReason(b.days <= 0 ? "منتهية الصلاحية" : "");
  }

  function submit() {
    if (!target) return;
    setErr(null);
    start(async () => {
      try {
        const r = await writeOffBatch({
          batch_id: target.id,
          qty: Number(qty),
          reason,
        });
        if (!r.ok) { setErr(r.reason); return; }
        setTarget(null);
        setFlash("سُجِّل الإتلاف وخُصم من الرصيد ✓");
        setTimeout(() => setFlash(null), 3000);
        router.refresh();
      } catch {
        setErr("تعذّر الاتصال — حاول مجدداً");
      }
    });
  }

  if (batches.length === 0) return null;

  return (
    <div className="panel" style={{ padding: "1.1rem 1.25rem", border: "1px solid rgba(251,191,36,0.22)" }}>
      <div className="section-title mb-3">
        <CalendarClock className="w-3.5 h-3.5" style={{ color: "#fbbf24" }} />
        <h2>دفعات تقترب من الانتهاء</h2>
      </div>

      {flash && (
        <div className="flex items-center gap-2 text-[13px] px-4 py-2.5 rounded-xl mb-3"
          style={{ background: "rgb(var(--accent-1-rgb) / 0.1)", border: "1px solid rgb(var(--accent-1-rgb) / 0.25)", color: "var(--accent-1)" }}>
          <CheckCircle2 className="w-4 h-4" /> {flash}
        </div>
      )}

      <div className="space-y-1.5">
        {batches.map((b) => (
          <div key={b.id} className="flex items-center justify-between gap-3 text-[12px] px-3 py-2 rounded-xl"
            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid var(--hairline)" }}>
            <span className="font-bold text-white min-w-0 truncate">
              {b.name}
              {b.batchNumber && (
                <span className="font-normal ms-1.5" style={{ color: "var(--text-4)" }}>#{b.batchNumber}</span>
              )}
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span style={{ color: "var(--text-3)" }} className="ltr-nums">
                {num(b.qty)} {b.unit} · تنتهي {b.date}{" "}
                <span style={{ color: b.days <= 14 ? "#fda4b4" : "#fbbf24" }}>
                  ({b.days <= 0 ? "منتهية" : `خلال ${b.days} يوم`})
                </span>
              </span>
              <button className="btn-ghost" title="تسجيل إتلاف" onClick={() => open(b)}>
                <Trash2 className="w-3.5 h-3.5" style={{ color: "#fda4b4" }} />
              </button>
            </span>
          </div>
        ))}
      </div>

      {target && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="w-full glass" style={{ maxWidth: 420, borderRadius: "1.25rem", padding: "1.5rem" }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[15px] font-black text-white">تسجيل إتلاف</h3>
              <button className="btn-ghost" onClick={() => setTarget(null)}><X className="w-4 h-4" /></button>
            </div>

            <p className="text-[12px] mb-4" style={{ color: "var(--text-3)" }}>
              {target.name}
              {target.batchNumber && ` · دفعة #${target.batchNumber}`}
              {" · "}
              <span className="ltr-nums">المتبقي {num(target.qty)} {target.unit}</span>
            </p>

            <label className="text-[11px] font-semibold block mb-1.5" style={{ color: "var(--text-3)" }}>
              الكمية التالفة *
            </label>
            <input className="field ltr-nums" type="text" inputMode="decimal" dir="ltr"
              value={qty} onChange={(e) => setQty(e.target.value)} />

            <label className="text-[11px] font-semibold block mb-1.5 mt-3" style={{ color: "var(--text-3)" }}>
              السبب
            </label>
            <input className="field" value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="منتهية الصلاحية / كسر / تلف تخزين" />

            <p className="text-[11px] mt-3" style={{ color: "var(--text-4)" }}>
              يُخصم من رصيد الصنف ويُسجَّل في حركة المخزون كـ«إتلاف» — لا يُحسب جرداً.
            </p>

            {err && (
              <p className="flex items-center gap-1.5 text-[12px] mt-2" style={{ color: "#fda4b4" }}>
                <AlertTriangle className="w-3.5 h-3.5" /> {err}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 mt-4">
              <button className="btn-ghost" onClick={() => setTarget(null)}>إلغاء</button>
              <button className="btn-primary" disabled={pending || !(Number(qty) > 0)} onClick={submit}>
                <Trash2 className="w-4 h-4" /> {pending ? "جارٍ…" : "تسجيل الإتلاف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
