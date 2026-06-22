"use client";

export interface BarRow {
  label: string;
  current: number | string;
  last: number | string;
  currentNum: number;
  lastNum: number;
  color: string;
}

export function ComparisonBars({ rows }: { rows: BarRow[] }) {
  const maxVal = Math.max(...rows.map((r) => Math.max(r.currentNum, r.lastNum)), 1);

  return (
    <div className="space-y-6">
      {rows.map((row) => {
        const curW = (row.currentNum / maxVal) * 100;
        const lasW = (row.lastNum / maxVal) * 100;
        return (
          <div key={row.label}>
            <div className="flex items-center justify-between mb-2.5">
              <span
                className="text-[11px] font-bold uppercase tracking-[0.14em]"
                style={{ color: "rgba(148,163,184,0.4)" }}
              >
                {row.label}
              </span>
              <div className="flex items-center gap-4">
                <span className="text-[12px] font-black ltr-nums" style={{ color: row.color }}>
                  {row.current}
                </span>
                <span className="text-[11px] font-medium ltr-nums" style={{ color: "rgba(148,163,184,0.3)" }}>
                  {row.last}
                </span>
              </div>
            </div>

            {/* Current month bar */}
            <div
              className="rounded-full overflow-hidden mb-1.5"
              style={{ height: 7, background: "rgba(255,255,255,0.04)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${curW}%`,
                  background: `linear-gradient(90deg, ${row.color}60, ${row.color})`,
                  boxShadow: `0 0 8px ${row.color}40`,
                  minWidth: row.currentNum > 0 ? 6 : 0,
                }}
              />
            </div>

            {/* Last month bar — dimmer */}
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 4, background: "rgba(255,255,255,0.03)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${lasW}%`,
                  background: "rgba(148,163,184,0.15)",
                  minWidth: row.lastNum > 0 ? 4 : 0,
                }}
              />
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="flex items-center gap-5 pt-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-1.5 rounded-full" style={{ background: "rgba(20,184,166,0.7)" }} />
          <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.35)" }}>هذا الشهر</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 rounded-full" style={{ background: "rgba(148,163,184,0.18)" }} />
          <span className="text-[10px]" style={{ color: "rgba(148,163,184,0.35)" }}>الشهر الماضي</span>
        </div>
      </div>
    </div>
  );
}
