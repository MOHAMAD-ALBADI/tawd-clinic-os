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
        className="col-span-12 lg:col-span-7 relative rounded-3xl overflow-hidden flex flex-col justify-between"
        style={{
          background: "linear-gradient(145deg, rgba(16,185,129,0.09) 0%, rgba(10,13,22,0.96) 55%, rgba(10,13,22,1) 100%)",
          border: "1px solid rgba(16,185,129,0.18)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.03), 0 24px 60px rgba(0,0,0,0.45)",
          padding: "1.6rem 1.9rem", minHeight: 220,
        }}
      >
        <div className="absolute pointer-events-none" style={{ width: 420, height: 420, borderRadius: "50%", background: "radial-gradient(circle, rgba(16,185,129,0.09) 0%, transparent 60%)", top: -160, insetInlineStart: -60 }} />
        <div className="relative flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(16,185,129,0.14)", border: "1px solid rgba(16,185,129,0.25)" }}>
            <Sparkles className="w-4 h-4" style={{ color: "#34D399" }} />
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-wide" style={{ color: "rgba(52,211,153,0.75)" }}>استردّت لك سُرى هذا الشهر</p>
            <p className="text-[10px]" style={{ color: "rgba(148,163,184,0.45)" }}>مواعيد ملغاة أُعيد ملؤها تلقائياً</p>
          </div>
        </div>

        <div className="relative mt-auto pt-4">
          <div className="flex items-end gap-2">
            <span className="font-black ltr-nums leading-none" style={{ fontSize: "clamp(2.6rem, 6vw, 4rem)", color: "#34D399", textShadow: "0 0 60px rgba(16,185,129,0.4)", letterSpacing: "-0.03em" }}>
              {fmt(n)}
            </span>
            <span className="font-bold mb-2 text-lg" style={{ color: "rgba(52,211,153,0.6)" }}>ر.ع</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ background: "rgba(16,185,129,0.12)", color: "#34D399" }}>
              <TrendingUp className="w-3 h-3" /> {count} موعد مسترجَع
            </div>
            <span className="text-[11px]" style={{ color: "rgba(148,163,184,0.45)" }}>بدون أي جهد من الاستقبال</span>
          </div>
        </div>
      </div>

      {/* Waitlist */}
      <div
        className="col-span-12 lg:col-span-5 rounded-3xl overflow-hidden"
        style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", padding: "1.25rem 1.4rem" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock3 className="w-4 h-4" style={{ color: "#5dd9cb" }} />
            <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: "rgba(148,163,184,0.4)" }}>قائمة الانتظار</p>
          </div>
          <span className="font-black ltr-nums text-lg" style={{ color: "#5dd9cb" }}>{waitlist.length}</span>
        </div>
        {waitlist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <UserPlus className="w-7 h-7" style={{ color: "rgba(148,163,184,0.25)" }} />
            <p className="text-xs" style={{ color: "rgba(148,163,184,0.4)" }}>لا أحد بالانتظار</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {waitlist.slice(0, 5).map((w) => (
              <div key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: "linear-gradient(135deg,#14b8a6,#0d9488)" }}>{w.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-white truncate">{w.name}</p>
                  <p className="text-[11px]" style={{ color: "rgba(148,163,184,0.5)" }}>{w.service ?? "أي خدمة"}</p>
                </div>
                <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.4)" }}>{w.waitingFor}</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] mt-3 text-center" style={{ color: "rgba(148,163,184,0.35)" }}>
          عند أي إلغاء، سُرى تعرض الموعد على هؤلاء تلقائياً
        </p>
      </div>
    </div>
  );
}
