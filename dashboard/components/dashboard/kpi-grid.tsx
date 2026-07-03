"use client";

import { SparkLine } from "./spark-line";
import { Calendar, UserPlus, Banknote, Bot, Activity, Star, TrendingUp, Clock } from "lucide-react";

const ICON_MAP = {
  Calendar, UserPlus, Banknote, Bot, Activity, Star, TrendingUp, Clock,
} as const;

export type KpiIconName = keyof typeof ICON_MAP;

export type KpiItem = {
  label: string;
  value: string | number;
  sub: string;
  /** meaning marker — tints ONLY the icon; the number stays white */
  color: string;
  glow: string;   // kept for API compatibility (unused)
  border: string; // kept for API compatibility (unused)
  spark: number[];
  iconName: KpiIconName;
};

export function KpiGrid({ items }: { items: KpiItem[] }) {
  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
      {items.map((k) => {
        const Icon = ICON_MAP[k.iconName];
        return (
          <div
            key={k.label}
            className="panel panel-hover relative overflow-hidden"
            style={{ padding: "1.25rem 1.4rem" }}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="eyebrow leading-tight">{k.label}</p>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
              </div>
            </div>
            <p
              className="font-bold ltr-nums leading-none text-white"
              style={{ fontSize: typeof k.value === "string" ? "1.45rem" : "2.4rem" }}
            >
              {k.value}
            </p>
            <p className="text-[11px] mt-1.5 mb-3" style={{ color: "var(--text-3)" }}>
              {k.sub}
            </p>
            <div className="flex justify-end">
              <SparkLine data={k.spark} color="rgba(255,255,255,0.35)" width={72} height={28} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
