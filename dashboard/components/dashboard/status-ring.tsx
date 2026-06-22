"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

export type StatusSlice = { name: string; value: number; color: string };

export function StatusRing({ data, total }: { data: StatusSlice[]; total: number }) {
  const isEmpty = total === 0;
  const chartData = isEmpty
    ? [{ name: "empty", value: 1, color: "rgba(255,255,255,0.04)" }]
    : data.filter((d) => d.value > 0);

  return (
    <div className="relative flex items-center justify-center" style={{ height: 160 }}>
      {!isEmpty && (
        <div
          className="absolute rounded-full pointer-events-none"
          style={{
            width: 148, height: 148,
            background: "radial-gradient(circle, rgba(20,184,166,0.08) 0%, transparent 70%)",
          }}
        />
      )}

      <ResponsiveContainer width={160} height={160}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%" cy="50%"
            innerRadius={52} outerRadius={72}
            paddingAngle={isEmpty ? 0 : 3}
            dataKey="value"
            stroke="none"
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
          className="font-black ltr-nums leading-none"
          style={{
            fontSize: "2.25rem",
            color: isEmpty ? "#1C1408" : "white",
            textShadow: isEmpty ? "none" : "0 0 20px rgba(20,184,166,0.15)",
          }}
        >
          {total}
        </p>
        <p className="text-[10px] font-semibold mt-0.5" style={{ color: "#374151" }}>
          موعد اليوم
        </p>
      </div>
    </div>
  );
}
