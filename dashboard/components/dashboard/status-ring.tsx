"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export type StatusSlice = { name: string; value: number; color: string };

export function StatusRing({ data, total }: { data: StatusSlice[]; total: number }) {
  const isEmpty = total === 0;
  const chartData = isEmpty
    ? [{ name: "empty", value: 1, color: "rgba(255,255,255,0.05)" }]
    : data.filter((d) => d.value > 0);

  return (
    <div className="relative flex items-center justify-center" style={{ height: 150 }}>
      {/* quiet track behind the data band */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 128, height: 128,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      />
      <ResponsiveContainer width={150} height={150}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%" cy="50%"
            innerRadius={57} outerRadius={68}
            paddingAngle={isEmpty ? 0 : 3}
            dataKey="value"
            stroke="#0a0a0b"
            strokeWidth={2}
            cornerRadius={6}
            startAngle={90} endAngle={-270}
          >
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <p
          className="font-bold ltr-nums leading-none"
          style={{
            fontSize: "1.9rem",
            color: isEmpty ? "rgba(255,255,255,0.14)" : "#ffffff",
          }}
        >
          {total}
        </p>
        <p className="text-[10px] font-semibold mt-0.5" style={{ color: "var(--text-4)" }}>
          موعد اليوم
        </p>
      </div>
    </div>
  );
}
