"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Lock, Scale } from "lucide-react";
import { closeDay } from "@/app/actions/accountant";

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function DayCloseForm({
  systemCash,
  systemCard,
}: {
  systemCash: number;
  systemCard: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openingFloat, setOpeningFloat] = useState("0");
  const [countedCash, setCountedCash] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<{ variance: number; expectedCash: number } | null>(null);

  const expected = Number(openingFloat || 0) + systemCash;
  const liveVariance = countedCash === "" ? null : Number(countedCash) - expected;

  function submit() {
    if (countedCash === "") { alert("أدخل الكاش المعدود فعلياً"); return; }
    start(async () => {
      try {
        const r = await closeDay({
          openingFloat: Number(openingFloat || 0),
          countedCash: Number(countedCash),
          notes,
        });
        setResult({ variance: r.variance, expectedCash: r.expectedCash });
        router.refresh();
      } catch (e) { alert(e instanceof Error ? e.message : "حدث خطأ"); }
    });
  }

  return (
    <div className="panel" style={{ padding: "1.5rem", maxWidth: 560 }}>
      <h3 className="font-bold text-white flex items-center gap-2 text-sm mb-1">
        <Scale className="w-4 h-4" style={{ color: "var(--accent-1)" }} />
        مطابقة الصندوق
      </h3>
      <p className="text-[11px] mb-5" style={{ color: "var(--text-3)" }}>
        عُدّ الكاش في الدرج وأدخله — النظام يحسب الفرق تلقائياً
      </p>

      {/* system side */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] mb-1" style={{ color: "var(--text-4)" }}>كاش النظام اليوم</p>
          <p className="text-base font-bold ltr-nums text-white">{fmt(systemCash)}</p>
        </div>
        <div className="rounded-xl px-3 py-2.5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-[10px] mb-1" style={{ color: "var(--text-4)" }}>شبكة/تحويل النظام</p>
          <p className="text-base font-bold ltr-nums text-white">{fmt(systemCard)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الرصيد الافتتاحي (فكّة الصباح)</label>
            <input type="number" step="0.001" min="0" value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)} className="field ltr-nums" dir="ltr" />
          </div>
          <div>
            <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>الكاش المعدود فعلياً *</label>
            <input type="number" step="0.001" min="0" value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)} className="field ltr-nums" dir="ltr" placeholder="0.000" />
          </div>
        </div>

        {/* live variance preview */}
        <div className="rounded-xl px-4 py-3 flex items-center justify-between"
          style={{
            background: liveVariance === null ? "rgba(255,255,255,0.025)"
              : Math.abs(liveVariance) < 0.001 ? "rgba(45,212,191,0.07)"
              : "rgba(244,63,94,0.06)",
            border: `1px solid ${liveVariance === null ? "rgba(255,255,255,0.06)"
              : Math.abs(liveVariance) < 0.001 ? "rgba(45,212,191,0.25)"
              : "rgba(244,63,94,0.25)"}`,
          }}>
          <span className="text-[12px]" style={{ color: "var(--text-2)" }}>
            المتوقع بالدرج: <span className="font-bold ltr-nums text-white">{fmt(expected)}</span>
          </span>
          {liveVariance !== null && (
            <span className="text-[13px] font-bold ltr-nums"
              style={{ color: Math.abs(liveVariance) < 0.001 ? "#5dd9cb" : "#fda4b4" }}>
              {Math.abs(liveVariance) < 0.001 ? "مطابق ✓" : `${liveVariance > 0 ? "زيادة +" : "عجز "}${fmt(Math.abs(liveVariance))}`}
            </span>
          )}
        </div>

        <div>
          <label className="text-[11px] font-semibold block mb-1" style={{ color: "var(--text-3)" }}>ملاحظات (اختياري)</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className="field" placeholder="سبب الفرق إن وجد…" />
        </div>

        <button onClick={submit} disabled={pending} className="btn-primary w-full">
          <Lock className="w-4 h-4" />
          {pending ? "جارٍ الإغلاق…" : result ? "تحديث الإغلاق" : "إغلاق اليوم"}
        </button>

        {result && (
          <p className="text-[12px] text-center" style={{ color: Math.abs(result.variance) < 0.001 ? "#5dd9cb" : "#fcd34d" }}>
            أُغلق اليوم — {Math.abs(result.variance) < 0.001 ? "الصندوق مطابق تماماً ✓" : `الفرق المسجّل: ${fmt(result.variance)} ر.ع`}
          </p>
        )}
      </div>
    </div>
  );
}
