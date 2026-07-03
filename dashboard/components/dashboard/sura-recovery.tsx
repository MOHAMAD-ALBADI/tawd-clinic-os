"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Clock3, TrendingUp, UserPlus } from "lucide-react";

type WaitItem = { id: string; name: string; service: string | null; waitingFor: string };

export function SuraRecoveryPanel({
  recovered, count, waitlist,
}: {
  recovered: number;
  count: number;
  waitlist: WaitItem[];
}) {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const target = recovered;
    const dur = 1400;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [recovered]);

  const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  return (
    <div className="grid grid-cols-12 gap-4">
      {/* ROI counter — the selling piece */}
      <div
        className="col-span-12 lg:col-span-7 panel-feature relative overflow-hidden flex flex-col justify-between"
        style={{ padding: "1.6rem 1.9rem", minHeight: 220 }}
      >
        <div className="relative flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(45,212,191,0.1)", border: "1px solid rgba(45,212,191,0.22)" }}>
            <Sparkles className="w-4 h-4" style={{ color: "#2dd4bf" }} />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wide" style={{ color: "var(--text-1)" }}>استردّت لك سُرى هذا الشهر</p>
            <p className="text-[10px]" style={{ color: "var(--text-3)" }}>مواعيد ملغاة أُعيد ملؤها تلقائياً</p>
          </div>
        </div>

        <div className="relative mt-auto pt-4">
          <div className="flex items-end gap-2">
            <span className="font-bold ltr-nums leading-none text-white" style={{ fontSize: "clamp(2.4rem, 5.5vw, 3.6rem)", letterSpacing: "-0.03em" }}>
              {fmt(n)}
            </span>
            <span className="font-bold mb-1.5 text-lg" style={{ color: "var(--text-3)" }}>ر.ع</span>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="badge badge-ok">
              <TrendingUp className="w-3 h-3" /> {count} موعد مسترجَع
            </span>
            <span className="text-[11px]" style={{ color: "var(--text-3)" }}>بدون أي جهد من الاستقبال</span>
          </div>
        </div>
      </div>

      {/* Waitlist */}
      <div className="col-span-12 lg:col-span-5 panel overflow-hidden" style={{ padding: "1.25rem 1.4rem" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock3 className="w-4 h-4" style={{ color: "var(--text-3)" }} />
            <p className="eyebrow">قائمة الانتظار</p>
          </div>
          <span className="font-bold ltr-nums text-lg text-white">{waitlist.length}</span>
        </div>
        {waitlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <UserPlus className="w-7 h-7" style={{ color: "var(--text-4)" }} />
            <p className="text-xs" style={{ color: "var(--text-3)" }}>لا أحد بالانتظار</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {waitlist.slice(0, 5).map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff" }}>{w.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{w.name}</p>
                  <p className="text-[11px]" style={{ color: "var(--text-3)" }}>{w.service ?? "أي خدمة"}</p>
                </div>
                <span className="text-[10px]" style={{ color: "var(--text-4)" }}>{w.waitingFor}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] mt-3 text-center" style={{ color: "var(--text-4)" }}>
          عند أي إلغاء، سُرى تعرض الموعد على هؤلاء تلقائياً
        </p>
      </div>
    </div>
  );
}
