"use client";

import { BarChart, Bar, XAxis, Cell, ResponsiveContainer, Tooltip } from "recharts";

export type DayBar = { day: string; total: number; completed: number; isToday: boolean };

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl px-3 py-2 text-xs"
      style={{
        background: "#0D0A04",
        border: "1px solid rgba(20,184,166,0.18)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
      }}
    >
      <p className="font-bold text-white mb-1">{label}</p>
      <p className="ltr-nums" style={{ color: "#5dd9cb" }}>
        إجمالي: <strong>{payload[0]?.value ?? 0}</strong>
      </p>
      <p className="ltr-nums" style={{ color: "#14b8a6" }}>
        مكتمل: <strong>{payload[0]?.payload?.completed ?? 0}</strong>
      </p>
    </div>
  );
}

export function WeekBars({ data }: { data: DayBar[] }) {
  return (
    <ResponsiveContainer width="100%" height={72}>
      <BarChart data={data} barSize={16} barCategoryGap="30%">
        <XAxis
          dataKey="day"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#374151", fontSize: 9, fontWeight: 700 }}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(20,184,166,0.04)", radius: 4 }}
        />
        <Bar dataKey="total" radius={[5, 5, 2, 2]}>
          {data.map((d, i) => (
            <Cell
              key={i}
              fill={
                d.isToday
                  ? "#14b8a6"
                  : d.total === 0
                  ? "rgba(255,255,255,0.04)"
                  : "rgba(20,184,166,0.28)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
