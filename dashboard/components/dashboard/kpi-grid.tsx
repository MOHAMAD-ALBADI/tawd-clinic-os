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
  color: string;
  glow: string;
  border: string;
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
          className="relative rounded-2xl overflow-hidden"
          style={{
            background: `linear-gradient(145deg, ${k.glow} 0%, rgba(10,13,22,0.85) 100%)`,
            border: `1px solid ${k.border}`,
            padding: "1.25rem 1.4rem",
            transition: "border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = `${k.color}35`;
            e.currentTarget.style.boxShadow = `0 8px 40px ${k.glow}, 0 0 0 1px ${k.color}18`;
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = k.border;
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div className="flex items-start justify-between mb-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] leading-tight" style={{ color: "rgba(148,163,184,0.35)" }}>
              {k.label}
            </p>
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${k.color}18`, border: `1px solid ${k.color}28` }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: k.color }} />
            </div>
          </div>
          <p
            className="font-black ltr-nums leading-none"
            style={{
              fontSize: typeof k.value === "string" ? "1.5rem" : "2.6rem",
              color: k.color,
              textShadow: `0 0 30px ${k.color}50`,
              letterSpacing: "-0.03em",
            }}
          >
            {k.value}
          </p>
          <p className="text-[11px] mt-1.5 mb-3" style={{ color: "rgba(148,163,184,0.3)" }}>
            {k.sub}
          </p>
          <div className="flex justify-end">
            <SparkLine data={k.spark} color={k.color} width={72} height={30} />
          </div>
        </div>
        );
      })}
    </div>
  );
}
