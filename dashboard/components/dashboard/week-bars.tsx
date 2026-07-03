"use client";

import { BarChart, Bar, XAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";

export type DayBar = { day: string; total: number; completed: number; isToday: boolean };

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        background: "#131315",
        border: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
      }}
    >
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="ltr-nums" style={{ color: "var(--text-2)" }}>
        إجمالي: <strong style={{ color: "#fff" }}>{payload[0]?.value ?? 0}</strong>
      </p>
      <p className="ltr-nums" style={{ color: "var(--text-2)" }}>
        مكتمل: <strong style={{ color: "#fff" }}>{payload[0]?.payload?.completed ?? 0}</strong>
      </p>
    </div>
  );
}

export function WeekBars({ data }: { data: DayBar[] }) {
  return (
    <ResponsiveContainer width="100%" height={72}>
      <BarChart data={data} barSize={14} barCategoryGap="30%">
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#52525b", fontSize: 9, fontWeight: 700 }}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(255,255,255,0.03)", radius: 4 }}
        />
        {/* rounded data-end, anchored baseline */}
        <Bar dataKey="total" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                d.isToday
                  ? "var(--accent-1)"
                  : d.total === 0
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(255,255,255,0.16)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
