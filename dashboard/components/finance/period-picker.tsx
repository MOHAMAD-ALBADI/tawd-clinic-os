"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { CalendarRange, X } from "lucide-react";
import { PERIOD_CHOICES, periodLabel, type PeriodKey } from "@/lib/period";

/** Which window every figure below is measured over.

    Written into the URL, not into state: a period is a thing an accountant sends
    to somebody. It also survives the refresh that follows every action on these
    screens, which component state would not. */
export function PeriodPicker({
  active, from, to, label,
}: {
  active: PeriodKey;
  from: string | null;
  to: string | null;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [open, setOpen] = useState(active === "custom");
  /* `to` arrives exclusive; the input shows the last day actually included. */
  const [f, setF] = useState(from ?? "");
  const [t, setT] = useState(to ? shiftBack(to) : "");

  function go(next: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null) params.delete(k); else params.set(k, v);
    }
    /* Any change of window invalidates a page cursor, and leaving one behind
       lands the reader on page 4 of a list that now has one page. */
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {PERIOD_CHOICES.map((k) => {
        const on = active === k;
        return (
          <button key={k}
            onClick={() => { setOpen(false); go({ period: k, from: null, to: null }); }}
            className="text-[12px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
            style={{
              background: on ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
              border: `1px solid ${on ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
              color: on ? "var(--accent-1)" : "var(--text-3)",
            }}>
            {periodLabel(k)}
          </button>
        );
      })}

      <button onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
        style={{
          background: active === "custom" ? "rgb(var(--accent-1-rgb) / 0.12)" : "rgba(255,255,255,0.025)",
          border: `1px solid ${active === "custom" ? "rgb(var(--accent-1-rgb) / 0.32)" : "var(--hairline)"}`,
          color: active === "custom" ? "var(--accent-1)" : "var(--text-3)",
        }}>
        <CalendarRange className="w-3.5 h-3.5" />
        {active === "custom" ? label : "فترة محدّدة"}
      </button>

      {open && (
        <div className="flex items-center gap-1.5 flex-wrap px-2.5 py-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--hairline)" }}>
          <input type="date" value={f} onChange={(e) => setF(e.target.value)}
            className="field ltr-nums" dir="ltr" style={{ width: 150, padding: "0.3rem 0.5rem" }} />
          <span className="text-[12px]" style={{ color: "var(--text-4)" }}>→</span>
          <input type="date" value={t} onChange={(e) => setT(e.target.value)}
            className="field ltr-nums" dir="ltr" style={{ width: 150, padding: "0.3rem 0.5rem" }} />
          <button className="btn-primary" style={{ padding: "0.3rem 0.7rem", fontSize: "12px" }}
            disabled={!f && !t}
            onClick={() => go({ period: null, from: f || null, to: t || null })}>
            تطبيق
          </button>
          <button className="btn-ghost" style={{ padding: "0.3rem 0.5rem" }}
            onClick={() => { setOpen(false); setF(""); setT(""); go({ period: "month", from: null, to: null }); }}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function shiftBack(exclusiveEnd: string): string {
  const t = new Date(`${exclusiveEnd}T00:00:00.000Z`).getTime() - 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}
